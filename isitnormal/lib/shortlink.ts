import { getAdminSupabase } from "./supabase/server";

/** shortId → {slug, optKey}. 만료(90일)·미존재·오프라인이면 null (U4/U5). */
export async function resolveShortLink(
  shortId: string,
): Promise<{ slug: string; optKey: string } | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("short_links")
    .select("slug, opt_key, expires_at")
    .eq("short_id", shortId)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { slug: data.slug, optKey: data.opt_key };
}
