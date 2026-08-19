"use client";

import { useMemo, useState } from "react";
import TextToolLayout, { Check, OptionRow } from "@/components/TextToolLayout";

const SAMPLE = `당신은  전문 카피라이터입니다.


아래 조건에 맞춰 {{제품명}} 소개 문구를 작성하세요.
- 톤: {{톤}}
- 길이: 3문장  `;

export function cleanPrompt(
  src: string,
  opt: {
    trimLine: boolean;
    collapseSpace: boolean;
    maxBlank: number;
    tabToSpace: boolean;
    normalizeQuotes: boolean;
    fullWidth: boolean;
    unifyBullet: boolean;
  },
): string {
  if (!src) return "";
  let s = src.replace(/\r\n?/g, "\n");
  if (opt.tabToSpace) s = s.replace(/\t/g, "  ");
  // 비표준 공백(NBSP, 얇은 공백 등) → 일반 공백
  s = s.replace(/[   -   　]/g, " ");
  // 제로폭 문자 제거 (복사 과정에서 자주 섞인다)
  s = s.replace(/[​-‍﻿]/g, "");
  if (opt.normalizeQuotes) {
    s = s.replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"');
    s = s.replace(/[‐-―]/g, "-").replace(/…/g, "...");
  }
  if (opt.fullWidth) {
    s = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  }
  if (opt.unifyBullet) s = s.replace(/^(\s*)[•‧·▪◦∙]\s*/gm, "$1- ");
  if (opt.collapseSpace) s = s.replace(/ {2,}/g, " ");
  if (opt.trimLine) s = s.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");
  const max = Math.max(0, opt.maxBlank);
  s = s.replace(new RegExp(`\\n{${max + 2},}`, "g"), "\n".repeat(max + 1));
  return s.trim();
}

export function findVars(s: string): string[] {
  const set = new Set<string>();
  for (const m of s.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) set.add(m[1].trim());
  return [...set];
}

/**
 * 토큰 수 근사.
 * 정확한 값은 모델별 토크나이저(BPE)에 따라 다르므로 참고용이다.
 * 경험적으로 한글은 1자 ≈ 1.5토큰, 영문/숫자는 4자 ≈ 1토큰에 가깝다.
 */
export function estimateTokens(s: string): { total: number; hangul: number; latin: number; other: number } {
  let hangul = 0;
  let latin = 0;
  let other = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if ((cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x3131 && cp <= 0x318e)) hangul++;
    else if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) latin++;
    else other++;
  }
  const total = Math.round(hangul * 1.5 + latin / 4 + other * 0.5);
  return { total, hangul, latin, other };
}

function Highlight({ text }: { text: string }) {
  if (!text) return <p className="text-sm text-slate-400">왼쪽에 프롬프트를 붙여넣으면 정리 결과가 표시됩니다.</p>;
  const parts = text.split(/(\{\{\s*[^{}]+?\s*\}\})/g);
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">
      {parts.map((p, i) =>
        /^\{\{[\s\S]*\}\}$/.test(p) ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 font-semibold text-amber-900">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </pre>
  );
}

export default function PromptCleaner() {
  const [src, setSrc] = useState("");
  const [trimLine, setTrimLine] = useState(true);
  const [collapseSpace, setCollapse] = useState(true);
  const [maxBlank, setMaxBlank] = useState(1);
  const [tabToSpace, setTab] = useState(true);
  const [normalizeQuotes, setQuotes] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);
  const [unifyBullet, setUnify] = useState(true);

  const result = useMemo(
    () => cleanPrompt(src, { trimLine, collapseSpace, maxBlank, tabToSpace, normalizeQuotes, fullWidth, unifyBullet }),
    [src, trimLine, collapseSpace, maxBlank, tabToSpace, normalizeQuotes, fullWidth, unifyBullet],
  );
  const vars = useMemo(() => findVars(result), [result]);
  const tok = useMemo(() => estimateTokens(result), [result]);
  const saved = src.length - result.length;

  return (
    <TextToolLayout
      storageKey="prompt-cleaner"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      inputLabel="프롬프트를 붙여넣으세요"
      outputLabel="정리된 프롬프트"
      downloadName="prompt.txt"
      outputText={result}
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <Check checked={trimLine} onChange={setTrimLine} label="줄 끝 공백 제거" />
            <Check checked={collapseSpace} onChange={setCollapse} label="연속 공백 하나로" />
            <Check checked={tabToSpace} onChange={setTab} label="탭 → 공백 2칸" />
          </OptionRow>
          <OptionRow>
            <Check checked={normalizeQuotes} onChange={setQuotes} label="스마트 따옴표·대시 → 일반 기호" />
            <Check checked={fullWidth} onChange={setFullWidth} label="전각 영숫자 → 반각" />
            <Check checked={unifyBullet} onChange={setUnify} label="글머리 기호 - 로 통일" />
          </OptionRow>
          <OptionRow>
            <label className="inline-flex items-center gap-2" htmlFor="pc-blank">
              <span className="font-medium">허용할 연속 빈 줄</span>
              <select
                id="pc-blank"
                value={maxBlank}
                onChange={(e) => setMaxBlank(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                <option value={0}>0줄 (빈 줄 없음)</option>
                <option value={1}>1줄</option>
                <option value={2}>2줄</option>
              </select>
            </label>
          </OptionRow>
        </div>
      }
      output={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs text-slate-500">글자수</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">{result.length}</div>
              {saved > 0 ? <div className="text-[11px] text-emerald-600">-{saved}자 정리됨</div> : null}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs text-slate-500">토큰 추정</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">≈{tok.total}</div>
              <div className="text-[11px] text-slate-400">한글 1자≈1.5토큰 기준</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs text-slate-500">변수 {"{{ }}"}</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">{vars.length}개</div>
            </div>
          </div>

          {vars.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <span key={v} className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs text-amber-900">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-slate-500">
            토큰 수는 근사치입니다. 실제 값은 모델별 토크나이저(BPE)에 따라 달라지므로 과금·컨텍스트 한도 판단은 각 서비스의
            공식 계산기를 확인하세요.
          </p>

          <Highlight text={result} />
        </div>
      }
    />
  );
}
