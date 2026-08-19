// =============================================================================
// E1 · ActionResult code → 한국어 UI 메시지 매핑 (D2 규약 §2 — throw 대신 code 분기)
//
// - 서버 액션은 절대 throw 하지 않는다. { ok:false, code, message } 를 받아
//   여기서 화면 문구로 바꾼다. DB 원문 메시지는 사용자에게 노출하지 않는다.
// - 카피 톤: 해요체 · 죄책감/재촉 금지 (10_brand D-6).
// - 타입만 import 하므로 클라이언트 번들에 서버 코드가 섞이지 않는다.
// =============================================================================

import type { ActionErrorCode } from "@/lib/auth/schemas";
import type { OnboardingStep } from "@duckmate/db";

export const ACTION_ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  INVALID_INPUT: "입력값을 다시 확인해 주세요.",
  UNDERAGE: "만 19세 이상부터 이용할 수 있어요.",
  AUTH_REQUIRED: "로그인이 필요해요. 다시 로그인해 주세요.",
  AUTH_FAILED: "이메일 또는 비밀번호가 올바르지 않아요.",
  EMAIL_TAKEN: "이미 가입된 이메일이에요. 로그인해 주세요.",
  PROFILE_NOT_FOUND: "프로필을 찾을 수 없어요. 다시 로그인해 주세요.",
  STEP_ORDER: "이전 단계를 먼저 마쳐야 해요. 해당 단계로 이동할게요.",
  CONTACT_INFO_BLOCKED: "연락처·링크·SNS 계정은 카드에 적을 수 없어요.",
  VERIFY_LEVEL_REQUIRED: "본인인증을 마치면 열려요.",
  PHONE_BLOCKED: "이용이 제한된 번호예요. 고객센터로 문의해 주세요.",
  CI_BLOCKED: "이용이 제한된 계정이에요. 고객센터로 문의해 주세요.",
  CI_ALREADY_REGISTERED: "이미 본인인증된 계정이 있어요. 기존 계정으로 로그인해 주세요.",
  VERIFIER_NOT_CONFIGURED: "본인인증 연동 준비 중이에요. 잠시 후 다시 시도해 주세요.",
  VERIFY_FAILED: "인증에 실패했어요. 다시 시도해 주세요.",
  DB_ERROR: "저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
};

/** code 우선 매핑. INVALID_INPUT 만 서버(zod)의 한국어 사유를 그대로 보여준다. */
export function messageForActionError(code: ActionErrorCode, serverMessage?: string): string {
  if (code === "INVALID_INPUT" && serverMessage) return serverMessage;
  return ACTION_ERROR_MESSAGES[code] ?? "잠시 후 다시 시도해 주세요.";
}

const STEP_VALUES: readonly OnboardingStep[] = [
  "age",
  "phone",
  "hobbies",
  "quiz",
  "duckcard",
  "photo",
  "mode",
  "done",
];

/** STEP_ORDER 메시지의 "(현재: hobbies)" 에서 저장된 스텝을 뽑아낸다 */
export function stepFromStepOrderMessage(message: string): OnboardingStep | null {
  const m = /현재:\s*([a-z]+)/.exec(message);
  const found = m?.[1];
  return STEP_VALUES.find((s) => s === found) ?? null;
}

/**
 * code 에 대응하는 강제 이동 경로 (없으면 null — 화면이 인라인 에러만 노출).
 * 리다이렉트는 액션이 아니라 화면 몫이라는 D2 규약을 여기서 한 곳으로 모은다.
 */
export function redirectForActionError(code: ActionErrorCode, message: string): string | null {
  if (code === "AUTH_REQUIRED" || code === "PROFILE_NOT_FOUND") return "/login";
  if (code === "STEP_ORDER") {
    const step = stepFromStepOrderMessage(message);
    if (step === "done") return "/home";
    return step ? `/onboarding/${step}` : null;
  }
  return null;
}
