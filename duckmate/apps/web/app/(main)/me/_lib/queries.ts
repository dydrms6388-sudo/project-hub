// =============================================================================
// E4 · /me 계열 서버 조회 헬퍼 (세션 RLS 로만 동작 — service role 미사용)
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import type { Photo, ReviewStatus } from "@duckmate/db";

export interface MyHobby {
  hobbyId: string;
  name: string;
  /** 1~3 = 덕질카드 Top3, null = Top3 아님 */
  rank: 1 | 2 | 3 | null;
  intensity: 1 | 2 | 3 | 4 | 5;
}

/** 내 취미 (Top3 우선 정렬). 덕질카드 미리보기·편집 공용. */
export async function getMyHobbies(profileId: string): Promise<MyHobby[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_hobbies")
    .select("hobby_id, rank, intensity, hobbies(name)")
    .eq("profile_id", profileId);

  const rows = (data ?? []) as unknown as {
    hobby_id: string;
    rank: 1 | 2 | 3 | null;
    intensity: 1 | 2 | 3 | 4 | 5;
    hobbies: { name: string } | { name: string }[] | null;
  }[];

  return rows
    .map((row) => {
      const joined = Array.isArray(row.hobbies) ? row.hobbies[0] : row.hobbies;
      return {
        hobbyId: row.hobby_id,
        name: joined?.name ?? "취미",
        rank: row.rank,
        intensity: row.intensity,
      };
    })
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || a.name.localeCompare(b.name, "ko"));
}

export interface PhotoSummary {
  photos: Photo[];
  counts: Record<ReviewStatus, number>;
  total: number;
}

/** 내 사진 + 검수 상태 집계 (승인 전 사진도 본인에겐 보인다 — 12_flows §8.2) */
export async function getMyPhotos(profileId: string): Promise<PhotoSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  const photos = (data ?? []) as Photo[];
  const counts: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const photo of photos) counts[photo.review_status] += 1;

  return { photos, counts, total: photos.length };
}
