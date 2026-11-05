import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevChatPlayground, type DevView } from "@/components/chat/dev/DevChatPlayground";

/**
 * 개발 전용 채팅 목 라우트 (E3 스크린샷·수동 QA). 프로덕션은 404.
 *   /dev/chat?view=list
 *   /dev/chat?view=room[&match=<uuid>][&realtime=polling][&scam=1]
 */
export const metadata: Metadata = { title: "채팅 목", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DevChatPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const view: DevView = sp.view === "room" ? "room" : "list";
  const matchId = typeof sp.match === "string" ? sp.match : undefined;
  const realtime = sp.realtime === "polling" ? "polling" : "connected";
  return <DevChatPlayground view={view} matchId={matchId} realtime={realtime} scam={sp.scam === "1"} />;
}
