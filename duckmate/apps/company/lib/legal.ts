/**
 * 법적 고지 로더 — apps/web/content/legal/*.md 를 빌드 시 fs 로 읽어(복제 렌더, 13_company_site 결정 11)
 * frontmatter 파싱 → {{KEY}} 치환 → marked 렌더(목차·heading id 포함). 서버 컴포넌트 전용.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked, type RendererThis, type Tokens } from "marked";
import { company, fillPlaceholders, isPlaceholder } from "@/config/company";

const CONTENT_DIR = join(process.cwd(), "../web/content/legal");

export type LegalRouteSlug = "terms" | "privacy" | "location" | "youth";

export interface LegalDocDef {
  /** 원본 파일명 (= web 라우트 slug) */
  file: string;
  label: string;
  description: string;
}

/** company 라우트 slug → 원본 파일. `/legal/youth/` 는 web 의 `youth-policy` 별칭(08_legal_docs 결정 4). */
export const LEGAL_DOCS: Record<LegalRouteSlug, LegalDocDef> = {
  terms: {
    file: "terms",
    label: "이용약관",
    description: `${company.SERVICE_NAME} 이용약관 전문. 만 19세 이상 성인 전용, 본인인증 단계별 이용 범위, 친구·데이팅 모드, 유료서비스와 청약철회, 금지행위와 제재·이의신청, 게시물 권리를 정합니다.`,
  },
  privacy: {
    file: "privacy",
    label: "개인정보처리방침",
    description: `${company.SERVICE_NAME} 개인정보처리방침. 수집 항목·목적·보유기간, 제3자 제공 없음, 처리위탁·국외이전, 열람·삭제·다운로드 권리, 안전조치와 개인정보보호책임자 연락처를 안내합니다.`,
  },
  location: {
    file: "location",
    label: "위치정보 이용약관",
    description: `GPS·IP 등 단말 위치정보를 수집하지 않으며 회원이 직접 고른 시/군/구 코드만 저장한다는 것과, 그 이용 목적·보유기간·권리·위치정보 관리책임자를 안내합니다.`,
  },
  youth: {
    file: "youth-policy",
    label: "청소년보호정책",
    description: `만 19세 이상만 이용할 수 있는 이유, 생년월일·본인인증·재가입 차단의 3중 연령확인, 미성년 의심 시 조치, 신고 채널과 청소년보호책임자를 안내합니다.`,
  },
};

export const LEGAL_ROUTE_SLUGS = Object.keys(LEGAL_DOCS) as LegalRouteSlug[];

/** 상단 탭·푸터 공통 링크 5종 (trailingSlash) */
export const LEGAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/legal/terms/", label: "이용약관" },
  { href: "/legal/privacy/", label: "개인정보처리방침" },
  { href: "/legal/location/", label: "위치정보 이용약관" },
  { href: "/legal/youth/", label: "청소년보호정책" },
  { href: "/legal/business/", label: "사업자 정보" },
];

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

export interface LegalDoc {
  routeSlug: LegalRouteSlug;
  meta: LegalFrontmatter;
  html: string;
  toc: TocItem[];
  /** effective_date 가 유효한 날짜이고 오늘보다 미래면 true ("개정 예정" 배지) */
  upcoming: boolean;
  /** web 도메인 canonical. WEB_APP_URL 플레이스홀더면 null(self-canonical) */
  canonical: string | null;
}

/** flat `key: "value"` frontmatter 만 지원(README 스키마). 의존성 추가 없이 처리. */
function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
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

function slugify(text: string, used: Set<string>): string {
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

function render(markdown: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(this: RendererThis, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        const id = slugify(token.text, used);
        if (token.depth === 2 || token.depth === 3) toc.push({ id, text: token.text, depth: token.depth });
        // 문서 제목(h1)은 페이지 헤더가 표시하므로 본문 h1 은 sr-only
        const cls = token.depth === 1 ? ' class="sr-only"' : "";
        return `<h${token.depth} id="${id}"${cls}>${inner}</h${token.depth}>\n`;
      },
      table(this: RendererThis, token: Tokens.Table) {
        // 가로 스크롤 래퍼 + th scope (모바일에서 페이지 가로 스크롤 금지)
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

const cache = new Map<LegalRouteSlug, LegalDoc>();

export function loadLegalDoc(routeSlug: LegalRouteSlug): LegalDoc {
  const hit = cache.get(routeSlug);
  if (hit) return hit;
  const def = LEGAL_DOCS[routeSlug];
  const raw = readFileSync(join(CONTENT_DIR, `${def.file}.md`), "utf8");
  const { data, body } = parseFrontmatter(raw);
  const meta: LegalFrontmatter = {
    title: fillPlaceholders(data.title ?? def.label),
    slug: data.slug ?? def.file,
    version: data.version ?? "0.0.0",
    effective_date: fillPlaceholders(data.effective_date ?? "{{EFFECTIVE_DATE}}"),
    last_updated: data.last_updated ?? "",
    consent_required: data.consent_required === "true",
  };
  const { html, toc } = render(fillPlaceholders(body));
  const eff = Date.parse(meta.effective_date);
  const upcoming = Number.isFinite(eff) && eff > Date.now();
  const canonical = isPlaceholder(company.WEB_APP_URL) ? null : `${company.WEB_APP_URL.replace(/\/$/, "")}/legal/${meta.slug}`;
  const doc: LegalDoc = { routeSlug, meta, html, toc, upcoming, canonical };
  cache.set(routeSlug, doc);
  return doc;
}
