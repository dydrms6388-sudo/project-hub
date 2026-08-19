"use client";

import { type ReactNode, useCallback, useState } from "react";
import AudioLoader from "./AudioLoader";
import EngineBar from "./EngineBar";
import ExportBar from "./ExportBar";
import TranscriptView, { type ViewMode } from "./TranscriptView";
import type { DecodedAudio } from "@/lib/audio";
import type { Language, ModelKey } from "@/lib/models";
import { formatClock, type Segment } from "@/lib/transcript";
import { useWhisper } from "@/lib/useWhisper";

export type WorkbenchProps = {
  extensions: string[];
  accept: string;
  hint: string;
  /** 문단을 나눌 무음 기준(초) */
  gapSec?: number;
  initialMode?: ViewMode;
  allowSpeaker?: boolean;
  emphasizeTime?: boolean;
  subtitles?: boolean;
  runLabel?: string;
  /** 도구별 고지문 (회의록의 화자 구분 안내 등) */
  notice?: ReactNode;
  /** 결과 위에 끼워 넣을 도구별 패널 */
  renderExtra?: (args: { segments: Segment[]; audio: DecodedAudio | null; fileName: string }) => ReactNode;
  docTitle?: string;
};

/**
 * 파일 기반 받아쓰기 도구의 공통 작업대.
 * 엔진 제어 → 파일 입력 → 30초 조각 스트리밍 전사 → 편집 → 내보내기.
 */
export default function Workbench({
  extensions,
  accept,
  hint,
  gapSec = 1.2,
  initialMode = "paragraph",
  allowSpeaker = false,
  emphasizeTime = false,
  subtitles = true,
  runLabel = "받아쓰기 시작",
  notice,
  renderExtra,
  docTitle,
}: WorkbenchProps) {
  const api = useWhisper();
  const [modelKey, setModelKey] = useState<ModelKey>(api.defaultModel);
  const [language, setLanguage] = useState<Language>("ko");
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [fileName, setFileName] = useState("transcript");

  const { state, segments, setSegments } = api;
  const running = state.phase === "running" || state.phase === "loading";

  const onLoaded = useCallback(
    (a: DecodedAudio, f: File) => {
      setAudio(a);
      setFileName(f.name.replace(/\.[^.]+$/, ""));
      api.reset();
    },
    [api],
  );

  const onCleared = useCallback(() => {
    setAudio(null);
    api.reset();
  }, [api]);

  async function start() {
    if (!audio) return;
    try {
      await api.run({
        pcm: audio.pcm,
        sampleRate: audio.sampleRate,
        modelKey,
        language,
        timestamps: true,
      });
    } catch {
      /* 오류는 state.error 로 표시된다 */
    }
  }

  const speed =
    state.elapsedMs && state.audioSec ? state.audioSec / (state.elapsedMs / 1000) : null;

  return (
    <div className="space-y-5">
      <EngineBar
        api={api}
        modelKey={modelKey}
        onModelKey={setModelKey}
        language={language}
        onLanguage={setLanguage}
      />

      {notice}

      <AudioLoader
        extensions={extensions}
        accept={accept}
        hint={hint}
        onLoaded={onLoaded}
        onCleared={onCleared}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={!audio || running}
          aria-label={runLabel}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {running ? "처리 중…" : runLabel}
        </button>
        {running ? (
          <button
            type="button"
            onClick={api.abort}
            aria-label="중단"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            중단
          </button>
        ) : null}
        {audio ? (
          <span className="text-xs text-slate-500">
            길이 {formatClock(audio.duration)} · 약 {Math.max(1, Math.ceil(audio.duration / 30))}개 조각으로 나눠
            처리합니다
          </span>
        ) : null}
      </div>

      {state.elapsedMs !== null && !running ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
          {formatClock(state.audioSec ?? 0)} 분량을 {(state.elapsedMs / 1000).toFixed(1)}초에 처리했습니다
          {speed ? ` (실시간 대비 약 ${speed.toFixed(1)}배속)` : ""}. 이 수치는 지금 쓰는 기기·브라우저 기준입니다.
        </p>
      ) : null}

      {renderExtra?.({ segments, audio, fileName })}

      <TranscriptView
        segments={segments}
        onChange={setSegments}
        initialMode={initialMode}
        gapSec={gapSec}
        allowSpeaker={allowSpeaker}
        emphasizeTime={emphasizeTime}
        emptyText={
          audio ? "위 버튼을 눌러 받아쓰기를 시작하세요." : "먼저 오디오 파일을 올려 주세요."
        }
      />

      {segments.length > 0 ? (
        <>
          <ExportBar
            segments={segments}
            baseName={fileName}
            subtitles={subtitles}
            gapSec={gapSec}
            docTitle={docTitle ?? fileName}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            자동 인식 결과는 초안입니다. 사람 이름·회사명·숫자·전문 용어는 틀릴 수 있으니 원본 녹음과 대조해
            주세요.
          </p>
        </>
      ) : null}
    </div>
  );
}
