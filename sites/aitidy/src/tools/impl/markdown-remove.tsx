"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow, OutputText, Radio } from "@/components/TextToolLayout";
import { detectTables, stripInline, tableToTsv, walkLines, type LinkMode } from "@/lib/md";

const SAMPLE = `## 요약
**핵심**은 다음과 같습니다.

- 첫째 항목
- 둘째 항목

| 항목 | 값 |
|---|---|
| 매출 | 1,200 |

> 인용문입니다.

자세한 내용은 [공식 문서](https://example.com)를 보세요.`;

type ListMode = "keep" | "bullet" | "remove";
type TableMode = "tab" | "keep" | "remove";

export function convert(
  src: string,
  opt: { list: ListMode; table: TableMode; link: LinkMode; keepCode: boolean; collapseBlank: boolean },
): string {
  if (!src.trim()) return "";

  // 표 영역을 먼저 확보한다(줄 번호 기준).
  const tableRanges: { from: number; to: number; text: string }[] = [];
  if (opt.table !== "keep") {
    for (const t of detectTables(src)) {
      if (t.kind !== "markdown") continue;
      const len = 2 + t.rows.length; // 헤더 + 구분선 + 데이터
      tableRanges.push({
        from: t.line,
        to: t.line + len - 1,
        text: opt.table === "tab" ? tableToTsv(t) : "",
      });
    }
  }

  const lines = walkLines(src);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const range = tableRanges.find((r) => r.from === i);
    if (range) {
      if (range.text) out.push(range.text);
      i = range.to;
      continue;
    }
    if (tableRanges.some((r) => i > r.from && i <= r.to)) continue;

    const { text, inCode, fence } = lines[i];

    if (inCode) {
      if (fence) {
        if (opt.keepCode) continue; // 펜스 기호만 제거하고 내용은 남긴다
        continue;
      }
      if (opt.keepCode) out.push(text);
      continue;
    }

    let s = text;

    // 수평선
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)) {
      out.push("");
      continue;
    }

    // 헤딩
    s = s.replace(/^\s{0,3}#{1,6}\s+/, "");
    s = s.replace(/^\s{0,3}#{1,6}\s*$/, "");

    // 인용문 (중첩 포함)
    s = s.replace(/^(\s*)(>\s?)+/, "$1");

    // 목록
    const ul = s.match(/^(\s*)([-*+])\s+(.*)$/);
    const ol = s.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
    const task = s.match(/^(\s*)([-*+])\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      const body = task[4];
      const mark = task[3].toLowerCase() === "x" ? "[완료] " : "[ ] ";
      s = opt.list === "remove" ? `${task[1]}${body}` : `${task[1]}${opt.list === "bullet" ? "• " : "- "}${mark}${body}`;
    } else if (ul) {
      const body = ul[3];
      if (opt.list === "remove") s = `${ul[1]}${body}`;
      else if (opt.list === "bullet") s = `${ul[1]}• ${body}`;
      else s = `${ul[1]}${ul[2]} ${body}`;
    } else if (ol) {
      const body = ol[4];
      if (opt.list === "remove") s = `${ol[1]}${body}`;
      else s = `${ol[1]}${ol[2]}. ${body}`;
    }

    s = stripInline(s, opt.link);
    // 남은 이스케이프 문자
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1");
    out.push(s.replace(/[ \t]+$/, ""));
  }

  let res = out.join("\n");
  if (opt.collapseBlank) res = res.replace(/\n{3,}/g, "\n\n");
  return res.replace(/^\n+/, "").replace(/\n+$/, "\n").trimEnd();
}

export default function MarkdownRemove() {
  const [src, setSrc] = useState("");
  const [list, setList] = useState<ListMode>("bullet");
  const [table, setTable] = useState<TableMode>("tab");
  const [link, setLink] = useState<LinkMode>("text");
  const [keepCode, setKeepCode] = useState(true);
  const [collapseBlank, setCollapseBlank] = useState(true);

  const result = useMemo(
    () => convert(src, { list, table, link, keepCode, collapseBlank }),
    [src, list, table, link, keepCode, collapseBlank],
  );

  return (
    <TextToolLayout
      storageKey="markdown-remove"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      downloadName="markdown-removed.txt"
      outputText={result}
      output={<OutputText text={result} mono={false} />}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">목록 기호</span>
            <Radio
              name="md-list"
              value={list}
              onChange={setList}
              options={[
                { value: "keep", label: "그대로 유지(-)" },
                { value: "bullet", label: "가운뎃점(•)" },
                { value: "remove", label: "제거" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">표</span>
            <Radio
              name="md-table"
              value={table}
              onChange={setTable}
              options={[
                { value: "tab", label: "탭 구분 평문" },
                { value: "keep", label: "그대로 두기" },
                { value: "remove", label: "삭제" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">링크</span>
            <Radio
              name="md-link"
              value={link}
              onChange={setLink}
              options={[
                { value: "text", label: "텍스트만" },
                { value: "keepUrl", label: "URL 유지" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={keepCode} onChange={setKeepCode} label="코드블록 내용 유지(``` 기호만 제거)" />
            <Check checked={collapseBlank} onChange={setCollapseBlank} label="빈 줄 2개 이상 하나로" />
          </OptionRow>
        </div>
      }
    />
  );
}
