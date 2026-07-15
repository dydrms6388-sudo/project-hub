import { getAnonSupabase } from "./supabase/server";

/**
 * 승격(색인) 상태 조회 — 앱 렌더/사이트맵이 사용.
 * is_indexed 는 승격 잡(supabase/promote.ts)이 게이트 통과 시 true로 flip한다.
 * Supabase 미설정이면 항상 미승격 취급(noindex) → 안전 기본값.
 */

export interface SurveyExtras {
  isIndexed: boolean;
  promotionCommentary: string;
}

export async function getSurveyExtras(slug: string): Promise<SurveyExtras> {
  const sb = getAnonSupabase();
  if (!sb) return { isIndexed: false, promotionCommentary: "" };
  const { data } = await sb
    .from("surveys")
    .select("is_indexed, promotion_commentary")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  return {
    isIndexed: Boolean(data?.is_indexed),
    promotionCommentary: data?.promotion_commentary ?? "",
  };
}

export async function getIndexedSlugs(): Promise<string[]> {
  const sb = getAnonSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("surveys")
    .select("slug")
    .eq("status", "approved")
    .eq("is_indexed", true);
  return (data ?? []).map((r) => r.slug as string);
}
