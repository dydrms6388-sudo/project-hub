"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow } from "@/components/TextToolLayout";

const PRESETS = [500, 700, 1000, 1500, 2000];

export function utf8Bytes(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) n += 1;
    else if (cp < 0x800) n += 2;
    else if (cp < 0x10000) n += 3;
    else n += 4;
  }
  return n;
}

/** EUC-KR(CP949) 근사: ASCII 1바이트, 한글·한자·전각 2바이트, 표현 불가 문자는 별도 집계 */
export function euckrBytes(s: string): { bytes: number; unsupported: number } {
  let bytes = 0;
  let unsupported = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes += 1;
    else if (cp > 0xffff) {
      unsupported += 1; // 이모지 등 BMP 밖 문자는 EUC-KR 로 표현할 수 없다
    } else if (
      (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
      (cp >= 0x3131 && cp <= 0x318e) || // 호환 자모
      (cp >= 0x4e00 && cp <= 0x9fff) || // 한자
      (cp >= 0x3000 && cp <= 0x303f) || // CJK 문장부호
      (cp >= 0xff01 && cp <= 0xff60) || // 전각
      (cp >= 0x2000 && cp <= 0x266f) // 일반 기호(일부)
    ) {
      bytes += 2;
    } else {
      bytes += 2;
      unsupported += 1;
    }
  }
  return { bytes, unsupported };
}

export function analyze(src: string) {
  const withSpace = [...src].length;
  const noSpace = [...src.replace(/\s/g, "")].length;
  const noSpaceNoPunct = [...src.replace(/[\s\p{P}\p{S}]/gu, "")].length;
  const words = src.trim() ? src.trim().split(/\s+/).length : 0;
  const lines = src === "" ? 0 : src.replace(/\r\n?/g, "\n").split("\n").length;
  const paragraphs = src.trim()
    ? src
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .filter((p) => p.trim() !== "").length
    : 0;
  const sentences = src.trim() ? (src.match(/[^.!?。！？\n]+[.!?。！？]?/g) ?? []).filter((s) => s.trim()).length : 0;
  const utf8 = utf8Bytes(src);
  const euckr = euckrBytes(src);
  // 원고지: 200자 원고지 1매(20자 × 10줄), 공백 포함 기준
  const manuscript = withSpace === 0 ? 0 : Math.ceil(withSpace / 200);
  return { withSpace, noSpace, noSpaceNoPunct, words, lines, paragraphs, sentences, utf8, euckr, manuscript };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-900">{value}</div>
      {sub ? <div className="text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

export default function WordCount() {
  const [src, setSrc] = useState("");
  const [preset, setPreset] = useState(1000);
  const [countNoSpace, setCountNoSpace] = useState(false);

  const s = useMemo(() => analyze(src), [src]);
  const current = countNoSpace ? s.noSpace : s.withSpace;
  const pct = preset > 0 ? Math.min(100, Math.round((current / preset) * 100)) : 0;

  const report = useMemo(
    () =>
      [
        `공백 포함 글자수: ${s.withSpace}`,
        `공백 제외 글자수: ${s.noSpace}`,
        `공백·문장부호 제외: ${s.noSpaceNoPunct}`,
        `단어 수: ${s.words}`,
        `줄 수: ${s.lines}`,
        `문단 수: ${s.paragraphs}`,
        `문장 수: ${s.sentences}`,
        `UTF-8 바이트: ${s.utf8}`,
        `EUC-KR(추정) 바이트: ${s.euckr.bytes}`,
        `원고지(200자): ${s.manuscript}매`,
      ].join("\n"),
    [s],
  );

  return (
    <TextToolLayout
      storageKey="word-count"
      value={src}
      onChange={setSrc}
      placeholder="자소서, 보고서, AI 답변 등을 붙여넣으면 즉시 계산됩니다."
      inputLabel="텍스트 입력 (붙여넣으면 바로 계산)"
      outputLabel="글자수 통계"
      downloadName="word-count.txt"
      outputText={report}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">자소서 기준</span>
            <span className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  aria-label={`${p}자 기준으로 보기`}
                  aria-pressed={preset === p}
                  className={`rounded-md border px-2.5 py-1 text-sm font-medium ${
                    preset === p
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p}자
                </button>
              ))}
            </span>
          </OptionRow>
          <OptionRow>
            <Check checked={countNoSpace} onChange={setCountNoSpace} label="공백 제외 기준으로 진행률 계산" />
          </OptionRow>
        </div>
      }
      output={
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>
                {preset}자 기준 ({countNoSpace ? "공백 제외" : "공백 포함"})
              </span>
              <span className="tabular-nums">
                {current} / {preset} ({pct}%)
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="글자수 진행률"
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={`h-full rounded-full transition-all ${current > preset ? "bg-rose-500" : "bg-blue-600"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {current > preset ? (
              <p className="mt-1 text-xs font-medium text-rose-600">기준보다 {current - preset}자 초과</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{preset - current}자 더 쓸 수 있습니다.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="공백 포함" value={`${s.withSpace}자`} />
            <Stat label="공백 제외" value={`${s.noSpace}자`} />
            <Stat label="공백·부호 제외" value={`${s.noSpaceNoPunct}자`} />
            <Stat label="단어 수" value={`${s.words}개`} />
            <Stat label="줄 / 문단" value={`${s.lines} / ${s.paragraphs}`} />
            <Stat label="문장 수" value={`${s.sentences}개`} />
            <Stat label="UTF-8" value={`${s.utf8}B`} sub="한글 1자 = 3바이트" />
            <Stat
              label="EUC-KR(추정)"
              value={`${s.euckr.bytes}B`}
              sub={s.euckr.unsupported > 0 ? `표현 불가 ${s.euckr.unsupported}자` : "한글 1자 = 2바이트"}
            />
            <Stat label="원고지" value={`${s.manuscript}매`} sub="200자 기준, 공백 포함" />
          </div>
        </div>
      }
    />
  );
}
