/**
 * 시드 투입 스크립트 — categories/surveys/survey_options 를 Supabase에 upsert.
 * 전부 운영자(@운영자) 콘텐츠, status='approved'. 사용자인 척 위장 금지(S1).
 * 통계는 실제 투표로만 채워진다 — 이 스크립트는 표(vote)를 만들지 않는다(가짜 숫자 금지).
 *
 * 실행: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx supabase/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES } from "../content/categories";
import { SEEDS } from "../content/seeds";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

// 카테고리 slug -> id (schema.sql의 고정 id 1..12와 동일 순서)
const CAT_ID = new Map(CATEGORIES.map((c, i) => [c.slug, i + 1]));

async function main() {
  let surveyN = 0;
  let optionN = 0;

  for (const s of SEEDS) {
    const category_id = CAT_ID.get(s.categorySlug);
    if (!category_id) throw new Error(`unknown category ${s.categorySlug}`);

    const { data: survey, error: sErr } = await db
      .from("surveys")
      .upsert(
        {
          slug: s.slug,
          category_id,
          title: s.title,
          body: s.body,
          vote_kind: "binary",
          origin: "operator",
          author_badge: "@운영자",
          status: "approved",
          editor_commentary: s.editorCommentary,
          quality_scan_passed: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (sErr || !survey) throw sErr ?? new Error(`survey upsert failed: ${s.slug}`);
    surveyN++;

    for (let i = 0; i < s.options.length; i++) {
      const o = s.options[i];
      const { error: oErr } = await db.from("survey_options").upsert(
        { survey_id: survey.id, opt_key: o.key, label: o.label, sort: i },
        { onConflict: "survey_id,opt_key" },
      );
      if (oErr) throw oErr;
      optionN++;
    }
  }

  console.log(`시드 완료: 설문 ${surveyN}개 / 선택지 ${optionN}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
