import "server-only";

/**
 * PortOneVerifier — Phase 4 실연동 전 stub (F-082). 인터페이스만 충족, 시크릿 env 는 읽기만 한다.
 *
 * TODO(Phase 4, D2):
 *  1. start(): 클라이언트 SDK `PortOne.requestIdentityVerification({ storeId, identityVerificationId, channelKey, redirectUrl })`
 *     에 필요한 값을 돌려준다(kind:"redirect" 또는 SDK 파라미터). identityVerificationId 는 서버가 생성해 profileId 와 묶어 저장(rate_limits 유사 테이블 또는 meta).
 *  2. verify(): `GET https://api.portone.io/identity-verifications/{identityVerificationId}` (Authorization: PortOne {PORTONE_API_SECRET})
 *     → status === "VERIFIED" 인 경우 verifiedCustomer { name, birthDate(YYYY-MM-DD), gender(MALE|FEMALE), ci, di }.
 *     ciHash = sha256(ci + IDENTITY_CI_SALT), diHash = sha256(di + IDENTITY_CI_SALT). name/raw 는 반환하되 저장 금지.
 *  3. 웹훅(supabase/functions/identity-webhook)은 알림용. 최종 판정은 항상 이 verify() 의 서버-서버 조회 결과로만.
 *  4. 실연동 시 IDENTITY_MOCK_ALLOWLIST 폐기(PRD Phase 4→5 체크리스트).
 */
import { serverEnv } from "@/lib/env";
import type { IdentityStart, IdentityStartContext, IdentityVerifier, IdentityVerifyInput, IdentityVerifyResult } from "@/lib/identity/types";

export class PortOneVerifier implements IdentityVerifier {
  readonly provider = "portone" as const;

  private configured(): boolean {
    const env = serverEnv();
    return Boolean(env.PORTONE_API_KEY && env.PORTONE_API_SECRET);
  }

  async start(ctx: IdentityStartContext): Promise<IdentityStart> {
    if (!this.configured()) {
      // 설정 전: 게이트 화면으로 되돌리고 사유를 쿼리로 전달(E1 은 "지금은 인증할 수 없어요" 표시)
      return { kind: "redirect", provider: "portone", redirectUrl: `${ctx.returnUrl}?provider=portone&error=NOT_CONFIGURED` };
    }
    // TODO(Phase 4): identityVerificationId 발급 + SDK 파라미터 반환
    return { kind: "redirect", provider: "portone", redirectUrl: `${ctx.returnUrl}?provider=portone&error=NOT_IMPLEMENTED` };
  }

  async verify(_input: IdentityVerifyInput): Promise<IdentityVerifyResult> {
    if (!this.configured()) return { ok: false, provider: "portone", code: "NOT_CONFIGURED" };
    // TODO(Phase 4): 서버-서버 조회 후 해시 계산
    return { ok: false, provider: "portone", code: "PROVIDER_ERROR", message: "PortOne 연동은 Phase 4" };
  }
}
