// =============================================================================
// E4 · /settings — 설정 허브 [F-PRF-02] (12_flows §5.3)
//
// 다크패턴 금지 규약: 탈퇴·구독 해지는 **설정(1) → 항목(2) = 2뎁스**로 끝난다.
// 항목을 숨기거나 "문의하세요"로 우회시키지 않는다 (09_store_policy E-5).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@duckmate/ui";
import type { Subscription } from "@duckmate/db";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "설정",
  robots: { index: false, follow: false },
};

const TIER_LABEL: Record<string, string> = {
  free: "무료 이용 중",
  plus: "플러스",
  pro: "프로",
};

function Row({
  href,
  label,
  value,
  description,
}: {
  href: string;
  label: string;
  value?: string;
  description?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised px-4 py-4 text-ink hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-body">{label}</span>
          {description && <span className="text-caption text-ink-muted">{description}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-body-sm text-ink-muted">
          {value}
          <span aria-hidden>›</span>
        </span>
      </Link>
    </li>
  );
}

export default async function SettingsPage() {
  const { user, profile } = await requireOnboardingDone();

  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const subscription = data as Pick<Subscription, "tier" | "status"> | null;
  const tier = subscription?.tier ?? "free";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-6 text-ink">
      <header className="flex items-center justify-between">
        <h1 className="text-h1">설정</h1>
        <Link href="/me" className="text-body-sm text-primary underline underline-offset-2">
          내 프로필
        </Link>
      </header>

      <ul className="flex flex-col gap-2">
        <Row
          href="/settings/mode"
          label="모드 전환"
          value={profile.mode === "dating" ? "데이팅" : "친구"}
        />
        <Row href="/settings/notifications" label="알림 설정" />
        <Row href="/settings/blocks" label="차단 목록" />
        <Row href="/settings/subscription" label="구독 관리" value={TIER_LABEL[tier] ?? tier} />
      </ul>

      <ul className="flex flex-col gap-2">
        <Row
          href="/settings/data"
          label="내 데이터 다운로드"
          description="내가 등록한 정보를 파일로 받아볼 수 있어요"
        />
        <Row
          href="/settings/delete"
          label="탈퇴하기"
          description="계정과 내가 올린 정보를 파기해요"
        />
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3">약관·정책</h2>
        <ul className="flex flex-col gap-2">
          <Row href="/legal" label="약관 및 정책 전문" />
          <Row href="/legal/privacy" label="개인정보처리방침" />
          <Row href="/legal/community" label="커뮤니티 가이드라인" />
          <Row href="/appeal" label="제재 이의제기" />
        </ul>
      </section>

      <p className="flex items-center gap-2 text-caption text-ink-muted">
        <Badge variant="neutral">{profile.nickname}</Badge>
        인증 레벨 {profile.verify_level} · 계정 문의는 약관에 안내된 대표 이메일로 받아요.
      </p>
    </main>
  );
}
