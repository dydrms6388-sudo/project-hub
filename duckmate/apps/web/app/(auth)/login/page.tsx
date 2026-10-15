// =============================================================================
// E1 · /login — 이메일+비밀번호 로그인 [12_flows §0 (public)]
// 로그인 후 이동은 (main)/layout 의 requireOnboardingDone 이 온보딩 미완 시
// 저장된 스텝으로 다시 보낸다 — 여기서 스텝을 계산하지 않는다(§결정-3).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  // open redirect 방지: 내부 절대경로만 허용
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : "/home";

  return (
    <section data-testid="login-page">
      <h1 className="text-h1">다시 만나서 반가워요</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        가입할 때 쓴 이메일로 로그인해 주세요.
      </p>

      <LoginForm next={next} />

      <p className="mt-6 text-body-sm text-ink-muted">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-semibold text-primary underline underline-offset-4">
          가입하기
        </Link>
      </p>
    </section>
  );
}
