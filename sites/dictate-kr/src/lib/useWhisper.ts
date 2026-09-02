"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachWorker } from "./worker";
import { detectWebGPU, isMobile } from "./capability";
import { planSegments } from "./dsp";
import {
  type Device,
  type Dtype,
  type Language,
  type ModelKey,
  defaultModelKey,
  languageArg,
  modelByKey,
  pickBackend,
} from "./models";
import type { Segment } from "./transcript";

export type Phase = "idle" | "loading" | "running" | "done" | "error";

export type EngineState = {
  phase: Phase;
  /** 0~100 */
  progress: number;
  label: string;
  stage: string;
  error: string | null;
  /** WebGPU → WASM 자동 강등 같은 알림 */
  notice: string | null;
  device: Device | null;
  dtype: Dtype | null;
  /** 이번 세션에서 실제로 내려받은 모델 바이트 (측정값) */
  bytes: number | null;
  elapsedMs: number | null;
  audioSec: number | null;
  ready: boolean;
};

const initialState: EngineState = {
  phase: "idle",
  progress: 0,
  label: "",
  stage: "",
  error: null,
  notice: null,
  device: null,
  dtype: null,
  bytes: null,
  elapsedMs: null,
  audioSec: null,
  ready: false,
};

export type RunResult = {
  segments: Segment[];
  elapsedMs: number;
  audioSec: number;
  bytes: number;
  aborted: boolean;
};

export type RunOptions = {
  pcm: Float32Array;
  sampleRate: number;
  modelKey: ModelKey;
  language: Language;
  /** 결과 타임스탬프에 더할 오프셋(초) — 실시간 이어붙이기용 */
  offsetSec?: number;
  /** 이미 쌓인 결과에 이어 붙일지 */
  append?: boolean;
  /** 조각 최대 길이(초). Whisper 수용 한계인 30초가 기본. */
  maxSec?: number;
  timestamps?: boolean;
};

let reqCounter = 0;

/**
 * Whisper 워커 한 개를 컴포넌트 수명에 묶어 관리한다.
 * 워커는 첫 실행 때 만들고, 언마운트 시 종료한다.
 */
export function useWhisper() {
  const [state, setState] = useState<EngineState>(initialState);
  const [segments, setSegmentsRaw] = useState<Segment[]>([]);
  /**
   * 실시간 모드는 워커 콜백·MediaRecorder 콜백 안에서 결과를 이어 붙인다.
   * 그 콜백들은 녹음 시작 시점의 클로저를 붙잡고 있어 state 값이 낡는다.
   * 항상 최신 목록을 가리키는 ref 를 따로 두고, run() 은 이쪽만 읽는다.
   */
  const segmentsRef = useRef<Segment[]>([]);
  const setSegments = useCallback((next: Segment[] | ((prev: Segment[]) => Segment[])) => {
    setSegmentsRaw((prev) => {
      const v = typeof next === "function" ? (next as (p: Segment[]) => Segment[])(prev) : next;
      segmentsRef.current = v;
      return v;
    });
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const pendingRef = useRef<{
    reqId: number;
    resolve: (r: RunResult) => void;
    reject: (e: Error) => void;
    offset: number;
    append: boolean;
    base: Segment[];
  } | null>(null);
  const busyRef = useRef(false);

  const caps = useMemo(() => {
    if (typeof window === "undefined") {
      return { webgpu: false, mobile: false, backend: { device: "wasm" as Device, dtype: "q8" as Dtype } };
    }
    const webgpu = detectWebGPU();
    return { webgpu, mobile: isMobile(), backend: pickBackend(webgpu) };
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), {
      type: "module",
      name: "whisper",
    });

    // 공용 규약(progress/done/error)은 attachWorker 가 처리한다.
    const detach = attachWorker(w, {
      onProgress: (value, label) =>
        setState((s) => ({ ...s, progress: value, label: label ?? s.label })),
      onDone: (value) => {
        const v = (value ?? {}) as {
          reqId?: number;
          kind?: string;
          segments?: Segment[];
          elapsedMs?: number;
          audioSec?: number;
          bytes?: number;
          device?: Device;
          dtype?: Dtype;
        };
        busyRef.current = false;
        if (v.kind === "load") {
          setState((s) => ({
            ...s,
            phase: "idle",
            ready: true,
            progress: 100,
            label: "모델 준비 완료",
            bytes: v.bytes ?? s.bytes,
          }));
          return;
        }
        const p = pendingRef.current;
        pendingRef.current = null;
        const produced = (v.segments ?? []).map((x) => ({ ...x, start: x.start + (p?.offset ?? 0), end: x.end + (p?.offset ?? 0) }));
        const next = p?.append ? [...(p.base ?? []), ...produced] : produced;
        setSegments(next);
        setState((s) => ({
          ...s,
          phase: "done",
          ready: true,
          progress: 100,
          label: v.kind === "aborted" ? "중단됨" : "완료",
          elapsedMs: v.elapsedMs ?? s.elapsedMs,
          audioSec: v.audioSec ?? s.audioSec,
          bytes: v.bytes ?? s.bytes,
          device: v.device ?? s.device,
          dtype: v.dtype ?? s.dtype,
        }));
        p?.resolve({
          segments: next,
          elapsedMs: v.elapsedMs ?? 0,
          audioSec: v.audioSec ?? 0,
          bytes: v.bytes ?? 0,
          aborted: v.kind === "aborted",
        });
      },
      onError: (message) => {
        busyRef.current = false;
        const p = pendingRef.current;
        pendingRef.current = null;
        setState((s) => ({ ...s, phase: "error", error: message }));
        p?.reject(new Error(message));
      },
    });

    // 이 워커 전용 추가 메시지(부분 결과 · 단계 · 강등 알림)
    const extra = (e: MessageEvent) => {
      const msg = e.data as { type?: string; value?: unknown };
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "stage") {
        setState((s) => ({ ...s, stage: String(msg.value ?? "") }));
      } else if (msg.type === "fallback") {
        const v = msg.value as { to?: string };
        setState((s) => ({
          ...s,
          device: "wasm",
          dtype: "q8",
          notice: `이 기기에서 WebGPU 를 쓸 수 없어 WebAssembly(${v?.to ?? "wasm/q8"})로 전환했습니다. 처리 속도가 느려질 수 있습니다.`,
        }));
      } else if (msg.type === "partial") {
        const v = msg.value as { all?: Segment[]; processedSec?: number; totalSec?: number };
        const p = pendingRef.current;
        const offset = p?.offset ?? 0;
        const shifted = (v.all ?? []).map((x) => ({ ...x, start: x.start + offset, end: x.end + offset }));
        setSegments(p?.append ? [...(p.base ?? []), ...shifted] : shifted);
      }
    };
    w.addEventListener("message", extra);

    detachRef.current = () => {
      w.removeEventListener("message", extra);
      detach(); // attachWorker 의 정리 — 리스너 해제 + terminate
    };
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => {
    return () => {
      detachRef.current?.();
      detachRef.current = null;
      workerRef.current = null;
    };
  }, []);

  /** 모델만 미리 내려받아 둔다(전사 없이). */
  const warmup = useCallback(
    (modelKey: ModelKey) => {
      const w = ensureWorker();
      const reqId = ++reqCounter;
      setState((s) => ({
        ...s,
        phase: "loading",
        error: null,
        progress: 0,
        label: "모델 준비 중",
        device: caps.backend.device,
        dtype: caps.backend.dtype,
      }));
      w.postMessage({
        cmd: "load",
        reqId,
        model: modelByKey(modelKey).id,
        device: caps.backend.device,
        dtype: caps.backend.dtype,
      });
    },
    [caps.backend, ensureWorker],
  );

  const run = useCallback(
    (opts: RunOptions): Promise<RunResult> => {
      if (busyRef.current) return Promise.reject(new Error("이미 처리 중입니다."));
      const w = ensureWorker();
      const reqId = ++reqCounter;
      busyRef.current = true;

      const plan = planSegments(opts.pcm, opts.sampleRate, { maxSec: opts.maxSec ?? 30 });
      const base = opts.append ? segmentsRef.current : [];

      setState((s) => ({
        ...s,
        phase: "running",
        error: null,
        notice: s.notice,
        progress: 0,
        label: "준비 중",
        elapsedMs: null,
        device: caps.backend.device,
        dtype: caps.backend.dtype,
      }));
      if (!opts.append) setSegments([]);

      return new Promise<RunResult>((resolve, reject) => {
        pendingRef.current = {
          reqId,
          resolve,
          reject,
          offset: opts.offsetSec ?? 0,
          append: Boolean(opts.append),
          base,
        };
        // PCM 은 복사본을 transfer 해 메인 스레드 원본을 살려 둔다(재실행·내보내기용).
        const copy = opts.pcm.slice();
        w.postMessage(
          {
            cmd: "transcribe",
            reqId,
            model: modelByKey(opts.modelKey).id,
            device: caps.backend.device,
            dtype: caps.backend.dtype,
            pcm: copy.buffer,
            sampleRate: opts.sampleRate,
            segments: plan,
            language: languageArg(opts.language),
            timestamps: opts.timestamps ?? true,
          },
          [copy.buffer],
        );
      });
    },
    [caps.backend, ensureWorker, setSegments],
  );

  const abort = useCallback(() => {
    workerRef.current?.postMessage({ cmd: "abort" });
    setState((s) => ({ ...s, label: "중단 요청됨" }));
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
    setState((s) => ({ ...initialState, ready: s.ready, device: s.device, dtype: s.dtype, bytes: s.bytes }));
  }, []);

  const dismissNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  return {
    state,
    segments,
    setSegments,
    caps,
    defaultModel: defaultModelKey(caps.mobile),
    warmup,
    run,
    abort,
    reset,
    dismissNotice,
    busy: state.phase === "running" || state.phase === "loading",
  };
}

export type WhisperApi = ReturnType<typeof useWhisper>;
