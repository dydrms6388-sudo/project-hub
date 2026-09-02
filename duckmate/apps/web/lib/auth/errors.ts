/**
 * 서버 4xx 에러 코드 (C3 §0-21 매핑 고정) + 서버 액션 결과 타입.
 * - RPC 가 `raise exception 'NOT_VERIFIED: …'` 형태로 던지면 message 의 첫 토큰으로 매핑한다(D1 §0-40).
 * - 서버 액션은 throw 하지 않고 항상 `ActionResult` 를 반환한다(클라이언트가 code 로 분기).
 */
import { ERROR_CODES, type ErrorCode } from "@duckmate/db";

export type AuthErrorCode =
  | ErrorCode
  // 본인인증 결과 코드(apply_identity_verification)
  | "BLOCKED_CI"
  | "DUPLICATE_CI"
  | "MINOR"
  | "IDENTITY_FAILED"
  | "NOT_ALLOWLISTED"
  | "CONFLICT"
  | "INTERNAL";

export const AUTH_ERROR_CODES: ReadonlyArray<AuthErrorCode> = [
  ...ERROR_CODES,
  "BLOCKED_CI",
  "DUPLICATE_CI",
  "MINOR",
  "IDENTITY_FAILED",
  "NOT_ALLOWLISTED",
  "CONFLICT",
  "INTERNAL",
];

/** HTTP 상태 매핑 (라우트 핸들러용). 서버 액션은 status 대신 code 를 반환 */
export const HTTP_STATUS: Readonly<Record<AuthErrorCode, number>> = {
  NOT_AUTHENTICATED: 401,
  NOT_VERIFIED: 403,
  NOT_ENTITLED: 403,
  SANCTIONED: 403,
  AGE_BLOCKED: 403,
  ONBOARDING_INCOMPLETE: 403,
  DELETING: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_ACTED: 409,
  CONFLICT: 409,
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  BLOCKED_CI: 403,
  DUPLICATE_CI: 409,
  MINOR: 403,
  IDENTITY_FAILED: 422,
  NOT_ALLOWLISTED: 403,
  INTERNAL: 500,
};

/** 사용자에게 보여줄 기본 문구 (E 가 덮어써도 됨). 신고자·내부 정보 미포함 */
export const DEFAULT_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  NOT_AUTHENTICATED: "로그인이 필요해요",
  NOT_VERIFIED: "본인인증 후 이용할 수 있어요",
  NOT_ENTITLED: "지금은 이용할 수 없어요",
  SANCTIONED: "계정 이용이 제한됐어요",
  AGE_BLOCKED: "만 19세 이상만 이용할 수 있어요",
  ONBOARDING_INCOMPLETE: "프로필 작성을 먼저 마쳐 주세요",
  DELETING: "탈퇴 처리 중인 계정이에요",
  FORBIDDEN: "권한이 없어요",
  NOT_FOUND: "찾을 수 없어요",
  ALREADY_ACTED: "이미 처리됐어요",
  CONFLICT: "이미 사용 중이에요",
  INVALID_INPUT: "입력값을 다시 확인해 주세요",
  RATE_LIMITED: "요청이 많아요. 잠시 후 다시 시도해 주세요",
  BLOCKED_CI: "이 정보로는 가입할 수 없어요",
  DUPLICATE_CI: "이미 가입된 정보예요. 기존 계정으로 로그인해 주세요",
  MINOR: "덕메이트는 만 19세 이상만 이용할 수 있어요",
  IDENTITY_FAILED: "인증에 실패했어요. 다시 시도해 주세요",
  NOT_ALLOWLISTED: "지금은 초대된 번호만 인증할 수 있어요",
  INTERNAL: "잠시 문제가 생겼어요. 다시 시도해 주세요",
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly field: string | undefined;
  readonly retryAfterSec: number | undefined;
  readonly redirectTo: string | undefined;

  constructor(
    code: AuthErrorCode,
    message?: string,
    opts: { field?: string; retryAfterSec?: number; redirectTo?: string; cause?: unknown } = {},
  ) {
    super(message ?? DEFAULT_MESSAGES[code], opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "AuthError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.field = opts.field;
    this.retryAfterSec = opts.retryAfterSec;
    this.redirectTo = opts.redirectTo;
  }
}

export type ActionFailure = {
  ok: false;
  code: AuthErrorCode;
  message: string;
  field?: string;
  retryAfterSec?: number;
  /** 서버가 정한 이동 경로(예: NOT_VERIFIED → /verify, AGE_BLOCKED → /blocked/age). 클라이언트는 그대로 따른다 */
  redirectTo?: string;
};
export type ActionSuccess<T> = { ok: true; data: T };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(
  code: AuthErrorCode,
  message?: string,
  extra: { field?: string; retryAfterSec?: number; redirectTo?: string } = {},
): ActionFailure {
  const out: ActionFailure = { ok: false, code, message: message ?? DEFAULT_MESSAGES[code] };
  if (extra.field !== undefined) out.field = extra.field;
  if (extra.retryAfterSec !== undefined) out.retryAfterSec = extra.retryAfterSec;
  if (extra.redirectTo !== undefined) out.redirectTo = extra.redirectTo;
  return out;
}

const KNOWN = new Set<string>(AUTH_ERROR_CODES);

type PgLikeError = { code?: string; message?: string; details?: string; hint?: string };

function isPgLike(e: unknown): e is PgLikeError {
  return typeof e === "object" && e !== null && ("message" in e || "code" in e);
}

/**
 * PostgREST/Postgres 에러 → AuthError.
 *  - message 첫 토큰(`NOT_VERIFIED: …` / `SANCTIONED`) 이 알려진 코드면 그대로
 *  - SQLSTATE 28000 → NOT_AUTHENTICATED, 42501 → FORBIDDEN, 23505 → CONFLICT, 23514(check) → INVALID_INPUT, P0002 → NOT_FOUND
 */
export function fromDbError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  if (!isPgLike(e)) return new AuthError("INTERNAL", undefined, { cause: e });
  const msg = e.message ?? "";
  const token = msg.split(/[:\s]/, 1)[0] ?? "";
  if (KNOWN.has(token)) {
    const rest = msg.slice(token.length).replace(/^:\s*/, "").trim();
    return new AuthError(token as AuthErrorCode, rest.length > 0 ? rest : undefined, { cause: e });
  }
  switch (e.code) {
    case "28000":
      return new AuthError("NOT_AUTHENTICATED", undefined, { cause: e });
    case "42501":
      return new AuthError("FORBIDDEN", undefined, { cause: e });
    case "23505":
      return new AuthError("CONFLICT", undefined, { cause: e });
    case "23514":
    case "22P02":
    case "23502":
      return new AuthError("INVALID_INPUT", undefined, { cause: e });
    case "P0002":
    case "PGRST116":
      return new AuthError("NOT_FOUND", undefined, { cause: e });
    default:
      return new AuthError("INTERNAL", undefined, { cause: e });
  }
}

/** 서버 액션 catch 블록 공용: 어떤 예외든 ActionFailure 로 (내부 메시지 노출 금지) */
export function toActionFailure(e: unknown): ActionFailure {
  const err = e instanceof AuthError ? e : fromDbError(e);
  if (err.code === "INTERNAL") console.error("[action] internal error", e);
  return fail(err.code, err.code === "INTERNAL" ? undefined : err.message, {
    ...(err.field !== undefined ? { field: err.field } : {}),
    ...(err.retryAfterSec !== undefined ? { retryAfterSec: err.retryAfterSec } : {}),
    ...(err.redirectTo !== undefined ? { redirectTo: err.redirectTo } : {}),
  });
}
