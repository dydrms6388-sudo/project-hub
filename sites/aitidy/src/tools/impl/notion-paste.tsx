"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow, OutputText, Radio } from "@/components/TextToolLayout";
import { walkLines } from "@/lib/md";

const SAMPLE = `# 프로젝트 개요
내용입니다.

#### 세부 항목
* 항목 1
* 항목 2

\`\`\`python
print("hello")
\`\`\``;

type Shift = "-1" | "0" | "1";

export function toNotion(
  src: string,
  opt: {
    shift: Shift;
    keepLang: boolean;
    deepHeadingToBold: boolean;
    unifyBullet: boolean;
    blankBeforeHeading: boolean;
    trimSpaces: boolean;
  },
): string {
  if (!src.trim()) return "";
  const delta = Number(opt.shift);
  const lines = walkLines(src);
  const out: string[] = [];

  for (const { text, inCode, fence, lang } of lines) {
    if (fence) {
      // 여는 펜스만 언어 태그를 가진다. 노션은 ```lang 을 읽어 코드 언어를 자동 설정한다.
      if (text.trim().replace(/[`~]/g, "") === "") out.push("```");
      else out.push(opt.keepLang && lang ? `\`\`\`${lang}` : "```");
      continue;
    }
    if (inCode) {
      out.push(text);
      continue;
    }

    let s = opt.trimSpaces ? text.replace(/[ \t]+$/, "").replace(/\u00a0/g, " ") : text;

    const h = s.match(/^(\s{0,3})(#{1,6})\s+(.*)$/);
    if (h) {
      let level = h[2].length + delta;
      if (level < 1) level = 1;
      if (level > 6) level = 6;
      const body = h[3].trim();
      if (opt.deepHeadingToBold && level > 3) {
        // 노션 기본 헤딩은 H1~H3 뿐이라 H4 이하는 붙여넣으면 사라지거나 평문이 된다.
        s = `**${body.replace(/^\*+|\*+$/g, "")}**`;
      } else {
        s = `${"#".repeat(level)} ${body}`;
      }
      if (opt.blankBeforeHeading && out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(s);
      continue;
    }

    if (opt.unifyBullet) {
      s = s.replace(/^(\s*)[*+]\s+/, "$1- ");
      s = s.replace(/^(\s*)•\s*/, "$1- ");
      s = s.replace(/^(\s*)(\d+)\)\s+/, "$1$2. ");
    }

    out.push(s);
  }

  let res = out.join("\n");
  if (opt.trimSpaces) res = res.replace(/\n{3,}/g, "\n\n");
  return res.trim() + "\n";
}

export default function NotionPaste() {
  const [src, setSrc] = useState("");
  const [shift, setShift] = useState<Shift>("1");
  const [keepLang, setKeepLang] = useState(true);
  const [deepHeadingToBold, setDeep] = useState(true);
  const [unifyBullet, setUnify] = useState(true);
  const [blankBeforeHeading, setBlank] = useState(true);
  const [trimSpaces, setTrim] = useState(true);

  const result = useMemo(
    () => toNotion(src, { shift, keepLang, deepHeadingToBold, unifyBullet, blankBeforeHeading, trimSpaces }),
    [src, shift, keepLang, deepHeadingToBold, unifyBullet, blankBeforeHeading, trimSpaces],
  );

  return (
    <TextToolLayout
      storageKey="notion-paste"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      downloadName="notion.md"
      downloadMime="text/markdown;charset=utf-8"
      outputText={result}
      outputLabel="노션에 붙여넣을 마크다운"
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-full shrink-0 font-medium sm:w-28">헤딩 레벨</span>
            <Radio
              name="np-shift"
              value={shift}
              onChange={setShift}
              options={[
                { value: "1", label: "한 단계 내림 (H1→H2)" },
                { value: "0", label: "그대로" },
                { value: "-1", label: "한 단계 올림 (H2→H1)" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={keepLang} onChange={setKeepLang} label="코드블록 언어 태그 유지(```python)" />
            <Check checked={deepHeadingToBold} onChange={setDeep} label="H4 이하는 굵게로 변환" />
          </OptionRow>
          <OptionRow>
            <Check checked={unifyBullet} onChange={setUnify} label="목록 기호 - 로 통일" />
            <Check checked={blankBeforeHeading} onChange={setBlank} label="헤딩 앞 빈 줄 확보" />
            <Check checked={trimSpaces} onChange={setTrim} label="줄 끝 공백·연속 빈 줄 정리" />
          </OptionRow>
        </div>
      }
      output={<OutputText text={result} />}
    />
  );
}
