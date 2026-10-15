import "server-only";

/**
 * 본인인증 처리 코어 (서버 액션과 /api/identity/callback 이 공유).
 *
 *   startVerification()            → IdentityStart (mock: token / portone: redirect)
 *   completeVerification(payload)  → verifier.verify → apply_identity_verification(service role) → 게이트 캐시 무효화
 *
 * 결과 code 매핑 (ActionFailure.code):
 *   OK → ok{redirectTo:"/home", verifyLevel}
 *   MINOR → banned(트리거) + 사진 파일 삭제, redirectTo "/suspended" (세션 유지: 정지 화면이 렌더돼야 함)
 *   BLOCKED_CI / DUPLICATE_CI / IDENTITY_FAILED / NOT_ALLOWLISTED → 인라인 사유 (C3 S7 실패 문구)
 */
import { isProduction, publicEnv } from "@/lib/env/public";
import type { IdentityApplyResult } from "@duckmate/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/auth/errors";
import { getProfile, invalidateGateCache, requireProfileForAction } from "@/lib/auth/session";
import { normalizeKrPhone } from "@/lib/auth/otp";
import { ROUTES } from "@/lib/auth/routes";
import { getIdentityVerifier } from "@/lib/identity";
import type { IdentityStart } from "@/lib/identity/types";
import { removeProfilePhotoObjects } from "@/lib/photos/upload";

export type CompleteResult = { code: "OK"; verifyLevel: number; redirectTo: string; alreadyVerified?: boolean };

function callbackUrl(): string {
  return `${publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/identity/callback`;
}

export async function startVerification(): Promise<ActionResult<IdentityStart | { kind: "already"; redirectTo: string }>> {
  const ctx = await requireProfileForAction(1);
  if (ctx.state.verifyLevel >= 2) return ok({ kind: "already", redirectTo: ROUTES.home });
  const verifier = getIdentityVerifier();
  return ok(await verifier.start({ profileId: ctx.profileId, userId: ctx.user.id, returnUrl: callbackUrl() }));
}

export async function completeVerification(payload: Record<string, unknown>): Promise<ActionResult<CompleteResult>> {
  const ctx = await requireProfileForAction(1);
  if (ctx.state.verifyLevel >= 2) return ok({ code: "OK", verifyLevel: ctx.state.verifyLevel, redirectTo: ROUTES.home, alreadyVerified: true });

  const profile = await getProfile();
  const verifier = getIdentityVerifier();
  const phoneE164 = ctx.user.phone ? normalizeKrPhone(ctx.user.phone) : null;

  // 프로덕션에서는 simulate 류 개발용 페이로드를 제거
  const safePayload: Record<string, unknown> = { ...payload };
  if (isProduction()) delete safePayload["simulate"];

  const result = await verifier.verify({
    profileId: ctx.profileId,
    userId: ctx.user.id,
    phoneE164,
    profile: { birthDate: profile?.birth_date ?? null, gender: profile?.gender ?? null },
    payload: safePayload,
  });

  const admin = createAdminClient();

  if (!result.ok) {
    // 실패 이력(해시 없음)만 남긴다 — NOT_ALLOWLISTED/FAILED. 토큰 오류·미설정은 기록하지 않음
    if (result.code === "FAILED" || result.code === "NOT_ALLOWLISTED") {
      await admin.rpc("apply_identity_verification", {
        p_user_id: ctx.user.id,
        p_provider: result.provider,
        p_result: "failed",
        p_meta: { reason: result.code },
      });
    }
    switch (result.code) {
      case "NOT_ALLOWLISTED":
        return fail("NOT_ALLOWLISTED");
      case "INVALID_TOKEN":
        return fail("INVALID_INPUT", "인증 세션이 만료됐어요. 다시 시도해 주세요");
      case "NOT_CONFIGURED":
        return fail("NOT_ENTITLED", "지금은 인증할 수 없어요. 잠시 후 다시 시도해 주세요");
      default:
        return fail("IDENTITY_FAILED");
    }
  }

  // 이름·raw 는 여기서 버린다(저장·로깅 금지)
  const { data, error } = await admin.rpc("apply_identity_verification", {
    p_user_id: ctx.user.id,
    p_provider: result.provider,
    p_result: "success",
    p_ci_hash: result.ciHash,
    p_di_hash: result.diHash,
    p_birth_date: result.birthDate,
    p_gender: result.gender,
    p_provider_tx_id: result.providerTxId,
    p_meta: {},
  });
  if (error) throw error;
  const applied = data as unknown as IdentityApplyResult;
  await invalidateGateCache();

  switch (applied.code) {
    case "OK":
      return ok({ code: "OK", verifyLevel: applied.verify_level ?? 2, redirectTo: ROUTES.home });
    case "MINOR": {
      // 사진 파일 삭제(행은 SQL 이 삭제). 실패해도 계정은 이미 banned — D7 purge 가 재시도
      try {
        await removeProfilePhotoObjects(admin, ctx.profileId);
      } catch (e) {
        console.error("[identity] photo purge after MINOR failed", e);
      }
      return fail("MINOR", undefined, { redirectTo: ROUTES.suspended });
    }
    case "BLOCKED_CI":
      return fail("BLOCKED_CI");
    case "DUPLICATE_CI":
      return fail("DUPLICATE_CI");
    default:
      return fail("IDENTITY_FAILED");
  }
}
