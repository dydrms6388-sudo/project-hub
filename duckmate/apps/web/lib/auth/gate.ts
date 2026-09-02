/**
 * 접근 게이트 판정 (C3 §0-3 순서, 순수 함수) + 미들웨어 캐시 쿠키 인코딩.
 *
 *   ① 세션 없음 → /login
 *   ② status='age_blocked' → /blocked/age
 *   ③ status='banned' 또는 활성 sanctions.level ≥ 3 → /suspended
 *   ④ status='deleting' → /account/restore
 *   ⑤ 생년월일 미확정 → /onboarding/age, onboarding_step ∈ basic..photos → /onboarding/{step}
 *   ⑥ verify_level < 2 이고 대상이 L2 라우트 → /verify
 *   ⑦ 통과
 *
 * 이 파일은 Edge(미들웨어)·Node(서버 컴포넌트/액션) 양쪽에서 import 되므로 next/headers 를 import 하지 않는다.
 */
import { ONBOARDING_STEPS, ONBOARDING_STEP_ROUTES, isOnboardingComplete } from "@duckmate/db";
import type { Enums, GateResult, GateState, RouteTarget, VerifyLevel } from "@duckmate/db";
import { ROUTES } from "@/lib/auth/routes";
import { base64UrlDecode, base64UrlEncode, hmacSha256Hex, timingSafeEqualHex } from "@/lib/auth/hash";

const STEP_INDEX: Readonly<Record<Enums["onboarding_step"], number>> = Object.fromEntries(
  ONBOARDING_STEPS.map((s, i) => [s, i]),
) as Record<Enums["onboarding_step"], number>;

export const SUSPEND_MIN_SANCTION_LEVEL = 3;

function deny(code: Exclude<GateResult, { allow: true }>["code"], redirectTo: string): GateResult {
  return { allow: false, code, redirectTo };
}
const ALLOW: GateResult = { allow: true };

/** 현재 상태의 사용자가 "있어야 할 곳" (정상 상태면 /home 또는 /verify) */
export function homeFor(state: GateState): string {
  if (state.status === "age_blocked") return ROUTES.blockedAge;
  if (state.status === "banned" || state.sanctionLevel >= SUSPEND_MIN_SANCTION_LEVEL) return ROUTES.suspended;
  if (state.status === "deleting") return ROUTES.restore;
  if (!state.hasBirthDate) return ROUTES.age;
  if (!isOnboardingComplete(state.onboardingStep)) return ONBOARDING_STEP_ROUTES[state.onboardingStep];
  if (state.verifyLevel < 2) return ROUTES.verify;
  return ROUTES.home;
}

export function evaluateGate(state: GateState | null, target: RouteTarget): GateResult {
  // ① 세션 없음
  if (state === null) {
    if (target.kind === "public" || target.kind === "auth") return ALLOW;
    if (target.kind === "admin") return deny("FORBIDDEN", ROUTES.notFound);
    return deny("NOT_AUTHENTICATED", ROUTES.login);
  }

  // (admin) 은 역할만 본다. 없으면 404 와 동일 화면(C3 §8)
  if (target.kind === "admin") {
    if (state.status === "banned") return deny("SANCTIONED", ROUTES.suspended);
    return state.role === "admin" || state.role === "moderator" ? ALLOW : deny("FORBIDDEN", ROUTES.notFound);
  }

  // ② 연령 차단: /blocked/age 만 허용
  if (state.status === "age_blocked") {
    return target.kind === "auth" && target.route === "blocked_age" ? ALLOW : deny("AGE_BLOCKED", ROUTES.blockedAge);
  }

  // ③ 영구정지 / 정지(3~5): /suspended, /appeal 만 허용
  if (state.status === "banned" || state.sanctionLevel >= SUSPEND_MIN_SANCTION_LEVEL) {
    if (target.kind === "status" && (target.route === "suspended" || target.route === "appeal")) return ALLOW;
    if (target.kind === "public") return ALLOW;
    return deny("SANCTIONED", ROUTES.suspended);
  }

  // ④ 탈퇴 유예: /account/restore 만 허용
  if (state.status === "deleting") {
    if (target.kind === "status" && target.route === "restore") return ALLOW;
    if (target.kind === "public") return ALLOW;
    return deny("DELETING", ROUTES.restore);
  }

  // ⑤-a 생년월일 미확정(프로필 행 없음 포함): /onboarding/age 만 (OTP 후 드래프트 없이 들어온 재방문자)
  if (!state.hasBirthDate) {
    if (target.kind === "auth" && (target.route === "age" || target.route === "phone")) return ALLOW;
    if (target.kind === "public") return ALLOW;
    return deny("ONBOARDING_INCOMPLETE", ROUTES.age);
  }

  // ⑤-b 온보딩 6화면 미완: 현재 step 이하의 화면만 재방문 가능(뒤로가기 프리필), 그 외 → /onboarding/{step}
  if (!isOnboardingComplete(state.onboardingStep)) {
    const current = STEP_INDEX[state.onboardingStep];
    if (target.kind === "onboarding") {
      return STEP_INDEX[target.step] <= current ? ALLOW : deny("ONBOARDING_INCOMPLETE", ONBOARDING_STEP_ROUTES[state.onboardingStep]);
    }
    if (target.kind === "public") return ALLOW;
    return deny("ONBOARDING_INCOMPLETE", ONBOARDING_STEP_ROUTES[state.onboardingStep]);
  }

  // 여기부터 온보딩 완료 상태
  switch (target.kind) {
    case "public":
      return ALLOW;
    case "auth": // 로그인·연령·OTP·연령차단 화면은 완료자에게 의미 없음 → 있어야 할 곳으로
    case "onboarding": // 완료 후 /onboarding/* → /home (C3 §0-11)
      return deny("REDIRECT", homeFor(state));
    case "verify":
      return state.verifyLevel >= 2 ? deny("REDIRECT", ROUTES.home) : ALLOW;
    case "app":
      if (target.minLevel >= 2 && state.verifyLevel < 2) return deny("NOT_VERIFIED", ROUTES.verify);
      return ALLOW;
    case "status":
      // 제재/탈퇴 상태가 아닌데 상태 화면 접근 → 있어야 할 곳으로
      return deny("REDIRECT", homeFor(state));
    default:
      return ALLOW;
  }
}

/** 서버 액션용 최소 레벨 판정: 게이트 통과 + verify_level ≥ minLevel */
export function checkActionAccess(state: GateState | null, minLevel: VerifyLevel): GateResult {
  const gate = evaluateGate(state, { kind: "app", minLevel: minLevel >= 2 ? 2 : 1 });
  if (!gate.allow) return gate;
  if (state && state.verifyLevel < minLevel) {
    return deny(minLevel >= 2 ? "NOT_VERIFIED" : "ONBOARDING_INCOMPLETE", minLevel >= 2 ? ROUTES.verify : homeFor(state));
  }
  return ALLOW;
}

// ---------------------------------------------------------------------------
// 미들웨어 게이트 캐시 쿠키 (60s). HMAC 서명. layout 의 requireGate() 는 캐시를 쓰지 않고 항상 DB 를 본다.
// ---------------------------------------------------------------------------
export const GATE_COOKIE = "dm_gate";
export const GATE_CACHE_TTL_SEC = 60;

type GateCookiePayload = { v: 1; u: string; e: number; s: GateState };

export async function encodeGateCookie(userId: string, state: GateState, secret: string, now = Date.now()): Promise<string> {
  const payload: GateCookiePayload = { v: 1, u: userId, e: Math.floor(now / 1000) + GATE_CACHE_TTL_SEC, s: state };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSha256Hex(secret, body);
  return `${body}.${sig}`;
}

export async function decodeGateCookie(value: string | undefined, userId: string, secret: string, now = Date.now()): Promise<GateState | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmacSha256Hex(secret, body);
  if (!timingSafeEqualHex(sig, expected)) return null;
  const raw = base64UrlDecode(body);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GateCookiePayload>;
    if (parsed.v !== 1 || parsed.u !== userId || typeof parsed.e !== "number" || !parsed.s) return null;
    if (parsed.e * 1000 < now) return null;
    return parsed.s;
  } catch {
    return null;
  }
}
