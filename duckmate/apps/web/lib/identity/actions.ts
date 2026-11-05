"use server";

/**
 * 본인인증 서버 액션 (E1 /verify 게이트 화면 · E5 /settings/verify 가 호출).
 *
 *   startIdentityVerification()                 → mock: { kind:"token", token } → 곧바로 completeIdentityVerification({ token })
 *                                                 portone: { kind:"redirect", redirectUrl } → window.location 이동
 *   completeIdentityVerification({ token, … })  → { code:"OK", verifyLevel, redirectTo:"/home" } 또는 실패 code
 *
 * 실패 code → 문구(C3 S7): NOT_ALLOWLISTED "지금은 초대된 번호만 인증할 수 있어요" / DUPLICATE_CI / BLOCKED_CI / IDENTITY_FAILED / MINOR(→ /suspended)
 */
import { toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { completeVerification, startVerification, type CompleteResult } from "@/lib/identity/service";
import type { IdentityStart } from "@/lib/identity/types";

export async function startIdentityVerification(): Promise<ActionResult<IdentityStart | { kind: "already"; redirectTo: string }>> {
  try {
    return await startVerification();
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function completeIdentityVerification(payload: unknown): Promise<ActionResult<CompleteResult>> {
  try {
    const body = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
    return await completeVerification(body);
  } catch (e) {
    return toActionFailure(e);
  }
}
