/**
 * 법적 문서 로더 (서버 컴포넌트 전용 — fs). content/legal/*.md 를 빌드 시 읽어 치환·렌더·캐시한다.
 *
 * 라우트(E4 확정): /legal/{terms,privacy,location,youth,community,refund,business} — 짧은 slug 가 canonical.
 * 08_legal_docs 결정 4 의 긴 slug(youth-policy·community-guidelines·refund-policy)는 LEGAL_ALIASES 로 301 redirect.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Enums } from "@duckmate/db";
import { company, fillPlaceholders, isPlaceholder } from "@/config/company";
import { parseFrontmatter, renderMarkdown, type LegalFrontmatter, type TocItem } from "./markdown";

const CONTENT_DIR = join(process.cwd(), "content/legal");

export type LegalRouteSlug = "terms" | "privacy" | "location" | "youth" | "community" | "refund";

export interface LegalDocDef {
  /** 원본 파일명(= frontmatter slug) */
  file: string;
  label: string;
  description: string;
  /** 가입 시 동의 문서 → legal_documents.key (재동의 매핑). 게시만 하는 문서는 null */
  docKey: Enums["legal_doc_key"] | null;
}

export const LEGAL_DOCS: Readonly<Record<LegalRouteSlug, LegalDocDef>> = {
  terms: {
    file: "terms",
    label: "이용약관",
    docKey: "terms",
    description: `${company.SERVICE_NAME} 이용약관 전문. 만 19세 이상 성인 전용, 본인인증 단계별 이용 범위, 친구·데이팅 모드, 유료서비스와 청약철회, 금지행위와 제재·이의신청, 게시물 권리를 정합니다.`,
  },
  privacy: {
    file: "privacy",
    label: "개인정보처리방침",
    docKey: "privacy",
    description: `${company.SERVICE_NAME} 개인정보처리방침. 수집 항목·목적·보유기간, 제3자 제공 없음, 처리위탁·국외이전, 열람·삭제·다운로드 권리, 안전조치와 개인정보보호책임자 연락처를 안내합니다.`,
  },
  location: {
    file: "location",
    label: "위치정보 이용약관",
    docKey: "location",
    description: `GPS·IP 등 단말 위치정보를 수집하지 않으며 회원이 직접 고른 시/군/구 코드만 저장한다는 것과, 그 이용 목적·보유기간·권리·위치정보 관리책임자를 안내합니다.`,
  },
  youth: {
    file: "youth-policy",
    label: "청소년보호정책",
    docKey: "youth",
    description: `만 19세 이상만 이용할 수 있는 이유, 생년월일·본인인증·재가입 차단의 3중 연령확인, 미성년 의심 시 조치, 신고 채널과 청소년보호책임자를 안내합니다.`,
  },
  community: {
    file: "community-guidelines",
    label: "커뮤니티 가이드라인",
    docKey: null,
    description: `${company.SERVICE_NAME} 커뮤니티 가이드라인. 금지행위의 구체적 기준, 신고 사유 14가지, 제재 단계와 이의신청 절차를 안내합니다.`,
  },
  refund: {
    file: "refund-policy",
    label: "환불정책",
    docKey: "refund",
    description: `${company.SERVICE_NAME} 유료서비스의 청약철회·환불 기준. 구독·아이템별 환불 계산식과 절차를 안내합니다.`,
  },
};

export const LEGAL_ROUTE_SLUGS = Object.keys(LEGAL_DOCS) as LegalRouteSlug[];

/** 긴 slug(frontmatter slug) → 짧은 라우트 slug. company 사이트 canonical(`/legal/youth-policy`)이 여기로 들어온다 */
export const LEGAL_ALIASES: Readonly<Record<string, LegalRouteSlug>> = {
  "youth-policy": "youth",
  "community-guidelines": "community",
  "refund-policy": "refund",
};

export function isLegalRouteSlug(s: string): s is LegalRouteSlug {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, s);
}

/** 라우트 파라미터 → 정규 slug (alias 면 redirect 대상, 없으면 null) */
export function resolveLegalSlug(param: string): { slug: LegalRouteSlug; redirect: boolean } | null {
  if (isLegalRouteSlug(param)) return { slug: param, redirect: false };
  const alias = LEGAL_ALIASES[param];
  return alias ? { slug: alias, redirect: true } : null;
}

/** legal_doc_key → 라우트 (재동의 모달·동의 화면 링크) */
export function legalHrefForDocKey(key: Enums["legal_doc_key"]): string {
  const found = (Object.entries(LEGAL_DOCS) as Array<[LegalRouteSlug, LegalDocDef]>).find(([, d]) => d.docKey === key);
  if (found) return `/legal/${found[0]}`;
  return key === "business" ? "/legal/business" : "/legal";
}

export function legalLabelForDocKey(key: Enums["legal_doc_key"]): string {
  const found = Object.values(LEGAL_DOCS).find((d) => d.docKey === key);
  if (found) return found.label;
  return key === "business" ? "사업자 정보" : key === "marketing" ? "마케팅 수신 안내" : key;
}

/** 푸터·설정 링크 7종 (인덱싱 O, 비로그인 접근 O) */
export const LEGAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/legal/terms", label: "이용약관" },
  { href: "/legal/privacy", label: "개인정보처리방침" },
  { href: "/legal/location", label: "위치정보 이용약관" },
  { href: "/legal/youth", label: "청소년보호정책" },
  { href: "/legal/community", label: "커뮤니티 가이드라인" },
  { href: "/legal/refund", label: "환불정책" },
  { href: "/legal/business", label: "사업자 정보" },
];

export interface LegalDoc {
  routeSlug: LegalRouteSlug;
  meta: LegalFrontmatter;
  html: string;
  toc: TocItem[];
  /** effective_date 가 유효한 날짜이고 오늘보다 미래면 true ("개정 예정" 배지) */
  upcoming: boolean;
  canonical: string;
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
  const { html, toc } = renderMarkdown(fillPlaceholders(body));
  const eff = Date.parse(meta.effective_date);
  const upcoming = Number.isFinite(eff) && eff > Date.now();
  const base = isPlaceholder(company.WEB_APP_URL) ? "" : company.WEB_APP_URL.replace(/\/$/, "");
  const doc: LegalDoc = { routeSlug, meta, html, toc, upcoming, canonical: `${base}/legal/${routeSlug}` };
  cache.set(routeSlug, doc);
  return doc;
}

export function loadAllLegalDocs(): LegalDoc[] {
  return LEGAL_ROUTE_SLUGS.map((s) => loadLegalDoc(s));
}
