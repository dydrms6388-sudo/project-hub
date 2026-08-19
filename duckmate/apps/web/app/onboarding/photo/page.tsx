// =============================================================================
// E1 · /onboarding/photo — 사진 업로드 (6/7) [F-ONB-08] · photo_upload_complete
// 스킵 가능(M6). 검수 안내를 업로드 "전에" 노출한다(반려 시 배신감 방지).
// 경로 규약: Storage 객체 키 {profile_id}/{uuid}.webp ·
//            photos.path = photos/{profile_id}/{uuid}.webp (D2-4 / 00006_storage)
// =============================================================================

import type { Photo } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { PhotoUploader, type ExistingPhoto } from "./photo-uploader";

export default async function PhotoPage() {
  const profile = await requireOnboardingStep("photo");
  const supabase = await createClient();

  const { data } = await supabase
    .from("photos")
    .select("id, path, review_status, is_primary")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true });

  const photos: ExistingPhoto[] = ((data ?? []) as Pick<
    Photo,
    "id" | "path" | "review_status" | "is_primary"
  >[]).map((p) => ({
    id: p.id,
    path: p.path,
    reviewStatus: p.review_status,
    isPrimary: p.is_primary,
  }));

  return (
    <section data-testid="onboarding-step-photo">
      <h1 className="text-h1">프로필 사진 (선택)</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        사진 없이도 Lv2까지 모든 기능을 쓸 수 있어요. 덕질카드가 먼저 보이니까요.
      </p>

      <PhotoUploader profileId={profile.id} initialPhotos={photos} />
    </section>
  );
}
