// =============================================================================
// E4 · /settings/notifications — 알림 설정 [F-NTF-01]
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getNotificationPrefs } from "@/lib/notifications/actions";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/schemas";
import { NotificationsForm } from "./notifications-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "알림 설정",
  robots: { index: false, follow: false },
};

export default async function NotificationsSettingsPage() {
  await requireOnboardingDone();
  const result = await getNotificationPrefs();
  const initial = result.ok ? result.data : DEFAULT_NOTIFICATION_PREFS;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">알림 설정</h1>
        <p className="text-body-sm text-ink-muted">받고 싶은 알림만 켜 두세요.</p>
      </header>

      <NotificationsForm initial={initial} />
    </main>
  );
}
