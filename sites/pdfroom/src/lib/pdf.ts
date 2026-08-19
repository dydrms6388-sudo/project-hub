"use client";

/**
 * PDF 처리 공통 로더.
 *
 * - 모든 대형 의존성(pdf-lib / fontkit / pdf.js / qpdf-wasm)은 이 파일의 함수를
 *   호출하는 시점에 `await import(...)` 로만 받는다. 컴포넌트 최상단 import 금지.
 * - pdf.js 워커·cmap·표준폰트·wasm 은 next.config.ts 가 node_modules 에서
 *   public/pdfjs 로 복사한 **같은 오리진의 로컬 파일**을 쓴다 (CDN 참조 없음).
 */

import { withBase } from "@/site.config";

/* ------------------------------------------------------------------ pdf-lib */

export type PdfLib = typeof import("pdf-lib");

let pdfLibPromise: Promise<PdfLib> | null = null;

export function loadPdfLib(): Promise<PdfLib> {
  pdfLibPromise ??= import("pdf-lib");
  return pdfLibPromise;
}

/* ------------------------------------------------------------------- pdf.js */

/** 필요한 부분만 좁게 선언한 pdf.js 타입 (버전 업 시 컴파일이 깨지지 않도록) */
export type PdfJsTextItem = { str: string; hasEOL?: boolean; transform?: number[] };
export type PdfJsViewport = { width: number; height: number };
export type PdfJsPage = {
  getViewport: (o: { scale: number; rotation?: number }) => PdfJsViewport;
  render: (o: {
    canvas: HTMLCanvasElement;
    viewport: PdfJsViewport;
    canvasContext?: CanvasRenderingContext2D;
    background?: string;
  }) => { promise: Promise<void>; cancel: () => void };
  getTextContent: () => Promise<{ items: (PdfJsTextItem | { type: string })[] }>;
  cleanup: () => void;
};
export type PdfJsDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
};
type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: Record<string, unknown>) => {
    promise: Promise<PdfJsDoc>;
    destroy: () => Promise<void>;
  };
};

let pdfjsPromise: Promise<PdfJsModule> | null = null;

export function loadPdfjs(): Promise<PdfJsModule> {
  pdfjsPromise ??= (async () => {
    const mod = (await import("pdfjs-dist")) as unknown as PdfJsModule;
    // 로컬 번들된 워커 (public/pdfjs/ — next.config.ts 가 복사)
    mod.GlobalWorkerOptions.workerSrc = withBase("/pdfjs/pdf.worker.min.mjs");
    return mod;
  })();
  return pdfjsPromise;
}

/** 암호가 걸린 PDF 를 만났을 때 던지는 에러 */
export class PdfPasswordError extends Error {
  constructor() {
    super("비밀번호가 걸린 PDF 입니다. 먼저 [PDF 비밀번호 해제] 도구로 잠금을 푼 뒤 사용해 주세요.");
    this.name = "PdfPasswordError";
  }
}

/**
 * pdf.js 문서 열기. `data` 는 pdf.js 가 소유(detach)하므로 **항상 복사본**을 넘긴다.
 */
export async function openPdfJs(bytes: Uint8Array): Promise<PdfJsDoc> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: withBase("/pdfjs/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: withBase("/pdfjs/standard_fonts/"),
    wasmUrl: withBase("/pdfjs/wasm/"),
    iccUrl: withBase("/pdfjs/iccs/"),
    isEvalSupported: false,
  });
  try {
    return await task.promise;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new PdfPasswordError();
    throw e;
  }
}

/* -------------------------------------------------------------- 한글 폰트 */

export const KOREAN_FONT_URL = "/fonts/Pretendard-Regular.subset.ttf";

let fontBytesPromise: Promise<Uint8Array> | null = null;

/** 서브셋 한글 폰트(Pretendard Regular, KS X 1001) 원본 바이트 */
export function loadKoreanFontBytes(): Promise<Uint8Array> {
  fontBytesPromise ??= (async () => {
    const res = await fetch(withBase(KOREAN_FONT_URL));
    if (!res.ok) throw new Error(`한글 폰트를 불러오지 못했습니다 (HTTP ${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  })();
  return fontBytesPromise;
}

export type EmbeddedFont = {
  /** pdf-lib PDFFont */
  font: import("pdf-lib").PDFFont;
  /** 폰트에 글리프가 없는 문자들 (중복 제거) */
  missingChars: (text: string) => string[];
  /** 한글 폰트 임베딩에 성공했는가 (false 면 Helvetica 폴백) */
  korean: boolean;
};

/**
 * 한글 텍스트를 그릴 수 있도록 서브셋 폰트를 임베딩한다.
 * 폰트를 못 받으면 예외를 던지지 않고 Helvetica 로 폴백하되 `korean:false` 를 돌려주어
 * 호출부가 "한글은 출력할 수 없습니다" 안내를 띄우게 한다. (깨진 글자를 조용히 내보내지 않는다)
 */
export async function embedKoreanFont(
  doc: import("pdf-lib").PDFDocument,
): Promise<EmbeddedFont> {
  const { StandardFonts } = await loadPdfLib();
  try {
    const [fontkitMod, bytes] = await Promise.all([
      import("@pdf-lib/fontkit"),
      loadKoreanFontBytes(),
    ]);
    const fontkit = (fontkitMod as unknown as { default?: unknown }).default ?? fontkitMod;
    doc.registerFontkit(fontkit as Parameters<typeof doc.registerFontkit>[0]);
    const font = await doc.embedFont(bytes, { subset: true });
    const set = new Set<number>(font.getCharacterSet());
    return {
      font,
      korean: true,
      missingChars: (text: string) => {
        const out = new Set<string>();
        for (const ch of text) {
          const cp = ch.codePointAt(0);
          if (cp === undefined) continue;
          if (ch === "\n" || ch === "\r" || ch === "\t") continue;
          if (!set.has(cp)) out.add(ch);
        }
        return [...out];
      },
    };
  } catch {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    return {
      font,
      korean: false,
      // WinAnsi 밖(=한글 포함)은 전부 출력 불가로 본다
      missingChars: (text: string) => {
        const out = new Set<string>();
        for (const ch of text) {
          const cp = ch.codePointAt(0) ?? 0;
          if (cp > 0xff) out.add(ch);
        }
        return [...out];
      },
    };
  }
}

/* ---------------------------------------------------------------- qpdf-wasm */

export type QpdfRun = {
  /** qpdf 종료 코드. 0=성공, 3=경고(결과는 생성됨), 그 외=실패 */
  code: number;
  stderr: string;
  output: Uint8Array | null;
};

/**
 * qpdf(WebAssembly)를 1회 실행한다. emscripten `main()` 은 인스턴스당 한 번만
 * 안전하게 호출할 수 있으므로 호출마다 새 인스턴스를 만든다.
 */
export async function runQpdf(
  inputs: { path: string; bytes: Uint8Array }[],
  args: string[],
  outPath: string | null,
): Promise<QpdfRun> {
  const mod = await import("@neslinesli93/qpdf-wasm");
  const factory = ((mod as unknown as { default?: unknown }).default ?? mod) as (o: {
    locateFile: () => string;
    printErr?: (s: string) => void;
    print?: (s: string) => void;
  }) => Promise<{
    callMain: (a: string[]) => number;
    FS: {
      writeFile: (p: string, d: Uint8Array) => void;
      readFile: (p: string) => Uint8Array;
    };
  }>;

  const lines: string[] = [];
  const qpdf = await factory({
    locateFile: () => withBase("/wasm/qpdf.wasm"),
    printErr: (s) => lines.push(s),
    print: (s) => lines.push(s),
  });

  for (const f of inputs) qpdf.FS.writeFile(f.path, f.bytes);

  let code: number;
  try {
    code = qpdf.callMain(args);
  } catch (e) {
    // emscripten 은 exit(non-zero) 를 예외로 던지기도 한다
    const status = (e as { status?: number }).status;
    code = typeof status === "number" ? status : 2;
    if (typeof status !== "number") lines.push(String((e as Error)?.message ?? e));
  }

  let output: Uint8Array | null = null;
  if (outPath && (code === 0 || code === 3)) {
    try {
      output = qpdf.FS.readFile(outPath);
    } catch {
      output = null;
    }
  }
  return { code, stderr: lines.join("\n"), output };
}

/* ------------------------------------------------------------------- 유틸 */

/** "1-3,5,8-" 형태를 0-based 페이지 인덱스 배열로. 잘못된 입력은 예외. */
export function parsePageRanges(spec: string, total: number): number[] {
  const trimmed = spec.trim();
  if (!trimmed) return Array.from({ length: total }, (_, i) => i);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const rawPart of trimmed.split(/[,\s]+/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const m = /^(\d+)\s*(?:-\s*(\d+)?)?$/.exec(part);
    if (!m) throw new Error(`페이지 범위 형식이 올바르지 않습니다: "${part}" (예: 1-3,5,8)`);
    const from = Number(m[1]);
    const hasDash = part.includes("-");
    const to = m[2] ? Number(m[2]) : hasDash ? total : from;
    if (from < 1 || to < 1) throw new Error("페이지 번호는 1 이상이어야 합니다.");
    if (from > total || to > total)
      throw new Error(`이 PDF 는 ${total}페이지입니다. ${Math.max(from, to)}페이지는 없습니다.`);
    const [a, b] = from <= to ? [from, to] : [to, from];
    for (let i = a; i <= b; i++) {
      if (seen.has(i - 1)) continue;
      seen.add(i - 1);
      out.push(i - 1);
    }
  }
  if (out.length === 0) throw new Error("선택된 페이지가 없습니다.");
  return out;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** UI 가 멈추지 않도록 이벤트 루프에 양보 */
export function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export async function fileBytes(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

/**
 * 파일 바이트에 암호화 사전(/Encrypt)이 들어 있는지 대충 훑어본다.
 * 암호화된 PDF 는 본문이 깨져 보이므로 pdf-lib 이 "손상된 파일" 처럼 실패하는데,
 * 그 경우 사용자에게 엉뚱한 안내가 나가지 않도록 미리 구분한다.
 */
function looksEncrypted(bytes: Uint8Array): boolean {
  const needle = "/Encrypt";
  const tail = bytes.length; // 전체를 훑되 ASCII 비교만 한다
  for (let i = 0; i < tail - needle.length; i++) {
    if (bytes[i] !== 0x2f /* '/' */) continue;
    let hit = true;
    for (let j = 1; j < needle.length; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

/** pdf-lib 로 문서 열기. 암호 PDF 는 친절한 메시지로 바꿔 던진다. */
export async function openPdfLib(bytes: Uint8Array) {
  const { PDFDocument } = await loadPdfLib();
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/encrypt/i.test(msg) || looksEncrypted(bytes)) throw new PdfPasswordError();
    throw new Error(`PDF 를 열지 못했습니다. 손상된 파일일 수 있습니다. (${msg})`);
  }
}

/** Uint8Array → 다운로드용 Blob (SharedArrayBuffer 타입 이슈 회피) */
export function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
