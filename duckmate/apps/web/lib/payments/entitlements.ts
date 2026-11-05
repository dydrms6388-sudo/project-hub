/**
 * 권한(entitlement) 래퍼 — `@duckmate/db` 의 ENTITLEMENTS 상수를 그대로 쓴다.
 *
 * - tier 는 서버 `get_effective_tier(user_id)` 결과만 신뢰한다(Phase 1 = 항상 'free').
 * - 클라이언트 체크는 UX 용이며 보안 경계가 아니다(A4 §2.3). 서버측 8곳은 `ENTITLEMENT_CHECKPOINTS` 참조.
 * - UI 에서 tier 비교 금지 → 반드시 키 비교 (`getEntitlements(tier).undo === true`).
 */
import { ENTITLEMENT_KEYS, entitlementsFor, type Entitlements, type Tier } from "@duckmate/db";
import { PAYMENT_ERROR_CODES, PaymentError, type PaymentErrorCode } from "./errors";

export type EntitlementKey = keyof Entitlements;
export type BooleanEntitlementKey = { [K in EntitlementKey]: Entitlements[K] extends boolean ? K : never }[EntitlementKey];
export type NumericEntitlementKey = { [K in EntitlementKey]: Entitlements[K] extends number ? K : never }[EntitlementKey];
/** `ads` 는 "권한"이 아니라 노출 플래그(true=광고 표시) — assertEntitled 대상에서 제외 */
export type GateKey = Exclude<BooleanEntitlementKey, "ads"> | NumericEntitlementKey | "see_likers";

export interface EntitlementContext {
  /** `get_effective_tier` 결과. null/undefined = free */
  tier: Tier | null | undefined;
  /** 수치 키용: 오늘/이번 주 이미 사용한 수 (기본 0) */
  used?: number;
}

export function getEntitlements(tier: Tier | null | undefined): Readonly<Entitlements> {
  return entitlementsFor(tier);
}

export { ENTITLEMENT_KEYS };

/** 수치 한도 -1 = 무제한 */
export const UNLIMITED = -1;

function numericAllows(limit: number, used: number): boolean {
  return limit === UNLIMITED || used < limit;
}

/** 던지지 않는 판정 */
export function isEntitled(key: GateKey, ctx: EntitlementContext): boolean {
  const ent = getEntitlements(ctx.tier);
  const value = ent[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return numericAllows(value, ctx.used ?? 0);
  return value === "full"; // see_likers
}

/** 키에 맞는 실패 코드 (A4 §2.3 표) */
export function entitlementFailureCode(key: GateKey): PaymentErrorCode {
  switch (key) {
    case "daily_reco_limit":
    case "daily_card_limit":
    case "battle_detail_top":
      return PAYMENT_ERROR_CODES.LIMIT_REACHED;
    case "weekly_superlike_quota":
      return PAYMENT_ERROR_CODES.NO_SUPERLIKE;
    case "event_priority":
      return PAYMENT_ERROR_CODES.PRIORITY_WINDOW;
    default:
      return PAYMENT_ERROR_CODES.NOT_ENTITLED;
  }
}

/**
 * 권한 없으면 PaymentError 를 던진다. 서버 액션·Edge Function 에서 사용.
 * 수치 키는 `ctx.used` 가 한도 미만이어야 통과(-1 = 무제한).
 */
export function assertEntitled(key: GateKey, ctx: EntitlementContext): void {
  if (isEntitled(key, ctx)) return;
  const ent = getEntitlements(ctx.tier);
  throw new PaymentError(entitlementFailureCode(key), `${key} (tier=${ctx.tier ?? "free"}, limit=${String(ent[key])}, used=${ctx.used ?? 0})`);
}

/** 서버측 권한 체크 포인트 8곳 (A4 §2.3) — Phase 3 구현·G2 리뷰 체크리스트 */
export const ENTITLEMENT_CHECKPOINTS: ReadonlyArray<{
  id: number;
  where: string;
  key: GateKey;
  onFail: PaymentErrorCode | "mask" | "drop";
  phase: 1 | 2 | 3 | 5;
}> = [
  { id: 1, where: "daily_recommendations 생성 배치(Edge Function)", key: "daily_reco_limit", onFail: "drop", phase: 1 },
  { id: 2, where: "RPC draw_daily_card", key: "daily_card_limit", onFail: "LIMIT_REACHED", phase: 2 },
  { id: 3, where: "뷰 v_likers (blur 면 닉네임·사진 NULL, count 만)", key: "see_likers", onFail: "mask", phase: 3 },
  { id: 4, where: "RPC send_super_like (쿼터 → ledger 잔액 → 거부, 일 상한 5)", key: "weekly_superlike_quota", onFail: "NO_SUPERLIKE", phase: 1 },
  { id: 5, where: "RPC undo_last_pass (undo AND <300s AND 상대 미like)", key: "undo", onFail: "NOT_ENTITLED", phase: 3 },
  { id: 6, where: "취향 배틀 결과 조회 (상위 N row 만)", key: "battle_detail_top", onFail: "mask", phase: 2 },
  { id: 7, where: "이벤트 RSVP RPC (starts_at-24h 이전 거부)", key: "event_priority", onFail: "PRIORITY_WINDOW", phase: 5 },
  { id: 8, where: "추천 필터 파라미터 검증 (고급 필터 drop + 로그)", key: "advanced_filters", onFail: "drop", phase: 3 },
];
