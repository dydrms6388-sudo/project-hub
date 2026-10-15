// =============================================================================
// E2 · 페이월 안내(인라인) — Phase 1 은 "안내 1줄"만, 결제 버튼·결제 코드 없음.
//
// 12_flows §3.5 / 04_monetization §3:
//  - 페이월 전환 지점 5종의 source 값이 규약이다: likers_blur / recs_exhausted /
//    superlike_empty / rewind_attempt / battle_detail_lock.
//  - Phase 3 에서 E4 가 이 자리의 `source` 를 그대로 받아 페이월 모달을 띄우고
//    paywall_source props 로 로깅한다. 그때까지 여기는 사실 안내만 한다.
//  - 금지: "지금 안 사면", "마감 임박", 카운트다운, 재고 표시, 죄책감 카피
//    (A4 §4 다크패턴 금지 3·5·6항 / C2 D-3).
// =============================================================================

import { TIER_LIMITS } from "@duckmate/db";

/** 04_monetization §3 표의 source 5종 — 값 변경 금지 */
export type PaywallSource =
  | "likers_blur"
  | "recs_exhausted"
  | "superlike_empty"
  | "rewind_attempt"
  | "battle_detail_lock";

const NOTICE: Record<PaywallSource, string> = {
  likers_blur: "플러스에서는 보낸 분이 누구인지 볼 수 있어요.",
  recs_exhausted: `플러스에서는 하루 ${TIER_LIMITS.plus.dailyRecs}명까지 추천을 받아요.`,
  superlike_empty: `슈퍼라이크는 플러스에서 주 ${TIER_LIMITS.plus.weeklySuperlikes}개씩 채워져요.`,
  rewind_attempt: "되돌리기는 플러스부터 쓸 수 있어요.",
  battle_detail_lock: "취향 배틀 상세는 플러스에서 더 볼 수 있어요.",
};

export interface PaywallNoticeProps {
  source: PaywallSource;
  className?: string;
}

export function PaywallNotice({ source, className }: PaywallNoticeProps) {
  return (
    <p
      data-paywall-source={source}
      className={["text-caption text-ink-muted", className].filter(Boolean).join(" ")}
    >
      {NOTICE[source]} 구독은 준비 중이에요.
    </p>
  );
}
