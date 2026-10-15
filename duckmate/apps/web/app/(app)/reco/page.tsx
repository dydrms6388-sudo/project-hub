import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { RecoScreen } from "@/components/discover/RecoScreen";
import { fetchTodayRecommendations } from "./actions";

export const metadata: Metadata = { title: "오늘의 추천", robots: { index: false, follow: false } };

export default async function RecoPage() {
  await requireProfile(2);
  const r = await fetchTodayRecommendations();
  if (!r.ok && r.redirectTo) redirect(r.redirectTo);
  // 오늘 카드가 있고 전부 acted → 루프 끝 화면 (07:00 전 재진입도 동일, 12_flows §3.3)
  if (r.ok && r.data.cards.length > 0 && r.data.remaining === 0) redirect("/reco/done");
  return <RecoScreen initial={r.ok ? r.data : null} />;
}
