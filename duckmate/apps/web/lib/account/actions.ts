"use server";

/**
 * 계정 상태 서버 액션 (E5 설정 화면이 호출) — 모드 전환 검증(D2 소관) · 탈퇴/휴면.
 *
 *   setMode({ mode, seekingGender?, previewViewed })  dating 은 L3 + seeking_gender + 미리보기 필수 → NOT_ENTITLED
 *   requestDelete({immediate?}) → status=deleting(7일 유예) 또는 즉시 삭제 + 로그아웃, redirectTo "/"
 *   cancelDelete()    → 유예 중 복구, redirectTo "/home"
 *   pauseAccount()    → status=paused + 로그아웃 (재로그인 시 verifyOtp 가 resume_account)
 *   resumeAccount()   → paused → active
 */
import { headers } from "next/headers";
import type { Enums } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { getSession, invalidateGateCache, requireProfileForAction } from "@/lib/auth/session";
import { recordConsent } from "@/lib/auth/consents";
import { clientIp } from "@/lib/auth/otp";
import { ROUTES } from "@/lib/auth/routes";
import { firstIssue, setModeSchema } from "@/lib/onboarding/schemas";

export async function setMode(input: unknown): Promise<ActionResult<{ mode: Enums["profile_mode"]; seekingGender: Enums["seeking_gender"] | null }>> {
  try {
    const parsed = setModeSchema.safeParse(input);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      return fail("INVALID_INPUT", message, { field });
    }
    const { mode, seekingGender, previewViewed } = parsed.data;
    if (!previewViewed) return fail("INVALID_INPUT", "공개 범위 미리보기를 끝까지 확인해 주세요", { field: "previewViewed" });
    if (mode === "dating" && !seekingGender) return fail("INVALID_INPUT", "찾고 싶은 성별을 골라 주세요", { field: "seekingGender" });

    const ctx = await requireProfileForAction(1);
    if (mode === "dating" && ctx.state.verifyLevel < 3) {
      return fail("NOT_ENTITLED", "본인인증 + 승인된 대표 사진 1장이 필요해요", { redirectTo: "/settings/verify" });
    }
    const { data, error } = await ctx.supabase.rpc("set_mode", { p_mode: mode, p_seeking_gender: mode === "dating" ? seekingGender : null });
    if (error) throw error;
    const result = (data ?? {}) as { mode?: Enums["profile_mode"]; seeking_gender?: Enums["seeking_gender"] | null };

    if (mode === "dating" && ctx.state.mode !== "dating") {
      const h = await headers();
      await recordConsent(ctx.supabase, ctx.user.id, "dating_mode_public", true, "settings", { ip: clientIp(h), userAgent: h.get("user-agent") });
    }
    await invalidateGateCache();
    return ok({ mode: result.mode ?? mode, seekingGender: result.seeking_gender ?? null });
  } catch (e) {
    return toActionFailure(e);
  }
}

/** RPC 시그니처에 없는 인자로 호출했을 때의 PostgREST/PG 오류 (H1 0071 적용 전) */
function isUnknownRpcSignature(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  return code === "PGRST202" || code === "42883" || /Could not find the function|function .* does not exist|p_immediate/i.test(msg);
}

type LooseRpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> };

type RequestDeleteResult = { redirectTo: string; purgeAfter: string | null; immediate: boolean };

/**
 * 탈퇴 요청. `immediate: true` 는 07_legal 결정 21 의 "지금 바로 삭제"(유예 없이 즉시) — H1 이 0071 에서
 * `request_delete(p_immediate boolean)` 를 추가한다. **인자를 모르는 구버전 RPC 에서도 동작해야 하므로**
 * 인자 호출이 시그니처 오류로 실패하면 무인자 호출로 폴백하고(=7일 유예), 응답의 `immediate` 로 실제 적용 여부를 돌려준다.
 * 화면(`DeleteAccountScreen`)은 이 값으로 완료 문구를 고른다.
 */
export async function requestDelete(input?: { immediate?: boolean }): Promise<ActionResult<RequestDeleteResult>> {
  try {
    const wantImmediate = input?.immediate === true;
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });

    let payload: { purge_after?: string; immediate?: boolean } | null = null;
    let applied = false;

    if (wantImmediate) {
      const loose = ctx.supabase as unknown as LooseRpc;
      const { data, error } = await loose.rpc("request_delete", { p_immediate: true });
      if (error) {
        if (!isUnknownRpcSignature(error)) throw error;
      } else {
        payload = (data ?? {}) as { purge_after?: string; immediate?: boolean };
        applied = payload.immediate !== false;
      }
    }

    if (payload === null) {
      const { data, error } = await ctx.supabase.rpc("request_delete");
      if (error) throw error;
      payload = (data ?? {}) as { purge_after?: string; immediate?: boolean };
      applied = payload.immediate === true;
    }

    await ctx.supabase.auth.signOut();
    await invalidateGateCache();
    return ok({ redirectTo: "/", purgeAfter: payload.purge_after ?? null, immediate: applied });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function cancelDelete(): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const { supabase, user } = await getSession();
    if (!user) return fail("NOT_AUTHENTICATED", undefined, { redirectTo: ROUTES.login });
    const { error } = await supabase.rpc("cancel_delete");
    if (error) throw error;
    await invalidateGateCache();
    return ok({ redirectTo: ROUTES.home });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function pauseAccount(): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const ctx = await requireProfileForAction(1);
    const { error } = await ctx.supabase.rpc("pause_account");
    if (error) throw error;
    await ctx.supabase.auth.signOut();
    await invalidateGateCache();
    return ok({ redirectTo: "/" });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function resumeAccount(): Promise<ActionResult<{ status: Enums["profile_status"] }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("NOT_AUTHENTICATED", undefined, { redirectTo: ROUTES.login });
    const { data, error } = await supabase.rpc("resume_account");
    if (error) throw error;
    await invalidateGateCache();
    const result = (data ?? {}) as { status?: Enums["profile_status"] };
    return ok({ status: result.status ?? "active" });
  } catch (e) {
    return toActionFailure(e);
  }
}
