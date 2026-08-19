// =============================================================================
// D5 · 모더레이션(신고/차단/이의제기) zod 스키마 + 결과 타입
//
// - ActionResult 패턴(15_auth D2-1)을 따르되, 에러 코드 집합이 auth 와 다르므로
//   lib/auth/schemas.ts 를 수정하지 않고(파일 소유권) 이 도메인 전용 유니온을 둔다.
//   형태는 동일: { ok:true, data } | { ok:false, code, message } — E3/E4 는 code 로 분기.
// - reason_code 는 @duckmate/db 의 REASON_CODES(A5 §2 택소노미 18종)가 단일 진실.
// =============================================================================

import { z } from "zod";
import { REASON_CODES, type ReasonCode } from "@duckmate/db";

// ---------------------------------------------------------------------------
// 결과 타입 (ActionResult 패턴 — throw 금지, 코드 반환)
// ---------------------------------------------------------------------------
export type ModerationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ModerationErrorCode; message: string };

export type ModerationErrorCode =
  | "INVALID_INPUT" // zod 검증 실패
  | "AUTH_REQUIRED" // 세션 없음
  | "PROFILE_NOT_FOUND" // 내 프로필 없음 (handle_new_user 이전/이상)
  | "TARGET_NOT_FOUND" // 피신고/차단 대상 프로필 없음
  | "SELF_ACTION" // 자기 자신 신고/차단 시도
  | "MATCH_NOT_FOUND" // match_id 가 없거나 내가 참여자가 아님
  | "RATE_LIMITED" // 동일 대상 중복 신고 24h 1회 제한
  | "APPEAL_NOT_ALLOWED" // 내 제재가 아니거나 존재하지 않음
  | "APPEAL_WINDOW_EXPIRED" // 통보 후 30일 초과
  | "APPEAL_DUPLICATE" // 제재 건당 1회 초과
  | "DB_ERROR";

export function modFail(code: ModerationErrorCode, message: string): ModerationResult<never> {
  return { ok: false, code, message };
}

// ---------------------------------------------------------------------------
// 입력 스키마
// ---------------------------------------------------------------------------

/** 신고 접수 — OTHER 는 detail 필수 (A5 §2). match_id 있으면 스냅샷 자동 첨부. */
export const submitReportSchema = z
  .object({
    targetId: z.string().uuid("대상 프로필 id 가 올바르지 않아요."),
    matchId: z.string().uuid().nullable().default(null),
    reasonCode: z.enum(REASON_CODES as readonly [ReasonCode, ...ReasonCode[]], {
      errorMap: () => ({ message: "신고 사유를 선택해 주세요." }),
    }),
    detail: z.string().trim().max(1000, "상세 내용은 1000자까지예요.").nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.reasonCode === "OTHER" && (!v.detail || v.detail.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "기타 사유는 상세 내용을 5자 이상 적어 주세요.",
      });
    }
  });
export type SubmitReportInput = z.input<typeof submitReportSchema>;

export const blockUserSchema = z.object({
  targetId: z.string().uuid("대상 프로필 id 가 올바르지 않아요."),
});
export type BlockUserInput = z.input<typeof blockUserSchema>;

/** 이의제기 — DB submit_appeal() 과 동일 제약(10~2000자) 프리체크 */
export const submitAppealSchema = z.object({
  sanctionId: z.string().uuid("제재 id 가 올바르지 않아요."),
  body: z
    .string()
    .trim()
    .min(10, "이의제기 내용은 10자 이상 적어 주세요.")
    .max(2000, "이의제기 내용은 2000자까지예요."),
});
export type SubmitAppealInput = z.input<typeof submitAppealSchema>;
