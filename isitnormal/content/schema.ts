/**
 * 정상인가요 — 콘텐츠 스키마 (P2)
 *
 * 시드 설문·카테고리 허브의 타입과 검증기. 리포 관례("tool-content.ts 스키마 재사용")를 따른 단일 스키마.
 * seeds.ts / hubs.ts 는 이 타입을 만족해야 한다. P3(DB 시드), P2(허브 렌더)가 소비한다.
 */
import type { CategorySlug } from "./categories";

export interface SeedOption {
  key: string; // 'a' | 'b' | 'c' | 'd'
  label: string;
}

export interface SeedSurvey {
  slug: string; // 영문 kebab, 전역 고유
  categorySlug: CategorySlug;
  title: string; // 답 가능한 질문
  body: string; // 120~250자, "이거 나만 그래?" 긴장 세팅
  options: SeedOption[]; // 2~4개
  editorCommentary: string; // 300자+ 고유 편집 해설 (색인 3층 중 3층)
  /** 관련 항목 5개(다른 시드 slug). 조립 단계에서 채움. */
  related?: string[];
  /** 전부 운영자 시드 → 배지 고정. UGC 아님. */
  authorBadge: "@운영자";
}

export interface HubFaq {
  q: string;
  a: string;
}

export interface CategoryHub {
  categorySlug: CategorySlug;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string; // 1,200자+ 고유 편집 본문
  faq: HubFaq[]; // 3~4개
}

/** 색인 게이트가 요구하는 최소 해설 길이(공유 상수와 일치). */
export const MIN_COMMENTARY = 300;
export const MIN_HUB_INTRO = 1200;

/** 개발/CI용 경량 검증. 위반 목록을 반환(빈 배열이면 통과). */
export function validateSeed(s: SeedSurvey): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9-]+$/.test(s.slug)) errs.push(`${s.slug}: slug 형식`);
  if (s.options.length < 2) errs.push(`${s.slug}: 선택지 2개 미만`);
  if (new Set(s.options.map((o) => o.key)).size !== s.options.length)
    errs.push(`${s.slug}: 선택지 key 중복`);
  if ([...s.body].length < 80) errs.push(`${s.slug}: body 너무 짧음`);
  if ([...s.editorCommentary].length < MIN_COMMENTARY)
    errs.push(`${s.slug}: 해설 ${MIN_COMMENTARY}자 미만`);
  if (s.authorBadge !== "@운영자") errs.push(`${s.slug}: 운영자 배지 누락`);
  return errs;
}

export function validateHub(h: CategoryHub): string[] {
  const errs: string[] = [];
  if ([...h.intro].length < MIN_HUB_INTRO)
    errs.push(`${h.categorySlug}: intro ${MIN_HUB_INTRO}자 미만 (${[...h.intro].length})`);
  if (h.faq.length < 3) errs.push(`${h.categorySlug}: FAQ 3개 미만`);
  if ([...h.metaTitle].length > 70) errs.push(`${h.categorySlug}: metaTitle 과길이`);
  return errs;
}

/** 금지 AI 상투구 (절대 규칙 3). */
export const AI_CLICHES = [
  "알아보겠습니다",
  "살펴보겠습니다",
  "결론적으로",
  "중요합니다",
  "도움이 되셨",
  "마무리하며",
];

export function findCliches(text: string): string[] {
  return AI_CLICHES.filter((c) => text.includes(c));
}
