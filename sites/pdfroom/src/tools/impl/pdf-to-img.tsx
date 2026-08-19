"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import {
  baseName,
  fileBytes,
  formatBytes,
  openPdfJs,
  parsePageRanges,
  yieldToUi,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

const SCALES = [
  { v: 1, label: "72 DPI — 화면용 (가장 작음)" },
  { v: 1.5, label: "108 DPI — 웹 게시용" },
  { v: 2, label: "144 DPI — 기본 권장" },
  { v: 3, label: "216 DPI — 확대 열람" },
  { v: 4.17, label: "300 DPI — 인쇄용 (매우 큼)" },
];

export default function PdfToImg() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(0.9);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ files: DownloadFile[]; previews: string[] } | null>(null);

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
    try {
      const bytes = await fileBytes(file);
      const doc = await openPdfJs(bytes);
      const indices = parsePageRanges(range, doc.numPages);
      const stem = baseName(file.name);
      const out: DownloadFile[] = [];
      const previews: string[] = [];

      for (let k = 0; k < indices.length; k++) {
        const pageNo = indices[k] + 1;
        const page = await doc.getPage(pageNo);
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

        const mime = format === "png" ? "image/png" : "image/jpeg";
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, mime, format === "jpeg" ? quality : undefined),
        );
        if (!blob) throw new Error(`${pageNo}쪽을 이미지로 만들지 못했습니다.`);
        out.push({
          name: `${stem}_p${String(pageNo).padStart(3, "0")}.${format === "png" ? "png" : "jpg"}`,
          blob,
        });
        if (previews.length < 6) previews.push(canvas.toDataURL("image/jpeg", 0.6));
        canvas.width = 0;
        canvas.height = 0;
        setProgress(Math.round(((k + 1) / indices.length) * 100));
        await yieldToUi();
      }
      await doc.destroy();
      setResult({ files: out, previews });
    } catch (e) {
      setError((e as Error)?.message ?? "변환 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={200}
        onFiles={onFiles}
        hint="이미지로 바꿀 PDF 1개를 선택하세요"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이미지 형식" htmlFor="p2i-fmt">
          <select
            id="p2i-fmt"
            value={format}
            onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}
            className={inputCls}
          >
            <option value="png">PNG — 글자가 또렷함 (용량 큼)</option>
            <option value="jpeg">JPG — 사진·스캔본에 적합 (용량 작음)</option>
          </select>
        </Field>
        <Field label="해상도" htmlFor="p2i-scale">
          <select
            id="p2i-scale"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className={inputCls}
          >
            {SCALES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {format === "jpeg" && (
        <Field label={`JPG 품질 — ${Math.round(quality * 100)}`} htmlFor="p2i-q">
          <input
            id="p2i-q"
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      )}

      <Field label="페이지 범위" htmlFor="p2i-range" hint="비우면 전체. 예: 1-5,9">
        <input
          id="p2i-range"
          type="text"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="전체"
          className={inputCls}
        />
      </Field>

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "변환 중…" : "이미지로 변환"}
      </Btn>

      {busy && <Progress value={progress} label="페이지 렌더링 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">
            {result.files.length}장 · 합계{" "}
            {formatBytes(result.files.reduce((a, b) => a + b.blob.size, 0))}
          </p>
          {result.previews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {result.previews.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.slice(-24) + i}
                  src={p}
                  alt={`미리보기 ${i + 1}`}
                  className="h-24 shrink-0 rounded border border-slate-200"
                />
              ))}
            </div>
          )}
          <Btn
            onClick={() =>
              void saveFiles(result.files, `${baseName(file?.name ?? "pdf")}_이미지.zip`)
            }
          >
            {result.files.length > 1 ? "ZIP 으로 다운로드" : "다운로드"}
          </Btn>
        </ResultBox>
      )}

      <Notice>
        PDF 는 벡터 문서라 &ldquo;원래 해상도&rdquo;라는 것이 없습니다. 1배율은 72 DPI(PDF 의 기본
        좌표 단위)에 해당하며, 배율을 올릴수록 글자가 선명해지는 대신 용량과 처리 시간이 제곱으로
        늘어납니다. 모바일에서는 300 DPI 로 여러 장을 한 번에 뽑으면 메모리 부족으로 실패할 수
        있습니다.
      </Notice>
    </div>
  );
}
