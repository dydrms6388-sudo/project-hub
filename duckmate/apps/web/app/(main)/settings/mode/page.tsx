// =============================================================================
// E4 · /settings/mode — 친구/데이팅 모드 전환 (12_flows §5.3)
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { ModeForm } from "./mode-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "모드 전환",
  robots: { index: false, follow: false },
};

export default async function ModeSettingsPage() {
  const { profile } = await requireOnboardingDone();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">모드 전환</h1>
        <p className="text-body-sm text-ink-muted">지금은 {profile.mode === "dating" ? "데이팅" : "취미 친구"} 모드예요.</p>
      </header>

      <ModeForm mode={profile.mode} verifyLevel={profile.verify_level} />
    </main>
  );
}
