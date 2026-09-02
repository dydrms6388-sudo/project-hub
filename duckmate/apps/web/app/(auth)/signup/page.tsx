// =============================================================================
// E1 · /signup — 이메일 가입 + 약관 동의 + 연령 확인 [F-ONB-01, F-ONB-10]
// D2-7: 연령(생년월일)이 가입 폼에 통합돼 있어 signUpWithAge 성공 시 서버가
//       onboarding_step 을 phone 으로 전진시킨다 → 다음 화면은 /onboarding/phone.
// 퍼널 이벤트 signup_start 는 화면 마운트 시점(폼 컴포넌트)에서 잡는다.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "가입하기",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // /onboarding/age 연령 게이트에서 넘어온 프리필 (YYYY-MM-DD)
  const raw = Array.isArray(sp.birth) ? sp.birth[0] : sp.birth;
  const birthDate = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;

  return (
    <section data-testid="signup-page">
      <h1 className="text-h1">같은 걸 좋아하는 사람부터 만나요</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        가입은 1분이면 끝나요. 만 19세 이상만 이용할 수 있어요.
      </p>

      <SignupForm initialBirthDate={birthDate} />

      <p className="mt-6 text-body-sm text-ink-muted">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
          로그인
        </Link>
      </p>
    </section>
  );
}
