"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { type Paragraph, type Segment, formatClock, plainText, toParagraphs } from "@/lib/transcript";

export type ViewMode = "paragraph" | "timestamp";

export type TranscriptViewProps = {
  segments: Segment[];
  onChange?: (next: Segment[]) => void;
  /** 기본 보기 모드 */
  initialMode?: ViewMode;
  /** 문단 나누는 무음 기준(초) */
  gapSec?: number;
  /** 화자 라벨 입력칸을 보여준다(자동 화자분리가 아니라 사용자가 직접 붙이는 것) */
  allowSpeaker?: boolean;
  /** 타임스탬프를 굵게 강조 (회의록용) */
  emphasizeTime?: boolean;
  emptyText?: string;
};

/**
 * 전사 결과 표시 + 인라인 편집.
 * - 문단 뷰: 무음 기준으로 묶어 읽기 좋게. 편집하면 그 문단에 속한 조각들이 하나로 합쳐진다.
 * - 타임스탬프 뷰: 조각 단위로 시각과 함께. 자막 만들기 전 검수용.
 */
export default function TranscriptView({
  segments,
  onChange,
  initialMode = "paragraph",
  gapSec = 1.2,
  allowSpeaker = false,
  emphasizeTime = false,
  emptyText = "아직 결과가 없습니다.",
}: TranscriptViewProps) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const editable = typeof onChange === "function";

  const paragraphs: Paragraph[] = useMemo(() => toParagraphs(segments, gapSec), [segments, gapSec]);

  const exportText = useMemo(
    () =>
      mode === "timestamp"
        ? segments.map((s) => `[${formatClock(s.start)}] ${s.speaker ? `${s.speaker}: ` : ""}${s.text}`).join("\n")
        : paragraphs.map((p) => p.text).join("\n\n"),
    [mode, segments, paragraphs],
  );

  function editSegment(index: number, text: string) {
    if (!onChange) return;
    const next = segments.map((s, i) => (i === index ? { ...s, text } : s));
    onChange(next);
  }

  function editSpeaker(index: number, speaker: string) {
    if (!onChange) return;
    const next = segments.map((s, i) => (i === index ? { ...s, speaker: speaker || undefined } : s));
    onChange(next);
  }

  /**
   * 문단을 통째로 고치면, 그 문단이 포함하던 조각들을 하나로 합쳐 대체한다.
   * (문단 단위 편집과 조각 단위 타임스탬프를 동시에 만족시키기 위한 절충)
   */
  function editParagraph(p: Paragraph, text: string) {
    if (!onChange) return;
    const inside = segments.filter((s) => s.start >= p.start - 1e-6 && s.end <= p.end + 1e-6);
    if (inside.length === 0) return;
    const first = inside[0];
    const merged: Segment = { start: p.start, end: p.end, text, speaker: first.speaker };
    const before = segments.filter((s) => s.end <= p.start + 1e-6 && !inside.includes(s));
    const after = segments.filter((s) => s.start >= p.end - 1e-6 && !inside.includes(s));
    onChange([...before, merged, ...after]);
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
          {(
            [
              ["paragraph", "문단 보기"],
              ["timestamp", "타임스탬프 보기"],
            ] as [ViewMode, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={mode === v}
              aria-label={label}
              onClick={() => setMode(v)}
              className={`px-3 py-1.5 text-sm transition ${
                mode === v ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {segments.length}개 구간 · {plainText(segments).length.toLocaleString()}자
        </span>
        <CopyButton value={() => exportText} label="본문 복사" className="ml-auto" />
      </div>

      {editable ? (
        <p className="text-xs text-slate-500">
          텍스트를 직접 눌러 오탈자를 고칠 수 있습니다. 수정 내용은 내보내기에 그대로 반영됩니다.
        </p>
      ) : null}

      {mode === "paragraph" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          {paragraphs.map((p) => (
            <div key={`${p.start}-${p.end}`} className="group">
              <div className="mb-0.5 text-xs text-slate-400">{formatClock(p.start)}</div>
              {editable ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label={`${formatClock(p.start)} 문단 편집`}
                  tabIndex={0}
                  onBlur={(e) => editParagraph(p, e.currentTarget.textContent ?? "")}
                  className="rounded px-1 py-0.5 text-[15px] leading-relaxed text-slate-800 outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-300"
                >
                  {p.text}
                </div>
              ) : (
                <p className="text-[15px] leading-relaxed text-slate-800">{p.text}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {segments.map((s, i) => (
            <li key={`${s.start}-${i}`} className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-3">
              <span
                className={`shrink-0 font-mono text-xs tabular-nums ${
                  emphasizeTime
                    ? "rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700"
                    : "pt-1 text-slate-400"
                }`}
              >
                {formatClock(s.start)}
                {emphasizeTime ? ` – ${formatClock(s.end)}` : ""}
              </span>
              <div className="min-w-0 flex-1">
                {allowSpeaker ? (
                  <input
                    value={s.speaker ?? ""}
                    onChange={(e) => editSpeaker(i, e.target.value)}
                    placeholder="화자 (직접 입력)"
                    aria-label={`${formatClock(s.start)} 구간 화자 이름`}
                    className="mb-1 w-32 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
                  />
                ) : null}
                {editable ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label={`${formatClock(s.start)} 구간 편집`}
                    tabIndex={0}
                    onBlur={(e) => editSegment(i, e.currentTarget.textContent ?? "")}
                    className="rounded px-1 py-0.5 text-[15px] leading-relaxed text-slate-800 outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-blue-300"
                  >
                    {s.text}
                  </div>
                ) : (
                  <p className="text-[15px] leading-relaxed text-slate-800">{s.text}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
