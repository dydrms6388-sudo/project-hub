"use client";

import { useCallback, useRef, useState } from "react";
import Progress from "@/components/Progress";
import DocPicker from "@/components/docmind/DocPicker";
import EnginePanel from "@/components/docmind/EnginePanel";
import ResultView from "@/components/docmind/ResultView";
import { useEngine } from "@/components/docmind/useEngine";
import { chunkDocument } from "@/lib/docmind/chunk";
import { isAborted } from "@/lib/docmind/mapreduce";
import type { ParsedDoc } from "@/lib/docmind/parse";
import { MAX_MAP_CHUNKS, runSummaryPipeline, type PipelineKind } from "@/lib/docmind/pipeline";
import { SUMMARY_LENGTHS, type SummaryLength } from "@/lib/docmind/prompts";

export type PipelineToolProps = {
  kind: PipelineKind;
  /** 요약 길이 선택 노출 여부 */
  showLength?: boolean;
  runLabel: string;
  busyLabel: string;
  resultTitle: string;
  uploadHint?: string;
  /** 도구별 안내 문구 */
  intro?: React.ReactNode;
};

/**
 * 맵리듀스 계열 도구(요약/핵심정리/영문요약)의 공통 화면.
 * 1) 모델 준비 → 2) 문서 업로드 → 3) 실행 → 결과 스트리밍
 */
export default function PipelineTool({
  kind,
  showLength = false,
  runLabel,
  busyLabel,
  resultTitle,
  uploadHint,
  intro,
}: PipelineToolProps) {
  const engine = useEngine();
  const [doc, setDoc] = useState<ParsedDoc | null>(null);
  const [length, setLength] = useState<SummaryLength>("문단");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ pct: number; label: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  const onDocs = useCallback((docs: ParsedDoc[]) => {
    setDoc(docs[0] ?? null);
    setOut("");
    setNote(null);
    setErr(null);
  }, []);

  const ready = engine.status === "ready" && doc !== null && !doc.empty;
  const stepNo = showLength ? "4단계" : "3단계";

  async function run() {
    if (!doc) return;
    signal.current = { aborted: false };
    setBusy(true);
    setOut("");
    setErr(null);
    setNote(null);
    setStep({ pct: 0, label: "준비 중" });
    try {
      // 문맥 4096토큰 한도 안에서 LLM 호출 수를 줄이기 위해 청크를 크게 잡는다.
      const chunks = chunkDocument(doc.pages, { size: 1800, overlap: 150 });
      const res = await runSummaryPipeline({
        chunks,
        kind,
        length,
        signal: signal.current,
        onStep: (done, total, label) => setStep({ pct: (done / total) * 100, label }),
        onToken: (_d, full) => setOut(full),
      });
      setOut(res.text);
      if (res.truncated) {
        setNote(
          `문서가 길어 앞쪽 ${MAX_MAP_CHUNKS}개 구간(전체 ${chunks.length}개)만 처리했습니다. ` +
            `뒷부분이 필요하면 문서를 나눠서 올려 주세요.`,
        );
      }
    } catch (e) {
      if (!isAborted(e)) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <div className="space-y-5">
      {intro ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{intro}</p>
      ) : null}

      <EnginePanel engine={engine} />

      <section aria-label="문서 업로드">
        <h2 className="mb-2 text-sm font-bold text-slate-900">2단계 · 문서 올리기</h2>
        <DocPicker onChange={onDocs} hint={uploadHint} />
      </section>

      {showLength ? (
        <section aria-label="요약 길이">
          <h2 className="mb-2 text-sm font-bold text-slate-900">3단계 · 요약 길이</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {SUMMARY_LENGTHS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLength(l.value)}
                aria-pressed={length === l.value}
                aria-label={`${l.label} 선택`}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  length === l.value
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-xs text-slate-500">{l.hint}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="실행">
        <h2 className="mb-2 text-sm font-bold text-slate-900">{stepNo} · 실행</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!ready || busy}
            aria-label={runLabel}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? busyLabel : runLabel}
          </button>
          {busy ? (
            <button
              type="button"
              onClick={() => {
                signal.current.aborted = true;
              }}
              aria-label="작업 중단"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              중단
            </button>
          ) : null}
          {!ready && !busy ? (
            <span className="text-xs text-slate-500">
              모델 준비와 문서 업로드를 마치면 활성화됩니다.
            </span>
          ) : null}
        </div>
      </section>

      {step ? <Progress value={step.pct} label={step.label} /> : null}

      {err ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}

      <ResultView text={out} streaming={busy} title={resultTitle}>
        {note ? <p className="mt-3 text-xs text-slate-500">{note}</p> : null}
      </ResultView>
    </div>
  );
}
