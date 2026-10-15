import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-display text-primary">덕메이트</h1>
      <p className="text-lg">
        같은 걸 좋아하는 사람이랑 만나는 앱.
        <br />
        외모 스와이프 말고, 취미·덕질 궁합부터.
      </p>
      <Link
        href="/onboarding/age"
        className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-fg"
      >
        시작하기
      </Link>
      <p className="text-caption text-ink-muted">만 19세 이상만 이용할 수 있어요.</p>
    </main>
  );
}
