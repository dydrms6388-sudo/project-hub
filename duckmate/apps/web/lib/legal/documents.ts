// =============================================================================
// E4 · 법적 문서 6종 로더 (apps/web/content/legal/*.md 단일 소스)
//
// 08_legal_docs 결정사항 준수:
//   ② 플레이스홀더 {{VAR}} 치환의 단일 소스 = apps/company/config/company.ts.
//      web 이 값을 재정의하지 않고 그 파일을 그대로 import 한다(값 중복 정의 금지).
//      미입력 값은 `[TODO_사업자정보…]` 그대로 노출 + 빌드 경고(차단 금지 — 스펙 §0-4).
//   ① frontmatter 의 draft:true 면 렌더 화면이 "법률 검토 전 초안" 배너를 띄운다.
//   ⑥ version/effectiveDate 표시.
//
// 서버 전용(fs 사용). 페이지는 generateStaticParams + force-static 으로 빌드 타임에
// 읽으므로 런타임 파일 접근이 없다.
// =============================================================================

import { readFile } from "node:fs/promises";
import path from "node:path";
import { TODO_PLACEHOLDER, company, display } from "../../../company/config/company";

export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "location",
  "youth",
  "community",
  "refund",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** 설정 → 약관 및 정책 목록의 노출 순서·짧은 설명 (08_legal_docs §4-E4-2 순서 고정) */
export const LEGAL_DOC_SUMMARY: Record<LegalSlug, string> = {
  terms: "서비스 이용 조건, 인증 레벨, 신고·제재, 유료서비스의 기본 계약",
  privacy: "수집 항목·보유 기간·위탁/국외이전·정보주체 권리",
  location: "활동 지역(행정구역) 정보만 수집 — 실시간 위치는 수집하지 않아요",
  youth: "만 19세 미만 차단 3중 장치와 청소년보호책임자",
  community: "금지행위와 신고 사유, 제재 5등급, 안전 만남 수칙",
  refund: "청약철회·일할 환불 계산식·해지 기준",
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export interface LegalDocMeta {
  slug: LegalSlug;
  title: string;
  version: string;
  /** frontmatter 원본 값이 플레이스홀더면 null */
  effectiveDate: string | null;
  /** 화면 표시용 — 미정 시 "정식 오픈 시 확정" */
  effectiveDateLabel: string;
  draft: boolean;
}

export interface LegalDoc extends LegalDocMeta {
  html: string;
  headings: { id: string; text: string; level: number }[];
  /** 치환하지 못한(=사업자 정보 미입력) 변수 목록 — 화면 하단 고지에 사용 */
  missingPlaceholders: string[];
}

// ---------------------------------------------------------------------------
// 플레이스홀더 치환 (08_legal_docs 결정 ② 전체 목록)
// ---------------------------------------------------------------------------

const PLACEHOLDER_VALUES: Record<string, string> = {
  COMPANY_NAME: display(company.legalName),
  SERVICE_NAME: display(company.serviceName),
  CEO_NAME: display(company.ceoName),
  BIZ_REG_NO: display(company.bizRegNo),
  MAIL_ORDER_NO: display(company.mailOrderNo),
  ADDRESS: display(company.address),
  PRIVACY_OFFICER: display(company.privacyOfficer.name),
  YOUTH_OFFICER: display(company.youthOfficer.name),
  CONTACT_EMAIL: display(company.contactEmail),
  // 시행일·서비스 리전 국가는 company.ts 관리 항목이 아니다 — 확정 전까지 TODO 노출.
  EFFECTIVE_DATE: TODO_PLACEHOLDER,
  SUPABASE_REGION_COUNTRY: TODO_PLACEHOLDER,
};

function isUnfilled(value: string): boolean {
  return value.includes("[TODO_사업자정보");
}

/** display() 가 돌려주는 플레이스홀더 상수도 같은 규칙으로 취급한다. */
void TODO_PLACEHOLDER;

function substitute(source: string, missing: Set<string>): string {
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (_match, name: string) => {
    const value = PLACEHOLDER_VALUES[name];
    if (value === undefined) {
      missing.add(name);
      return `[TODO_사업자정보:${name}]`;
    }
    if (isUnfilled(value)) missing.add(name);
    return value;
  });
}

// ---------------------------------------------------------------------------
// frontmatter 파싱 (YAML 부분집합: key: value / 따옴표 / true·false)
// ---------------------------------------------------------------------------

interface Frontmatter {
  data: Record<string, string | boolean>;
  body: string;
}

function parseFrontmatter(raw: string): Frontmatter {
  const normalized = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: normalized };

  const data: Record<string, string | boolean> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1] ?? "";
    let value = (kv[2] ?? "").trim();
    if (value === "true" || value === "false") {
      data[key] = value === "true";
      continue;
    }
    value = value.replace(/^["'](.*)["']$/, "$1");
    data[key] = value;
  }
  return { data, body: normalized.slice(match[0].length) };
}

// ---------------------------------------------------------------------------
// 파일 로딩
// ---------------------------------------------------------------------------

/** turbo/next 실행 위치(apps/web 또는 리포 루트)를 모두 견디는 후보 경로 */
function contentCandidates(slug: LegalSlug): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "content", "legal", `${slug}.md`),
    path.join(cwd, "apps", "web", "content", "legal", `${slug}.md`),
  ];
}

async function readDocSource(slug: LegalSlug): Promise<string | null> {
  for (const candidate of contentCandidates(slug)) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // 다음 후보 시도
    }
  }
  return null;
}

function toMeta(slug: LegalSlug, data: Record<string, string | boolean>): LegalDocMeta {
  const rawEffective = typeof data.effectiveDate === "string" ? data.effectiveDate : "";
  const substitutedEffective = substitute(rawEffective, new Set<string>());
  const filled = substitutedEffective !== "" && !isUnfilled(substitutedEffective);
  return {
    slug,
    title: typeof data.title === "string" && data.title !== "" ? data.title : slug,
    version: typeof data.version === "string" ? data.version : "0.0.0",
    effectiveDate: filled ? substitutedEffective : null,
    effectiveDateLabel: filled ? substitutedEffective : "정식 오픈 시 확정",
    draft: data.draft === true,
  };
}

let warned = false;

/** 문서 1건 로드 + 치환 + HTML 변환. 없으면 null (라우트는 notFound 처리). */
export async function getLegalDoc(slug: LegalSlug): Promise<LegalDoc | null> {
  const source = await readDocSource(slug);
  if (source === null) return null;

  const { data, body } = parseFrontmatter(source);
  const missing = new Set<string>();
  const substituted = substitute(body, missing);
  const { renderMarkdown } = await import("./markdown");
  const { html, headings } = renderMarkdown(substituted);

  if (missing.size > 0 && !warned) {
    warned = true;
    console.warn(
      `⚠️  [duckmate/legal] 사업자 정보 플레이스홀더 미입력: ${[...missing].join(", ")} — apps/company/config/company.ts (스펙 §0-4: 경고만, 빌드 차단 없음)`,
    );
  }

  return { ...toMeta(slug, data), html, headings, missingPlaceholders: [...missing] };
}

/** 목록 화면용 메타만 (본문 변환 생략) */
export async function listLegalDocs(): Promise<LegalDocMeta[]> {
  const metas: LegalDocMeta[] = [];
  for (const slug of LEGAL_SLUGS) {
    const source = await readDocSource(slug);
    if (source === null) continue;
    metas.push(toMeta(slug, parseFrontmatter(source).data));
  }
  return metas;
}
