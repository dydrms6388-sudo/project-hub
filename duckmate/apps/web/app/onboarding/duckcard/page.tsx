// =============================================================================
// E1 · /onboarding/duckcard — 덕질카드 작성 (5/7) [F-ONB-07] · duckcard_complete
// '나중에 채우기' 허용 스텝 (advanceOnboardingStep — D2 §2, 12_flows §결정-4).
// Top3 순위는 profile_hobbies.rank 소유(D2-2) → 여기서는 확인만 하고 수정은
// 취미 화면(saveHobbies 재호출)으로 되돌려 보낸다.
// =============================================================================

import Link from "next/link";
import { HobbyChip } from "@duckmate/ui";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { DuckCardForm } from "./duckcard-form";

interface TopHobbyRow {
  rank: number | null;
  hobbies: { name: string } | { name: string }[] | null;
}

export default async function DuckCardPage() {
  const profile = await requireOnboardingStep("duckcard");
  const supabase = await createClient();

  const { data } = await supabase
    .from("profile_hobbies")
    .select("rank, hobbies(name)")
    .eq("profile_id", profile.id)
    .not("rank", "is", null)
    .order("rank", { ascending: true });

  const top3 = ((data ?? []) as TopHobbyRow[])
    .map((row) => {
      const h = Array.isArray(row.hobbies) ? row.hobbies[0] : row.hobbies;
      return { rank: row.rank ?? 0, name: h?.name ?? "" };
    })
    .filter((t) => t.name !== "");

  return (
    <section data-testid="onboarding-step-duckcard">
      <h1 className="text-h1">내 덕질카드 만들기</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        상대에게 사진보다 먼저 보이는 카드예요.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-surface-raised p-5">
        <h2 className="text-h3">Top 3</h2>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="duckcard-top3">
          {top3.length > 0 ? (
            top3.map((t) => (
              <HobbyChip key={t.rank} selectable={false} label={`${t.rank}위 ${t.name}`} />
            ))
          ) : (
            <p className="text-body-sm text-ink-muted">아직 순위가 없어요.</p>
          )}
        </div>
        <Link
          href="/onboarding/hobbies"
          className="mt-3 inline-block text-caption text-ink-muted underline underline-offset-4"
          data-testid="duckcard-edit-top3"
        >
          순위 바꾸기
        </Link>
      </div>

      <DuckCardForm
        initialFavNote={profile.fav_note ?? ""}
        initialObsession={profile.current_obsession ?? ""}
      />
    </section>
  );
}
