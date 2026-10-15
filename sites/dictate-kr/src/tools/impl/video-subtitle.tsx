"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveBlob } from "@/components/DownloadButton";
import FileDrop from "@/components/FileDrop";
import EngineBar from "@/components/whisper/EngineBar";
import ExportBar from "@/components/whisper/ExportBar";
import TranscriptView from "@/components/whisper/TranscriptView";
import { AudioDecodeError, type DecodedAudio, decodeToMono16k } from "@/lib/audio";
import type { Language, ModelKey } from "@/lib/models";
import { formatClock, mergeShort, toSrt, toVtt } from "@/lib/transcript";
import { useWhisper } from "@/lib/useWhisper";

const VIDEO_EXT = ["mp4", "mov", "m4v", "webm"];

/**
 * 영상 자막 자동 생성.
 * 영상 파일에서 오디오 트랙만 디코딩해 전사한 뒤, 자막 길이에 맞게 짧은 조각을 합쳐 SRT/VTT 로 뽑는다.
 * 만들어진 자막은 브라우저 안에서 곧바로 영상에 얹어 미리 볼 수 있다(파일은 업로드되지 않는다).
 */
export default function VideoSubtitle() {
  const api = useWhisper();
  const { state, segments, setSegments } = api;

  const [modelKey, setModelKey] = useState<ModelKey>(api.defaultModel);
  const [language, setLanguage] = useState<Language>("ko");
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("subtitle");
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxChars, setMaxChars] = useState(28);
  const [preview, setPreview] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackUrlRef = useRef<string | null>(null);

  const running = state.phase === "running" || state.phase === "loading";

  /** 자막용으로 다듬은 구간: 너무 짧은 조각을 합쳐 한 줄 길이를 맞춘다 */
  const cues = useMemo(() => mergeShort(segments, 1.2, maxChars), [segments, maxChars]);

  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  useEffect(() => {
    if (cues.length === 0) {
      setTrackUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([toVtt(cues)], { type: "text/vtt" }));
    if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    trackUrlRef.current = url;
    setTrackUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      if (trackUrlRef.current === url) trackUrlRef.current = null;
    };
  }, [cues]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const onFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      api.reset();
      setError(null);
      if (!file) {
        setAudio(null);
        setVideoUrl((u) => {
          if (u) URL.revokeObjectURL(u);
          return null;
        });
        return;
      }
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setVideoUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return URL.createObjectURL(file);
      });
      setStage("오디오 트랙 추출 중");
      try {
        const decoded = await decodeToMono16k(file, setStage);
        setAudio(decoded);
      } catch (e) {
        setAudio(null);
        setError(
          e instanceof AudioDecodeError
            ? e.message
            : `영상에서 오디오를 읽지 못했습니다. (${e instanceof Error ? e.message : String(e)})`,
        );
      } finally {
        setStage(null);
      }
    },
    [api],
  );

  async function start() {
    if (!audio) return;
    try {
      await api.run({ pcm: audio.pcm, sampleRate: audio.sampleRate, modelKey, language, timestamps: true });
      setPreview(true);
    } catch {
      /* state.error 로 표시 */
    }
  }

  return (
    <div className="space-y-5">
      <EngineBar
        api={api}
        modelKey={modelKey}
        onModelKey={setModelKey}
        language={language}
        onLanguage={setLanguage}
      />

      <FileDrop
        accept="video/mp4,video/quicktime,video/webm"
        extensions={VIDEO_EXT}
        multiple={false}
        maxSizeMB={800}
        hint="mp4 · mov · m4v · webm — 영상은 재생만 되고, 인식에는 오디오 트랙만 사용합니다 (최대 800MB)"
        onFiles={onFiles}
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={!audio || running}
          aria-label="자막 만들기"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {running ? "만드는 중…" : "자막 만들기"}
        </button>
        {running ? (
          <button
            type="button"
            onClick={api.abort}
            aria-label="중단"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            중단
          </button>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-slate-600">
          한 자막 최대 글자 수
          <input
            type="number"
            min={12}
            max={60}
            value={maxChars}
            onChange={(e) => setMaxChars(Math.min(60, Math.max(12, Number(e.target.value) || 28)))}
            aria-label="자막 한 줄 최대 글자 수"
            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        {audio ? <span className="text-xs text-slate-500">영상 길이 {formatClock(audio.duration)}</span> : null}
      </div>

      {videoUrl ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">미리보기</h3>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              aria-label="자막 미리보기 켜기 끄기"
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              자막 {preview ? "끄기" : "켜기"}
            </button>
          </div>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            className="w-full rounded-xl bg-black"
            aria-label="업로드한 영상 미리보기"
          >
            {trackUrl && preview ? (
              <track kind="subtitles" src={trackUrl} srcLang="ko" label="자동 생성 자막" default />
            ) : null}
          </video>
          <p className="text-xs text-slate-500">
            영상은 브라우저 메모리에서만 재생됩니다. 자막을 고치면 미리보기에도 즉시 반영됩니다(자막 켜기를 다시
            누르면 갱신됩니다).
          </p>
        </div>
      ) : null}

      <TranscriptView
        segments={segments}
        onChange={setSegments}
        initialMode="timestamp"
        emptyText={audio ? "위 버튼을 눌러 자막을 만들어 보세요." : "먼저 영상 파일을 올려 주세요."}
      />

      {cues.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">자막 파일</span>
            <button
              type="button"
              aria-label="SRT 자막 내려받기"
              onClick={() =>
                saveBlob(new Blob([toSrt(cues)], { type: "application/x-subrip;charset=utf-8" }), `${fileName}.srt`)
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              SRT 내려받기
            </button>
            <button
              type="button"
              aria-label="VTT 자막 내려받기"
              onClick={() =>
                saveBlob(new Blob([toVtt(cues)], { type: "text/vtt;charset=utf-8" }), `${fileName}.vtt`)
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              VTT 내려받기
            </button>
            <span className="text-xs text-slate-500">{cues.length}개 자막 · 한 줄 최대 {maxChars}자</span>
          </div>

          <ExportBar segments={segments} baseName={fileName} subtitles={false} docTitle="영상 대본" />

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-relaxed text-violet-900">
            <p className="font-semibold">자막을 영상에 직접 입히려면</p>
            <p className="mt-1">
              이 도구는 자막 <b>파일</b>까지 만듭니다. 영상 화면에 글자를 태워 넣는(하드섭) 작업은 영상 인코딩이
              필요해 별도 도구에서 합니다.
            </p>
            <a
              href="https://clipforge.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-semibold text-violet-700 underline"
            >
              클립포지에서 자막 굽기 ↗
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
