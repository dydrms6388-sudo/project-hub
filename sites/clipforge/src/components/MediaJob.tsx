"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  canUseThreads,
  currentVariant,
  getFFmpeg,
  onFFmpegLog,
  onFFmpegProgress,
  terminateFFmpeg,
  type CoreVariant,
} from "@/lib/ffmpeg/client";
import { formatBytes } from "@/lib/media";

export type OutFile = { name: string; blob: Blob };
export type JobPhase = "idle" | "core" | "running" | "done" | "error";

export type JobCtx = {
  ff: FFmpeg;
  /** 이후 ffmpeg 진행률을 from~to 구간에 매핑한다(멀티패스용) */
  stage: (label: string, from: number, to: number) => void;
  setPercent: (p: number) => void;
  /** ffmpeg 로그 한 줄씩 받기 (silencedetect 파싱 등). 해제 함수를 돌려준다 */
  collectLogs: (fn: (line: string) => void) => () => void;
  cancelled: () => boolean;
};

export type MediaJob = ReturnType<typeof useMediaJob>;

export function useMediaJob() {
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [percent, setPercent] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<OutFile[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [variant, setVariant] = useState<CoreVariant | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const cancelledRef = useRef(false);
  const rangeRef = useRef<[number, number]>([0, 100]);

  const busy = phase === "core" || phase === "running";

  // 처리 중 페이지를 벗어나면 결과가 날아간다 → 이탈 경고
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const reset = useCallback(() => {
    setPhase("idle");
    setPercent(0);
    setLabel("");
    setError(null);
    setFiles([]);
    setLogs([]);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    terminateFFmpeg();
    setPhase("idle");
    setLabel("취소했습니다");
    setPercent(0);
  }, []);

  const run = useCallback(async (task: (ctx: JobCtx) => Promise<OutFile[]>) => {
    cancelledRef.current = false;
    setError(null);
    setFiles([]);
    setLogs([]);
    setPhase("core");
    setPercent(0);
    setLabel("엔진 준비 중");
    rangeRef.current = [0, 100];

    const offLog = onFFmpegLog((line) => {
      setLogs((prev) => (prev.length > 300 ? [...prev.slice(-250), line] : [...prev, line]));
    });
    const offProgress = onFFmpegProgress((ratio) => {
      const [from, to] = rangeRef.current;
      const p = from + Math.max(0, Math.min(1, ratio)) * (to - from);
      setPercent(Math.max(0, Math.min(100, p)));
    });

    try {
      const ff = await getFFmpeg(({ percent: p, label: l }) => {
        setPercent(p);
        setLabel(l);
      });
      setVariant(currentVariant());
      if (cancelledRef.current) return;
      setPhase("running");
      setPercent(0);
      setLabel("변환 중");

      const ctx: JobCtx = {
        ff,
        stage: (l, from, to) => {
          rangeRef.current = [from, to];
          setLabel(l);
          setPercent(from);
        },
        setPercent: (p) => setPercent(Math.max(0, Math.min(100, p))),
        collectLogs: (fn) => onFFmpegLog(fn),
        cancelled: () => cancelledRef.current,
      };

      const out = await task(ctx);
      if (cancelledRef.current) return;
      setFiles(out);
      setPercent(100);
      setLabel("완료");
      setPhase("done");
    } catch (e) {
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "처리 중 오류가 발생했습니다.");
      setPhase("error");
    } finally {
      offLog();
      offProgress();
    }
  }, []);

  return { phase, percent, label, error, files, logs, variant, busy, elapsed, run, cancel, reset, setFiles };
}

/* ------------------------------------------------------------------ */

export function EngineNotice() {
  const [mt, setMt] = useState<boolean | null>(null);
  useEffect(() => setMt(canUseThreads()), []);
  if (mt === null) return null;
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
      {mt ? (
        <>
          ⚡ <b>멀티스레드 엔진</b> 사용 가능 — 이 브라우저는 SharedArrayBuffer 가 켜져 있어 CPU 코어를 모두
          씁니다. 첫 실행 때 변환 엔진 약 32MB 를 받고, 이후에는 브라우저에 저장돼 다시 받지 않습니다.
        </>
      ) : (
        <>
          🐢 <b>싱글스레드 엔진</b>으로 동작합니다 — 이 환경에서는 SharedArrayBuffer 를 쓸 수 없어 코어 1개만
          사용합니다(모바일·일부 브라우저·미리보기 배포). 결과는 같지만 2~4배 느립니다. 긴 영상은 PC 크롬/엣지를
          권장합니다.
        </>
      )}
    </p>
  );
}

export function JobBar({ job, showLogs = true }: { job: MediaJob; showLogs?: boolean }) {
  const [open, setOpen] = useState(false);
  if (job.phase === "idle" && !job.error) return null;

  return (
    <div className="space-y-2">
      {job.busy && (
        <>
          <Progress value={job.percent} label={`${job.label}${job.elapsed ? ` · ${job.elapsed}초 경과` : ""}`} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={job.cancel}
              aria-label="변환 취소"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <span className="text-xs text-slate-500">
              창을 닫거나 새로고침하면 처리가 중단됩니다.
            </span>
          </div>
        </>
      )}

      {job.error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">변환에 실패했습니다.</p>
          <p className="mt-1 break-words">{job.error}</p>
          <p className="mt-1 text-xs text-red-600">
            메모리 부족이면 영상을 짧게 잘라서 나눠 처리하거나, PC 크롬/엣지에서 다시 시도해 보세요.
          </p>
        </div>
      )}

      {showLogs && job.logs.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="ffmpeg 로그 보기"
            className="text-xs text-slate-500 underline"
          >
            {open ? "로그 접기" : "자세한 로그 보기"}
          </button>
          {open && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-relaxed text-slate-200">
              {job.logs.slice(-120).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultFiles({ files, note }: { files: OutFile[]; note?: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f.blob));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-emerald-800">완료됐습니다 · {files.length}개 파일</p>
      {note ? <p className="text-xs text-emerald-700">{note}</p> : null}
      <ul className="space-y-3">
        {files.map((f, i) => {
          const url = urls[i];
          const type = f.blob.type;
          return (
            <li key={f.name} className="space-y-2 rounded-lg bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{f.name}</span>
                <span className="text-xs text-slate-500">{formatBytes(f.blob.size)}</span>
                <button
                  type="button"
                  onClick={() => saveBlob(f.blob, f.name)}
                  aria-label={`${f.name} 다운로드`}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  다운로드
                </button>
              </div>
              {url && type.startsWith("video/") && (
                <video src={url} controls playsInline className="max-h-72 w-full rounded-lg bg-black" />
              )}
              {url && type.startsWith("audio/") && <audio src={url} controls className="w-full" />}
              {url && type.startsWith("image/") && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url} alt={f.name} className="max-h-72 w-auto rounded-lg" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 도구 공통: 실행 버튼 */
export function RunButton({
  onClick,
  disabled,
  busy,
  children = "변환 시작",
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={typeof children === "string" ? children : "실행"}
      className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6"
    >
      {busy ? "처리 중…" : children}
    </button>
  );
}

/** 라벨 + 컨트롤 한 줄 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none";
export const selectClass = inputClass;
