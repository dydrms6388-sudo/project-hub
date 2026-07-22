/**
 * 정상인가요 — 승격 색인 게이트 (P1 산출물, 재사용 모듈)
 *
 * 최우선 원칙 1: UGC 플랫폼은 빈 글 수천 개가 색인되는 순간 Low Value Content로 죽는다.
 *   기본값 = 모든 UGC는 noindex. 아래 게이트를 전부 통과해야만 index 승격 + sitemap 등재.
 *
 * 이 파일은 프레임워크 비의존 순수 함수. P3(투표 집계)·P5(모더레이션)·P7(sitemap 생성)이 공유한다.
 * 판정은 전부 이진(boolean). 점수제 없음 — 점수는 후해진다.
 */

/** 통계 노출 최소 표본 (V3). n<30이면 통계 미노출 → "집계 중". */
export const MIN_SAMPLE_FOR_STATS = 30;
/** 색인 페이지 본문 최소 총 글자수 (절대 규칙 2). */
export const MIN_INDEX_CHARS = 1200;
/** 그중 이 페이지에만 존재하는 고유 텍스트 최소치 (절대 규칙 2). */
export const MIN_UNIQUE_CHARS = 800;
/** 편집자 해설 최소 (색인 3층 중 3층). */
export const MIN_EDITOR_COMMENTARY = 300;
/** 관련 항목 개수. */
export const MIN_RELATED = 5;
/** UGC 승격 필수 경과일. */
export const MIN_AGE_DAYS = 7;
/** UGC 승격 필수 유효 반응(투표+댓글) 수. */
export const MIN_VALID_REACTIONS = 10;
/** UGC 본문 글자수 대안 조건. */
export const MIN_UGC_BODY_CHARS = 400;

export type Origin = "operator" | "user";
export type ModerationStatus = "pending" | "approved" | "held" | "rejected";

export interface PromotionInput {
  origin: Origin;
  moderationStatus: ModerationStatus;
  /** UGC 원문 글자수 (1층) */
  bodyChars: number;
  /** 총 투표 수 */
  votes: number;
  /** 댓글(한 줄 의견) 수 */
  comments: number;
  /** 편집자 해설 글자수 (3층) */
  editorCommentaryChars: number;
  /** 관련 항목 수 */
  relatedCount: number;
  /** 색인 페이지 3층 합산 총 글자수 */
  totalPageChars: number;
  /** 그중 이 페이지 전용 고유 글자수 (변수 치환 템플릿 제외) */
  uniquePageChars: number;
  /** 생성 후 경과일 */
  ageDays: number;
  /** 자동 품질 스캔 통과 여부 (상투구·유사도·법무·스팸) */
  qualityScanPassed: boolean;
}

export interface PromotionResult {
  /** index 승격 + sitemap 등재 가능 여부 */
  canIndex: boolean;
  /** 통계(%) 노출 가능 여부 — false면 "집계 중" */
  showStats: boolean;
  /** 실패 사유 코드 목록 (이진 판정 근거). 빈 배열이면 통과. */
  reasons: string[];
}

/**
 * 유효 반응 = 투표 + 댓글. (2) 조건.
 */
export function validReactions(input: Pick<PromotionInput, "votes" | "comments">): number {
  return input.votes + input.comments;
}

/**
 * 통계 노출 가능 여부만 따로 (V3). 카드/통계 시각화 게이트에서 재사용.
 */
export function canShowStats(votes: number): boolean {
  return votes >= MIN_SAMPLE_FOR_STATS;
}

/**
 * 승격 판정. 통과하려면 reasons가 비어야 한다.
 *
 * 공통(모든 origin): 3층 완비 + 1200/800 글자 + 관련 5 + 통계 표본 30.
 * UGC(origin='user') 추가: 본문400||투표30, 유효반응10, 7일경과, 품질스캔, 승인상태.
 * 운영자 시드(origin='operator')도 원문/해설/관련은 완비 상태로 작성되지만,
 *   실제 투표 n>=30 병목은 동일하게 적용된다(가짜 숫자 금지, S2/D3).
 */
export function evaluatePromotion(input: PromotionInput): PromotionResult {
  const reasons: string[] = [];

  // --- 3층 구조 완비 (절대 규칙 1) ---
  if (input.bodyChars <= 0) reasons.push("no_body"); // 1층 원문 없음
  if (!canShowStats(input.votes)) reasons.push("stats_below_min_sample"); // 2층: n<30
  if (input.editorCommentaryChars < MIN_EDITOR_COMMENTARY) reasons.push("commentary_too_short"); // 3층
  if (input.relatedCount < MIN_RELATED) reasons.push("related_below_5");

  // --- 글자 밀도 (절대 규칙 2) ---
  if (input.totalPageChars < MIN_INDEX_CHARS) reasons.push("total_chars_below_1200");
  if (input.uniquePageChars < MIN_UNIQUE_CHARS) reasons.push("unique_chars_below_800");

  // --- UGC 전용 게이트 ---
  if (input.origin === "user") {
    if (input.moderationStatus !== "approved") reasons.push("not_approved");
    const cond1 = input.bodyChars >= MIN_UGC_BODY_CHARS || input.votes >= MIN_SAMPLE_FOR_STATS;
    if (!cond1) reasons.push("ugc_body_or_votes_unmet"); // (1)
    if (validReactions(input) < MIN_VALID_REACTIONS) reasons.push("valid_reactions_below_10"); // (2)
    if (input.ageDays < MIN_AGE_DAYS) reasons.push("age_below_7d"); // (3)
    if (!input.qualityScanPassed) reasons.push("quality_scan_failed"); // (4)
  }

  return {
    canIndex: reasons.length === 0,
    showStats: canShowStats(input.votes),
    reasons,
  };
}

/**
 * sitemap 등재 판정 = 승격 통과와 동치. (미승격 UGC는 sitemap 절대 금지)
 * sitemap 생성기(P7)는 이 함수로 걸러진 것만 넣는다. F3: sitemap URL 수 == 색인 대상 수.
 */
export function isSitemapEligible(input: PromotionInput): boolean {
  return evaluatePromotion(input).canIndex;
}
