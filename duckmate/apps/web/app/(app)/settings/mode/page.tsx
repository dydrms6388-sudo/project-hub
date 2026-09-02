import type { Metadata } from "next";
import { getProfile, getSession, requireProfile } from "@/lib/auth/session";
import { ModeScreen } from "@/components/settings/ModeScreen";
import { loadMyProfileView } from "../../me/load";

export const metadata: Metadata = { title: "모드", robots: { index: false, follow: false } };

/** /settings/mode — 친구↔데이팅 전환. 데이팅은 L3 + seeking_gender + 공개 범위 미리보기 완료 필수 (12_flows §6.2) */
export default async function ModePage() {
  await requireProfile(1);
  const profile = await getProfile();
  const { supabase } = await getSession();
  const view = profile ? await loadMyProfileView(supabase, profile) : null;
  if (!view) return null;
  return <ModeScreen view={view} />;
}
