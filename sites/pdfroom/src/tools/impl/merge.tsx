"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  fileBytes,
  formatBytes,
  openPdfLib,
  parsePageRanges,
  pdfBlob,
  yieldToUi,
} from "@/lib/pdf";
import { nextId, syncOrdered, type WithFile } from "@/tools/files";
import { Btn, ErrorBox, Notice, ReorderList, ResultBox, inputCls } from "@/tools/ui";

type Item = WithFile & { range: string };

export default function Merge() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; pages: number } | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setResult(null);
    setError("");
    setItems((prev) =>
      syncOrdered<Item>(prev, files, (file, key) => ({ id: nextId(), key, file, range: "" })),
    );
  }, []);

  function setRange(id: string, range: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, range } : it)));
  }

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(0);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const src = await openPdfLib(await fileBytes(it.file));
        const total = src.getPageCount();
        let indices: number[];
        try {
          indices = parsePageRanges(it.range, total);
        } catch (e) {
          throw new Error(`${it.file.name}: ${(e as Error).message}`);
        }
        const copied = await out.copyPages(src, indices);
        for (const p of copied) out.addPage(p);
        setProgress(Math.round(((i + 1) / items.length) * 95));
        await yieldToUi();
      }
      if (out.getPageCount() === 0) throw new Error("합칠 페이지가 없습니다.");
      const bytes = await out.save({ useObjectStreams: true });
      setProgress(100);
      setResult({ blob: pdfBlob(bytes), pages: out.getPageCount() });
    } catch (e) {
      setError((e as Error)?.message ?? "합치는 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple
        maxSizeMB={300}
        onFiles={onFiles}
        hint="PDF 파일 2개 이상을 선택하세요 (한 번에 여러 개 가능)"
      />

      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">
            합칠 순서 · 파일별 페이지 범위
          </h3>
          <p className="text-xs text-slate-500">
            항목을 끌어다 놓거나 ↑ ↓ 버튼으로 순서를 바꿉니다. 페이지 범위를 비워 두면 그 파일의
            전체 페이지를 사용합니다.
          </p>
          <ReorderList
            items={items.map((it) => ({
              ...it,
              label: it.file.name,
              sub: formatBytes(it.file.size),
            }))}
            removable={false}
            onChange={(next) => {
              setItems(next);
              setResult(null);
            }}
            renderExtra={(it) => (
              <input
                type="text"
                value={it.range}
                onChange={(e) => setRange(it.id, e.target.value)}
                placeholder="전체 (예: 1-3,7,10-)"
                aria-label={`${it.file.name} 페이지 범위`}
                className={inputCls}
              />
            )}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={run} disabled={busy || items.length < 1}>
          {busy ? "합치는 중…" : "PDF 합치기"}
        </Btn>
        <span className="text-xs text-slate-500">{items.length}개 파일 선택됨</span>
      </div>

      {busy && <Progress value={progress} label="PDF 합치는 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">
            완료 — 총 <b>{result.pages}</b>페이지, {formatBytes(result.blob.size)}
          </p>
          <Btn onClick={() => saveBlob(result.blob, "merged.pdf")}>merged.pdf 다운로드</Btn>
        </ResultBox>
      )}

      <Notice>
        페이지 범위는 <code>1-3</code>(1~3쪽), <code>5</code>(5쪽만), <code>8-</code>(8쪽부터 끝까지)
        처럼 씁니다. 쉼표로 여러 구간을 이을 수 있고, 적은 순서대로 페이지가 배치됩니다.
      </Notice>
    </div>
  );
}
