"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow, OutputText, Radio } from "@/components/TextToolLayout";

const SAMPLE = `✅ 첫 번째 항목입니다 😀
🔥 두 번째 항목 → 화살표와 ★ 별표도 있습니다.
👨‍👩‍👧‍👦 가족 이모지와 ①② 같은 기호도 섞여 있죠.`;

type Mode = "emoji" | "symbols";

/** 이모지(그림문자) 계열 */
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
/** 이모지 + 기타 기호(화살표·도형·괄호숫자·박스드로잉 등) */
const SYMBOL_RE =
  /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{So}\p{Sk}←-⇿∀-⋿─-╿▀-▟■-◿①-⓿〓㈀-㋿]/gu;
/** 이모지 조합용 문자(변이 선택자·ZWJ·피부톤·키캡) */
const JOINERS = /[︎️‍⃣\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu;

export function removeEmoji(
  src: string,
  opt: { mode: Mode; keepArrows: boolean; collapseSpace: boolean; trimLine: boolean; dropEmptyLine: boolean },
): string {
  if (!src) return "";
  let s = src;
  s = s.replace(opt.mode === "emoji" ? EMOJI_RE : SYMBOL_RE, (m) => {
    if (opt.keepArrows && /[←-⇿]/u.test(m)) return m;
    return "";
  });
  s = s.replace(JOINERS, "");
  if (opt.collapseSpace) s = s.replace(/[ \t]{2,}/g, " ");
  if (opt.trimLine) s = s.split("\n").map((l) => l.replace(/^[ \t]+|[ \t]+$/g, "")).join("\n");
  if (opt.dropEmptyLine) s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

export function countRemoved(src: string, mode: Mode): number {
  if (!src) return 0;
  const re = mode === "emoji" ? EMOJI_RE : SYMBOL_RE;
  re.lastIndex = 0;
  return (src.match(re) ?? []).length;
}

export default function EmojiRemove() {
  const [src, setSrc] = useState("");
  const [mode, setMode] = useState<Mode>("emoji");
  const [keepArrows, setKeepArrows] = useState(false);
  const [collapseSpace, setCollapse] = useState(true);
  const [trimLine, setTrim] = useState(true);
  const [dropEmptyLine, setDrop] = useState(true);

  const result = useMemo(
    () => removeEmoji(src, { mode, keepArrows, collapseSpace, trimLine, dropEmptyLine }),
    [src, mode, keepArrows, collapseSpace, trimLine, dropEmptyLine],
  );
  const removed = useMemo(() => countRemoved(src, mode), [src, mode]);

  return (
    <TextToolLayout
      storageKey="emoji-remove"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      downloadName="emoji-removed.txt"
      outputText={result}
      outputLabel={src ? `결과 — ${removed}개 제거됨` : "결과"}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">제거 범위</span>
            <Radio
              name="er-mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "emoji", label: "이모티콘만 (😀🔥✅)" },
                { value: "symbols", label: "모든 심볼 (→ ★ ① ─ 포함)" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={keepArrows} onChange={setKeepArrows} label="화살표(→ ← ↑ ↓)는 남기기" />
            <Check checked={collapseSpace} onChange={setCollapse} label="연속 공백 하나로" />
            <Check checked={trimLine} onChange={setTrim} label="줄 앞뒤 공백 제거" />
            <Check checked={dropEmptyLine} onChange={setDrop} label="빈 줄 정리" />
          </OptionRow>
        </div>
      }
      output={<OutputText text={result} mono={false} />}
    />
  );
}
