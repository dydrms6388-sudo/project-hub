/**
 * 자막 파서/직렬화 — 순수 JS. ffmpeg.wasm 을 전혀 쓰지 않는다.
 *
 * 지원 포맷: SRT(SubRip) / VTT(WebVTT) / SMI(SAMI)
 * - 한국어 자막은 상당수가 EUC-KR(CP949) 로 저장돼 있어 UTF-8 로 읽으면 깨진다.
 *   decodeSubtitleBytes() 가 BOM → UTF-8 엄격 검사 → EUC-KR 순으로 복구한다.
 * - 브라우저/Node 양쪽에서 동작한다(DOM 의존 없음). TextDecoder 만 사용.
 */

export type Cue = {
  /** 시작 시각(ms) */
  start: number;
  /** 종료 시각(ms) */
  end: number;
  /** 여러 줄이면 \n 으로 구분 */
  text: string;
  /** VTT cue identifier 등 (선택) */
  id?: string;
};

export type SubFormat = "srt" | "vtt" | "smi";

export type DecodeResult = {
  text: string;
  /** 실제로 사용한 인코딩 라벨 */
  encoding: string;
  /** BOM 이나 엄격 UTF-8 검사로 확정했는지 */
  confident: boolean;
  /** 디코딩 중 나온 치환 문자(U+FFFD) 개수 — 0 이 아니면 깨졌을 가능성 */
  replacements: number;
};

/* ------------------------------------------------------------------ */
/* 인코딩 감지                                                          */
/* ------------------------------------------------------------------ */

function toU8(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function countReplacement(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
  return n;
}

/**
 * 자막 바이트를 문자열로 복구한다.
 *  1) BOM 이 있으면 그대로 신뢰 (UTF-8 / UTF-16LE / UTF-16BE)
 *  2) BOM 이 없으면 fatal:true 로 UTF-8 검사 — 통과하면 UTF-8
 *  3) 실패하면 EUC-KR(CP949) 로 디코딩 (한국어 자막의 사실상 표준 레거시 인코딩)
 */
export function decodeSubtitleBytes(input: ArrayBuffer | Uint8Array): DecodeResult {
  const u8 = toU8(input);

  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    const text = new TextDecoder("utf-8").decode(u8.subarray(3));
    return { text: stripBom(text), encoding: "utf-8 (BOM)", confident: true, replacements: countReplacement(text) };
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    const text = new TextDecoder("utf-16le").decode(u8.subarray(2));
    return { text: stripBom(text), encoding: "utf-16le (BOM)", confident: true, replacements: countReplacement(text) };
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    const text = new TextDecoder("utf-16be").decode(u8.subarray(2));
    return { text: stripBom(text), encoding: "utf-16be (BOM)", confident: true, replacements: countReplacement(text) };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(u8);
    return { text: stripBom(text), encoding: "utf-8", confident: true, replacements: 0 };
  } catch {
    /* UTF-8 이 아니다 → 레거시 한글 인코딩으로 간주 */
  }

  const text = new TextDecoder("euc-kr").decode(u8);
  return {
    text: stripBom(text),
    encoding: "euc-kr (CP949)",
    confident: false,
    replacements: countReplacement(text),
  };
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/* ------------------------------------------------------------------ */
/* 시간 유틸                                                            */
/* ------------------------------------------------------------------ */

/** "01:02:03,456" / "01:02:03.456" / "02:03.456" / "01:02:03" → ms */
export function parseTimestamp(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  const m = /^(?:(\d+):)?(\d{1,3}):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const frac = m[4] ? Number(m[4].padEnd(3, "0")) : 0;
  return ((h * 60 + min) * 60 + sec) * 1000 + frac;
}

function pad(n: number, w = 2): string {
  return String(Math.floor(Math.abs(n))).padStart(w, "0");
}

export function formatTimestamp(ms: number, sep: "," | "." = ","): string {
  const v = Math.max(0, Math.round(ms));
  const h = Math.floor(v / 3600000);
  const m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const f = v % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(f, 3)}`;
}

/* ------------------------------------------------------------------ */
/* 공통 텍스트 정리                                                     */
/* ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    const hit = NAMED_ENTITIES[body.toLowerCase()];
    return hit === undefined ? whole : hit;
  });
}

/** SMI 조각(HTML 유사) → 평문. <br> 은 줄바꿈으로 */
function smiHtmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:p|font|b|i|u|span|div|ruby|rt)\b[^>]*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* SRT                                                                 */
/* ------------------------------------------------------------------ */

const ARROW = /-->/;

export function parseSrt(input: string): Cue[] {
  const text = stripBom(input).replace(/\r\n?/g, "\n");
  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l, i, a) => !(i === a.length - 1 && l.trim() === ""));
    if (lines.length === 0) continue;
    let i = 0;
    let id: string | undefined;
    if (!ARROW.test(lines[0]) && /^\s*\d+\s*$/.test(lines[0])) {
      id = lines[0].trim();
      i = 1;
    }
    if (i >= lines.length || !ARROW.test(lines[i])) continue;
    const [a, b] = lines[i].split(ARROW);
    const start = parseTimestamp(a ?? "");
    const end = parseTimestamp((b ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null) continue;
    const body = lines
      .slice(i + 1)
      .join("\n")
      .trim();
    cues.push({ start, end, text: body, id });
  }
  return cues;
}

export function toSrt(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatTimestamp(c.start, ",")} --> ${formatTimestamp(c.end, ",")}\n${c.text}`)
      .join("\n\n") + "\n"
  );
}

/* ------------------------------------------------------------------ */
/* WebVTT                                                              */
/* ------------------------------------------------------------------ */

export function parseVtt(input: string): Cue[] {
  const text = stripBom(input).replace(/\r\n?/g, "\n");
  const cues: Cue[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^WEBVTT/i.test(trimmed)) continue;
    if (/^(NOTE|STYLE|REGION)\b/i.test(trimmed)) continue;
    const lines = trimmed.split("\n");
    let i = 0;
    let id: string | undefined;
    if (!ARROW.test(lines[0])) {
      id = lines[0].trim();
      i = 1;
    }
    if (i >= lines.length || !ARROW.test(lines[i])) continue;
    const [a, rest] = lines[i].split(ARROW);
    const start = parseTimestamp(a ?? "");
    const endToken = (rest ?? "").trim().split(/\s+/)[0] ?? "";
    const end = parseTimestamp(endToken);
    if (start === null || end === null) continue;
    cues.push({ start, end, text: lines.slice(i + 1).join("\n").trim(), id });
  }
  return cues;
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map((c) => `${formatTimestamp(c.start, ".")} --> ${formatTimestamp(c.end, ".")}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

/* ------------------------------------------------------------------ */
/* SAMI (.smi)                                                         */
/* ------------------------------------------------------------------ */

/** SMI 안에 들어 있는 언어 클래스 목록(KRCC, ENCC …) */
export function smiClasses(input: string): string[] {
  const set = new Set<string>();
  const re = /<p\b[^>]*\bclass\s*=\s*"?([a-zA-Z0-9_-]+)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) set.add(m[1].toUpperCase());
  return [...set];
}

export type SmiParseOptions = {
  /** 여러 언어가 들어 있을 때 뽑아낼 클래스 (예: "KRCC") */
  lang?: string;
  /** 마지막 자막의 종료 시각을 못 찾을 때 붙일 길이(ms) */
  tailMs?: number;
};

export function parseSmi(input: string, opts: SmiParseOptions = {}): Cue[] {
  const tailMs = opts.tailMs ?? 3000;
  const wanted = opts.lang?.toUpperCase();
  const text = stripBom(input).replace(/\r\n?/g, "\n");

  // <BODY> 안쪽만 (없으면 전체)
  const bodyMatch = /<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(text);
  const body = bodyMatch ? bodyMatch[1] : text;

  // SYNC 토큰 단위로 자른다.
  const syncRe = /<sync\b([^>]*)>/gi;
  type Raw = { start: number; end: number | null; html: string };
  const raws: Raw[] = [];
  let m: RegExpExecArray | null;
  let prevIndex = -1;
  let prevAttrs = "";
  while ((m = syncRe.exec(body))) {
    if (prevIndex >= 0) {
      raws.push(makeRaw(prevAttrs, body.slice(prevIndex, m.index)));
    }
    prevAttrs = m[1];
    prevIndex = syncRe.lastIndex;
  }
  if (prevIndex >= 0) raws.push(makeRaw(prevAttrs, body.slice(prevIndex)));

  function makeRaw(attrs: string, html: string): Raw {
    const s = /\bstart\s*=\s*"?(-?\d+)"?/i.exec(attrs);
    const e = /\bend\s*=\s*"?(-?\d+)"?/i.exec(attrs);
    return { start: s ? Number(s[1]) : 0, end: e ? Number(e[1]) : null, html };
  }

  // SYNC 안에서 원하는 언어 클래스의 <P> 만 남긴다.
  function pick(html: string): string {
    const parts = html.split(/(?=<p\b)/i).filter((p) => /<p\b/i.test(p));
    if (parts.length === 0) return smiHtmlToText(html);
    if (parts.length === 1 || !wanted) return smiHtmlToText(parts[0]);
    const hit = parts.find((p) => {
      const c = /<p\b[^>]*\bclass\s*=\s*"?([a-zA-Z0-9_-]+)"?/i.exec(p);
      return c ? c[1].toUpperCase() === wanted : false;
    });
    return smiHtmlToText(hit ?? parts[0]);
  }

  const cues: Cue[] = [];
  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    const content = pick(raw.html);
    if (content === "") continue; // &nbsp; 만 있는 SYNC = 앞 자막 종료 마커
    const nextStart = raws[i + 1]?.start ?? raw.start + tailMs;
    const end = raw.end ?? nextStart;
    if (end <= raw.start) continue;
    cues.push({ start: raw.start, end, text: content });
  }
  return cues;
}

export type SmiWriteOptions = { lang?: string; title?: string };

export function toSmi(cues: Cue[], opts: SmiWriteOptions = {}): string {
  const cls = (opts.lang ?? "KRCC").toUpperCase();
  const langAttr = cls === "ENCC" ? "en-US" : "ko-KR";
  const title = escapeSmi(opts.title ?? "clipforge");
  const lines: string[] = [
    "<SAMI>",
    "<HEAD>",
    `<TITLE>${title}</TITLE>`,
    '<STYLE TYPE="text/css">',
    "<!--",
    "P { margin-left:4pt; margin-right:4pt; margin-bottom:2pt; margin-top:2pt;",
    "    text-align:center; font-size:20pt; font-family:굴림, Arial; font-weight:normal;",
    "    color:white; background-color:black; }",
    `.${cls} { Name:한국어; lang:${langAttr}; SAMIType:CC; }`,
    "-->",
    "</STYLE>",
    "</HEAD>",
    "<BODY>",
  ];
  for (const c of cues) {
    const html = escapeSmi(c.text).replace(/\n/g, "<br>");
    lines.push(`<SYNC Start=${Math.max(0, Math.round(c.start))}><P Class=${cls}>${html}`);
    lines.push(`<SYNC Start=${Math.max(0, Math.round(c.end))}><P Class=${cls}>&nbsp;`);
  }
  lines.push("</BODY>", "</SAMI>", "");
  return lines.join("\n");
}

function escapeSmi(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* 포맷 자동 판별 / 통합 API                                            */
/* ------------------------------------------------------------------ */

export function detectFormat(text: string, filename?: string): SubFormat {
  const head = stripBom(text).slice(0, 4000);
  if (/<sami\b|<sync\b/i.test(head)) return "smi";
  if (/^﻿?WEBVTT/i.test(stripBom(text).trimStart())) return "vtt";
  if (/\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->/.test(head)) {
    return /-->\s*\d{1,2}:\d{2}:\d{2}\.\d{1,3}/.test(head) ? "vtt" : "srt";
  }
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "smi" || ext === "sami") return "smi";
  if (ext === "vtt") return "vtt";
  return "srt";
}

export function parseSubtitle(text: string, format: SubFormat, opts: SmiParseOptions = {}): Cue[] {
  if (format === "smi") return parseSmi(text, opts);
  if (format === "vtt") return parseVtt(text);
  return parseSrt(text);
}

export function serializeSubtitle(cues: Cue[], format: SubFormat, opts: SmiWriteOptions = {}): string {
  if (format === "smi") return toSmi(cues, opts);
  if (format === "vtt") return toVtt(cues);
  return toSrt(cues);
}

/* ------------------------------------------------------------------ */
/* 변형: 싱크 밀기 / 정렬 / 병합                                         */
/* ------------------------------------------------------------------ */

/** 싱크를 ms 만큼 밀거나 당긴다. 0 이하로 내려간 자막은 잘라내고, 완전히 사라지면 제거 */
export function shiftCues(cues: Cue[], deltaMs: number): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const start = c.start + deltaMs;
    const end = c.end + deltaMs;
    if (end <= 0) continue;
    out.push({ ...c, start: Math.max(0, start), end });
  }
  return out;
}

/** 재생 속도가 다른 소스에 맞추기 위한 배율(예: 25fps↔23.976fps = 1.0427) */
export function scaleCues(cues: Cue[], factor: number): Cue[] {
  if (!Number.isFinite(factor) || factor <= 0) return cues;
  return cues.map((c) => ({ ...c, start: Math.round(c.start * factor), end: Math.round(c.end * factor) }));
}

export type NormalizeOptions = {
  /** 자막 최소 노출 시간(ms) */
  minDurationMs?: number;
  /** 겹치는 구간을 앞 자막 종료로 잘라낼지 */
  fixOverlap?: boolean;
};

export function normalizeCues(cues: Cue[], opts: NormalizeOptions = {}): Cue[] {
  const minDur = opts.minDurationMs ?? 0;
  const sorted = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Cue[] = [];
  for (const c of sorted) {
    const cue: Cue = { ...c, text: c.text.trim() };
    if (!cue.text) continue;
    if (cue.end < cue.start) cue.end = cue.start;
    if (minDur > 0 && cue.end - cue.start < minDur) cue.end = cue.start + minDur;
    const prev = out[out.length - 1];
    if (opts.fixOverlap && prev && cue.start < prev.end) {
      if (prev.start < cue.start) prev.end = cue.start;
      else {
        // 완전히 같은 시작 → 텍스트를 합친다
        prev.text = `${prev.text}\n${cue.text}`;
        prev.end = Math.max(prev.end, cue.end);
        continue;
      }
    }
    out.push(cue);
  }
  return out;
}

export type MergeMode = "concat" | "overlay";

/**
 * 여러 자막 파일 합치기.
 *  - concat: 파일을 순서대로 이어 붙인다(앞 파일 마지막 시각 + gap 만큼 밀림). 분할 영상용.
 *  - overlay: 시간축을 그대로 두고 한 파일로 합친다(다국어/누락분 보충).
 */
export function mergeCues(lists: Cue[][], mode: MergeMode = "concat", gapMs = 0): Cue[] {
  if (mode === "overlay") {
    return normalizeCues(lists.flat(), { fixOverlap: false });
  }
  const out: Cue[] = [];
  let offset = 0;
  for (const list of lists) {
    if (list.length === 0) continue;
    for (const c of list) out.push({ ...c, start: c.start + offset, end: c.end + offset });
    offset = Math.max(...list.map((c) => c.end)) + offset === offset ? offset : out[out.length - 1].end + gapMs;
  }
  return normalizeCues(out, { fixOverlap: false });
}

/** 자막 전체 길이(ms) */
export function totalDuration(cues: Cue[]): number {
  return cues.reduce((max, c) => Math.max(max, c.end), 0);
}

export function extensionFor(format: SubFormat): string {
  return format;
}

export function mimeFor(format: SubFormat): string {
  if (format === "vtt") return "text/vtt;charset=utf-8";
  if (format === "smi") return "application/x-sami;charset=utf-8";
  return "application/x-subrip;charset=utf-8";
}
