import type { Metadata } from "next";
import { requireGate, getProfile } from "@/lib/auth/session";
import { getOnboardingSnapshot } from "@/lib/onboarding/actions";
import { CardScreen } from "@/components/onboarding/CardScreen";
import { ageBandOf } from "@/components/onboarding/age";
import { loadHobbies, loadRegions } from "@/components/onboarding/data";
import { categoryOf, hobbyById, uiCategorySlug } from "@/components/onboarding/hobbies";
import { regionLabel } from "@/components/onboarding/regions";

export const metadata: Metadata = { title: "덕질 카드" };
export const dynamic = "force-dynamic";

export default async function CardPage() {
  const { state } = await requireGate({ kind: "onboarding", step: "card" });
  const [snap, profile, regions, { categories, hobbies }] = await Promise.all([getOnboardingSnapshot(), getProfile(), loadRegions(), loadHobbies()]);
  const s = snap.ok ? snap.data : null;
  const cardHobbies = (s?.hobbies ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((h) => {
      const hobby = hobbyById(hobbies, h.hobbyId);
      const cat = hobby ? categoryOf(categories, hobby.categoryId) : undefined;
      return {
        hobbyId: h.hobbyId,
        rank: h.rank,
        favNote: h.favNote,
        category: cat ? uiCategorySlug(cat.slug) : "fandom",
        label: hobby?.name ?? String(h.hobbyId),
        intensity: Math.min(5, Math.max(1, h.intensity)) as 1 | 2 | 3 | 4 | 5,
      };
    });
  return (
    <CardScreen
      profileId={state.profileId ?? "me"}
      nickname={s?.profile.nickname ?? profile?.nickname ?? ""}
      ageBand={ageBandOf(profile?.birth_date)}
      region={regionLabel(regions, s?.profile.regionCode ?? profile?.region_code)}
      hobbies={cardHobbies}
      initialNowInto={s?.profile.nowInto ?? null}
    />
  );
}
