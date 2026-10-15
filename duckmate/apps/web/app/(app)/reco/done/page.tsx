import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { RecoDoneScreen } from "@/components/discover/RecoDoneScreen";
import { fetchHomeView } from "../../home/actions";

export const metadata: Metadata = { title: "오늘 루프 끝", robots: { index: false, follow: false } };

export default async function RecoDonePage() {
  await requireProfile(2);
  const r = await fetchHomeView();
  if (!r.ok && r.redirectTo) redirect(r.redirectTo);
  // 아직 남은 카드가 있으면 추천으로
  if (r.ok && r.data.summary.reco_remaining > 0) redirect("/reco");
  return <RecoDoneScreen summary={r.ok ? r.data.summary : null} />;
}
