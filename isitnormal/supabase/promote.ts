/**
 * 승격 잡 — 승인된 설문에 승격 색인 게이트를 적용해 is_indexed 를 flip.
 * cron(예: 매일)으로 실행. 통과분만 색인·sitemap 편입, 나머지는 계속 noindex.
 *
 * 실행: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx supabase/promote.ts
 *
 * 밀도 게이트: 페이지 고유 글자수(body+해설+승격해설) 800자+, 총 1,200자+, 해설 300자+,
 * 투표 n>=30, 유효반응 10+, (UGC는) 7일 경과·품질스캔·승인. 하나라도 미달이면 승격 안 함.
 */
import { createClient } from "@supabase/supabase-js";
import { evaluatePromotion, type Origin } from "../lib/promotion-gate";
import { getSurveyBySlug } from "../lib/surveys";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const clen = (s: string) => [...(s ?? "")].length;
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const { data: surveys, error } = await db
    .from("surveys")
    .select(
      "id, slug, origin, body, editor_commentary, promotion_commentary, quality_scan_passed, created_at, is_indexed",
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
      totalPageChars: uniqueChars + 400, // 통계/관련 UI 보일러플레이트 추정
      uniquePageChars: uniqueChars,
      ageDays,
      qualityScanPassed: Boolean(s.quality_scan_passed),
    });

    if (result.canIndex && !s.is_indexed) {
      await db.from("surveys").update({ is_indexed: true, promoted_at: new Date().toISOString() }).eq("id", s.id);
      promoted++;
    } else if (!result.canIndex && s.is_indexed) {
      // 신고 숨김 등으로 조건이 깨지면 색인 해제
      await db.from("surveys").update({ is_indexed: false }).eq("id", s.id);
      demoted++;
    } else if (!result.canIndex) {
      for (const r of result.reasons) blocked[r] = (blocked[r] ?? 0) + 1;
    }
  }

  console.log(`승격 ${promoted} / 해제 ${demoted} / 미승격 사유:`, blocked);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
