/**
 * 문서 청크 분할 — 순수 함수만 있으며 브라우저/노드 어디서나 동작한다.
 * (scripts/verify-core.ts 에서 노드로 직접 검산한다)
 */

export type PageText = { page: number; text: string };

export type Chunk = {
  /** 문서 내 0-base 순번 */
  id: number;
  text: string;
  /** 청크가 시작된 페이지(1-base) */
  startPage: number;
  /** 청크가 끝난 페이지(1-base) */
  endPage: number;
  /** 문서 전체 문자열 기준 오프셋 */
  start: number;
  end: number;
};

export type ChunkOptions = {
  /** 청크 최대 길이(문자) */
  size?: number;
  /** 청크 간 겹침(문자) */
  overlap?: number;
};

export const DEFAULT_CHUNK_OPTIONS = { size: 1600, overlap: 200 } as const;

/** 제어문자 제거, 줄바꿈 정리, PDF 특유의 하이픈 줄바꿈 병합 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00AD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/([A-Za-z])-\n([A-Za-z])/g, "$1$2")
    .replace(/[ \t\u00A0\u200B\uFEFF]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PageBound = { page: number; start: number; end: number };

/** 페이지 배열을 하나의 문자열로 잇고 페이지 경계 오프셋을 돌려준다. */
export function joinPages(pages: PageText[]): { text: string; bounds: PageBound[] } {
  const bounds: PageBound[] = [];
  let out = "";
  for (const p of pages) {
    const t = normalizeText(p.text);
    if (!t) continue;
    const start = out.length;
    out += t;
    bounds.push({ page: p.page, start, end: out.length });
    out += "\n\n";
  }
  return { text: out.trimEnd(), bounds };
}

/** 오프셋이 속한 페이지 번호 (이분 탐색). 경계 밖이면 가장 가까운 페이지. */
export function pageAt(bounds: PageBound[], offset: number): number {
  if (bounds.length === 0) return 1;
  let lo = 0;
  let hi = bounds.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = bounds[mid];
    if (offset < b.start) hi = mid - 1;
    else if (offset >= b.end) lo = mid + 1;
    else return b.page;
  }
  const idx = Math.min(bounds.length - 1, Math.max(0, lo));
  return bounds[idx].page;
}

export type Sentence = { text: string; start: number };

/**
 * 문장 단위 분해. 한국어(다./요./까?)·영어(. ! ?)·중일 구두점과 줄바꿈을 경계로 본다.
 * 경계를 못 찾으면 통째로 한 문장이 되며, 이후 chunkDocument 가 강제 분할한다.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^\n]*?(?:[.!?。？！]["'\)\]]?[ \t]+|\n+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      if (re.lastIndex > text.length) break;
      continue;
    }
    if (m[0].trim().length > 0) out.push({ text: m[0], start: m.index });
    if (re.lastIndex >= text.length) break;
  }
  return out;
}

function pushChunk(acc: Chunk[], bounds: PageBound[], text: string, start: number): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  // trim 으로 앞이 잘린 만큼 시작 오프셋 보정
  const lead = text.length - text.trimStart().length;
  const s = start + lead;
  const e = s + trimmed.length;
  acc.push({
    id: acc.length,
    text: trimmed,
    start: s,
    end: e,
    startPage: pageAt(bounds, s),
    endPage: pageAt(bounds, Math.max(s, e - 1)),
  });
}

/**
 * 페이지 텍스트 → 겹침이 있는 청크 배열.
 * - 문장 경계를 우선 지키고, 한 문장이 size 를 넘으면 강제로 자른다.
 * - overlap 문자만큼 직전 청크 끝부분을 다음 청크 앞에 붙인다.
 */
export function chunkDocument(pages: PageText[], options: ChunkOptions = {}): Chunk[] {
  const size = Math.max(200, options.size ?? DEFAULT_CHUNK_OPTIONS.size);
  const overlap = Math.max(
    0,
    Math.min(options.overlap ?? DEFAULT_CHUNK_OPTIONS.overlap, Math.floor(size / 2)),
  );
  const { text, bounds } = joinPages(pages);
  if (!text) return [];

  // 1) size 보다 긴 문장은 미리 강제 분할
  const sentences: Sentence[] = [];
  for (const s of splitSentences(text)) {
    if (s.text.length <= size) {
      sentences.push(s);
      continue;
    }
    for (let i = 0; i < s.text.length; i += size) {
      sentences.push({ text: s.text.slice(i, i + size), start: s.start + i });
    }
  }

  const chunks: Chunk[] = [];
  let buf: Sentence[] = [];
  let bufLen = 0;

  const flush = () => {
    if (buf.length === 0) return;
    pushChunk(chunks, bounds, buf.map((b) => b.text).join(""), buf[0].start);
  };

  for (const s of sentences) {
    if (bufLen > 0 && bufLen + s.text.length > size) {
      flush();
      // 겹침: 뒤에서부터 overlap 문자 분량의 문장만 남긴다
      const keep: Sentence[] = [];
      let keepLen = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        if (keepLen >= overlap) break;
        keep.unshift(buf[i]);
        keepLen += buf[i].text.length;
      }
      buf = overlap > 0 ? keep : [];
      bufLen = buf.reduce((a, b) => a + b.text.length, 0);
      // 겹침만으로 이미 size 를 채우면 겹침을 포기한다(무한 루프 방지)
      if (bufLen + s.text.length > size) {
        buf = [];
        bufLen = 0;
      }
    }
    buf.push(s);
    bufLen += s.text.length;
  }
  flush();

  return chunks.map((c, i) => ({ ...c, id: i }));
}

/**
 * 대략적인 토큰 수 추정. 정확한 토크나이저 없이 컨텍스트 예산을 잡기 위한 근사치다.
 * 한글은 문자당 약 0.8토큰, 그 외(영문/공백/기호)는 약 0.3토큰으로 잡는다.
 */
export function estimateTokens(text: string): number {
  let hangul = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x1100 && code <= 0x11ff)) hangul++;
  }
  const others = text.length - hangul;
  return Math.ceil(hangul * 0.8 + others * 0.3);
}

/** 전체 문서에서 추출된 문자 수가 이보다 적으면 "텍스트 없음(스캔본)" 으로 본다. */
export const EMPTY_TEXT_THRESHOLD = 40;

export function looksScanned(pages: PageText[]): boolean {
  const total = pages.reduce((a, p) => a + normalizeText(p.text).length, 0);
  return total < EMPTY_TEXT_THRESHOLD;
}
