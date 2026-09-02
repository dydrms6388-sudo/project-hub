/**
 * 온보딩 참조 데이터 로더 (서버 컴포넌트 전용). DB(공개 읽기: regions·hobby_categories·hobbies·quiz_questions)를 우선 읽고
 * 실패·빈 결과면 시드 미러 상수로 폴백한다 — Supabase 없이도 화면이 렌더되게(빌드·스크린샷·E2E 초기).
 */
import { getSession } from "@/lib/auth/session";
import { HOBBIES_FALLBACK, HOBBY_CATEGORIES_FALLBACK, type HobbyCategoryItem, type HobbyItem } from "./hobbies";
import { QUIZ_FALLBACK, parseQuizOptions, type QuizQuestionItem } from "./quiz";
import { REGIONS_FALLBACK, type RegionItem } from "./regions";

export async function loadRegions(): Promise<RegionItem[]> {
  try {
    const { supabase } = await getSession();
    const { data, error } = await supabase.from("regions").select("code, sido, sigungu, sort_order, is_active").eq("is_active", true);
    if (error || !data || data.length === 0) return [...REGIONS_FALLBACK];
    return data.map((r) => ({ code: r.code, sido: r.sido, sigungu: r.sigungu, sortOrder: r.sort_order }));
  } catch {
    return [...REGIONS_FALLBACK];
  }
}

export async function loadHobbies(): Promise<{ categories: HobbyCategoryItem[]; hobbies: HobbyItem[] }> {
  try {
    const { supabase } = await getSession();
    const [c, h] = await Promise.all([
      supabase.from("hobby_categories").select("id, slug, name, icon, is_initial, sort_order, is_active").eq("is_active", true),
      supabase.from("hobbies").select("id, slug, name, category_id, icon, sort_order, is_active").eq("is_active", true),
    ]);
    if (c.error || h.error || !c.data?.length || !h.data?.length) return { categories: [...HOBBY_CATEGORIES_FALLBACK], hobbies: [...HOBBIES_FALLBACK] };
    return {
      categories: c.data.map((x) => ({ id: x.id, slug: x.slug, name: x.name, icon: x.icon ?? "", isInitial: x.is_initial, sortOrder: x.sort_order })),
      hobbies: h.data.map((x) => ({ id: x.id, slug: x.slug, name: x.name, categoryId: x.category_id, icon: x.icon ?? "", sortOrder: x.sort_order })),
    };
  } catch {
    return { categories: [...HOBBY_CATEGORIES_FALLBACK], hobbies: [...HOBBIES_FALLBACK] };
  }
}

export async function loadQuiz(): Promise<QuizQuestionItem[]> {
  try {
    const { supabase } = await getSession();
    const { data, error } = await supabase.from("quiz_questions").select("id, key, text, options, sort_order, is_active").eq("is_active", true);
    if (error || !data || data.length === 0) return [...QUIZ_FALLBACK];
    return data.map((q) => ({ id: q.id, key: q.key, text: q.text, options: parseQuizOptions(q.options), sortOrder: q.sort_order })).filter((q) => q.options.length >= 2);
  } catch {
    return [...QUIZ_FALLBACK];
  }
}
