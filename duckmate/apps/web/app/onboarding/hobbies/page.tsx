// =============================================================================
// E1 · /onboarding/hobbies — 취미 선택 (3/7) [F-ONB-05] · 이벤트 hobby_select_complete
// 최소 3 · 목표 5 (12_flows §결정-5), 태그당 intensity 1~5, Top3 rank 1·2·3 (D2-2).
// 목록은 서버에서 조회한다(hobbies: 로그인 유저 전체 읽기 — 00003_rls).
// =============================================================================

import type { Hobby, ProfileHobby } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { HobbiesForm, type HobbyOption, type InitialSelection } from "./hobbies-form";

export default async function HobbiesPage() {
  const profile = await requireOnboardingStep("hobbies");
  const supabase = await createClient();

  const { data: hobbyRows } = await supabase
    .from("hobbies")
    .select("id, slug, name, category, icon")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const { data: mine } = await supabase
    .from("profile_hobbies")
    .select("hobby_id, intensity, rank")
    .eq("profile_id", profile.id);

  const hobbies: HobbyOption[] = ((hobbyRows ?? []) as Pick<
    Hobby,
    "id" | "slug" | "name" | "category" | "icon"
  >[]).map((h) => ({
    id: h.id,
    name: h.name,
    category: h.category,
    icon: h.icon,
  }));

  const initial: InitialSelection[] = ((mine ?? []) as Pick<
    ProfileHobby,
    "hobby_id" | "intensity" | "rank"
  >[]).map((r) => ({ hobbyId: r.hobby_id, intensity: r.intensity, rank: r.rank }));

  return (
    <section data-testid="onboarding-step-hobbies">
      <h1 className="text-h1">좋아하는 걸 골라주세요</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        3개부터 시작할 수 있고, 5개까지 고르면 추천이 더 정확해져요.
      </p>

      <HobbiesForm hobbies={hobbies} initial={initial} />
    </section>
  );
}
