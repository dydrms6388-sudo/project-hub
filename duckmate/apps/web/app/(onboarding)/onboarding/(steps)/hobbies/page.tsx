import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { getOnboardingSnapshot } from "@/lib/onboarding/actions";
import { HobbiesScreen } from "@/components/onboarding/HobbiesScreen";
import { loadHobbies } from "@/components/onboarding/data";

export const metadata: Metadata = { title: "취미 선택" };
export const dynamic = "force-dynamic";

export default async function HobbiesPage() {
  await requireGate({ kind: "onboarding", step: "hobbies" });
  const [{ categories, hobbies }, snap] = await Promise.all([loadHobbies(), getOnboardingSnapshot()]);
  return <HobbiesScreen categories={categories} hobbies={hobbies} initial={snap.ok ? snap.data.hobbies : []} />;
}
