"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import {
  baseName,
  fileBytes,
  formatBytes,
  openPdfLib,
  parsePageRanges,
  pdfBlob,
  yieldToUi,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

type Mode = "range" | "every" | "each";

export default function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("range");
  const [range, setRange] = useState("1-1");
  const [every, setEvery] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DownloadFile[] | null>(null);

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
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await fileBytes(file);
      const src = await openPdfLib(bytes);
      const total = src.getPageCount();
      const stem = baseName(file.name);

      // 각 결과물이 가져갈 페이지 인덱스 묶음
      let groups: { name: string; pages: number[] }[] = [];
      if (mode === "range") {
        const idx = parsePageRanges(range, total);
        groups = [{ name: `${stem}_${range.replace(/[^0-9,\-]/g, "") || "선택"}.pdf`, pages: idx }];
      } else if (mode === "every") {
        const n = Math.max(1, Math.floor(every));
        for (let s = 0; s < total; s += n) {
          const pages = [];
          for (let i = s; i < Math.min(s + n, total); i++) pages.push(i);
          groups.push({
            name: `${stem}_${pages[0] + 1}-${pages[pages.length - 1] + 1}.pdf`,
            pages,
          });
        }
      } else {
        for (let i = 0; i < total; i++) {
          groups.push({ name: `${stem}_p${String(i + 1).padStart(3, "0")}.pdf`, pages: [i] });
        }
      }

      const out: DownloadFile[] = [];
      for (let g = 0; g < groups.length; g++) {
        const doc = await PDFDocument.create();
        const copied = await doc.copyPages(src, groups[g].pages);
        for (const p of copied) doc.addPage(p);
        const saved = await doc.save({ useObjectStreams: true });
        out.push({ name: groups[g].name, blob: pdfBlob(saved) });
        setProgress(Math.round(((g + 1) / groups.length) * 100));
        if (g % 5 === 4) await yieldToUi();
      }
      setResult(out);
    } catch (e) {
      setError((e as Error)?.message ?? "분할 중 오류가 발생했습니다.");
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
        maxSizeMB={300}
        onFiles={onFiles}
        hint="분할할 PDF 1개를 선택하세요"
      />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">분할 방식</legend>
        {(
          [
            ["range", "페이지 범위만 뽑기 (1개 파일)"],
            ["every", "N페이지마다 자르기"],
            ["each", "모든 페이지를 낱장으로"],
          ] as [Mode, string][]
        ).map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="split-mode"
              value={v}
              checked={mode === v}
              onChange={() => {
                setMode(v);
                setResult(null);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {mode === "range" && (
        <Field label="페이지 범위" htmlFor="split-range" hint="예: 1-3,7,10- (10쪽부터 끝까지)">
          <input
            id="split-range"
            type="text"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className={inputCls}
          />
        </Field>
      )}

      {mode === "every" && (
        <Field label="몇 페이지마다 자를까요?" htmlFor="split-every">
          <input
            id="split-every"
            type="number"
            min={1}
            max={999}
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      )}

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "분할 중…" : "PDF 분할하기"}
      </Btn>

      {busy && <Progress value={progress} label="분할 중" />}
      <ErrorBox>{error}</ErrorBox>

      {result && result.length > 0 && (
        <ResultBox>
          <p className="text-sm text-slate-700">
            {result.length}개 파일 생성 · 합계{" "}
            {formatBytes(result.reduce((a, b) => a + b.blob.size, 0))}
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs text-slate-600">
            {result.map((f) => (
              <li key={f.name} className="truncate">
                {f.name} — {formatBytes(f.blob.size)}
              </li>
            ))}
          </ul>
          <Btn onClick={() => void saveFiles(result, `${baseName(file?.name ?? "split")}_분할.zip`)}>
            {result.length > 1 ? "ZIP 으로 다운로드" : "다운로드"}
          </Btn>
        </ResultBox>
      )}

      <Notice>
        분할은 페이지를 그대로 복사하는 방식이라 글꼴·이미지 품질이 전혀 손상되지 않습니다. 다만 원본에
        걸려 있던 목차(북마크)와 일부 양식 필드는 결과 파일에 따라오지 않을 수 있습니다.
      </Notice>
    </div>
  );
}
