/**
 * @duckmate/db — 인증/게이트 공용 타입 (D2). 런타임 의존성 없음(클라이언트·서버·Edge 공용).
 * 판정 로직 자체는 apps/web/lib/auth/gate.ts (서버). 클라이언트는 서버 리다이렉트만 따른다(C3 §0-3).
 */
import type { Enums, Json, VerifyLevel } from "./types";

/** get_gate_state() RPC 결과 (0014). 세션 없음 = null, 프로필 없음 = profileId null */
export type GateState = {
  profileId: string | null;
  status: Enums["profile_status"];
  onboardingStep: Enums["onboarding_step"];
  verifyLevel: VerifyLevel;
  mode: Enums["profile_mode"];
  hasBirthDate: boolean;
  /** 0 = 없음, 1~6 */
  sanctionLevel: number;
  deleteRequestedAt: string | null;
  hidden: boolean;
  /** admin | moderator | null (app_role()) */
  role: "admin" | "moderator" | null;
};

/** 게이트 판정 코드 (C3 §0-3 순서). 서버 4xx 코드와 동일 문자열 */
export type GateCode =
  | "NOT_AUTHENTICATED"
  | "AGE_BLOCKED"
  | "SANCTIONED"
  | "DELETING"
  | "ONBOARDING_INCOMPLETE"
  | "NOT_VERIFIED"
  | "FORBIDDEN"
  | "REDIRECT"; // 정상 상태인데 대상 라우트가 현재 상태에 맞지 않음(예: 완료자가 /onboarding, 미제재자가 /suspended)

export type GateResult = { allow: true } | { allow: false; code: GateCode; redirectTo: string };

/** 라우트 종류 (apps/web/lib/auth/routes.ts 가 pathname → RouteTarget 으로 분류) */
export type RouteKind =
  | "public"
  | "auth" // /login, /onboarding/age, /onboarding/phone, /blocked/age — 세션 없이 접근하는 진입 화면
  | "onboarding" // /onboarding/{basic..photos}
  | "verify" // /verify
  | "app" // (app) 그룹, minLevel 1 또는 2
  | "status" // /suspended, /appeal, /account/restore
  | "admin";

export type RouteTarget =
  | { kind: "public" }
  | { kind: "auth"; route: "login" | "age" | "phone" | "blocked_age" }
  | { kind: "onboarding"; step: Exclude<Enums["onboarding_step"], "verify" | "done"> }
  | { kind: "verify" }
  | { kind: "app"; minLevel: VerifyLevel }
  | { kind: "status"; route: "suspended" | "appeal" | "restore" }
  | { kind: "admin" };

/** apply_identity_verification() 반환 코드 */
export type IdentityApplyCode = "OK" | "FAILED" | "BLOCKED_CI" | "MINOR" | "DUPLICATE_CI";

export type IdentityApplyResult = {
  ok: boolean;
  code: IdentityApplyCode;
  verification_id: string;
  verify_level?: VerifyLevel;
  birth_date_verified?: boolean;
  report?: Json;
};

/** check_rate_limit() 반환 */
export type RateLimitResult = { allowed: boolean; count: number; limit: number; retry_after_sec: number };

const PROFILE_STATUS_SET = new Set<string>(["active", "paused", "banned", "age_blocked", "deleting"]);
const STEP_SET = new Set<string>(["basic", "hobbies", "quiz", "card", "photos", "verify", "done"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * get_gate_state() 의 jsonb → GateState. 형식이 깨졌으면 null(= 세션 없음으로 취급 → /login).
 * 프로필 행이 없으면(handle_new_user 실패 등) 생년월일 미확정 상태로 만들어 /onboarding/age 로 유도한다.
 */
export function parseGateState(json: Json | null | undefined): GateState | null {
  if (!isRecord(json)) return null;
  const roleRaw = json["role"];
  const role: GateState["role"] = roleRaw === "admin" || roleRaw === "moderator" ? roleRaw : null;
  const profileId = typeof json["profile_id"] === "string" ? (json["profile_id"] as string) : null;
  if (profileId === null) {
    return {
      profileId: null,
      status: "active",
      onboardingStep: "basic",
      verifyLevel: 0,
      mode: "friend",
      hasBirthDate: false,
      sanctionLevel: 0,
      deleteRequestedAt: null,
      hidden: false,
      role,
    };
  }
  const status = json["status"];
  const step = json["onboarding_step"];
  const level = json["verify_level"];
  const sanction = json["sanction_level"];
  if (typeof status !== "string" || !PROFILE_STATUS_SET.has(status)) return null;
  if (typeof step !== "string" || !STEP_SET.has(step)) return null;
  if (typeof level !== "number" || level < 0 || level > 3) return null;
  return {
    profileId,
    status: status as Enums["profile_status"],
    onboardingStep: step as Enums["onboarding_step"],
    verifyLevel: Math.trunc(level) as VerifyLevel,
    mode: json["mode"] === "dating" ? "dating" : "friend",
    hasBirthDate: json["has_birth_date"] === true,
    sanctionLevel: typeof sanction === "number" ? Math.trunc(sanction) : 0,
    deleteRequestedAt: typeof json["delete_requested_at"] === "string" ? (json["delete_requested_at"] as string) : null,
    hidden: json["hidden"] === true,
    role,
  };
}

/** 온보딩 6화면 완료 여부 (verify | done). 두 값 모두 L1 라우트(/me, /settings) 접근 가능 */
export function isOnboardingComplete(step: Enums["onboarding_step"]): boolean {
  return step === "verify" || step === "done";
}
