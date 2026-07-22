/**
 * data_score — 페이지 생성/색인 우선순위의 단일 기준.
 *
 * 절대 제약 2번(빈 껍데기 페이지 금지)의 집행 지점: 임계치 미달 엔티티는
 * 페이지를 만들지 않고 상위로 301 통합한다. sitemap 등재도 이 점수 순.
 */

export interface DataScoreInput {
  /** 해당 엔티티에 귀속된 거래 수. */
  transactionCount: number;
  /** 최근 90일 거래 수 (신선도 가중). */
  recentCount: number;
  /** 하위 엔티티 수(지역 페이지의 풍부함). 단지 페이지는 0. */
  childCount: number;
}

/** 페이지를 생성하는 최소 거래 수 — 스펙: "거래 3건 미만이면 생성 금지". */
export const MIN_TRANSACTIONS_FOR_PAGE = 3;

/** 0–100. */
export function dataScore({ transactionCount, recentCount, childCount }: DataScoreInput): number {
  if (transactionCount < MIN_TRANSACTIONS_FOR_PAGE) return 0;
  // 거래량: log 스케일 포화 (3건=약 20, 100건=약 60)
  const volume = Math.min(60, Math.round(Math.log10(transactionCount) * 30));
  // 신선도: 최근 거래 비중
  const freshness = Math.min(25, Math.round((recentCount / Math.max(1, transactionCount)) * 25));
  // 구조: 하위 엔티티(내부링크 재료)
  const breadth = Math.min(15, childCount);
  return Math.max(0, Math.min(100, volume + freshness + breadth));
}

/** 생성 대상인가? (미달 → 상위 301 통합) */
export function shouldCreatePage(input: DataScoreInput): boolean {
  return input.transactionCount >= MIN_TRANSACTIONS_FOR_PAGE;
}
