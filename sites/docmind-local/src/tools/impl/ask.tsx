"use client";

import { useCallback, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import Progress from "@/components/Progress";
import DocPicker from "@/components/docmind/DocPicker";
import EnginePanel from "@/components/docmind/EnginePanel";
import { MiniMarkdown } from "@/components/docmind/ResultView";
import { useEngine } from "@/components/docmind/useEngine";
import { chunkDocument, type Chunk } from "@/lib/docmind/chunk";
import { embedPassages, embedQuery } from "@/lib/docmind/embed";
import { generate, tidy } from "@/lib/docmind/engine";
import { EMBED_MODEL } from "@/lib/docmind/models";
import type { ParsedDoc } from "@/lib/docmind/parse";
import { AI_NOTICE, askPrompt, type ChatMessage } from "@/lib/docmind/prompts";
import { mmr, topK } from "@/lib/docmind/similarity";
import { loadDocVectors, saveDocVectors, type StoredChunk } from "@/lib/docmind/vectordb";

/** RAG 검색용 청크는 요약용보다 잘게 나눈다(근거 페이지를 좁히기 위해). */
const ASK_CHUNK = { size: 900, overlap: 150 } as const;
const TOP_K = 4;

type Source = { n: number; startPage: number; endPage: number; score: number; text: string };
type Turn = { role: "user" | "assistant"; content: string; sources?: Source[] };

function pageLabel(s: number, e: number) {
  return s === e ? `${s}쪽` : `${s}~${e}쪽`;
}

export default function Ask() {
  const engine = useEngine();
  const [doc, setDoc] = useState<ParsedDoc | null>(null);
  const [index, setIndex] = useState<StoredChunk[] | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexPct, setIndexPct] = useState(0);
  const [indexNote, setIndexNote] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  const onDocs = useCallback((docs: ParsedDoc[]) => {
    setDoc(docs[0] ?? null);
    setIndex(null);
    setTurns([]);
    setIndexNote(null);
    setErr(null);
  }, []);

  async function buildIndex() {
    if (!doc) return;
    setIndexing(true);
    setErr(null);
    setIndexPct(0);
    try {
      const storeId = `${doc.id}-ask${ASK_CHUNK.size}`;
      const cachedRows = await loadDocVectors(storeId).catch(() => [] as StoredChunk[]);
      const chunks: Chunk[] = chunkDocument(doc.pages, ASK_CHUNK);
      if (cachedRows.length === chunks.length && cachedRows.length > 0) {
        setIndex(cachedRows);
        setIndexNote(`이전에 만든 색인을 재사용했습니다 (${cachedRows.length}개 구간).`);
        return;
      }
      const vectors = await embedPassages(
        chunks.map((c) => c.text),
        (done, total) => setIndexPct((done / total) * 100),
        signal.current,
      );
      await saveDocVectors(
        {
          docId: storeId,
          name: doc.name,
          chunks: chunks.length,
          chars: doc.chars,
          embedModel: EMBED_MODEL.id,
        },
        chunks,
        vectors,
      ).catch(() => {
        /* 저장 실패(프라이빗 모드 등)해도 이번 세션은 계속 쓴다 */
      });
      const rows: StoredChunk[] = chunks.map((c, i) => ({
        key: `${storeId}#${c.id}`,
        docId: storeId,
        chunkId: c.id,
        text: c.text,
        startPage: c.startPage,
        endPage: c.endPage,
        vector: vectors[i] ?? [],
      }));
      setIndex(rows);
      setIndexNote(`${rows.length}개 구간을 색인했습니다. 다음부터는 바로 질문할 수 있습니다.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing(false);
      setIndexPct(0);
    }
  }

  async function ask() {
    const question = q.trim();
    if (!question || !index || index.length === 0) return;
    signal.current = { aborted: false };
    setBusy(true);
    setErr(null);
    setQ("");
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: question }]);
    try {
      const qv = await embedQuery(question);
      // 후보를 넓게 뽑은 뒤(top-k) MMR 로 겹치는 구간을 걸러 4곳을 고른다.
      // 청크가 150자씩 겹치도록 잘려 있어, 순수 top-k 만 쓰면 같은 문단이 중복 선택된다.
      const pool = topK(qv, index, TOP_K * 3);
      const hits = mmr(qv, pool, TOP_K, 0.75);
      const sources: Source[] = hits.map((h, i) => ({
        n: i + 1,
        startPage: h.startPage,
        endPage: h.endPage,
        score: h.score,
        text: h.text,
      }));
      setTurns((prev) => [...prev, { role: "assistant", content: "", sources }]);
      const messages = askPrompt(
        question,
        hits.map((h) => ({ text: h.text, startPage: h.startPage, endPage: h.endPage })),
        history,
      );
      await generate(messages, {
        maxTokens: 600,
        temperature: 0.2,
        signal: signal.current,
        onToken: (_d, full) => {
          setTurns((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: full };
            return next;
          });
        },
      });
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: tidy(last.content) };
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canIndex = engine.status === "ready" && doc !== null && !doc.empty && !indexing;

  return (
    <div className="space-y-5">
      <EnginePanel engine={engine} />

      <section aria-label="문서 업로드">
        <h2 className="mb-2 text-sm font-bold text-slate-900">2단계 · 문서 올리기</h2>
        <DocPicker onChange={onDocs} />
      </section>

      <section aria-label="문서 색인">
        <h2 className="mb-2 text-sm font-bold text-slate-900">3단계 · 문서 색인 만들기</h2>
        <p className="mb-2 text-xs leading-relaxed text-slate-500">
          질문에 맞는 부분을 찾으려면 문서를 잘게 나눠 <b>임베딩 벡터</b>로 바꿔야 합니다. 임베딩
          모델({EMBED_MODEL.label})은 처음 한 번만 내려받고, 만들어진 벡터는 이 브라우저의
          IndexedDB 에만 저장됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void buildIndex()}
            disabled={!canIndex}
            aria-label="문서 색인 만들기"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {indexing ? "색인 중…" : index ? "색인 다시 만들기" : "문서 색인 만들기"}
          </button>
          {index ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              색인 {index.length}개 준비됨
            </span>
          ) : null}
        </div>
        {indexing ? (
          <div className="mt-2">
            <Progress value={indexPct} label="문서 임베딩 중" />
          </div>
        ) : null}
        {indexNote ? <p className="mt-2 text-xs text-slate-500">{indexNote}</p> : null}
      </section>

      <section aria-label="질문하기">
        <h2 className="mb-2 text-sm font-bold text-slate-900">4단계 · 질문하기</h2>

        <div className="space-y-3">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={`t-${i}`} className="ml-auto max-w-[90%] break-words rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm text-white">
                {t.content}
              </div>
            ) : (
              <div key={`t-${i}`} className="max-w-full rounded-xl border border-slate-200 p-3.5">
                <MiniMarkdown text={t.content || "…"} />
                {t.sources && t.sources.length > 0 ? (
                  <details className="mt-3 rounded-lg bg-slate-50 p-2.5">
                    <summary className="cursor-pointer text-xs font-medium text-slate-700">
                      근거 {t.sources.length}곳 ·{" "}
                      {t.sources.map((s) => pageLabel(s.startPage, s.endPage)).join(", ")}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {t.sources.map((s) => (
                        <li key={s.n} className="break-words text-xs leading-relaxed text-slate-600">
                          <span className="font-semibold text-slate-800">
                            [근거 {s.n}] {pageLabel(s.startPage, s.endPage)}
                          </span>{" "}
                          <span className="text-slate-400">(유사도 {s.score.toFixed(3)})</span>
                          <br />
                          {s.text.slice(0, 240)}
                          {s.text.length > 240 ? "…" : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyButton value={() => t.content} label="답변 복사" />
                </div>
              </div>
            ),
          )}
        </div>

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예: 이 계약의 해지 조건은?"
            aria-label="문서에 대한 질문 입력"
            disabled={!index || busy}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2.5 text-sm disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!index || busy || q.trim().length === 0}
            aria-label="질문 보내기"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "답변 중…" : "질문"}
          </button>
          {busy ? (
            <button
              type="button"
              onClick={() => {
                signal.current.aborted = true;
              }}
              aria-label="답변 중단"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
            >
              중단
            </button>
          ) : null}
        </form>

        {err ? (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}

        <p className="mt-4 rounded-lg bg-amber-50 p-2.5 text-xs font-medium leading-relaxed text-amber-900">
          ⚠️ {AI_NOTICE} 근거로 표시된 쪽수를 열어 직접 대조하세요.
        </p>
      </section>
    </div>
  );
}
