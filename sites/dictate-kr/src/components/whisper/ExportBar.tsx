"use client";

import { useState } from "react";
import { saveBlob } from "@/components/DownloadButton";
import { type Segment, formatClock, toParagraphs, toSrt, toTxt, toVtt } from "@/lib/transcript";

export type ExportBarProps = {
  segments: Segment[];
  /** 확장자를 뺀 파일 이름 */
  baseName?: string;
  /** 자막 포맷 버튼 노출 여부 */
  subtitles?: boolean;
  /** 문단 나누는 무음 기준(초) */
  gapSec?: number;
  /** 제목 줄에 넣을 문서 제목 (docx) */
  docTitle?: string;
};

function sanitize(name: string): string {
  return (name || "transcript").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}

/**
 * 내보내기 모음. docx 라이브러리(수백 KB)는 사용자가 DOCX 버튼을 누른 뒤에야
 * `await import("docx")` 로 받아온다 — 초기 번들에는 들어가지 않는다.
 * SRT/VTT/TXT 는 외부 의존성 없이 직접 문자열로 만든다.
 */
export default function ExportBar({
  segments,
  baseName = "transcript",
  subtitles = true,
  gapSec = 1.2,
  docTitle,
}: ExportBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = segments.length === 0;
  const name = sanitize(baseName);

  function download(text: string, ext: string, mime: string) {
    saveBlob(new Blob([text], { type: `${mime};charset=utf-8` }), `${name}.${ext}`);
  }

  async function exportDocx() {
    setBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const paras = toParagraphs(segments, gapSec);
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: docTitle ?? name,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "브라우저에서 Whisper 모델로 자동 생성한 초안입니다. 고유명사·숫자는 반드시 원본 녹음과 대조해 주세요.",
                    italics: true,
                    size: 18,
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              ...paras.flatMap((p) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: `[${formatClock(p.start)}] `, bold: true, color: "2563EB" }),
                    new TextRun({ text: p.speaker ? `${p.speaker}: ${p.text}` : p.text }),
                  ],
                }),
                new Paragraph({ text: "" }),
              ]),
            ],
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveBlob(blob, `${name}.docx`);
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">내보내기</span>
      <button
        type="button"
        disabled={disabled}
        aria-label="텍스트 파일로 내보내기"
        onClick={() => download(toTxt(segments, { gapSec }), "txt", "text/plain")}
        className={btn}
      >
        TXT
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="타임스탬프가 붙은 텍스트 파일로 내보내기"
        onClick={() => download(toTxt(segments, { timestamps: true }), "timestamps.txt", "text/plain")}
        className={btn}
      >
        TXT(시간표시)
      </button>
      {subtitles ? (
        <>
          <button
            type="button"
            disabled={disabled}
            aria-label="SRT 자막 파일로 내보내기"
            onClick={() => download(toSrt(segments), "srt", "application/x-subrip")}
            className={btn}
          >
            SRT
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="WebVTT 자막 파일로 내보내기"
            onClick={() => download(toVtt(segments), "vtt", "text/vtt")}
            className={btn}
          >
            VTT
          </button>
        </>
      ) : null}
      <button
        type="button"
        disabled={disabled || busy !== null}
        aria-label="워드 문서로 내보내기"
        onClick={exportDocx}
        className={btn}
      >
        {busy === "docx" ? "만드는 중…" : "DOCX"}
      </button>
    </div>
  );
}
