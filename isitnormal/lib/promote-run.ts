import { getAdminSupabase } from "./supabase/server";
import { evaluatePromotion, type Origin } from "./promotion-gate";
import { getSurveyBySlug } from "./surveys";

const clen = (s: string) => [...(s ?? "")].length;
const DAY = 24 * 60 * 60 * 1000;

export interface PromoteSummary {
  promoted: number;
  demoted: number;
  blocked: Record<string, number>;
  offline?: boolean;
}

/**
 * 승격 게이트를 승인 설문 전체에 적용해 is_indexed flip. 스크립트/크론 공용.
 * 밀도(고유 800/총 1200)·투표 n>=30·유효반응 10·(UGC)7일·품질스캔·승인 전부 충족분만 색인.
 */
export async function runPromotion(): Promise<PromoteSummary> {
  const db = getAdminSupabase();
  if (!db) return { promoted: 0, demoted: 0, blocked: {}, offline: true };

  const { data: surveys, error } = await db
    .from("surveys")
    .select(
      "id, slug, origin, body, editor_commentary, promotion_commentary, quality_scan_passed, is_surge_held, created_at, is_indexed",
    )
    .eq("status", "approved");
  if (error) throw error;

  let promoted = 0;
  let demoted = 0;
  const blocked: Record<string, number> = {};

  for (const s of surveys ?? []) {
    const [{ count: votes }, { count: comments }] = await Promise.all([
      db.from("votes").select("id", { count: "exact", head: true }).eq("survey_id", s.id),
      db
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("survey_id", s.id)
        .eq("status", "approved"),
    ]);

    const bodyChars = clen(s.body);
    const commentaryChars = clen(s.editor_commentary);
    const promoChars = clen(s.promotion_commentary);
    const uniqueChars = bodyChars + commentaryChars + promoChars;
    const relatedCount = getSurveyBySlug(s.slug)?.related?.length ?? 0;
    const ageDays = (Date.now() - new Date(s.created_at).getTime()) / DAY;

    const result = evaluatePromotion({
      origin: s.origin as Origin,
      moderationStatus: "approved",
      bodyChars,
      votes: votes ?? 0,
      comments: comments ?? 0,
      editorCommentaryChars: commentaryChars + promoChars,
      relatedCount,
      totalPageChars: uniqueChars + 400,
      uniquePageChars: uniqueChars,
      ageDays,
      qualityScanPassed: Boolean(s.quality_scan_passed),
    });

    // 급등 홀드(V2) 중이면 색인하지 않는다
    const eligible = result.canIndex && !s.is_surge_held;

    if (eligible && !s.is_indexed) {
      await db
        .from("surveys")
        .update({ is_indexed: true, promoted_at: new Date().toISOString() })
        .eq("id", s.id);
      promoted++;
    } else if (!eligible && s.is_indexed) {
      await db.from("surveys").update({ is_indexed: false }).eq("id", s.id);
      demoted++;
    } else if (!eligible) {
      const reasons = s.is_surge_held ? [...result.reasons, "surge_held"] : result.reasons;
      for (const r of reasons) blocked[r] = (blocked[r] ?? 0) + 1;
    }
  }
  return { promoted, demoted, blocked };
}
