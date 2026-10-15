/**
 * ENTITLEMENTS — 티어별 권한 12키 (A4 §2.2 확정표, 브리프 유료 구조표)
 * 서버(RLS/Edge Function)와 클라이언트가 같은 상수를 import 한다.
 * UI 에서 "플러스면 ~" 같은 tier 비교 금지 — 반드시 키 비교(ent.undo === true).
 * Phase 1 은 daily_reco_limit / weekly_superlike_quota 만 읽는다(PRD §0-46).
 */
import type { Enums } from "./types";

export type Tier = Enums["subscription_tier"];

export type Entitlements = {
  /** 일일 추천 수 */
  daily_reco_limit: number;
  /** 오늘의 궁합 카드(일) — Phase 2 */
  daily_card_limit: number;
  /** 나를 좋아한 사람 — 'blur' | 'full' */
  see_likers: "blur" | "full";
  /** 나를 좋아한 사람 추천 우선 노출(상한 해제 + 최상단) */
  liker_priority: boolean;
  /** 주간 슈퍼라이크 쿼터(월 07:00 KST 리셋, likes 카운트 뷰) */
  weekly_superlike_quota: number;
  /** 취향 배틀 결과 상세 상위 N (-1 = 전체) — Phase 2 */
  battle_detail_top: number;
  /** 되돌리기(마지막 패스 취소) — Phase 3 */
  undo: boolean;
  /** 이벤트 우선 참가(선착순 24h 먼저) — Phase 5 */
  event_priority: boolean;
  /** 광고 노출 여부 */
  ads: boolean;
  /** 읽음 표시 확인 — Phase 3 */
  read_receipts: boolean;
  /** 추천 고급 필터 — Phase 3 */
  advanced_filters: boolean;
  /** 프로필 방문자 통계(집계만) — Phase 3 */
  profile_stats: boolean;
};

export const ENTITLEMENTS: Readonly<Record<Tier, Readonly<Entitlements>>> = {
  free: {
    daily_reco_limit: 5,
    daily_card_limit: 1,
    see_likers: "blur",
    liker_priority: false,
    weekly_superlike_quota: 1,
    battle_detail_top: 1,
    undo: false,
    event_priority: false,
    ads: true,
    read_receipts: false,
    advanced_filters: false,
    profile_stats: false,
  },
  plus: {
    daily_reco_limit: 15,
    daily_card_limit: 3,
    see_likers: "full",
    liker_priority: false,
    weekly_superlike_quota: 5,
    battle_detail_top: 5,
    undo: true,
    event_priority: false,
    ads: false,
    read_receipts: true,
    advanced_filters: true,
    profile_stats: false,
  },
  pro: {
    daily_reco_limit: 30,
    daily_card_limit: 5,
    see_likers: "full",
    liker_priority: true,
    weekly_superlike_quota: 15,
    battle_detail_top: -1,
    undo: true,
    event_priority: true,
    ads: false,
    read_receipts: true,
    advanced_filters: true,
    profile_stats: true,
  },
} as const;

export const ENTITLEMENT_KEYS = [
  "daily_reco_limit",
  "daily_card_limit",
  "see_likers",
  "liker_priority",
  "weekly_superlike_quota",
  "battle_detail_top",
  "undo",
  "event_priority",
  "ads",
  "read_receipts",
  "advanced_filters",
  "profile_stats",
] as const satisfies ReadonlyArray<keyof Entitlements>;

/** 티어 공통 상수 (A4 §2.2) */
export const DAILY_SUPERLIKE_CAP = 5;
export const UNDO_WINDOW_SEC = 300;
export const BOOST_DURATION_MIN = 60;
/** 나를 좋아한 사람 추천 상한 비율(전 티어 공통, pro 는 liker_priority 로 해제) */
export const LIKER_POOL_RATIO = 0.4;

export function entitlementsFor(tier: Tier | null | undefined): Readonly<Entitlements> {
  return ENTITLEMENTS[tier ?? "free"];
}
