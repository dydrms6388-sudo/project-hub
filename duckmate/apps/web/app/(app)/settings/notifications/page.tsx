import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getPushPrefs } from "@/lib/push/actions";
import { NotificationsScreen } from "@/components/settings/NotificationsScreen";

export const metadata: Metadata = { title: "알림", robots: { index: false, follow: false } };

/** /settings/notifications — 서비스 알림(마스터·슬롯 3·방해금지) + 마케팅 수신 동의 (20_notifications 결정 1~3, B1 §0-20) */
export default async function NotificationsPage() {
  await requireProfile(1);
  const prefs = await getPushPrefs();
  return <NotificationsScreen initial={prefs.ok ? prefs.data : null} loadError={prefs.ok ? null : prefs.message} />;
}
