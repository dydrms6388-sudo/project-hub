/**
 * AI 답변(마크다운)에서 자주 나오는 구조를 파싱/변환하는 순수 함수 모음.
 * 브라우저·빌드 양쪽에서 동작하도록 DOM 의존성을 두지 않는다(HTML 표 파싱만 예외 처리).
 */

/* ---------------------------------- 코드블록 --------------------------------- */

export type CodeBlock = { lang: string; code: string; index: number };

const FENCE_RE = /^(\s*)(`{3,}|~{3,})[ \t]*([^\n`]*)$/;

/** ```lang ... ``` 블록을 전부 뽑는다. */
export function parseCodeBlocks(src: string): CodeBlock[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: CodeBlock[] = [];
  let open: { fence: string; lang: string; buf: string[] } | null = null;

  for (const line of lines) {
    if (!open) {
      const m = line.match(FENCE_RE);
      if (m) open = { fence: m[2][0].repeat(3), lang: (m[3] || "").trim(), buf: [] };
      continue;
    }
    const closing = line.trim().startsWith(open.fence) && line.trim().replace(/[`~]/g, "") === "";
    if (closing) {
      out.push({ lang: open.lang, code: open.buf.join("\n"), index: out.length });
      open = null;
    } else {
      open.buf.push(line);
    }
  }
  // 닫는 펜스 없이 답변이 잘린 경우에도 마지막 블록을 살린다(끝의 빈 줄은 버린다).
  if (open) {
    while (open.buf.length && open.buf[open.buf.length - 1].trim() === "") open.buf.pop();
    if (open.buf.length) out.push({ lang: open.lang, code: open.buf.join("\n"), index: out.length });
  }
  return out;
}

/** 언어 태그 → 파일 확장자 */
export const LANG_EXT: Record<string, string> = {
  js: "js", javascript: "js", jsx: "jsx", mjs: "mjs", cjs: "cjs",
  ts: "ts", typescript: "ts", tsx: "tsx",
  py: "py", python: "py",
  java: "java", kt: "kt", kotlin: "kt", swift: "swift",
  c: "c", h: "h", cpp: "cpp", "c++": "cpp", cs: "cs", csharp: "cs",
  go: "go", rs: "rs", rust: "rs", rb: "rb", ruby: "rb", php: "php",
  sh: "sh", bash: "sh", zsh: "sh", shell: "sh", ps1: "ps1", powershell: "ps1",
  sql: "sql", html: "html", xml: "xml", css: "css", scss: "scss", less: "less",
  json: "json", json5: "json5", yaml: "yml", yml: "yml", toml: "toml", ini: "ini",
  md: "md", markdown: "md", mdx: "mdx", tex: "tex", r: "r", m: "m", lua: "lua",
  dart: "dart", scala: "scala", pl: "pl", perl: "pl", vim: "vim", dockerfile: "Dockerfile",
  makefile: "mk", diff: "diff", patch: "patch", csv: "csv", tsv: "tsv", txt: "txt",
};

export function extFor(lang: string): string {
  const key = lang.trim().toLowerCase().split(/[\s:]/)[0];
  return LANG_EXT[key] ?? "txt";
}

/* ------------------------------------ 표 ------------------------------------ */

export type Table = {
  /** 표가 어디서 왔는지 */
  kind: "markdown" | "html" | "tsv";
  header: string[];
  rows: string[][];
  /** 원문에서의 시작 줄(정렬용) */
  line: number;
};

function splitPipeRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  // 이스케이프된 파이프(\|)는 셀 구분자가 아니다.
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function isSeparator(line: string): boolean {
  if (!line.includes("-")) return false;
  return SEP_RE.test(line) && /^[\s|:\-]+$/.test(line);
}

/** 마크다운 파이프 표 추출 */
export function parseMarkdownTables(src: string): Table[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const tables: Table[] = [];
  let i = 0;
  let inFence = false;
  while (i < lines.length) {
    if (/^\s*(`{3,}|~{3,})/.test(lines[i])) {
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) {
      i++;
      continue;
    }
    const head = lines[i];
    const sep = lines[i + 1];
    if (head && sep && head.includes("|") && isSeparator(sep)) {
      const header = splitPipeRow(head);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
        rows.push(splitPipeRow(lines[j]));
        j++;
      }
      tables.push({ kind: "markdown", header, rows, line: i });
      i = j;
      continue;
    }
    i++;
  }
  return tables;
}

/** HTML <table> 추출 (정규식 기반 — AI 답변 수준의 단순 표만 대상) */
export function parseHtmlTables(src: string): Table[] {
  const tables: Table[] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(src))) {
    const html = m[0];
    const rowsRaw = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const grid: string[][] = [];
    let headerFromTh: string[] | null = null;
    for (const r of rowsRaw) {
      const cells = r.match(/<(t[hd])\b[\s\S]*?<\/\1>/gi) ?? [];
      const vals = cells.map((c) =>
        c
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, " ")
          .trim(),
      );
      if (vals.length === 0) continue;
      if (!headerFromTh && /<th\b/i.test(r)) headerFromTh = vals;
      else grid.push(vals);
    }
    if (!headerFromTh && grid.length > 0) headerFromTh = grid.shift() ?? [];
    if (headerFromTh && headerFromTh.length) {
      const line = src.slice(0, m.index).split("\n").length - 1;
      tables.push({ kind: "html", header: headerFromTh, rows: grid, line });
    }
  }
  return tables;
}

/** 탭(또는 2칸 이상 공백) 구분 텍스트 블록 추출 */
export function parseTsvTables(src: string): Table[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const tables: Table[] = [];
  let buf: string[] = [];
  let start = 0;
  let inFence = false;

  const flush = () => {
    if (buf.length >= 2) {
      const split = (l: string) => (l.includes("\t") ? l.split("\t") : l.split(/ {2,}/)).map((s) => s.trim());
      const header = split(buf[0]);
      const rows = buf.slice(1).map(split);
      if (header.length >= 2) tables.push({ kind: "tsv", header, rows, line: start });
    }
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(l)) {
      inFence = !inFence;
      flush();
      continue;
    }
    const looksRow =
      !inFence &&
      l.trim() !== "" &&
      !l.includes("|") &&
      (l.includes("\t") || / {2,}\S/.test(l.trim())) &&
      (l.includes("\t") ? l.split("\t").length >= 2 : l.trim().split(/ {2,}/).length >= 2);
    if (looksRow) {
      if (buf.length === 0) start = i;
      buf.push(l);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

/** 마크다운 → HTML → 탭 순으로 자동 감지. 중복되는 영역은 우선순위가 높은 쪽만 남긴다. */
export function detectTables(src: string): Table[] {
  const md = parseMarkdownTables(src);
  const html = parseHtmlTables(src);
  if (md.length || html.length) {
    return [...md, ...html].sort((a, b) => a.line - b.line);
  }
  return parseTsvTables(src);
}

/** 숫자로 보이는 셀이면 number 로 변환 (콤마·%·통화기호 처리) */
export function coerceCell(raw: string): string | number {
  const s = raw.trim();
  if (s === "") return "";
  const cleaned = s.replace(/[,\s]/g, "").replace(/^[₩$€¥£]/, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

/* ------------------------------ 인라인 마크다운 ------------------------------ */

export type LinkMode = "text" | "keepUrl" | "remove";

/** 인라인 마크다운 기호 제거 (링크 처리 포함) */
export function stripInline(line: string, linkMode: LinkMode = "text"): string {
  let s = line;
  // 이미지: ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt) => (alt ? String(alt) : ""));
  // 링크: [text](url)
  s = s.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, text, url) => {
    const t = String(text);
    if (linkMode === "keepUrl") return t ? `${t} (${url})` : String(url);
    if (linkMode === "remove") return t;
    return t;
  });
  // 참조 링크 [text][ref] → text
  s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1");
  // 굵게/기울임/취소선
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, "$1$2");
  s = s.replace(/(^|[^\w_])_([^_\n]+)_(?=[^\w_]|$)/g, "$1$2");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  // 인라인 코드
  s = s.replace(/`{1,3}([^`]+)`{1,3}/g, "$1");
  return s;
}

/** 문서 전체를 줄 단위로 나누되 코드펜스 안쪽을 표시해 준다. */
export function walkLines(src: string): { text: string; inCode: boolean; fence: boolean; lang: string }[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: { text: string; inCode: boolean; fence: boolean; lang: string }[] = [];
  let inCode = false;
  let lang = "";
  for (const l of lines) {
    const m = l.match(FENCE_RE);
    if (m) {
      if (!inCode) {
        inCode = true;
        lang = (m[3] || "").trim();
        out.push({ text: l, inCode: true, fence: true, lang });
      } else {
        out.push({ text: l, inCode: true, fence: true, lang });
        inCode = false;
        lang = "";
      }
      continue;
    }
    out.push({ text: l, inCode, fence: false, lang });
  }
  return out;
}

/** 표 블록을 탭 구분 평문으로 */
export function tableToTsv(t: Table): string {
  return [t.header, ...t.rows].map((r) => r.map((c) => stripInline(c)).join("\t")).join("\n");
}
