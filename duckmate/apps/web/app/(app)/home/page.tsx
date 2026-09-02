import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { HomeScreen } from "@/components/discover/HomeScreen";
import { fetchHomeView } from "./actions";

export const metadata: Metadata = { title: "오늘", robots: { index: false, follow: false } };

export default async function HomePage() {
  const { profile } = await requireProfile(2);
  const r = await fetchHomeView();
  if (!r.ok && r.redirectTo) redirect(r.redirectTo);
  return <HomeScreen initial={r.ok ? r.data : null} nickname={profile.nickname} />;
}
