/**
 * 휴대폰 OTP 헬퍼 — 번호 정규화(E.164) · 해시 · 레이트리밋 키/한도 (Supabase Auth phone).
 * 원문 전화번호는 auth.users.phone 에만 존재. 앱 테이블에는 해시만 (profiles.phone_hash).
 */
import { serverEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/auth/hash";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { AuthError } from "@/lib/auth/errors";
import type { RateLimitResult } from "@duckmate/db";

/** 국내 휴대폰: 01[016789] + 7~8자리 (C3 S2) */
export const KR_MOBILE_RE = /^01[016789]\d{7,8}$/;
export const OTP_CODE_RE = /^\d{6}$/;

/** PRD §5.3: OTP 번호당 시간당 5회. IP 는 공유망(학교·회사) 감안 20회. 검증 시도는 번호당 10회/시간 */
export const OTP_LIMITS = {
  sendPerPhonePerHour: 5,
  sendPerIpPerHour: 20,
  verifyPerPhonePerHour: 10,
  windowSec: 3600,
} as const;

/**
 * 입력(010-1234-5678 / +82 10 1234 5678 / 821012345678) → E.164 '+821012345678'. 실패 시 null.
 */
export function normalizeKrPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = "0" + digits.slice(2);
  if (!KR_MOBILE_RE.test(digits)) return null;
  return "+82" + digits.slice(1);
}

/** '+821012345678' → '821012345678' (test_otp 키·allowlist 해시 입력 형식) */
export function e164Digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** profiles.phone_hash = sha256(digits + PHONE_HASH_SALT). 솔트 없으면(개발) 솔트 없이 */
export async function phoneHash(e164: string): Promise<string> {
  const salt = serverEnv().PHONE_HASH_SALT ?? "";
  return sha256Hex(e164Digits(e164) + salt);
}

/** IDENTITY_MOCK_ALLOWLIST 항목 = sha256(digits) (솔트 없음: 소유자가 `printf 821012345678 | sha256sum` 으로 계산) */
export async function allowlistHash(e164: string): Promise<string> {
  return sha256Hex(e164Digits(e164));
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : (headers.get("x-real-ip") ?? "0.0.0.0");
}

export async function rateLimitKey(scope: string, raw: string): Promise<string> {
  return `${scope}:${await sha256Hex(raw)}`;
}

/**
 * DB 고정 윈도우 레이트리밋(check_rate_limit, service role). 초과 시 AuthError(RATE_LIMITED, retryAfterSec).
 * 호출 자체가 1회 소비이므로 "검사 후 실행" 순서로 한 번만 부른다.
 */
export async function enforceRateLimit(admin: AdminSupabase, key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window: `${windowSec} seconds` });
  if (error) {
    // 레이트리밋 저장소 장애 시 fail-closed (OTP 남용 방지가 우선)
    console.error("[otp] check_rate_limit failed", error.message);
    throw new AuthError("RATE_LIMITED", undefined, { retryAfterSec: 60 });
  }
  const r = data as unknown as RateLimitResult;
  if (!r.allowed) throw new AuthError("RATE_LIMITED", undefined, { retryAfterSec: r.retry_after_sec });
  return r;
}
