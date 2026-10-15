// =============================================================================
// E2 · 승인된 프로필 사진 signed URL 발급 (서버 전용)
//
// 00006_storage.sql 규약:
//  - photos 버킷은 비공개 → signed URL 로만 서빙.
//  - "탐색 카드의 승인 사진 서빙은 D3/E2 서버 경로가 service role signed URL 로
//    발급한다(can_view_profile 판정 후)" — 그래서 이 함수는 반드시
//    **상대 프로필을 세션 RLS 로 이미 읽는 데 성공한 뒤에만** 호출한다.
//  - review_status='approved' 만 노출. pending/rejected 는 슬롯 자체를 만들지
//    않는다 (12_flows §8.2 — 깨진 이미지·자리 표시 금지).
//  - public.photos.path 는 "photos/{profile_id}/{uuid}.webp" 로 저장되므로
//    버킷 접두를 떼고 서명한다.
// =============================================================================

import { createServiceClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SEC = 60 * 10;

export async function getApprovedPhotoUrls(
  profileId: string,
  limit = 6,
): Promise<string[]> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("photos")
      .select("path, is_primary, created_at")
      .eq("profile_id", profileId)
      .eq("review_status", "approved")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error || !data) return [];

    const objectPaths = (data as { path: string }[])
      .map((row) => row.path.replace(/^photos\//, ""))
      .filter((p) => p.length > 0);
    if (objectPaths.length === 0) return [];

    const { data: signed } = await service.storage
      .from("photos")
      .createSignedUrls(objectPaths, SIGNED_URL_TTL_SEC);

    return (signed ?? [])
      .map((s) => s.signedUrl)
      .filter((url): url is string => typeof url === "string" && url.length > 0);
  } catch {
    // 사진은 가산점일 뿐 — 실패해도 카드는 완결돼 보여야 한다 (M6)
    return [];
  }
}
