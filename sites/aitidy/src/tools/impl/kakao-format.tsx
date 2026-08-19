"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow, Radio } from "@/components/TextToolLayout";
import { detectTables, stripInline, walkLines } from "@/lib/md";

const SAMPLE = `# 회의 결과
**결정 사항**
1. 배포는 금요일
2. QA는 목요일까지

| 담당 | 일정 |
|---|---|
| 김OO | 3/14 |
| 이OO | 3/15 |`;

type BoldMode = "bracket" | "plain" | "star";
type HeadMode = "arrow" | "line" | "plain";

export function toKakao(
  src: string,
  opt: { bold: BoldMode; head: HeadMode; table: boolean; collapse: boolean; numberKeep: boolean },
): string {
  if (!src.trim()) return "";

  const tableRanges: { from: number; to: number; text: string }[] = [];
  for (const t of detectTables(src)) {
    if (t.kind !== "markdown") continue;
    const width = Math.max(t.header.length, ...t.rows.map((r) => r.length));
    const head = t.header.map((h) => stripInline(h));
    const body = t.rows.map((r) => Array.from({ length: width }, (_, i) => stripInline(r[i] ?? "")));
    // 카톡은 고정폭이 아니므로 "머리글: 값" 줄바꿈 정렬이 가장 안 깨진다.
    const text = opt.table
      ? body
          .map((r) =>
            r
              .map((c, i) => (head[i] ? `${head[i]}: ${c}` : c))
              .filter((s) => s.trim() !== "" && !/: *$/.test(s))
              .join("\n"),
          )
          .join("\n─────\n")
      : [head.join(" / "), ...body.map((r) => r.join(" / "))].join("\n");
    tableRanges.push({ from: t.line, to: t.line + 1 + t.rows.length, text });
  }

  const lines = walkLines(src);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const range = tableRanges.find((r) => r.from === i);
    if (range) {
      out.push(range.text);
      i = range.to;
      continue;
    }
    if (tableRanges.some((r) => i > r.from && i <= r.to)) continue;

    const { text, inCode, fence } = lines[i];
    if (fence) continue;
    if (inCode) {
      out.push(text);
      continue;
    }

    let s = text;

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)) {
      out.push("─────────");
      continue;
    }

    // 헤딩
    const h = s.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (h) {
      const body = stripInline(h[2]);
      if (opt.head === "arrow") s = `${h[1].length <= 2 ? "▶" : "▪"} ${body}`;
      else if (opt.head === "line") s = `[${body}]`;
      else s = body;
      out.push(s);
      continue;
    }

    // 인용
    s = s.replace(/^(\s*)(>\s?)+/, '$1" ');

    // 목록
    const task = s.match(/^(\s*)([-*+])\s+\[( |x|X)\]\s+(.*)$/);
    const ul = s.match(/^(\s*)([-*+])\s+(.*)$/);
    const ol = s.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
    if (task) {
      const depth = Math.floor(task[1].length / 2);
      s = `${"  ".repeat(depth)}${task[3].toLowerCase() === "x" ? "☑" : "☐"} ${task[4]}`;
    } else if (ul) {
      const depth = Math.floor(ul[1].length / 2);
      s = `${"  ".repeat(depth)}${depth > 0 ? "- " : "· "}${ul[3]}`;
    } else if (ol) {
      const depth = Math.floor(ol[1].length / 2);
      s = `${"  ".repeat(depth)}${opt.numberKeep ? `${ol[2]}. ` : "· "}${ol[4]}`;
    }

    // 굵게
    if (opt.bold === "bracket") {
      s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "【$1】");
      s = s.replace(/\*\*([^*]+)\*\*/g, "【$1】");
      s = s.replace(/__([^_]+)__/g, "【$1】");
    } else if (opt.bold === "star") {
      s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "*$1*");
      s = s.replace(/\*\*([^*]+)\*\*/g, "*$1*");
      s = s.replace(/__([^_]+)__/g, "*$1*");
    }
    s = stripInline(s, "keepUrl");
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1");
    out.push(s.replace(/[ \t]+$/, ""));
  }

  let res = out.join("\n");
  if (opt.collapse) res = res.replace(/\n{3,}/g, "\n\n");
  return res.trim();
}

export default function KakaoFormat() {
  const [src, setSrc] = useState("");
  const [bold, setBold] = useState<BoldMode>("bracket");
  const [head, setHead] = useState<HeadMode>("arrow");
  const [table, setTable] = useState(true);
  const [collapse, setCollapse] = useState(true);
  const [numberKeep, setNumberKeep] = useState(true);

  const result = useMemo(
    () => toKakao(src, { bold, head, table, collapse, numberKeep }),
    [src, bold, head, table, collapse, numberKeep],
  );
  const lineCount = result ? result.split("\n").length : 0;

  return (
    <TextToolLayout
      storageKey="kakao-format"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      downloadName="kakao.txt"
      outputText={result}
      outputLabel={result ? `카카오톡 미리보기 (${result.length}자 · ${lineCount}줄)` : "카카오톡 미리보기"}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">굵게</span>
            <Radio
              name="kk-bold"
              value={bold}
              onChange={setBold}
              options={[
                { value: "bracket", label: "【강조】" },
                { value: "star", label: "*강조*" },
                { value: "plain", label: "기호 제거" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <span className="w-24 shrink-0 font-medium">제목</span>
            <Radio
              name="kk-head"
              value={head}
              onChange={setHead}
              options={[
                { value: "arrow", label: "▶ 제목" },
                { value: "line", label: "[제목]" },
                { value: "plain", label: "그냥 텍스트" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={table} onChange={setTable} label="표를 '머리글: 값' 줄바꿈으로 펼치기" />
            <Check checked={numberKeep} onChange={setNumberKeep} label="번호 목록 숫자 유지" />
            <Check checked={collapse} onChange={setCollapse} label="빈 줄 정리" />
          </OptionRow>
        </div>
      }
      output={
        result ? (
          <div className="rounded-xl bg-[#b2c7d9] p-3">
            <div className="max-w-full whitespace-pre-wrap break-words rounded-xl rounded-tl-sm bg-white p-3 font-mono text-[13px] leading-relaxed text-slate-900 shadow-sm">
              {result}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">왼쪽에 AI 답변을 붙여넣으면 카카오톡용 텍스트가 만들어집니다.</p>
        )
      }
    />
  );
}
