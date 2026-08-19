"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveBlob } from "@/components/DownloadButton";
import EngineBar from "@/components/whisper/EngineBar";
import ExportBar from "@/components/whisper/ExportBar";
import TranscriptView from "@/components/whisper/TranscriptView";
import { decodeToMono16k, describeMicError, micSupported, pcmToWav, pickRecorderMime } from "@/lib/audio";
import { findSilences } from "@/lib/dsp";
import type { Language, ModelKey } from "@/lib/models";
import { formatClock } from "@/lib/transcript";
import { useWhisper } from "@/lib/useWhisper";

/** MediaRecorder 가 조각을 뱉는 주기 */
const SLICE_MS = 5000;
/** 무음을 못 찾아도 이만큼 밀리면 강제로 끊어서 넘긴다 */
const FORCE_SEC = 25;
/** 이 길이를 넘으면 메모리·속도 경고 */
const WARN_SEC = 10 * 60;

export default function Live() {
  const api = useWhisper();
  const { state, segments, setSegments } = api;

  const [modelKey, setModelKey] = useState<ModelKey>(api.defaultModel);
  const [language, setLanguage] = useState<Language>("ko");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [pendingSec, setPendingSec] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const processedRef = useRef(0);
  const busyRef = useRef(false);
  const pcmRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => setSupported(micSupported()), []);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /**
   * 누적된 녹음 전체를 다시 디코딩한 뒤, 아직 넘기지 않은 뒷부분만 전사한다.
   * MediaRecorder 조각은 첫 조각에만 컨테이너 헤더가 들어 있어 조각 하나만 따로 디코딩할 수 없다.
   * 그래서 매번 전체를 이어 붙여 디코딩하고, 이미 처리한 지점 이후만 잘라 쓴다.
   */
  const pump = useCallback(
    async (flush: boolean) => {
      if (busyRef.current || chunksRef.current.length === 0) return;
      busyRef.current = true;
      try {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        const decoded = await decodeToMono16k(blob);
        pcmRef.current = decoded.pcm;
        const total = decoded.duration;
        const from = processedRef.current;
        const pending = total - from;
        setPendingSec(pending);
        if (pending < 1.5 && !flush) return;

        // 어디서 끊을지: 뒤쪽 무음을 찾아 단어 중간이 잘리지 않게 한다.
        let cut: number | null = null;
        if (flush) {
          cut = total;
        } else {
          const tail = decoded.pcm.subarray(Math.round(from * decoded.sampleRate));
          const sils = findSilences(tail, decoded.sampleRate, { minSilenceSec: 0.35 });
          const last = sils[sils.length - 1];
          if (last) {
            const mid = (last.start + last.end) / 2;
            if (mid > 1.0) cut = from + mid;
          }
          if (cut === null && pending >= FORCE_SEC) cut = total;
        }
        if (cut === null) return;

        const startSample = Math.round(from * decoded.sampleRate);
        const endSample = Math.min(decoded.pcm.length, Math.round(cut * decoded.sampleRate));
        if (endSample - startSample < decoded.sampleRate * 0.4) return;

        const slice = decoded.pcm.slice(startSample, endSample);
        processedRef.current = cut;
        setPendingSec(total - cut);

        await api.run({
          pcm: slice,
          sampleRate: decoded.sampleRate,
          modelKey,
          language,
          offsetSec: from,
          append: true,
          timestamps: true,
        });
      } catch (e) {
        setMicError(`실시간 처리 중 오류가 발생했습니다. (${e instanceof Error ? e.message : String(e)})`);
      } finally {
        busyRef.current = false;
      }
    },
    [api, language, modelKey],
  );

  async function start() {
    setMicError(null);
    if (!micSupported()) {
      setSupported(false);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      setMicError(describeMicError(e));
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    processedRef.current = 0;
    setSegments([]);
    api.reset();
    setElapsed(0);
    setPendingSec(0);

    // 입력 레벨 표시 — 마이크가 음소거된 채 "녹음 중"으로 보이는 상황을 막는다.
    try {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      /* 레벨 미터는 부가 기능 — 실패해도 녹음은 계속한다 */
    }

    const mime = pickRecorderMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;
    stoppingRef.current = false;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      void pump(stoppingRef.current);
    };
    rec.onerror = () => setMicError("녹음 중 오류가 발생했습니다. 다시 시도해 주세요.");
    rec.start(SLICE_MS);

    setRecording(true);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stop() {
    stoppingRef.current = true;
    try {
      recorderRef.current?.stop();
    } catch {
      /* 이미 멈춘 경우 무시 */
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    // 마지막 조각을 마저 넘긴다
    setTimeout(() => void pump(true), 300);
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800" role="alert">
        <p className="font-semibold">이 브라우저에서는 실시간 받아쓰기를 쓸 수 없습니다</p>
        <p className="mt-1">
          마이크 녹음에 필요한 MediaRecorder API 가 없습니다. 최신 크롬·엣지·사파리에서 열거나,{" "}
          <Link href="/tools/transcribe/" className="font-semibold underline">
            녹음 파일을 올려 변환하는 도구
          </Link>
          를 이용해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <EngineBar
        api={api}
        modelKey={modelKey}
        onModelKey={setModelKey}
        language={language}
        onLanguage={setLanguage}
        disabled={recording}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">시작 전에 알아 두세요</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            녹음은 <b>5초 단위</b>로 모아 처리하므로, 말한 내용이 화면에 뜨기까지 몇 초 정도 늦습니다. 방송 자막처럼
            즉시 나오지는 않습니다.
          </li>
          <li>말이 잠시 끊긴 지점을 찾아 문장 단위로 넘기기 때문에, 조용히 쉬어 주면 결과가 더 깔끔합니다.</li>
          <li>정확도가 중요하다면 녹음을 저장한 뒤 녹음 텍스트 변환 도구에서 small 모델로 다시 돌리는 편이 낫습니다.</li>
        </ul>
      </div>

      {micError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-800" role="alert">
          <p className="font-semibold">마이크를 사용할 수 없습니다</p>
          <p className="mt-1">{micError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button
            type="button"
            onClick={stop}
            aria-label="녹음 중지"
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            ■ 녹음 중지
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label="마이크 녹음 시작"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            ● 마이크로 받아쓰기 시작
          </button>
        )}

        {recording ? (
          <>
            <span className="flex items-center gap-2 text-sm font-medium text-red-600">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
              {formatClock(elapsed)}
            </span>
            <div className="flex min-w-[120px] flex-1 items-center gap-2">
              <span className="text-xs text-slate-500">입력</span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label="마이크 입력 레벨"
                aria-valuenow={Math.round(level * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all ${level > 0.02 ? "bg-emerald-500" : "bg-slate-300"}`}
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {recording && level < 0.02 && elapsed > 4 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900" role="status">
          입력 레벨이 거의 0 입니다. 마이크가 음소거되어 있거나 다른 입력 장치가 선택돼 있을 수 있습니다.
        </p>
      ) : null}

      {recording && elapsed > WARN_SEC ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900" role="status">
          {Math.floor(elapsed / 60)}분째 녹음 중입니다. 길어질수록 브라우저 메모리를 많이 쓰고 처리도 느려집니다.
          한 번 끊고 이어서 진행하는 편을 권합니다.
        </p>
      ) : null}

      {recording || pendingSec > 0 ? (
        <p className="text-xs text-slate-500" aria-live="polite">
          아직 처리하지 않은 구간 {pendingSec > 0 ? `약 ${pendingSec.toFixed(0)}초` : "없음"}
          {state.phase === "running" ? " · 받아쓰는 중" : ""}
        </p>
      ) : null}

      <TranscriptView
        segments={segments}
        onChange={setSegments}
        initialMode="paragraph"
        emptyText="녹음을 시작하면 5초쯤 뒤부터 결과가 이어서 표시됩니다."
      />

      {segments.length > 0 ? (
        <div className="space-y-3">
          <ExportBar segments={segments} baseName="live-dictation" docTitle="실시간 받아쓰기" />
          {pcmRef.current ? (
            <button
              type="button"
              aria-label="녹음 원본 WAV 저장"
              onClick={() => {
                if (pcmRef.current) saveBlob(pcmToWav(pcmRef.current, 16000), "recording-16k.wav");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              녹음 원본 WAV 저장 (16kHz 모노)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
