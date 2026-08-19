"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  baseName,
  fileBytes,
  formatBytes,
  openPdfJs,
  openPdfLib,
  pdfBlob,
  yieldToUi,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

type Mode = "lossless" | "raster";

const QUALITY: Record<string, { label: string; jpeg: number; dpi: number }> = {
  high: { label: "고품질 (150 DPI · JPEG 80)", jpeg: 0.8, dpi: 150 },
  balanced: { label: "표준 (110 DPI · JPEG 65)", jpeg: 0.65, dpi: 110 },
  small: { label: "최소 용량 (80 DPI · JPEG 50)", jpeg: 0.5, dpi: 80 },
};

export default function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("lossless");
  const [quality, setQuality] = useState<keyof typeof QUALITY>("balanced");
  const [gray, setGray] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; before: number } | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError("");
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(0);
    const before = file.size;
    try {
      const bytes = await fileBytes(file);
      if (mode === "lossless") {
        const doc = await openPdfLib(bytes);
        const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        setProgress(100);
        setResult({ blob: pdfBlob(saved), before });
      } else {
        const { PDFDocument } = await import("pdf-lib");
        const q = QUALITY[quality];
        const src = await openPdfJs(bytes);
        const out = await PDFDocument.create();
        for (let i = 1; i <= src.numPages; i++) {
          const page = await src.getPage(i);
          const base = page.getViewport({ scale: 1 });
          // PDF 좌표는 72 DPI 기준 → 원하는 DPI 배율로 렌더
          const scale = Math.min(q.dpi / 72, 3);
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
          if (gray) {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = img.data;
            for (let p = 0; p < d.length; p += 4) {
              const y = (d[p] * 299 + d[p + 1] * 587 + d[p + 2] * 114) / 1000;
              d[p] = d[p + 1] = d[p + 2] = y;
            }
            ctx.putImageData(img, 0, 0);
          }
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, "image/jpeg", q.jpeg),
          );
          if (!blob) throw new Error("페이지를 이미지로 변환하지 못했습니다.");
          const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
          // 원본 페이지 크기(포인트)를 그대로 유지
          const p = out.addPage([base.width, base.height]);
          p.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
          canvas.width = 0;
          canvas.height = 0;
          setProgress(Math.round((i / src.numPages) * 100));
          await yieldToUi();
        }
        await src.destroy();
        const saved = await out.save({ useObjectStreams: true });
        setResult({ blob: pdfBlob(saved), before });
      }
    } catch (e) {
      setError((e as Error)?.message ?? "압축 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const ratio =
    result && result.before > 0 ? Math.round((1 - result.blob.size / result.before) * 100) : 0;

  return (
    <div className="space-y-4">
      <Notice tone="warn" title="먼저 알아두세요 — 텍스트 PDF 는 거의 줄지 않습니다">
        PDF 용량의 대부분은 <b>스캔 이미지·사진</b>이 차지합니다. 한글·워드에서 내보낸 텍스트 위주
        PDF 는 이미 폰트와 텍스트 스트림이 압축(Flate)되어 있어 어떤 도구를 써도 몇 % 이상 줄이기
        어렵습니다. &ldquo;용량이 안 줄었다&rdquo;면 도구 문제가 아니라 그 PDF 에 줄일 이미지가 없는
        것입니다.
      </Notice>

      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={200}
        onFiles={onFiles}
        hint="용량을 줄일 PDF 1개를 선택하세요"
      />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">방식</legend>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="compress-mode"
            checked={mode === "lossless"}
            onChange={() => {
              setMode("lossless");
              setResult(null);
            }}
            className="mt-1"
          />
          <span>
            <b>무손실 정리</b> — 구조를 다시 쓰고 객체 스트림으로 묶습니다. 텍스트·검색·복사 그대로
            유지. 줄어드는 폭은 보통 0~15%.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="compress-mode"
            checked={mode === "raster"}
            onChange={() => {
              setMode("raster");
              setResult(null);
            }}
            className="mt-1"
          />
          <span>
            <b>이미지 재인코딩</b> — 각 페이지를 지정한 해상도의 JPEG 로 다시 만듭니다. 스캔 PDF 는
            크게 줄지만 <b>텍스트 선택·검색이 불가능해집니다.</b>
          </span>
        </label>
      </fieldset>

      {mode === "raster" && (
        <div className="space-y-3">
          <Field label="품질" htmlFor="compress-q">
            <select
              id="compress-q"
              value={quality}
              onChange={(e) => {
                setQuality(e.target.value as keyof typeof QUALITY);
                setResult(null);
              }}
              className={inputCls}
            >
              {Object.entries(QUALITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
            흑백(그레이스케일)로 변환 — 컬러 스캔본에서 추가로 줄어듭니다
          </label>
        </div>
      )}

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "처리 중…" : "용량 줄이기"}
      </Btn>

      {busy && <Progress value={progress} label="압축 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">
            {formatBytes(result.before)} → <b>{formatBytes(result.blob.size)}</b>{" "}
            {ratio > 0 ? (
              <span className="text-emerald-700">({ratio}% 감소)</span>
            ) : (
              <span className="text-amber-700">
                (거의 줄지 않았습니다 — 이미 최적화된 PDF 입니다)
              </span>
            )}
          </p>
          <Btn onClick={() => saveBlob(result.blob, `${baseName(file?.name ?? "pdf")}_압축.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}
    </div>
  );
}
