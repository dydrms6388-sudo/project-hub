import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getChatList } from "@/lib/chat/queries";
import { ChatListScreen } from "@/components/chat/ChatListScreen";

export const metadata: Metadata = {
  title: "채팅",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function ChatListPage() {
  const { profile } = await requireProfile(2);
  const res = await getChatList();
  if (!res.ok) {
    if (res.redirectTo) redirect(res.redirectTo);
    return <ChatListScreen initial={[]} myProfileId={profile.id} />;
  }
  return <ChatListScreen initial={res.data} myProfileId={profile.id} />;
}
