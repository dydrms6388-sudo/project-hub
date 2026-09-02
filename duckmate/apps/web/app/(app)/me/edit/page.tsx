import type { Metadata } from "next";
import { getSession, requireProfile } from "@/lib/auth/session";
import { ProfileEditScreen } from "@/components/profile/ProfileEditScreen";
import { loadProfileEditData } from "../load";

export const metadata: Metadata = { title: "프로필 편집", robots: { index: false, follow: false } };

/** /me/edit — 섹션 앵커(#card·#hobbies·#quiz·#availability·#bio) 단일 스크롤 폼, 섹션별 부분 저장 (12_flows §6.1) */
export default async function MeEditPage() {
  const { profile } = await requireProfile(1);
  const { supabase } = await getSession();
  const data = await loadProfileEditData(supabase, profile);
  return <ProfileEditScreen data={data} />;
}
