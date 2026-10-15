"use client";

import { useCallback, useEffect, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { baseName, fileBytes, formatBytes, openPdfLib, pdfBlob } from "@/lib/pdf";
import { usePageThumbs } from "@/tools/thumbs";
import { Btn, ErrorBox, Notice, ResultBox } from "@/tools/ui";

export default function DeletePages() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  /** 남길 페이지의 원본 인덱스 — 이 배열의 순서가 곧 결과 순서 */
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const { thumbs, total, progress, loading, error: thumbError } = usePageThumbs(bytes);

  useEffect(() => {
    setOrder(Array.from({ length: total }, (_, i) => i));
  }, [total]);

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
    setOrder([]);
    setBytes(f ? await fileBytes(f) : null);
  }, []);

  const thumbOf = (idx: number) => thumbs.find((t) => t.index === idx);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setResult(null);
    setOrder((prev) => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  }

  function drop(pos: number) {
    setResult(null);
    setOrder((prev) => prev.filter((_, i) => i !== pos));
  }

  async function run() {
    if (!bytes) return;
    if (order.length === 0) {
      setError("남길 페이지가 하나도 없습니다.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await openPdfLib(bytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, order);
      for (const p of copied) out.addPage(p);
      const saved = await out.save({ useObjectStreams: true });
      setResult(pdfBlob(saved));
    } catch (e) {
      setError((e as Error)?.message ?? "처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const removed = total - order.length;

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={200}
        onFiles={(f) => void onFiles(f)}
        hint="편집할 PDF 1개를 선택하세요"
      />

      {loading && <Progress value={progress} label="페이지 미리보기 만드는 중" />}
      <ErrorBox>{thumbError || error}</ErrorBox>

      {total > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>
              원본 {total}쪽 → 결과 <b>{order.length}</b>쪽 (삭제 {removed}쪽)
            </span>
            {removed > 0 || order.some((v, i) => v !== i) ? (
              <Btn
                variant="ghost"
                onClick={() => {
                  setOrder(Array.from({ length: total }, (_, i) => i));
                  setResult(null);
                }}
              >
                되돌리기
              </Btn>
            ) : null}
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {order.map((pageIdx, pos) => {
              const t = thumbOf(pageIdx);
              return (
                <li
                  key={pageIdx}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(pos))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(from)) move(from, pos);
                  }}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex h-32 items-center justify-center bg-slate-50">
                    {t ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.url}
                        alt={`원본 ${pageIdx + 1}쪽 미리보기`}
                        className="max-h-28 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">불러오는 중…</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
                    <span className="min-w-0 truncate text-xs text-slate-500">
                      {pos + 1}
                      <span className="text-slate-300"> ← 원본 {pageIdx + 1}쪽</span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={`${pos + 1}번째 페이지 앞으로 이동`}
                        onClick={() => move(pos, pos - 1)}
                        disabled={pos === 0}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={`${pos + 1}번째 페이지 뒤로 이동`}
                        onClick={() => move(pos, pos + 1)}
                        disabled={pos === order.length - 1}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        aria-label={`${pos + 1}번째 페이지 삭제`}
                        onClick={() => drop(pos)}
                        className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <Btn onClick={run} disabled={busy || order.length === 0}>
            {busy ? "저장 중…" : "적용해서 저장"}
          </Btn>
        </>
      )}

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <Btn onClick={() => saveBlob(result, `${baseName(file?.name ?? "edited")}_편집.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice>
        삭제·재정렬은 원본 페이지 객체를 그대로 새 문서로 복사하는 방식이라 이미지 재압축이 일어나지
        않습니다. 다만 삭제한 페이지를 가리키던 목차(북마크)와 내부 링크는 결과 파일에서 사라질 수
        있습니다.
      </Notice>
    </div>
  );
}
