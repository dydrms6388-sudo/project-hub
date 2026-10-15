"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { fileBytes, formatBytes, pdfBlob, yieldToUi } from "@/lib/pdf";
import { nextId, syncOrdered, type WithFile } from "@/tools/files";
import { Btn, ErrorBox, Field, Notice, ReorderList, ResultBox, inputCls } from "@/tools/ui";

/** mm → PDF 포인트 (1pt = 1/72inch, 1inch = 25.4mm) */
const mm = (v: number) => (v * 72) / 25.4;

const PAPERS: Record<string, { label: string; w: number; h: number } | null> = {
  a4: { label: "A4 (210 × 297 mm)", w: mm(210), h: mm(297) },
  a5: { label: "A5 (148 × 210 mm)", w: mm(148), h: mm(210) },
  a3: { label: "A3 (297 × 420 mm)", w: mm(297), h: mm(420) },
  letter: { label: "Letter (216 × 279 mm)", w: mm(215.9), h: mm(279.4) },
  fit: null, // 이미지 크기에 맞춤
};

type Item = WithFile;

async function toEmbeddable(
  file: File,
  optimize: boolean,
  maxDim: number,
  quality: number,
): Promise<{ bytes: Uint8Array; kind: "jpg" | "png" }> {
  const name = file.name.toLowerCase();
  const isJpg = file.type === "image/jpeg" || /\.jpe?g$/.test(name);
  const isPng = file.type === "image/png" || /\.png$/.test(name);
  if (!optimize && (isJpg || isPng)) {
    return { bytes: await fileBytes(file), kind: isPng ? "png" : "jpg" };
  }
  // webp/gif/bmp 는 pdf-lib 가 못 읽으므로 JPEG 로 변환한다 (최적화 옵션도 같은 경로)
  const { default: imageCompression } = await import("browser-image-compression");
  const out = await imageCompression(file, {
    maxWidthOrHeight: maxDim,
    initialQuality: quality,
    fileType: "image/jpeg",
    // useWebWorker:true 는 이 라이브러리가 워커 스크립트를 jsDelivr CDN 에서 받아오게 한다.
    // 외부 의존을 없애기 위해 메인 스레드에서 처리한다.
    useWebWorker: false,
    maxSizeMB: 30,
  });
  return { bytes: new Uint8Array(await out.arrayBuffer()), kind: "jpg" };
}

export default function ImgToPdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [paper, setPaper] = useState<keyof typeof PAPERS>("a4");
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState(10);
  const [optimize, setOptimize] = useState(true);
  const [maxDim, setMaxDim] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setResult(null);
    setError("");
    setItems((prev) => syncOrdered<Item>(prev, files, (file, key) => ({ id: nextId(), key, file })));
  }, []);

  async function run() {
    if (items.length === 0) return;
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(0);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const m = mm(Math.max(0, margin));

      for (let i = 0; i < items.length; i++) {
        const { bytes, kind } = await toEmbeddable(items[i].file, optimize, maxDim, 0.82);
        let img;
        try {
          img = kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        } catch {
          throw new Error(
            `${items[i].file.name} 을(를) 읽지 못했습니다. JPG·PNG·WEBP 이미지인지 확인해 주세요.`,
          );
        }

        const spec = PAPERS[paper];
        let pw: number;
        let ph: number;
        if (spec) {
          pw = landscape ? spec.h : spec.w;
          ph = landscape ? spec.w : spec.h;
        } else {
          pw = img.width + m * 2;
          ph = img.height + m * 2;
        }
        const page = doc.addPage([pw, ph]);
        const boxW = Math.max(1, pw - m * 2);
        const boxH = Math.max(1, ph - m * 2);
        const scale = Math.min(boxW / img.width, boxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });

        setProgress(Math.round(((i + 1) / items.length) * 100));
        await yieldToUi();
      }
      const saved = await doc.save({ useObjectStreams: true });
      setResult(pdfBlob(saved));
    } catch (e) {
      setError((e as Error)?.message ?? "변환 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["jpg", "jpeg", "png", "webp", "gif", "bmp"]}
        accept="image/*"
        multiple
        maxSizeMB={80}
        onFiles={onFiles}
        hint="JPG · PNG · WEBP · GIF · BMP 이미지를 여러 장 선택할 수 있습니다"
      />

      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">페이지 순서</h3>
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
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="용지" htmlFor="itp-paper">
          <select
            id="itp-paper"
            value={paper}
            onChange={(e) => {
              setPaper(e.target.value as keyof typeof PAPERS);
              setResult(null);
            }}
            className={inputCls}
          >
            {Object.entries(PAPERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v ? v.label : "이미지 크기에 맞춤"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="여백 (mm)" htmlFor="itp-margin">
          <input
            id="itp-margin"
            type="number"
            min={0}
            max={60}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={landscape}
          disabled={paper === "fit"}
          onChange={(e) => setLandscape(e.target.checked)}
        />
        가로 방향(landscape)
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
        긴 변을 줄여 용량 최적화
      </label>
      {optimize && (
        <Field label="긴 변 최대 픽셀" htmlFor="itp-max" hint="2000px 면 A4 인쇄에 충분합니다">
          <input
            id="itp-max"
            type="number"
            min={600}
            max={6000}
            step={100}
            value={maxDim}
            onChange={(e) => setMaxDim(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      )}

      <Btn onClick={run} disabled={busy || items.length === 0}>
        {busy ? "변환 중…" : "PDF 로 변환"}
      </Btn>

      {busy && <Progress value={progress} label="이미지 변환 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">
            완료 — {items.length}페이지, {formatBytes(result.size)}
          </p>
          <Btn onClick={() => saveBlob(result, "images.pdf")}>images.pdf 다운로드</Btn>
        </ResultBox>
      )}

      <Notice>
        PDF 에 직접 넣을 수 있는 이미지는 JPEG 와 PNG 뿐입니다. WEBP·GIF·BMP 는 브라우저가 한 번
        디코딩한 뒤 JPEG 로 다시 인코딩해 넣습니다. PNG 를 최적화 없이 넣으면 투명도가 보존되지만
        용량이 커질 수 있습니다.
      </Notice>
    </div>
  );
}
