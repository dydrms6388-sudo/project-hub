"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow, OutputText, Radio } from "@/components/TextToolLayout";
import { parseCodeBlocks } from "@/lib/md";

const SAMPLE = `아래와 같이 반환됩니다.

\`\`\`json
{"name":"홍길동","age":30,"tags":["a","b"],"address":{"city":"서울"}}
\`\`\``;

/** 답변 텍스트에서 JSON 후보를 뽑는다: 코드블록 우선 → 균형 잡힌 { } / [ ] 스캔 */
export function extractJson(src: string): string {
  const t = src.trim();
  if (!t) return "";
  if (t.startsWith("{") || t.startsWith("[")) return t;

  const blocks = parseCodeBlocks(src);
  const jsonBlock = blocks.find((b) => /^(json|json5|jsonc)$/i.test(b.lang)) ?? blocks.find((b) => {
    const c = b.code.trim();
    return c.startsWith("{") || c.startsWith("[");
  });
  if (jsonBlock) return jsonBlock.code.trim();

  // 균형 스캔 (문자열 리터럴 안의 괄호는 무시)
  let best = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch !== "{" && ch !== "[") continue;
    const close = ch === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === ch) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          const cand = src.slice(i, j + 1);
          if (cand.length > best.length) best = cand;
          i = j;
          break;
        }
      }
    }
  }
  return best;
}

/** 흔한 오류를 자동 교정: 트레일링 콤마, 홑따옴표 키/값, 주석 */
export function relax(src: string): string {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  s = s.replace(/,(\s*[}\]])/g, "$1");
  s = s.replace(/'([^'\\\n]*)'(\s*:)/g, '"$1"$2');
  s = s.replace(/:\s*'([^'\\\n]*)'/g, ': "$1"');
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  return s;
}

function TreeNode({ k, v, depth }: { k: string | null; v: unknown; depth: number }) {
  const isObj = v !== null && typeof v === "object";
  const [open, setOpen] = useState(depth < 2);
  const pad = { paddingLeft: `${Math.min(depth, 8) * 12}px` };

  if (!isObj) {
    const cls =
      typeof v === "number"
        ? "text-blue-700"
        : typeof v === "boolean"
          ? "text-purple-700"
          : v === null
            ? "text-slate-400"
            : "text-emerald-800";
    return (
      <div style={pad} className="font-mono text-[12px] leading-6">
        {k !== null ? <span className="text-slate-500">{k}: </span> : null}
        <span className={cls}>{v === null ? "null" : typeof v === "string" ? `"${v}"` : String(v)}</span>
      </div>
    );
  }

  const entries: [string, unknown][] = Array.isArray(v)
    ? v.map((x, i) => [String(i), x])
    : Object.entries(v as Record<string, unknown>);
  const brace = Array.isArray(v) ? ["[", "]"] : ["{", "}"];

  return (
    <div className="font-mono text-[12px] leading-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${k ?? "루트"} 펼치기/접기`}
        style={pad}
        className="block w-full cursor-pointer text-left hover:bg-slate-100"
      >
        <span className="text-slate-400">{open ? "▾" : "▸"} </span>
        {k !== null ? <span className="text-slate-500">{k}: </span> : null}
        <span className="text-slate-700">
          {brace[0]}
          {open ? "" : ` … ${entries.length} `}
          {open ? "" : brace[1]}
        </span>
      </button>
      {open ? (
        <>
          {entries.map(([ek, ev]) => (
            <TreeNode key={ek} k={ek} v={ev} depth={depth + 1} />
          ))}
          <div style={pad} className="text-slate-700">
            {brace[1]}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function JsonPretty() {
  const [src, setSrc] = useState("");
  const [indent, setIndent] = useState<"2" | "4" | "tab" | "min">("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [autoFix, setAutoFix] = useState(true);
  const [view, setView] = useState<"text" | "tree">("text");

  const parsed = useMemo(() => {
    const raw = extractJson(src);
    if (!raw) return { ok: false as const, error: "", raw: "", data: null as unknown };
    try {
      return { ok: true as const, error: "", raw, data: JSON.parse(raw) as unknown };
    } catch (e1) {
      if (autoFix) {
        try {
          const fixed = relax(raw);
          return { ok: true as const, error: "", raw: fixed, data: JSON.parse(fixed) as unknown };
        } catch {
          /* 아래 원본 오류를 보여준다 */
        }
      }
      return {
        ok: false as const,
        error: e1 instanceof Error ? e1.message : String(e1),
        raw,
        data: null as unknown,
      };
    }
  }, [src, autoFix]);

  const output = useMemo(() => {
    if (!parsed.ok) return "";
    const data = sortKeys ? sortDeep(parsed.data) : parsed.data;
    if (indent === "min") return JSON.stringify(data);
    return JSON.stringify(data, null, indent === "tab" ? "\t" : Number(indent));
  }, [parsed, indent, sortKeys]);

  return (
    <TextToolLayout
      storageKey="json-pretty"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      inputLabel="JSON 이 포함된 답변을 붙여넣으세요 (설명 문장이 섞여 있어도 됩니다)"
      outputLabel={parsed.ok ? "✅ 유효한 JSON" : src.trim() ? "⚠️ 오류" : "결과"}
      downloadName="data.json"
      downloadMime="application/json;charset=utf-8"
      outputText={output}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-full shrink-0 font-medium sm:w-20">들여쓰기</span>
            <Radio
              name="jp-indent"
              value={indent}
              onChange={setIndent}
              options={[
                { value: "2", label: "2칸" },
                { value: "4", label: "4칸" },
                { value: "tab", label: "탭" },
                { value: "min", label: "한 줄로(최소화)" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <span className="w-full shrink-0 font-medium sm:w-20">보기</span>
            <Radio
              name="jp-view"
              value={view}
              onChange={setView}
              options={[
                { value: "text", label: "텍스트" },
                { value: "tree", label: "트리" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={sortKeys} onChange={setSortKeys} label="키 이름 순 정렬" />
            <Check checked={autoFix} onChange={setAutoFix} label="흔한 오류 자동 교정(트레일링 콤마·홑따옴표·주석)" />
          </OptionRow>
        </div>
      }
      output={
        !src.trim() ? (
          <p className="text-sm text-slate-400">JSON 또는 JSON 이 섞인 답변을 붙여넣으세요.</p>
        ) : !parsed.ok ? (
          <div className="space-y-2">
            <p className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">
              JSON 파싱 실패: {parsed.error || "JSON 형태를 찾지 못했습니다."}
            </p>
            {parsed.raw ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-slate-600">{parsed.raw.slice(0, 2000)}</pre>
            ) : null}
          </div>
        ) : view === "tree" ? (
          <TreeNode k={null} v={parsed.data} depth={0} />
        ) : (
          <OutputText text={output} />
        )
      }
    />
  );
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, sortDeep(o[k])]),
    );
  }
  return v;
}
