/**
 * IdentityVerifier 어댑터 인터페이스 (PRD §0-39 · F-010/F-082).
 *
 *  - start(): 인증 시작. mock 은 서명 토큰, portone 은 리다이렉트/SDK 파라미터.
 *  - verify(): 프로바이더 결과 → 해시·생년월일·성별. **이름·원문 CI/DI·raw 는 DB 에 저장하지 않는다**
 *    (apply 단계에서 버림). ciHash = sha256(CI + IDENTITY_CI_SALT).
 */
import type { Enums } from "@duckmate/db";

export type IdentityProvider = Enums["identity_provider"];

export type IdentityStart =
  | { kind: "token"; provider: IdentityProvider; token: string; expiresInSec: number }
  | { kind: "redirect"; provider: IdentityProvider; redirectUrl: string };

export type IdentityStartContext = {
  profileId: string;
  userId: string;
  /** 인증 완료 후 돌아올 URL (portone). 예: https://app/api/identity/callback */
  returnUrl: string;
};

export type IdentityVerifyInput = {
  profileId: string;
  userId: string;
  /** auth.users.phone → E.164 (+82…). mock allowlist 판정용 */
  phoneE164: string | null;
  /** 자기신고 값(mock 이 "인증 결과"로 되돌려줄 때 참고). portone 은 무시 */
  profile: { birthDate: string | null; gender: Enums["gender"] | null };
  /** 클라이언트/콜백이 전달한 페이로드 (token, identityVerificationId, simulate …) */
  payload: Record<string, unknown>;
};

export type IdentityFailureCode = "FAILED" | "NOT_ALLOWLISTED" | "INVALID_TOKEN" | "PROVIDER_ERROR" | "NOT_CONFIGURED";

export type IdentityVerifyResult =
  | {
      ok: true;
      provider: IdentityProvider;
      ciHash: string;
      diHash: string | null;
      /** YYYY-MM-DD */
      birthDate: string;
      gender: Enums["gender"] | null;
      providerTxId: string | null;
      /** 저장 금지 — 로깅도 금지. 인터페이스 호환용으로만 존재 */
      name?: string;
      /** 저장 금지 */
      raw?: unknown;
    }
  | { ok: false; provider: IdentityProvider; code: IdentityFailureCode; message?: string };

export interface IdentityVerifier {
  readonly provider: IdentityProvider;
  start(ctx: IdentityStartContext): Promise<IdentityStart>;
  verify(input: IdentityVerifyInput): Promise<IdentityVerifyResult>;
}
