/**
 * 법적 문서 마크다운 파이프라인 (순수 함수, Node/브라우저 공용 — fs 없음).
 *   parseFrontmatter(src)  → { data, body }        flat `key: "value"` frontmatter (README 스키마)
 *   renderMarkdown(md)     → { html, toc }         marked + heading id + 목차(h2/h3) + 표 가로 스크롤 래퍼
 * apps/company/lib/legal.ts 의 렌더 로직을 web 용으로 복사(26_fe_company 결정 9). 두 앱이 같은 원본(.md)을 읽는다.
 */
import { Marked, type RendererThis, type Tokens } from "marked";

export interface LegalFrontmatter {
  title: string;
  slug: string;
  version: string;
  effective_date: string;
  last_updated: string;
  consent_required: boolean;
}

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

export function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$/);
    if (!kv) continue;
    let v = kv[2]!;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]!] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

export function slugifyHeading(text: string, used: Set<string>): string {
  let base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  if (!base) base = "section";
  let id = base;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

export function renderMarkdown(markdown: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(this: RendererThis, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        const id = slugifyHeading(token.text, used);
        if (token.depth === 2 || token.depth === 3) toc.push({ id, text: token.text, depth: token.depth });
        // 문서 제목(h1)은 페이지 헤더가 표시하므로 본문 h1 은 sr-only
        const cls = token.depth === 1 ? ' class="sr-only"' : "";
        return `<h${token.depth} id="${id}"${cls}>${inner}</h${token.depth}>\n`;
      },
      table(this: RendererThis, token: Tokens.Table) {
        const align = (a: string | null) => (a ? ` style="text-align:${a}"` : "");
        const th = token.header.map((c) => `<th scope="col"${align(c.align)}>${this.parser.parseInline(c.tokens)}</th>`).join("");
        const rows = token.rows
          .map((r) => `<tr>${r.map((c) => `<td${align(c.align)}>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`)
          .join("");
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="표 (가로 스크롤)"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = marked.parse(markdown) as string;
  return { html, toc };
}

/** 남아 있는 `{{KEY}}` 토큰 목록(치환 후 검사용) */
export function remainingPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) ?? [])];
}
