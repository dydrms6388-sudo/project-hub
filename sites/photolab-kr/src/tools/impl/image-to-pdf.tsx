"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { convertFile } from "@/lib/image";
import { formatBytes, yieldToUI } from "@/lib/image-core";
import {
  Check,
  ManyFilesWarning,
  Notice,
  NumberField,
  PrivacyNote,
  ResultTable,
  RunButton,
  Select,
  Slider,
  type ResultRow,
} from "./_ui";

type Paper = "a4" | "letter" | "fit";
type Orient = "auto" | "portrait" | "landscape";

const PAPER_PT: Record<"a4" | "letter", [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const mmToPt = (mm: number) => (mm * 72) / 25.4;

export default function ImageToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [paper, setPaper] = useState<Paper>("a4");
  const [orient, setOrient] = useState<Orient>("auto");
  const [marginMm, setMarginMm] = useState(10);
  const [quality, setQuality] = useState(85);
  const [maxSide, setMaxSide] = useState(2000);
  const [limitSize, setLimitSize] = useState(true);
  const [sortByName, setSortByName] = useState(false);

  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setRows(null);
    setPdf(null);
    setFatal(null);
  }, []);

  function move(i: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setRows(null);
    setPdf(null);
  }

  async function run() {
    if (files.length === 0) return;
    setBusy(true);
    setFatal(null);
    setRows(null);
    setPdf(null);
    setPct(0);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      doc.setProducer("photolab-kr");
      doc.setCreator("photolab-kr");

      const list = sortByName
        ? [...files].sort((a, b) => a.name.localeCompare(b.name, "ko"))
        : files;
      const report: ResultRow[] = [];
      const margin = mmToPt(Math.max(0, marginMm));

      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setLabel(f.name);
        setPct((i / list.length) * 100);
        try {
          const lower = f.name.toLowerCase();
          const isJpg = /\.(jpe?g)$/.test(lower);
          const isPng = /\.png$/.test(lower);
          const needsReencode = limitSize || (!isJpg && !isPng);

          let embedded;
          let note = "";
          if (!needsReencode && isJpg) {
            const bytes = new Uint8Array(await f.arrayBuffer());
            try {
              embedded = await doc.embedJpg(bytes);
              note = "원본 JPG 그대로 삽입(재인코딩 없음)";
            } catch {
              const blob = await convertFile(f, {
                resize: { kind: "none" },
                format: "image/jpeg",
                quality: quality / 100,
                background: "#ffffff",
              });
              embedded = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
              note = "JPG 재인코딩 후 삽입";
            }
          } else if (!needsReencode && isPng) {
            embedded = await doc.embedPng(new Uint8Array(await f.arrayBuffer()));
            note = "원본 PNG 그대로 삽입(재인코딩 없음)";
          } else {
            const blob = await convertFile(f, {
              resize: limitSize ? { kind: "maxSide", value: maxSide } : { kind: "none" },
              format: "image/jpeg",
              quality: quality / 100,
              background: "#ffffff",
            });
            embedded = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
            note = limitSize ? `긴 변 ${maxSide}px 로 줄여 삽입` : "JPG 로 변환해 삽입";
          }

          const iw = embedded.width;
          const ih = embedded.height;

          let pw: number;
          let ph: number;
          if (paper === "fit") {
            pw = iw + margin * 2;
            ph = ih + margin * 2;
          } else {
            const [a, b] = PAPER_PT[paper];
            const landscape =
              orient === "landscape" || (orient === "auto" && iw > ih);
            pw = landscape ? b : a;
            ph = landscape ? a : b;
          }

          const page = doc.addPage([pw, ph]);
          const cw = Math.max(1, pw - margin * 2);
          const ch = Math.max(1, ph - margin * 2);
          const scale = Math.min(cw / iw, ch / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          page.drawImage(embedded, {
            x: (pw - dw) / 2,
            y: (ph - dh) / 2,
            width: dw,
            height: dh,
          });

          report.push({
            name: f.name,
            note: `${i + 1}쪽 · ${iw}×${ih}px · ${note}`,
            error: null,
          });
        } catch (e) {
          report.push({
            name: f.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        await yieldToUI();
      }

      if (doc.getPageCount() === 0) {
        throw new Error("PDF 에 넣을 수 있는 이미지가 없습니다.");
      }
      const bytes = await doc.save();
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      setPdf(new Blob([ab], { type: "application/pdf" }));
      setRows(report);
      setPct(100);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setLabel("");
    }
  }

  return (
    <div className="space-y-5">
      <FileDrop
        accept="image/*,.heic,.heif"
        extensions={["jpg", "jpeg", "png", "webp", "heic", "heif", "hif", "bmp", "gif", "avif"]}
        multiple
        maxSizeMB={200}
        onFiles={onFiles}
        hint="사진 여러 장 — 위에서부터 순서대로 한 장씩 페이지가 됩니다"
      />
      <ManyFilesWarning count={files.length} />

      {files.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">페이지 순서</p>
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 p-2">
                <span className="w-6 shrink-0 text-center text-xs text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || sortByName}
                  aria-label={`${f.name} 위로`}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === files.length - 1 || sortByName}
                  aria-label={`${f.name} 아래로`}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <Check label="파일 이름순으로 정렬" checked={sortByName} onChange={setSortByName} />
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <Select
          label="용지 크기"
          value={paper}
          onChange={setPaper}
          options={[
            { value: "a4", label: "A4 (210×297mm)" },
            { value: "letter", label: "Letter (216×279mm)" },
            { value: "fit", label: "사진 원본 크기에 맞춤" },
          ]}
        />
        <Select
          label="방향"
          value={orient}
          onChange={setOrient}
          options={[
            { value: "auto", label: "자동 (사진 비율에 맞춤)" },
            { value: "portrait", label: "세로 고정" },
            { value: "landscape", label: "가로 고정" },
          ]}
          hint={paper === "fit" ? "원본 크기 모드에서는 방향 설정이 적용되지 않습니다." : undefined}
        />
        <NumberField
          label="여백"
          value={marginMm}
          onChange={setMarginMm}
          min={0}
          max={50}
          suffix="mm"
        />
        <Slider
          label="이미지 품질"
          value={quality}
          min={50}
          max={100}
          onChange={setQuality}
          hint="JPG 원본을 그대로 넣을 때는 적용되지 않습니다."
        />
        <div className="space-y-3 sm:col-span-2">
          <Check
            label="PDF 용량을 위해 사진 해상도 줄이기"
            checked={limitSize}
            onChange={setLimitSize}
            hint="끄면 JPG·PNG 원본을 재인코딩 없이 그대로 넣어 화질이 100% 유지되지만 파일이 커집니다."
          />
          {limitSize ? (
            <NumberField
              label="긴 변 최대 길이"
              value={maxSide}
              onChange={setMaxSide}
              min={300}
              max={6000}
              suffix="px"
              hint="A4 인쇄 기준 2000px 정도면 육안으로 충분합니다."
            />
          ) : null}
        </div>
      </div>

      <RunButton onClick={run} busy={busy} disabled={files.length === 0}>
        PDF 만들기
      </RunButton>

      {busy ? <Progress value={pct} label={label || "PDF 만드는 중"} /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {pdf ? (
        <div className="space-y-3">
          <Notice tone="ok">PDF 완성 — {formatBytes(pdf.size)}</Notice>
          {rows ? <ResultTable rows={rows} /> : null}
          <button
            type="button"
            onClick={() => saveBlob(pdf, "photos.pdf")}
            aria-label="PDF 저장"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            PDF 저장
          </button>
        </div>
      ) : null}

      <PrivacyNote />
    </div>
  );
}
