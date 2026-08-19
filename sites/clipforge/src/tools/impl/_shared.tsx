"use client";

import { useCallback, useEffect, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import FileDrop from "@/components/FileDrop";
import { EngineNotice } from "@/components/MediaJob";
import { formatBytes, probeMedia, toClock, type MediaInfo } from "@/lib/media";

export const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "wmv", "flv", "ts", "mpg", "mpeg", "3gp"];
export const AUDIO_EXT = ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma", "aiff", "amr"];
export const MEDIA_EXT = [...VIDEO_EXT, ...AUDIO_EXT];
export const SUB_EXT = ["srt", "vtt", "smi", "sami", "txt"];

/** 500MB — 이 이상은 브라우저 메모리에서 안전하게 다루기 어렵다 */
export const MAX_MB = 500;

/** exec 후 종료코드 확인 */
export async function exec(ff: FFmpeg, args: string[]): Promise<void> {
  const code = await ff.exec(args);
  if (code !== 0) {
    throw new Error(`ffmpeg 처리에 실패했습니다 (종료 코드 ${code}). 입력 파일이 손상됐거나 지원하지 않는 코덱일 수 있습니다.`);
  }
}

/** H.264 + AAC MP4 공통 인코딩 인자 */
export function h264Args(opts: { crf?: number; preset?: string; audio?: "aac" | "copy" | "none"; audioKbps?: number } = {}) {
  const { crf = 23, preset = "veryfast", audio = "aac", audioKbps = 128 } = opts;
  const args = [
    "-c:v", "libx264",
    "-preset", preset,
    "-crf", String(crf),
    "-pix_fmt", "yuv420p",
    "-profile:v", "high",
    "-level", "4.1",
  ];
  if (audio === "aac") args.push("-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000");
  else if (audio === "copy") args.push("-c:a", "copy");
  else args.push("-an");
  args.push("-movflags", "+faststart");
  return args;
}

/** 입력 1개 선택 + 메타 표시 */
export function useSourceFile(extensions: string[] = MEDIA_EXT) {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const onFiles = useCallback((list: File[]) => {
    setFile(list[0] ?? null);
    setInfo(null);
    setProbeError(null);
  }, []);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    probeMedia(file)
      .then((i) => alive && setInfo(i))
      .catch((e: Error) => alive && setProbeError(e.message));
    return () => {
      alive = false;
    };
  }, [file]);

  return { file, info, probeError, onFiles, extensions };
}

export function SourcePicker({
  extensions = MEDIA_EXT,
  multiple = false,
  onFiles,
  hint,
}: {
  extensions?: string[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hint?: string;
}) {
  return (
    <FileDrop
      extensions={extensions}
      multiple={multiple}
      maxSizeMB={MAX_MB}
      onFiles={onFiles}
      hint={hint ?? `${extensions.slice(0, 6).join(", ")} … · 최대 ${MAX_MB}MB`}
    />
  );
}

export function MediaMeta({ file, info, error }: { file: File | null; info: MediaInfo | null; error?: string | null }) {
  if (!file) return null;
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span className="font-medium text-slate-700">{file.name}</span>
      <span className="mx-2 text-slate-300">|</span>
      {formatBytes(file.size)}
      {info ? (
        <>
          <span className="mx-2 text-slate-300">|</span>
          {toClock(info.duration)}
          {info.hasVideo ? (
            <>
              <span className="mx-2 text-slate-300">|</span>
              {info.width}×{info.height}
            </>
          ) : (
            <>
              <span className="mx-2 text-slate-300">|</span>오디오만
            </>
          )}
        </>
      ) : error ? (
        <>
          <span className="mx-2 text-slate-300">|</span>
          <span className="text-amber-700">{error}</span>
        </>
      ) : (
        <>
          <span className="mx-2 text-slate-300">|</span>정보 읽는 중…
        </>
      )}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>;
}

export { EngineNotice };
