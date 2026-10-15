"use client";

/**
 * 문서 파싱 — PDF(pdfjs-dist) / DOCX(mammoth) / 텍스트·마크다운.
 * 무거운 파서는 전부 사용자가 파일을 넣은 뒤 await import 로 받는다.
 * 파일은 브라우저 메모리에서만 다뤄지며 어디에도 업로드되지 않는다.
 */

import { chunkDocument, looksScanned, normalizeText, type Chunk, type PageText } from "./chunk";
import { docKey } from "./hash";

export type DocKind = "pdf" | "docx" | "text";

export type ParsedDoc = {
  id: string;
  name: string;
  kind: DocKind;
  pages: PageText[];
  chunks: Chunk[];
  chars: number;
  pageCount: number;
  /** 텍스트가 거의 없는 경우(스캔 PDF 등) */
  empty: boolean;
};

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "markdown"];

export function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function kindOf(name: string): DocKind {
  const e = extOf(name);
  if (e === "pdf") return "pdf";
  if (e === "docx") return "docx";
  return "text";
}

/** pdfjs 워커는 번들에 포함된 로컬 파일을 쓴다(외부 CDN 사용 안 함). */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

type TextItemLike = { str?: string; hasEOL?: boolean };

async function parsePdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PageText[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const pages: PageText[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items as TextItemLike[]) {
        if (typeof item.str !== "string") continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      pages.push({ page: i, text });
      page.cleanup();
      onProgress?.(i, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}

async function parseDocx(file: File): Promise<PageText[]> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  // DOCX 에는 고정된 페이지 개념이 없다 → 문단 덩어리를 "쪽"처럼 나눠 근거 표시에 쓴다.
  const text = normalizeText(result.value);
  const APPROX_PAGE = 1800;
  const pages: PageText[] = [];
  const paragraphs = text.split("\n");
  let buf = "";
  let page = 1;
  for (const p of paragraphs) {
    if (buf.length + p.length > APPROX_PAGE && buf.length > 0) {
      pages.push({ page, text: buf });
      page++;
      buf = "";
    }
    buf += `${p}\n`;
  }
  if (buf.trim()) pages.push({ page, text: buf });
  return pages.length > 0 ? pages : [{ page: 1, text }];
}

async function parseText(file: File): Promise<PageText[]> {
  const text = await file.text();
  const APPROX_PAGE = 1800;
  if (text.length <= APPROX_PAGE) return [{ page: 1, text }];
  const pages: PageText[] = [];
  const lines = text.split("\n");
  let buf = "";
  let page = 1;
  for (const l of lines) {
    if (buf.length + l.length > APPROX_PAGE && buf.length > 0) {
      pages.push({ page, text: buf });
      page++;
      buf = "";
    }
    buf += `${l}\n`;
  }
  if (buf.trim()) pages.push({ page, text: buf });
  return pages;
}

export async function parseFile(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ParsedDoc> {
  const kind = kindOf(file.name);
  let pages: PageText[];
  if (kind === "pdf") pages = await parsePdf(file, onProgress);
  else if (kind === "docx") pages = await parseDocx(file);
  else pages = await parseText(file);

  const empty = looksScanned(pages);
  const chunks = empty ? [] : chunkDocument(pages);
  const chars = chunks.reduce((a, c) => a + c.text.length, 0);
  const id = docKey(file.name, file.size, chunks.map((c) => c.text).join("").slice(0, 20000));
  return {
    id,
    name: file.name,
    kind,
    pages,
    chunks,
    chars,
    pageCount: pages.length,
    empty,
  };
}

export const SCANNED_HINT =
  "이 파일에서 추출된 텍스트가 거의 없습니다. 스캔한 이미지 PDF 로 보입니다. " +
  "이 도구는 OCR(이미지 글자 인식)을 하지 않으므로, 텍스트가 들어 있는 PDF 를 사용하거나 " +
  "원본 문서를 텍스트로 다시 내보낸 뒤 시도해 주세요.";
