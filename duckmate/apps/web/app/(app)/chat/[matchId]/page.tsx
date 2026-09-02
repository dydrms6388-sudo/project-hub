import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getChatRoom, getMessages } from "@/lib/chat/queries";
import { getMySanctions, partnerRiskBanner } from "@/lib/moderation/queries";
import { ChatRoomScreen } from "@/components/chat/ChatRoomScreen";

export const metadata: Metadata = {
  title: "대화",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChatRoomPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!UUID_RE.test(matchId)) notFound();
  const { profile } = await requireProfile(2);

  const [roomRes, messagesRes, riskBanner] = await Promise.all([getChatRoom(matchId), getMessages(matchId), partnerRiskBanner(matchId)]);
  if (!roomRes.ok) {
    if (roomRes.redirectTo) redirect(roomRes.redirectTo);
    // 차단자 본인·비당사자·없는 방 → NOT_FOUND (존재 여부 비노출)
    notFound();
  }
  const initialMessages = messagesRes.ok ? messagesRes.data : { items: [], nextBefore: null };

  // 내 제재 level 2(채팅 24h 제한) 일 때만 해제 시각을 읽어 배너에 넘긴다 (E3 결정 23-c → H2)
  let sanctionEndsAt: string | null = null;
  if (roomRes.data.my_sanction_level >= 2) {
    try {
      sanctionEndsAt = (await getMySanctions()).top?.endsAt ?? null;
    } catch {
      sanctionEndsAt = null;
    }
  }

  return <ChatRoomScreen matchId={matchId} myProfileId={profile.id} initialRoom={roomRes.data} initialMessages={initialMessages} riskBanner={riskBanner} sanctionEndsAt={sanctionEndsAt} />;
}
