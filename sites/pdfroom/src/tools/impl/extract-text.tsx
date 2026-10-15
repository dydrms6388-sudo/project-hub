"use client";

import { useCallback, useState } from "react";
import CopyButton from "@/components/CopyButton";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  baseName,
  fileBytes,
  openPdfJs,
  parsePageRanges,
  yieldToUi,
  type PdfJsTextItem,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, inputCls } from "@/tools/ui";

export default function ExtractText() {
  const [file, setFile] = useState<File | null>(null);
  const [range, setRange] = useState("");
  const [withHeader, setWithHeader] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
    setText("");
    setError("");
    setEmpty(false);
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setText("");
    setEmpty(false);
    setProgress(0);
    try {
      const doc = await openPdfJs(await fileBytes(file));
      const indices = parsePageRanges(range, doc.numPages);
      const chunks: string[] = [];
      for (let k = 0; k < indices.length; k++) {
        const pageNo = indices[k] + 1;
        const page = await doc.getPage(pageNo);
        const content = await page.getTextContent();
        let buf = "";
        for (const raw of content.items) {
          const item = raw as PdfJsTextItem;
          if (typeof item.str !== "string") continue; // TextMarkedContent 는 건너뛴다
          buf += item.str;
          if (item.hasEOL) buf += "\n";
        }
        page.cleanup();
        const body = buf.replace(/[ \t]+\n/g, "\n").trim();
        chunks.push(withHeader ? `----- ${pageNo}쪽 -----\n${body}` : body);
        setProgress(Math.round(((k + 1) / indices.length) * 100));
        if (k % 5 === 4) await yieldToUi();
      }
      await doc.destroy();
      const joined = chunks.join("\n\n").trim();
      setText(joined);
      setEmpty(joined.replace(/-----.*-----/g, "").trim().length === 0);
    } catch (e) {
      setError((e as Error)?.message ?? "텍스트를 추출하는 중 오류가 발생했습니다.");
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
        hint="텍스트를 뽑을 PDF 1개를 선택하세요"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="페이지 범위" htmlFor="et-range" hint="비우면 전체. 예: 1-10">
          <input
            id="et-range"
            type="text"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder="전체"
            className={inputCls}
          />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={withHeader}
            onChange={(e) => setWithHeader(e.target.checked)}
          />
          페이지 구분선 넣기
        </label>
      </div>

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "추출 중…" : "텍스트 추출"}
      </Btn>

      {busy && <Progress value={progress} label="텍스트 추출 중" />}
      <ErrorBox>{error}</ErrorBox>

      {empty && (
        <Notice tone="warn" title="글자를 하나도 찾지 못했습니다">
          이 PDF 는 <b>스캔 이미지</b>로만 이루어져 있을 가능성이 높습니다. 이런 파일에서 글자를
          뽑으려면 OCR(광학 문자 인식)이 필요하고, 이 도구는 OCR 을 하지 않습니다.
        </Notice>
      )}

      {text && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={text} label="전체 복사" />
            <Btn
              variant="ghost"
              onClick={() =>
                saveBlob(
                  new Blob([text], { type: "text/plain;charset=utf-8" }),
                  `${baseName(file?.name ?? "pdf")}.txt`,
                )
              }
            >
              .txt 로 저장
            </Btn>
            <span className="text-xs text-slate-500">{text.length.toLocaleString()}자</span>
          </div>
          <textarea
            readOnly
            value={text}
            aria-label="추출된 텍스트"
            className="h-80 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs leading-relaxed"
          />
        </div>
      )}

      <Notice>
        PDF 안의 글자는 &ldquo;문단&rdquo;이 아니라 좌표가 붙은 조각으로 저장되어 있습니다.
        pdf.js 가 그 조각(textContent)을 읽어 순서대로 이어 붙이기 때문에, 단이 나뉜 논문이나 표가
        많은 문서에서는 줄바꿈이 원문과 다르게 보일 수 있습니다.
      </Notice>
    </div>
  );
}
