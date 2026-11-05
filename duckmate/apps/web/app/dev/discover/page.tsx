/**
 * 개발 전용 — E2 화면을 Supabase 없이 목 데이터로 렌더 (스크린샷·시각 확인). 프로덕션은 404.
 *   /dev/discover?screen=reco|match|home|done[&safety=1]
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevDiscover, type DevScreen } from "./DevDiscover";

export const metadata: Metadata = { title: "dev · discover", robots: { index: false, follow: false } };

const SCREENS: DevScreen[] = ["reco", "match", "home", "done"];

export default async function DevDiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const raw = typeof sp.screen === "string" ? sp.screen : "reco";
  const screen = (SCREENS.includes(raw as DevScreen) ? raw : "reco") as DevScreen;
  const safety = sp.safety === "1";
  return <DevDiscover screen={screen} safety={safety} />;
}
