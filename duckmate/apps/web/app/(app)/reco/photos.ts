import "server-only";

/**
 * storage `photos` 경로 → 서명 URL(1h). 사용자 권한 클라이언트 → storage RLS(approved + can_view_profile) 가 최종 방어선.
 * "use server" 파일이 아니므로 클라이언트에서 직접 호출할 수 없다(서버 액션·서버 컴포넌트 전용).
 */
import { createClient } from "@/lib/supabase/server";

export const PHOTO_URL_TTL_SEC = 3600;

export async function signPhotoPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths)).filter((p) => p.length > 0);
  if (unique.length === 0) return out;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("photos").createSignedUrls(unique, PHOTO_URL_TTL_SEC);
    if (error || !data) return out;
    for (const row of data) {
      if (row.signedUrl && row.path && !row.error) out.set(row.path, row.signedUrl);
    }
  } catch (e) {
    console.error("[reco] sign photo urls failed", e);
  }
  return out;
}
