"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  baseName,
  embedKoreanFont,
  fileBytes,
  formatBytes,
  openPdfLib,
  parsePageRanges,
  pdfBlob,
  yieldToUi,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

const POSITIONS = {
  "bottom-center": "아래 가운데",
  "bottom-right": "아래 오른쪽",
  "bottom-left": "아래 왼쪽",
  "top-center": "위 가운데",
  "top-right": "위 오른쪽",
  "top-left": "위 왼쪽",
} as const;
type Position = keyof typeof POSITIONS;

const FORMATS: { v: string; label: string }[] = [
  { v: "{n}", label: "1" },
  { v: "- {n} -", label: "- 1 -" },
  { v: "{n} / {total}", label: "1 / 20" },
  { v: "{n}쪽", label: "1쪽" },
  { v: "{n} 페이지", label: "1 페이지" },
  { v: "Page {n} of {total}", label: "Page 1 of 20" },
];

export default function PageNumbers() {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [format, setFormat] = useState("{n}");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [marginMm, setMarginMm] = useState(12);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError("");
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setWarn("");
    setResult(null);
    setProgress(0);
    try {
      const { rgb } = await import("pdf-lib");
      const doc = await openPdfLib(await fileBytes(file));
      const pages = doc.getPages();
      const indices = parsePageRanges(range, pages.length);
      const embedded = await embedKoreanFont(doc);
      const pdfFont = embedded.font;

      // 서식 문자열에 폰트가 못 그리는 글자가 있으면 중단 (깨진 글자를 내보내지 않는다)
      const sample = format.replace(/\{n\}/g, "0123456789").replace(/\{total\}/g, "");
      const missing = embedded.missingChars(sample);
      if (missing.length > 0) {
        throw new Error(
          embedded.korean
            ? `내장 폰트에 없는 글자가 서식에 있습니다: ${missing.join(" ")} — 해당 글자를 빼 주세요.`
            : `한글 폰트를 불러오지 못했습니다. 지금은 영문·숫자 서식만 사용할 수 있습니다 (문제 글자: ${missing.join(" ")}). 새로고침 후 다시 시도해 주세요.`,
        );
      }

      const margin = (marginMm * 72) / 25.4;
      const total = indices.length;

      for (let k = 0; k < indices.length; k++) {
        const page = pages[indices[k]];
        const { width: pw, height: ph } = page.getSize();
        const label = format
          .replace(/\{n\}/g, String(start + k))
          .replace(/\{total\}/g, String(start + total - 1));
        const tw = pdfFont.widthOfTextAtSize(label, size);

        const x =
          position.endsWith("left")
            ? margin
            : position.endsWith("right")
              ? pw - margin - tw
              : (pw - tw) / 2;
        const y = position.startsWith("top") ? ph - margin - size : margin;

        page.drawText(label, { x, y, size, font: pdfFont, color: rgb(0.2, 0.2, 0.2) });
        setProgress(Math.round(((k + 1) / indices.length) * 100));
        if (k % 20 === 19) await yieldToUi();
      }

      if (!embedded.korean) setWarn("한글 폰트를 불러오지 못해 기본 라틴 폰트로 처리했습니다.");
      const saved = await doc.save({ useObjectStreams: true });
      setResult(pdfBlob(saved));
    } catch (e) {
      setError((e as Error)?.message ?? "페이지 번호를 넣는 중 오류가 발생했습니다.");
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
        hint="페이지 번호를 넣을 PDF 1개를 선택하세요"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="위치" htmlFor="pn-pos">
          <select
            id="pn-pos"
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
            className={inputCls}
          >
            {Object.entries(POSITIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="서식" htmlFor="pn-fmt">
          <select
            id="pn-fmt"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={inputCls}
          >
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작 번호" htmlFor="pn-start" hint="표지를 1로 세지 않으려면 0 이하도 가능">
          <input
            id="pn-start"
            type="number"
            min={-50}
            max={9999}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="글자 크기 (pt)" htmlFor="pn-size">
          <input
            id="pn-size"
            type="number"
            min={6}
            max={48}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="가장자리 여백 (mm)" htmlFor="pn-margin">
          <input
            id="pn-margin"
            type="number"
            min={0}
            max={60}
            value={marginMm}
            onChange={(e) => setMarginMm(Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="적용할 페이지" htmlFor="pn-range" hint="비우면 전체. 예: 2- (2쪽부터)">
          <input
            id="pn-range"
            type="text"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder="전체"
            className={inputCls}
          />
        </Field>
      </div>

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "처리 중…" : "페이지 번호 넣기"}
      </Btn>

      {busy && <Progress value={progress} label="페이지 번호 삽입 중" />}
      <ErrorBox>{error}</ErrorBox>
      {warn && <Notice tone="warn">{warn}</Notice>}

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <Btn onClick={() => saveBlob(result, `${baseName(file?.name ?? "pdf")}_번호.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice>
        번호는 페이지 콘텐츠 스트림 맨 뒤에 텍스트로 덧그려집니다. 이미 인쇄된 번호가 있는 문서라면
        위치를 겹치지 않게 잡거나 여백을 늘려 주세요. &ldquo;{"{n}쪽"}&rdquo; 처럼 한글이 들어간
        서식은 서브셋 한글 폰트를 문서에 임베딩해 처리합니다.
      </Notice>
    </div>
  );
}
