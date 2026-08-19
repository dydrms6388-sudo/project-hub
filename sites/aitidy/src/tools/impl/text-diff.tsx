"use client";

import { useEffect, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { saveBlob } from "@/components/DownloadButton";
import { Check, DraftNotice, OptionRow, Radio, useLocalDraft } from "@/components/TextToolLayout";

type Mode = "word" | "line" | "char";
type Part = { value: string; added?: boolean; removed?: boolean };

export default function TextDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [mode, setMode] = useState<Mode>("word");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreSpace, setIgnoreSpace] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [err, setErr] = useState("");

  const draftA = useLocalDraft("text-diff-a", a, setA);
  const draftB = useLocalDraft("text-diff-b", b, setB);

  useEffect(() => {
    let alive = true;
    if (!a && !b) {
      setParts([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const d = await import("diff");
        if (!alive) return;
        const opts = { ignoreCase };
        let res: Part[];
        if (mode === "line") res = d.diffLines(a, b, { ...opts, ignoreWhitespace: ignoreSpace }) as Part[];
        else if (mode === "char") res = d.diffChars(a, b, opts) as Part[];
        else if (ignoreSpace) res = d.diffWords(a, b, opts) as Part[];
        else res = d.diffWordsWithSpace(a, b, opts) as Part[];
        setParts(res);
        setErr("");
      } catch {
        if (alive) setErr("비교 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      }
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [a, b, mode, ignoreCase, ignoreSpace]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let same = 0;
    for (const p of parts) {
      const n = p.value.length;
      if (p.added) added += n;
      else if (p.removed) removed += n;
      else same += n;
    }
    return { added, removed, same };
  }, [parts]);

  const summaryText = useMemo(
    () =>
      parts
        .filter((p) => p.added || p.removed)
        .map((p) => `${p.added ? "+ " : "- "}${p.value.replace(/\n+$/, "")}`)
        .join("\n"),
    [parts],
  );

  const clearAll = () => {
    draftA.clear();
    draftB.clear();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-20 shrink-0 font-medium">비교 단위</span>
            <Radio
              name="td-mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "word", label: "단어" },
                { value: "line", label: "줄" },
                { value: "char", label: "글자" },
              ]}
            />
          </OptionRow>
          <OptionRow>
            <Check checked={ignoreSpace} onChange={setIgnoreSpace} label="공백 차이 무시" />
            <Check checked={ignoreCase} onChange={setIgnoreCase} label="대소문자 무시" />
          </OptionRow>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={() => summaryText} label="변경분 복사" />
        <button
          type="button"
          onClick={() => saveBlob(new Blob([summaryText], { type: "text/plain;charset=utf-8" }), "diff.txt")}
          disabled={!summaryText}
          aria-label="변경분 다운로드"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          다운로드
        </button>
        <button
          type="button"
          onClick={() => {
            setA(b);
            setB(a);
          }}
          aria-label="원본과 수정본 바꾸기"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⇄ 좌우 바꾸기
        </button>
        <button
          type="button"
          onClick={clearAll}
          aria-label="입력 비우기"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          입력 비우기
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label htmlFor="td-a" className="block text-sm font-medium text-slate-700">
            원본 (A)
          </label>
          <textarea
            id="td-a"
            value={a}
            onChange={(e) => setA(e.target.value)}
            spellCheck={false}
            placeholder="첫 번째 답변을 붙여넣으세요"
            className="h-48 w-full resize-y rounded-xl border border-slate-300 p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-500 sm:h-64"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="td-b" className="block text-sm font-medium text-slate-700">
            비교본 (B)
          </label>
          <textarea
            id="td-b"
            value={b}
            onChange={(e) => setB(e.target.value)}
            spellCheck={false}
            placeholder="두 번째 답변을 붙여넣으세요"
            className="h-48 w-full resize-y rounded-xl border border-slate-300 p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-500 sm:h-64"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">비교 결과</span>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            추가 {stats.added}자
          </span>
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
            삭제 {stats.removed}자
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            동일 {stats.same}자
          </span>
        </div>
        <div className="min-h-40 overflow-x-auto rounded-xl border border-slate-300 bg-slate-50 p-3">
          {err ? (
            <p className="text-sm text-rose-600">{err}</p>
          ) : parts.length === 0 ? (
            <p className="text-sm text-slate-400">양쪽에 텍스트를 붙여넣으면 차이가 즉시 표시됩니다.</p>
          ) : (
            <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">
              {parts.map((p, i) => (
                <span
                  key={i}
                  className={
                    p.added
                      ? "rounded bg-emerald-200/70 text-emerald-950"
                      : p.removed
                        ? "rounded bg-rose-200/70 text-rose-950 line-through"
                        : ""
                  }
                >
                  {p.value}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <DraftNotice hasSaved={draftA.hasSaved || draftB.hasSaved} onClear={clearAll} />
    </div>
  );
}
