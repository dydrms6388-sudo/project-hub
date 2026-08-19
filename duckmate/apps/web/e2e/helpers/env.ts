// =============================================================================
// G1 · 실행 사전조건 검사 + 환경 헬퍼
//
// 이 저장소의 E2E 는 **살아 있는 Supabase 인스턴스**(로컬 `supabase start` 또는
// 전용 스테이징 프로젝트)를 전제한다. 없으면 가입 자체가 불가능하므로 테스트를
// 실패시키지 않고 **명시적 사유와 함께 skip** 한다 — "환경 미구성"과 "회귀"를
// 리포트에서 구분하기 위해서다.
//
// 판정 기준 (전부 실행 시점 env):
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY  = 앱이 붙을 DB
//   IDENTITY_VERIFIER=stub                                     = 본인인증 스텁
//   E2E_SUPABASE_EMAIL_CONFIRM=off                             = 가입 즉시 세션 발급
// =============================================================================

import { test } from "@playwright/test";

export interface EnvReport {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

function has(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 && !v.includes("YOUR_");
}

/**
 * 계정 생성이 필요한 스펙의 사전조건.
 *  - Supabase URL/anon key: 없으면 signUp 이 네트워크 단계에서 죽는다.
 *  - IDENTITY_VERIFIER=stub: 없으면 휴대폰 스텝(confirmPhoneVerification)이
 *    VERIFIER_NOT_CONFIGURED 로 막힌다 (actions.ts 의 서버측 잠금).
 */
export function checkLiveBackendEnv(): EnvReport {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!has("NEXT_PUBLIC_SUPABASE_URL")) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!has("NEXT_PUBLIC_SUPABASE_ANON_KEY")) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if ((process.env.IDENTITY_VERIFIER ?? "") !== "stub") missing.push("IDENTITY_VERIFIER=stub");

  if ((process.env.E2E_SUPABASE_EMAIL_CONFIRM ?? "off") !== "off") {
    warnings.push(
      "이메일 확인(confirm email)이 켜져 있으면 가입 직후 세션이 없어 온보딩이 /login 으로 튕긴다. " +
        "Supabase Auth 설정에서 'Confirm email' 을 끄고 E2E_SUPABASE_EMAIL_CONFIRM=off 로 표시할 것.",
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}

/** 계정 생성이 필요한 스펙 맨 앞에서 호출한다. 미구성이면 skip. */
export function requireLiveBackend(): void {
  const report = checkLiveBackendEnv();
  test.skip(
    !report.ok,
    `실행 환경 미구성 — 없는 값: ${report.missing.join(", ")}. ` +
      `docs/agents/28_e2e.md §사전조건 참고.`,
  );
}

/**
 * 추천 큐 발행에 필요한 서비스 키 경로.
 * `/discover` 는 daily_recommendations 행이 있어야 카드를 보여준다. 그 행은
 * cron(edge function daily-recommendations)이 만든다 — E2E 는 계정 생성 직후
 * 같은 함수를 직접 호출해 큐를 즉시 발행한다.
 */
export interface FunctionsAccess {
  functionsUrl: string;
  serviceRoleKey: string;
}

export function functionsAccess(): FunctionsAccess | null {
  const base =
    process.env.E2E_SUPABASE_FUNCTIONS_URL?.trim() ||
    (has("NEXT_PUBLIC_SUPABASE_URL")
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/functions/v1`
      : "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!base || !key || key.includes("YOUR_")) return null;
  return { functionsUrl: base.replace(/\/$/, ""), serviceRoleKey: key };
}

/** 추천 큐가 필요한 스펙 맨 앞에서 호출한다. */
export function requireFunctionsAccess(): void {
  test.skip(
    functionsAccess() === null,
    "추천 큐 발행 경로 미구성 — SUPABASE_SERVICE_ROLE_KEY (+ 선택 E2E_SUPABASE_FUNCTIONS_URL) 필요. " +
      "docs/agents/28_e2e.md §사전조건 참고.",
  );
}
