"use server";

// =============================================================================
// E1 · 휴대폰 인증 확정 Server Action (온보딩 2/7)
//
// D2 미결사항 2: SMS OTP 발송/검증 자체는 아직 구현되지 않았다(어댑터 미선택).
// 그래서 현 단계는 **IdentityVerifier 스텁 어댑터**를 그대로 태운다:
//   1) 클라이언트가 POST /api/auth/verify-identity {action:"request"} 로 세션 토큰 확보
//      (D2 §4 "E1 이 호출할 API" 목록의 그 경로)
//   2) 사용자가 인증번호 입력 → 이 액션이 같은 verifier 로 confirm 검증
//   3) 성공 시 promotePhoneVerified() 로 Lv0→Lv1 승급 + onboarding_step→hobbies
//
// 스텁이 아닌 실 verifier(PortOne)면 통과시키지 않고 VERIFIER_NOT_CONFIGURED 를
// 돌려준다 — 프로덕션에서 아무 코드나 통과하는 사고를 막는 서버측 잠금이다.
// (번호당 1계정·재전송 쿨다운·잠금의 서버 강제는 SMS 어댑터 도입 시 함께 구현)
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import { getIdentityVerifier } from "@/lib/auth/identity-verifier";
import { promotePhoneVerified } from "@/lib/auth/verify";
import { fail, type ActionResult } from "@/lib/auth/schemas";

const PHONE_RE = /^01[016789]\d{7,8}$/;
const CODE_RE = /^\d{6}$/;

export interface ConfirmPhoneInput {
  phone: string;
  code: string;
  /** /api/auth/verify-identity {action:"request"} 가 돌려준 세션 토큰 */
  token?: string;
}

export async function confirmPhoneVerification(
  input: ConfirmPhoneInput
): Promise<ActionResult<{ verifyLevel: number }>> {
  const phone = (input.phone ?? "").replace(/\D/g, "");
  const code = (input.code ?? "").trim();

  if (!PHONE_RE.test(phone)) {
    return fail("INVALID_INPUT", "휴대폰 번호를 다시 확인해 주세요. (예: 010-1234-5678)");
  }
  if (!CODE_RE.test(code)) {
    return fail("INVALID_INPUT", "인증번호 6자리를 입력해 주세요.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const verifier = getIdentityVerifier(user.email);
  if (verifier.name !== "stub") {
    return fail(
      "VERIFIER_NOT_CONFIGURED",
      "문자 인증 연동을 준비하고 있어요. 잠시 뒤에 다시 시도해 주세요."
    );
  }

  const result = await verifier.confirmVerification(user.id, { token: input.token ?? "" });
  if (!result.ok) {
    return fail("VERIFY_FAILED", "인증에 실패했어요. 인증번호를 다시 받아 주세요.");
  }

  const promotion = await promotePhoneVerified(user.id, phone);
  if (!promotion.ok) {
    return fail(promotion.code, promotion.message);
  }
  return { ok: true, data: { verifyLevel: promotion.verifyLevel } };
}
