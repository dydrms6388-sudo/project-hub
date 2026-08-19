// =============================================================================
// E4 · 의존성 없는 최소 마크다운 → HTML 변환기 (법적 문서 6종 렌더 전용)
//
// 왜 직접 구현하나: 08_legal_docs §4 는 md 원본을 그대로 렌더할 것을 요구하지만
// 새 npm 의존성(marked/remark 등) 추가는 금지다. <pre> 덤프는 표·조항 구조를
// 죽이므로 지원 문법을 최소한으로 고정한 자체 파서를 쓴다.
//
// 지원 문법 (약관 6종이 실제로 쓰는 것만):
//   #~#### 헤딩(+ 조항 앵커 id) · 문단 · 표(GFM 파이프) · 인용문(>) ·
//   순서/비순서 목록(1단 중첩) · 수평선(---) · **굵게** · `코드` · [링크](url)
//
// 보안: 원문은 우리가 소유한 md 파일뿐이지만, 렌더 전 항상 HTML 이스케이프 후
// 인라인 규칙만 다시 태그로 바꾼다(원문 HTML 통과 없음).
// =============================================================================

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

/** 인라인 규칙 — 이스케이프된 문자열 위에서만 동작한다. */
function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-primary-tint px-1 text-body-sm text-primary-tint-fg">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a class="text-primary underline underline-offset-2" href="$2">$1</a>',
  );
  return out;
}

/** 헤딩 앵커 id — `제13조` 딥링크 보장(08_legal_docs §4 "조항 앵커"). */
function headingId(text: string, used: Set<string>): string {
  const article = text.match(/제\s*(\d+)\s*조/);
  const base = article
    ? `제${article[1]}조`
    : text
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "section";

  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
}

export interface MarkdownResult {
  html: string;
  /** 문서 내 목차 (h2 이하) */
  headings: MarkdownHeading[];
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-2 mb-4 text-h1",
  2: "mt-8 mb-3 text-h2 scroll-mt-24",
  3: "mt-6 mb-2 text-h3 scroll-mt-24",
  4: "mt-4 mb-2 text-body font-semibold scroll-mt-24",
};

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function renderMarkdown(source: string): MarkdownResult {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const headings: MarkdownHeading[] = [];
  const usedIds = new Set<string>();

  let i = 0;
  const paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p class="my-3 text-body">${inline(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // 빈 줄 — 문단 종료
    if (trimmed === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      out.push('<hr class="my-8 border-line" />');
      i += 1;
      continue;
    }

    // 헤딩
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = (heading[1] ?? "#").length;
      const text = (heading[2] ?? "").trim();
      const id = headingId(text, usedIds);
      if (level >= 2) headings.push({ id, text, level });
      out.push(
        `<h${level} id="${id}" class="${HEADING_CLASS[level] ?? "text-body"}">${inline(text)}</h${level}>`,
      );
      i += 1;
      continue;
    }

    // 인용문 (연속 > 블록)
    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quoted.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(
        `<blockquote class="my-4 border-l-4 border-line bg-surface px-4 py-3 text-body-sm text-ink-muted">${quoted
          .map((q) => `<p>${inline(q)}</p>`)
          .join("")}</blockquote>`,
      );
      continue;
    }

    // 표 (헤더 + 구분선 필수)
    if (isTableRow(line) && isTableRow(lines[i + 1] ?? "") && /^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      flushParagraph();
      const header = splitRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        body.push(splitRow(lines[i] ?? ""));
        i += 1;
      }
      const head = header
        .map((c) => `<th class="border border-line px-3 py-2 text-left align-top">${inline(c)}</th>`)
        .join("");
      const rows = body
        .map(
          (cells) =>
            `<tr>${cells
              .map((c) => `<td class="border border-line px-3 py-2 align-top">${inline(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      out.push(
        '<div class="my-4 overflow-x-auto"><table class="w-full border-collapse text-body-sm">' +
          `<thead class="bg-surface text-ink"><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`,
      );
      continue;
    }

    // 목록 (1단 중첩 지원)
    const listMatch = raw.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      const baseIndent = (listMatch[1] ?? "").length;
      const ordered = /\d+\./.test(listMatch[2] ?? "");
      const items: string[] = [];
      let nested: string[] = [];
      let nestedOrdered = false;

      const closeNested = () => {
        if (nested.length === 0) return;
        const tag = nestedOrdered ? "ol" : "ul";
        const cls = nestedOrdered ? "list-decimal" : "list-disc";
        const prev = items.pop() ?? "";
        items.push(
          `${prev}<${tag} class="my-1 ml-5 ${cls} space-y-1">${nested.map((n) => `<li>${n}</li>`).join("")}</${tag}>`,
        );
        nested = [];
      };

      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const m = cur.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) {
          if (cur.trim() === "") break;
          // 목록 항목의 이어지는 줄
          if (nested.length > 0) {
            const last = nested.length - 1;
            nested[last] = `${nested[last] ?? ""} ${inline(cur.trim())}`;
          } else if (items.length > 0) {
            const last = items.length - 1;
            items[last] = `${items[last] ?? ""} ${inline(cur.trim())}`;
          } else break;
          i += 1;
          continue;
        }
        const indent = (m[1] ?? "").length;
        const content = inline((m[3] ?? "").trim());
        if (indent > baseIndent) {
          nestedOrdered = /\d+\./.test(m[2] ?? "");
          nested.push(content);
        } else {
          closeNested();
          items.push(content);
        }
        i += 1;
      }
      closeNested();

      const tag = ordered ? "ol" : "ul";
      const cls = ordered ? "list-decimal" : "list-disc";
      out.push(
        `<${tag} class="my-3 ml-5 ${cls} space-y-1 text-body">${items.map((it) => `<li>${it}</li>`).join("")}</${tag}>`,
      );
      continue;
    }

    paragraph.push(trimmed);
    i += 1;
  }

  flushParagraph();
  return { html: out.join("\n"), headings };
}
