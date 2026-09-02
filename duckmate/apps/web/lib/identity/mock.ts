import "server-only";

/**
 * MockVerifier — Phase 1 본인인증 대체 (PRD §0-3 / A5 §1).
 *
 *  - 프로덕션(NODE_ENV=production): `IDENTITY_MOCK_ALLOWLIST`(sha256(E.164 digits) 목록)에 있는 번호만 성공, 그 외 **항상 실패**.
 *    allowlist 가 비어 있으면 전원 실패(공개 런칭은 Phase 4 실인증 이후).
 *  - 개발/테스트: 항상 성공. payload.simulate = "fail" | "minor" | "duplicate" 로 실패 경로 재현.
 *  - "인증 결과" 생년월일 = 자기신고 birth_date (mock 은 알 수 없으므로). 따라서 프로덕션 mock 은 미성년 경로를 만들지 않는다.
 *  - ciHash 는 번호 기준 결정적(sha256("mock-ci:" + digits + salt)) → 같은 번호 재가입 시 중복/블록 판정이 동작한다.
 */
import { isProduction } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { base64UrlDecode, base64UrlEncode, hmacSha256Hex, sha256Hex, timingSafeEqualHex } from "@/lib/auth/hash";
import { allowlistHash, e164Digits } from "@/lib/auth/otp";
import type { IdentityStart, IdentityStartContext, IdentityVerifier, IdentityVerifyInput, IdentityVerifyResult } from "@/lib/identity/types";

const TOKEN_TTL_SEC = 15 * 60;
const MINOR_BIRTH_DATE = "2012-01-01";

function tokenSecret(): string {
  return serverEnv().IDENTITY_CI_SALT ?? "duckmate-dev-mock-secret";
}

export function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[0-9a-f]{64}$/.test(s)),
  );
}

export class MockVerifier implements IdentityVerifier {
  readonly provider = "mock" as const;

  async start(ctx: IdentityStartContext): Promise<IdentityStart> {
    const body = base64UrlEncode(JSON.stringify({ p: ctx.profileId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
    const sig = await hmacSha256Hex(tokenSecret(), body);
    return { kind: "token", provider: "mock", token: `${body}.${sig}`, expiresInSec: TOKEN_TTL_SEC };
  }

  async verify(input: IdentityVerifyInput): Promise<IdentityVerifyResult> {
    const token = typeof input.payload["token"] === "string" ? (input.payload["token"] as string) : "";
    if (!(await this.validToken(token, input.profileId))) {
      return { ok: false, provider: "mock", code: "INVALID_TOKEN" };
    }

    const env = serverEnv();
    const prod = isProduction();
    if (prod) {
      if (!input.phoneE164) return { ok: false, provider: "mock", code: "NOT_ALLOWLISTED" };
      const allow = parseAllowlist(env.IDENTITY_MOCK_ALLOWLIST);
      if (!allow.has(await allowlistHash(input.phoneE164))) {
        return { ok: false, provider: "mock", code: "NOT_ALLOWLISTED" };
      }
    }

    const simulate = !prod && typeof input.payload["simulate"] === "string" ? (input.payload["simulate"] as string) : null;
    if (simulate === "fail") return { ok: false, provider: "mock", code: "FAILED", message: "simulated" };

    const digits = input.phoneE164 ? e164Digits(input.phoneE164) : `user:${input.userId}`;
    const salt = env.IDENTITY_CI_SALT ?? "";
    const ciHash = simulate === "duplicate" ? await sha256Hex(`mock-ci:duplicate:${salt}`) : await sha256Hex(`mock-ci:${digits}:${salt}`);
    const diHash = await sha256Hex(`mock-di:${digits}:${salt}`);
    const birthDate = simulate === "minor" ? MINOR_BIRTH_DATE : (input.profile.birthDate ?? "1990-01-01");

    return {
      ok: true,
      provider: "mock",
      ciHash,
      diHash,
      birthDate,
      gender: input.profile.gender ?? "unspecified",
      providerTxId: `mock-${Date.now().toString(36)}`,
    };
  }

  private async validToken(token: string, profileId: string): Promise<boolean> {
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return false;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = await hmacSha256Hex(tokenSecret(), body);
    if (!timingSafeEqualHex(sig, expected)) return false;
    const raw = base64UrlDecode(body);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as { p?: string; exp?: number };
      return parsed.p === profileId && typeof parsed.exp === "number" && parsed.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
