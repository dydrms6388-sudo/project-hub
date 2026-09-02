/// <reference lib="webworker" />
/**
 * Whisper 전사 워커.
 *
 * @huggingface/transformers 는 **오직 이 파일 안에서 `await import()`** 로만 불러온다.
 * 이렇게 해야 초기 번들에 섞이지 않고, 사용자가 실제로 "변환 시작"을 누른 뒤에야
 * 수백 MB 짜리 모델과 런타임을 내려받는다.
 *
 * 메인 스레드와의 규약(src/lib/worker.ts):
 *   { type: 'progress' | 'done' | 'error', value }  ← 공용 attachWorker 가 처리
 *   { type: 'partial' | 'stage' , value }           ← 이 워커 전용 추가 메시지
 */

import type { Device, Dtype } from "@/lib/models";

type PlanSegment = { start: number; end: number; startSample: number; endSample: number };

export type WhisperRequest =
  | { cmd: "load"; reqId: number; model: string; device: Device; dtype: Dtype }
  | {
      cmd: "transcribe";
      reqId: number;
      model: string;
      device: Device;
      dtype: Dtype;
      pcm: ArrayBuffer;
      sampleRate: number;
      segments: PlanSegment[];
      language: string | null;
      /** 앞 조각의 마지막 문장을 다음 조각 프롬프트로 넘길지 */
      timestamps: boolean;
    }
  | { cmd: "abort" }
  | { cmd: "free" };

export type ResultSegment = { start: number; end: number; text: string };

/* transformers.js 파이프라인의 최소 형태만 지역 타입으로 정의한다.
   동적 import 라 정적 타입을 끌어오면 초기 번들 분석에 걸릴 수 있어 의도적으로 좁게 잡는다. */
type AsrChunk = { timestamp: [number, number | null]; text: string };
type AsrOutput = { text?: string; chunks?: AsrChunk[] };
type AsrPipeline = ((
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<AsrOutput | AsrOutput[]>) & {
  dispose?: () => Promise<void>;
};

type ProgressEvent = {
  status: string;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
  progress?: number;
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: unknown) {
  ctx.postMessage(msg);
}
const progress = (value: number, label?: string) => post({ type: "progress", value, label });
const stage = (value: string) => post({ type: "stage", value });
const fail = (value: string) => post({ type: "error", value });

let loaded: { key: string; pipe: AsrPipeline } | null = null;
let aborted = false;
/** 이번 로드에서 실제로 내려받은 파일별 바이트 (진짜 측정값) */
let files = new Map<string, { loaded: number; total: number }>();

function totalBytes(): { loaded: number; total: number } {
  let l = 0;
  let t = 0;
  for (const v of files.values()) {
    l += v.loaded;
    t += v.total;
  }
  return { loaded: l, total: t };
}

function onProgressEvent(p: ProgressEvent) {
  if (!p || typeof p !== "object") return;
  const name = p.file ?? p.name ?? "model";
  if (typeof p.total === "number" && p.total > 0) {
    files.set(name, { loaded: Math.min(p.loaded ?? 0, p.total), total: p.total });
  }
  const { loaded: l, total: t } = totalBytes();
  if (t > 0) {
    progress((l / t) * 100, `모델 내려받는 중 · ${(l / 1048576).toFixed(0)} / ${(t / 1048576).toFixed(0)} MB`);
  } else if (p.status === "initiate" || p.status === "download") {
    stage("모델 파일 확인 중");
  }
}

async function getPipeline(model: string, device: Device, dtype: Dtype): Promise<AsrPipeline> {
  const key = `${model}|${device}|${dtype}`;
  if (loaded?.key === key) return loaded.pipe;

  if (loaded) {
    try {
      await loaded.pipe.dispose?.();
    } catch {
      /* 해제 실패는 무시 — 새 파이프라인 생성이 우선 */
    }
    loaded = null;
  }

  stage("엔진 불러오는 중");
  const lib = await import("@huggingface/transformers");
  const { pipeline, env } = lib;
  // 브라우저 전용: 로컬 파일 시스템 조회를 끄고, Cache API 저장은 켠 채로 둔다.
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  files = new Map();
  stage("모델 준비 중");

  const build = async (d: Device, q: Dtype) =>
    (await pipeline("automatic-speech-recognition", model, {
      device: d,
      dtype: q,
      progress_callback: onProgressEvent as unknown as undefined,
    })) as unknown as AsrPipeline;

  let pipe: AsrPipeline;
  try {
    pipe = await build(device, dtype);
  } catch (e) {
    if (device === "webgpu") {
      // WebGPU 초기화나 fp32 가중치 로드가 실패하는 기기가 있다. 조용히 멈추지 않고
      // WASM+q8 로 한 번 더 시도한 뒤, 그것도 실패하면 오류를 그대로 올린다.
      stage("WebGPU 초기화 실패 — WebAssembly(q8)로 다시 시도합니다");
      files = new Map();
      pipe = await build("wasm", "q8");
      loaded = { key: `${model}|wasm|q8`, pipe };
      post({ type: "fallback", value: { from: `${device}/${dtype}`, to: "wasm/q8", reason: String(e) } });
      return pipe;
    }
    throw e;
  }

  loaded = { key, pipe };
  return pipe;
}

function toMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) {
    return `모델 파일을 내려받지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. (${msg})`;
  }
  if (/webgpu|adapter|device lost/i.test(msg)) {
    return `GPU 초기화에 실패했습니다. 브라우저를 최신 버전으로 올리거나 다른 브라우저(크롬·엣지)에서 열어 주세요. (${msg})`;
  }
  if (/out of memory|allocation|RangeError/i.test(msg)) {
    return `메모리가 부족합니다. 더 작은 모델(tiny/base)을 고르거나, 녹음을 짧게 잘라 다시 시도해 주세요. (${msg})`;
  }
  if (/Unauthorized|401|404|not found/i.test(msg)) {
    return `모델 파일을 찾지 못했습니다. 잠시 후 다시 시도해 주세요. (${msg})`;
  }
  return msg;
}

ctx.addEventListener("message", async (event: MessageEvent<WhisperRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") return;

  if (req.cmd === "abort") {
    aborted = true;
    return;
  }

  if (req.cmd === "free") {
    try {
      await loaded?.pipe.dispose?.();
    } catch {
      /* 무시 */
    }
    loaded = null;
    return;
  }

  if (req.cmd === "load") {
    try {
      aborted = false;
      await getPipeline(req.model, req.device, req.dtype);
      const { loaded: l, total: t } = totalBytes();
      progress(100, "모델 준비 완료");
      post({ type: "done", value: { reqId: req.reqId, kind: "load", bytes: l, totalBytes: t } });
    } catch (e) {
      fail(toMessage(e));
    }
    return;
  }

  if (req.cmd === "transcribe") {
    const startedAt = Date.now();
    try {
      aborted = false;
      const pipe = await getPipeline(req.model, req.device, req.dtype);
      const modelBytes = totalBytes().loaded;

      const pcm = new Float32Array(req.pcm);
      const totalSec = pcm.length / req.sampleRate;
      const all: ResultSegment[] = [];

      progress(0, "받아쓰는 중");
      for (let i = 0; i < req.segments.length; i++) {
        if (aborted) {
          post({ type: "done", value: { reqId: req.reqId, kind: "aborted", segments: all } });
          return;
        }
        const seg = req.segments[i];
        const slice = pcm.subarray(seg.startSample, seg.endSample);
        if (slice.length === 0) continue;

        const options: Record<string, unknown> = {
          task: "transcribe",
          return_timestamps: req.timestamps,
          // 30초 이하 조각만 넘기므로 파이프라인 내부 청킹은 쓰지 않는다.
        };
        if (req.language) options.language = req.language;

        const raw = await pipe(slice, options);
        const out = (Array.isArray(raw) ? raw[0] : raw) ?? {};

        const produced: ResultSegment[] = [];
        const chunks = out.chunks ?? [];
        for (const c of chunks) {
          const text = (c.text ?? "").trim();
          if (!text) continue;
          const s = seg.start + (Number.isFinite(c.timestamp?.[0]) ? (c.timestamp[0] as number) : 0);
          const rawEnd = c.timestamp?.[1];
          const e = Number.isFinite(rawEnd as number) ? seg.start + (rawEnd as number) : seg.end;
          produced.push({ start: s, end: Math.min(e, seg.end), text });
        }
        if (produced.length === 0) {
          const text = (out.text ?? "").trim();
          if (text) produced.push({ start: seg.start, end: seg.end, text });
        }

        all.push(...produced);
        post({
          type: "partial",
          value: {
            reqId: req.reqId,
            segments: produced,
            all,
            index: i,
            count: req.segments.length,
            processedSec: seg.end,
            totalSec,
          },
        });
        progress(((i + 1) / req.segments.length) * 100, `받아쓰는 중 · ${i + 1}/${req.segments.length} 조각`);
      }

      post({
        type: "done",
        value: {
          reqId: req.reqId,
          kind: "transcribe",
          segments: all,
          elapsedMs: Date.now() - startedAt,
          audioSec: totalSec,
          bytes: modelBytes,
          model: req.model,
          device: req.device,
          dtype: req.dtype,
        },
      });
    } catch (e) {
      fail(toMessage(e));
    }
  }
});

export {};
