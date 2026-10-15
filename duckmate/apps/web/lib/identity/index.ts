import "server-only";

/**
 * IdentityVerifier 선택 — env IDENTITY_VERIFIER (mock | portone). 기본 mock.
 * 프로덕션 + mock + allowlist 비어 있음 = 전원 인증 실패(의도된 동작, 경고 로그 1회).
 */
import { isProduction } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { MockVerifier, parseAllowlist } from "@/lib/identity/mock";
import { PortOneVerifier } from "@/lib/identity/portone";
import type { IdentityVerifier } from "@/lib/identity/types";

let cached: IdentityVerifier | null = null;
let warned = false;

export function getIdentityVerifier(): IdentityVerifier {
  if (cached) return cached;
  const env = serverEnv();
  if (env.IDENTITY_VERIFIER === "portone") {
    cached = new PortOneVerifier();
  } else {
    if (isProduction() && parseAllowlist(env.IDENTITY_MOCK_ALLOWLIST).size === 0 && !warned) {
      warned = true;
      console.warn("[identity] production + mock verifier with empty IDENTITY_MOCK_ALLOWLIST: every verification will fail (by design)");
    }
    cached = new MockVerifier();
  }
  return cached;
}

export type { IdentityStart, IdentityVerifier, IdentityVerifyInput, IdentityVerifyResult } from "@/lib/identity/types";
