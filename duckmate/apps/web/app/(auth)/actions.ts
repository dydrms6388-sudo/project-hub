"use server";

/**
 * 인증 서버 액션 (E1 의 PhoneOtpScreen / 연령 화면이 호출). 페이지 없음 — 액션 파일만.
 *
 *   requestOtp({ phone })                                   → { phone(E.164), resendAfterSec }
 *   verifyOtp({ phone, token, birthDate?, consents? })      → { redirectTo, isNew }   (birthDate+consents = 가입, 없으면 재방문 로그인)
 *   submitBirthDate({ birthDate, consents? })               → { redirectTo }          (OTP 후 드래프트 없이 들어온 재방문자)
 *   signOut()                                               → { redirectTo: "/" }
 *
 * 규칙
 *  - 모든 결과는 ActionResult. 실패 code 는 lib/auth/errors.ts (RATE_LIMITED 는 retryAfterSec 포함).
 *  - 미성년(KST 만 19세 미만) 은 서버가 재계산: create_profile → age_blocked(생년월일 미저장) → 로그아웃 → /blocked/age.
 *  - 레이트리밋: IP 20/h, 번호 5/h(발송), 번호 10/h(검증). DB 카운터(check_rate_limit) — 메모리 금지(서버리스).
 */
import { headers } from "next/headers";
import { parseGateState } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { OTP_LIMITS, clientIp, enforceRateLimit, normalizeKrPhone, phoneHash, rateLimitKey } from "@/lib/auth/otp";
import { recordOnboardingConsents, type ConsentContext } from "@/lib/auth/consents";
import { homeFor } from "@/lib/auth/gate";
import { invalidateGateCache } from "@/lib/auth/session";
import { ROUTES } from "@/lib/auth/routes";
import { firstIssue, phoneSchema, submitBirthDateSchema, verifyOtpSchema } from "@/lib/onboarding/schemas";

export const OTP_RESEND_AFTER_SEC = 30;

async function requestContext(): Promise<ConsentContext> {
  const h = await headers();
  return { ip: clientIp(h), userAgent: h.get("user-agent") };
}

export async function requestOtp(input: unknown): Promise<ActionResult<{ phone: string; resendAfterSec: number }>> {
  try {
    const parsed = phoneSchema.safeParse(input);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      return fail("INVALID_INPUT", message, { field });
    }
    const e164 = normalizeKrPhone(parsed.data.phone);
    if (!e164) return fail("INVALID_INPUT", "휴대폰 번호를 확인해 주세요", { field: "phone" });

    const ctx = await requestContext();
    const admin = createAdminClient();
    await enforceRateLimit(admin, await rateLimitKey("otp_send:ip", ctx.ip), OTP_LIMITS.sendPerIpPerHour, OTP_LIMITS.windowSec);
    await enforceRateLimit(admin, await rateLimitKey("otp_send:phone", e164), OTP_LIMITS.sendPerPhonePerHour, OTP_LIMITS.windowSec);

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms", shouldCreateUser: true } });
    if (error) {
      if (error.status === 429) return fail("RATE_LIMITED", "요청이 많아요. 1시간 후 다시 시도해 주세요", { retryAfterSec: OTP_LIMITS.windowSec });
      console.error("[otp] signInWithOtp failed", error.status, error.message);
      return fail("INTERNAL", "인증 코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요");
    }
    return ok({ phone: e164, resendAfterSec: OTP_RESEND_AFTER_SEC });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function verifyOtp(input: unknown): Promise<ActionResult<{ redirectTo: string; isNew: boolean }>> {
  try {
    const parsed = verifyOtpSchema.safeParse(input);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      return fail("INVALID_INPUT", message, { field });
    }
    const { token, birthDate, consents } = parsed.data;
    const e164 = normalizeKrPhone(parsed.data.phone);
    if (!e164) return fail("INVALID_INPUT", "휴대폰 번호를 확인해 주세요", { field: "phone" });
    // 가입 플로우는 OTP 검증 전에 동의 입력을 먼저 확인(로그인 상태에서 동의 누락이 생기지 않도록)
    if (birthDate && (!consents || !consents.terms || !consents.privacy || !consents.youthPolicy || !consents.evidenceSnapshot)) {
      return fail("INVALID_INPUT", "필수 약관에 동의해 주세요", { field: "consents" });
    }

    const ctx = await requestContext();
    const admin = createAdminClient();
    await enforceRateLimit(admin, await rateLimitKey("otp_verify:phone", e164), OTP_LIMITS.verifyPerPhonePerHour, OTP_LIMITS.windowSec);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token, type: "sms" });
    if (error || !data.user) {
      if (error?.status === 429) return fail("RATE_LIMITED", undefined, { retryAfterSec: 60 });
      return fail("INVALID_INPUT", "코드가 맞지 않아요", { field: "token" });
    }
    const user = data.user;

    // 세션 생성 직후 상태 판정 (handle_new_user 트리거가 profiles 행을 만든다)
    const gateRes = await supabase.rpc("get_gate_state");
    const state = parseGateState(gateRes.data);
    if (state?.status === "age_blocked") {
      await supabase.auth.signOut();
      await invalidateGateCache();
      return fail("AGE_BLOCKED", undefined, { redirectTo: ROUTES.blockedAge });
    }
    if (state?.status === "banned") {
      await invalidateGateCache();
      return ok({ redirectTo: ROUTES.suspended, isNew: false });
    }

    if (!state || !state.hasBirthDate) {
      if (!birthDate || !consents) {
        // 재방문인데 프로필 생년월일이 없음(드래프트 없음) → 연령 화면으로 (C3 §0-5)
        await invalidateGateCache();
        return ok({ redirectTo: ROUTES.age, isNew: true });
      }
      const created = await supabase.rpc("create_profile", { p_birth_date: birthDate, p_phone_hash: await phoneHash(e164) });
      if (created.error) throw created.error;
      const result = created.data as { age_blocked?: boolean; onboarding_step?: string } | null;
      if (result?.age_blocked) {
        await supabase.auth.signOut();
        await invalidateGateCache();
        return fail("AGE_BLOCKED", undefined, { redirectTo: ROUTES.blockedAge });
      }
      await recordOnboardingConsents(supabase, user.id, consents, ctx);
      await invalidateGateCache();
      return ok({ redirectTo: "/onboarding/basic", isNew: true });
    }

    // 기존 회원: 휴면이면 재로그인으로 즉시 해제 (C3 §6.4)
    let effective = state;
    if (state.status === "paused") {
      const r = await supabase.rpc("resume_account");
      if (!r.error) effective = { ...state, status: "active" };
    }
    await invalidateGateCache();
    return ok({ redirectTo: homeFor(effective), isNew: false });
  } catch (e) {
    return toActionFailure(e);
  }
}

/** 로그인 상태 + 생년월일 미확정 사용자(드래프트 없이 OTP 한 재방문자)의 연령 확인 */
export async function submitBirthDate(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = submitBirthDateSchema.extend({ consents: verifyOtpSchema.shape.consents }).safeParse(input);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      return fail("INVALID_INPUT", message, { field });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("NOT_AUTHENTICATED", undefined, { redirectTo: ROUTES.login });

    const state = parseGateState((await supabase.rpc("get_gate_state")).data);
    if (state?.hasBirthDate) {
      await invalidateGateCache();
      return ok({ redirectTo: homeFor(state) });
    }
    // 동의 이력이 전혀 없으면 동의 입력 필수
    const { count } = await supabase.from("consents").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("agreed", true);
    const hasConsents = (count ?? 0) > 0;
    const consents = parsed.data.consents;
    if (!hasConsents && (!consents || !consents.terms || !consents.privacy || !consents.youthPolicy || !consents.evidenceSnapshot)) {
      return fail("INVALID_INPUT", "필수 약관에 동의해 주세요", { field: "consents" });
    }

    const e164 = user.phone ? normalizeKrPhone(user.phone) : null;
    const created = await supabase.rpc("create_profile", {
      p_birth_date: parsed.data.birthDate,
      p_phone_hash: e164 ? await phoneHash(e164) : null,
    });
    if (created.error) throw created.error;
    const result = created.data as { age_blocked?: boolean } | null;
    if (result?.age_blocked) {
      await supabase.auth.signOut();
      await invalidateGateCache();
      return fail("AGE_BLOCKED", undefined, { redirectTo: ROUTES.blockedAge });
    }
    if (!hasConsents && consents) await recordOnboardingConsents(supabase, user.id, consents, await requestContext());
    await invalidateGateCache();
    return ok({ redirectTo: "/onboarding/basic" });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function signOut(): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await invalidateGateCache();
    return ok({ redirectTo: "/" });
  } catch (e) {
    return toActionFailure(e);
  }
}
