"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { AudioDecodeError, type DecodedAudio, decodeToMono16k } from "@/lib/audio";
import { formatClock } from "@/lib/transcript";

export type AudioLoaderProps = {
  extensions: string[];
  accept: string;
  hint: string;
  maxSizeMB?: number;
  onLoaded: (audio: DecodedAudio, file: File) => void;
  onCleared?: () => void;
};

/**
 * 파일 → 16kHz mono PCM 까지 한 번에 처리하는 입력부.
 * 공용 FileDrop 을 그대로 쓰고(확장자·용량 검증, "서버 전송 안 됨" 고지 포함),
 * 디코딩 단계만 여기서 덧붙인다.
 */
export default function AudioLoader({
  extensions,
  accept,
  hint,
  maxSizeMB = 500,
  onLoaded,
  onCleared,
}: AudioLoaderProps) {
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ name: string; audio: DecodedAudio } | null>(null);

  const handle = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) {
        setInfo(null);
        setError(null);
        onCleared?.();
        return;
      }
      setError(null);
      setStage("파일 읽는 중");
      try {
        const audio = await decodeToMono16k(file, setStage);
        setInfo({ name: file.name, audio });
        onLoaded(audio, file);
      } catch (e) {
        setInfo(null);
        setError(
          e instanceof AudioDecodeError
            ? e.message
            : `파일을 읽지 못했습니다. (${e instanceof Error ? e.message : String(e)})`,
        );
      } finally {
        setStage(null);
      }
    },
    [onCleared, onLoaded],
  );

  return (
    <div className="space-y-3">
      <FileDrop
        accept={accept}
        extensions={extensions}
        multiple={false}
        maxSizeMB={maxSizeMB}
        hint={hint}
        onFiles={handle}
      />

      {stage ? (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600" role="status" aria-live="polite">
          {stage}…
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {info ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">길이</dt>
            <dd className="font-medium text-slate-800">{formatClock(info.audio.duration)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">원본 샘플레이트</dt>
            <dd className="font-medium text-slate-800">{(info.audio.sourceRate / 1000).toFixed(1)}kHz</dd>
          </div>
          <div>
            <dt className="text-slate-400">원본 채널</dt>
            <dd className="font-medium text-slate-800">{info.audio.sourceChannels}ch</dd>
          </div>
          <div>
            <dt className="text-slate-400">변환 결과</dt>
            <dd className="font-medium text-slate-800">16kHz · 모노</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
