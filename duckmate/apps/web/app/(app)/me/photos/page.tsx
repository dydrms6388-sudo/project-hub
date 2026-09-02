import type { Metadata } from "next";
import { getSession, requireProfile } from "@/lib/auth/session";
import { PhotosScreen } from "@/components/profile/PhotosScreen";
import { loadMyPhotos } from "../load";

export const metadata: Metadata = { title: "사진 관리", robots: { index: false, follow: false } };

/** /me/photos — 6칸 그리드 · 검수 배지 · 대표 지정 · 삭제 · 추가 업로드 (12_flows §6.1, 15_auth 결정 11) */
export default async function MePhotosPage() {
  const { profile } = await requireProfile(1);
  const { supabase } = await getSession();
  const photos = await loadMyPhotos(supabase, profile.id);
  return <PhotosScreen photos={photos} profileId={profile.id} verifyLevel={profile.verify_level} mode={profile.mode} />;
}
