"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openPdfJs, type PdfJsDoc } from "@/lib/pdf";

export type Thumb = { index: number; url: string; w: number; h: number };

/**
 * PDF 바이트 → 페이지 썸네일(dataURL) 목록.
 * pdf.js 는 자체 Web Worker(로컬 번들)에서 파싱하므로 메인 스레드는 캔버스 그리기만 한다.
 */
export function usePageThumbs(bytes: Uint8Array | null, maxWidth = 180) {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const runId = useRef(0);

  const run = useCallback(
    async (data: Uint8Array) => {
      const id = ++runId.current;
      setLoading(true);
      setError("");
      setThumbs([]);
      setProgress(0);
      let doc: PdfJsDoc | null = null;
      try {
        doc = await openPdfJs(data);
        if (id !== runId.current) return;
        setTotal(doc.numPages);
        const out: Thumb[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (id !== runId.current) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(maxWidth / base.width, 1.5);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(vp.width));
          canvas.height = Math.max(1, Math.ceil(vp.height));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
          page.cleanup();
          out.push({
            index: i - 1,
            url: canvas.toDataURL("image/jpeg", 0.7),
            w: canvas.width,
            h: canvas.height,
          });
          if (id !== runId.current) return;
          setThumbs([...out]);
          setProgress(Math.round((i / doc.numPages) * 100));
        }
      } catch (e) {
        if (id === runId.current) setError((e as Error)?.message ?? "미리보기를 만들지 못했습니다.");
      } finally {
        try {
          await doc?.destroy();
        } catch {
          /* noop */
        }
        if (id === runId.current) setLoading(false);
      }
    },
    [maxWidth],
  );

  useEffect(() => {
    if (!bytes) {
      runId.current++;
      setThumbs([]);
      setTotal(0);
      setProgress(0);
      setError("");
      setLoading(false);
      return;
    }
    void run(bytes);
  }, [bytes, run]);

  return { thumbs, total, progress, loading, error };
}
