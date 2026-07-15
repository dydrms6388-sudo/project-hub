import { getAnonSupabase } from "./supabase/server";

export interface CommentItem {
  id: string;
  body: string;
  created_at: string;
}

/** 승인된 한 줄 의견만 조회 (익명, RLS: status='approved'). */
export async function getComments(slug: string, limit = 30): Promise<CommentItem[]> {
  const sb = getAnonSupabase();
  if (!sb) return [];
  const { data: survey } = await sb
    .from("surveys")
    .select("id")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (!survey) return [];
  const { data } = await sb
    .from("comments")
    .select("id, body, created_at")
    .eq("survey_id", survey.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CommentItem[];
}
