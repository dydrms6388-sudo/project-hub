// A4 §2 확정값 — 티어 한도 단일 진실(Single Source of Truth).
// FE/BE/Edge Function 은 반드시 이 상수만 참조한다 (하드코딩 금지).
// battleDetail: -1 = 전체 공개. rewindPerDay: -1 = 무제한, 0 = 불가 (A4 조정안 #1).

export const TIER_LIMITS = {
  free: {
    dailyRecs: 5,
    dailyCards: 1,
    seeLikers: "blur",
    weeklySuperlikes: 1,
    battleDetail: 1,
    rewind: false,
    rewindPerDay: 0,
    eventPriority: false,
    ads: true,
    monthlyBoostGrant: 0,
  },
  plus: {
    dailyRecs: 15,
    dailyCards: 3,
    seeLikers: "open",
    weeklySuperlikes: 5,
    battleDetail: 5,
    rewind: true,
    rewindPerDay: 3,
    eventPriority: false,
    ads: false,
    monthlyBoostGrant: 0,
  },
  pro: {
    dailyRecs: 30,
    dailyCards: 5,
    seeLikers: "open+boost",
    weeklySuperlikes: 15,
    battleDetail: -1,
    rewind: true,
    rewindPerDay: -1,
    eventPriority: true,
    ads: false,
    monthlyBoostGrant: 1, // A4 조정안 #2: 프로 월 부스트 1개 지급
  },
} as const;

export type TierLimits = typeof TIER_LIMITS;
export type Tier = keyof TierLimits;

// 소모성 아이템 정가 (A4 §5.2 환불 정가단가와 정합)
export const ITEM_PRICES = {
  superlike_pack_5: 4_900, // 슈퍼라이크 5개 팩
  superlike_unit: 980, //   환불 계산 정가단가 (₩4,900 / 5)
  boost_1: 3_900, //        부스트 1개 (1시간 노출↑, 구매 후 90일)
} as const;

// 구독 월 요금 (VAT 포함, 웹 Toss 기준 — 스토어 차등가는 Phase 4 B3)
export const TIER_PRICES = {
  free: 0,
  plus: 9_900,
  pro: 19_900,
} as const;
