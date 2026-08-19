"use client";

import { useCallback, useRef, useState } from "react";
import Progress from "@/components/Progress";
import DocPicker from "@/components/docmind/DocPicker";
import EnginePanel from "@/components/docmind/EnginePanel";
import ResultView from "@/components/docmind/ResultView";
import { useEngine } from "@/components/docmind/useEngine";
import { chunkDocument } from "@/lib/docmind/chunk";
import { generate, tidy } from "@/lib/docmind/engine";
import { isAborted } from "@/lib/docmind/mapreduce";
import type { ParsedDoc } from "@/lib/docmind/parse";
import { runSummaryPipeline } from "@/lib/docmind/pipeline";
import { comparePrompt } from "@/lib/docmind/prompts";

export default function Compare() {
  const engine = useEngine();
  const [docs, setDocs] = useState<ParsedDoc[]>([]);
  const [summaries, setSummaries] = useState<{ name: string; summary: string }[]>([]);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ pct: number; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  const onDocs = useCallback((list: ParsedDoc[]) => {
    setDocs(list);
    setOut("");
    setSummaries([]);
    setErr(null);
  }, []);

  const usable = docs.filter((d) => !d.empty);
  const ready = engine.status === "ready" && usable.length === 2;

  async function run() {
    if (usable.length !== 2) return;
    signal.current = { aborted: false };
    setBusy(true);
    setOut("");
    setSummaries([]);
    setErr(null);
    try {
      const partial: { name: string; summary: string }[] = [];
      for (let i = 0; i < 2; i++) {
        const d = usable[i];
        const base = i * 45;
        const res = await runSummaryPipeline({
          chunks: chunkDocument(d.pages, { size: 1800, overlap: 150 }),
          kind: "summary",
          length: "상세",
          signal: signal.current,
          onStep: (done, total, label) =>
            setStep({ pct: base + (done / total) * 45, label: `${d.name} — ${label}` }),
        });
        partial.push({ name: d.name, summary: res.text });
        setSummaries([...partial]);
      }
      setStep({ pct: 92, label: "두 문서 비교 중" });
      const text = await generate(comparePrompt(partial[0], partial[1]), {
        maxTokens: 900,
        temperature: 0.3,
        signal: signal.current,
        onToken: (_d, full) => setOut(full),
      });
      setOut(tidy(text));
      setStep({ pct: 100, label: "완료" });
    } catch (e) {
      if (!isAborted(e)) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
        계약서 개정 전후, 제안서 두 건처럼 <b>비슷한 문서 두 개</b>를 비교합니다. 각 문서를 따로
        요약한 뒤 두 요약을 맞대어 공통점·차이점을 정리합니다. 글자 단위 diff 가 아니라{" "}
        <b>내용 비교</b>이므로, 조문 대조가 목적이라면 원문도 함께 확인하세요.
      </p>

      <EnginePanel engine={engine} />

      <section aria-label="문서 업로드">
        <h2 className="mb-2 text-sm font-bold text-slate-900">2단계 · 문서 2개 올리기</h2>
        <DocPicker
          multiple
          max={2}
          onChange={onDocs}
          hint="PDF · DOCX · TXT · MD 두 개 (각 최대 60MB)"
        />
        {docs.length > 0 && usable.length !== 2 ? (
          <p className="mt-2 text-xs text-amber-800">
            텍스트를 읽을 수 있는 문서가 정확히 2개 필요합니다. (현재 {usable.length}개)
          </p>
        ) : null}
      </section>

      <section aria-label="실행">
        <h2 className="mb-2 text-sm font-bold text-slate-900">3단계 · 비교 실행</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!ready || busy}
            aria-label="문서 비교 시작"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "비교 중…" : "비교 시작"}
          </button>
          {busy ? (
            <button
              type="button"
              onClick={() => {
                signal.current.aborted = true;
              }}
              aria-label="비교 중단"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              중단
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          문서를 두 번 요약한 뒤 비교하므로, 한 문서만 요약할 때보다 2배 이상 걸립니다.
        </p>
      </section>

      {step ? <Progress value={step.pct} label={step.label} /> : null}

      {err ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}

      <ResultView text={out} streaming={busy} title="비교 결과">
        {summaries.length > 0 ? (
          <details className="mt-3 rounded-lg bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">
              비교에 사용된 각 문서 요약 보기
            </summary>
            <div className="mt-2 space-y-3">
              {summaries.map((s) => (
                <div key={s.name}>
                  <p className="text-xs font-semibold text-slate-800">{s.name}</p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                    {s.summary}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </ResultView>
    </div>
  );
}
