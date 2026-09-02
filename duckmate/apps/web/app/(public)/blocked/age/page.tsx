/**
 * /blocked/age — 연령 차단 (12_flows §8, 15_auth §0-4). 세션 없이도 렌더(가입 직후 서버가 로그아웃함).
 * age_blocked 세션이 남아 있으면 로그아웃 버튼 제공. 30일 내 같은 번호 재로그인 → 게이트 ②가 다시 여기로.
 * 제목은 EmptyState `as="h1"` (화면 유일 헤딩 — G1 §19 h1 부재 → H2).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@duckmate/ui";
import { gatePublic } from "@/components/auth/public-gate";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { COPY } from "@/components/onboarding/copy";

export const metadata: Metadata = { title: "이용 안내", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BlockedAgePage() {
  const { user } = await gatePublic({ kind: "auth", route: "blocked_age" });
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-background px-5" data-testid="blocked-age">
      <EmptyState
        as="h1"
        title={COPY.blockedAge.headline}
        description={COPY.blockedAge.sub}
        action={
          user ? (
            <LogoutButton />
          ) : (
            <Link href="/" className="text-body-sm text-muted-foreground underline-offset-4 hover:underline" data-testid="blocked-home">
              {COPY.blockedAge.back}
            </Link>
          )
        }
      />
    </div>
  );
}
