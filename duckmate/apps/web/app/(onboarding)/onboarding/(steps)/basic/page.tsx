import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { getOnboardingSnapshot } from "@/lib/onboarding/actions";
import { BasicScreen } from "@/components/onboarding/BasicScreen";
import { loadRegions } from "@/components/onboarding/data";

export const metadata: Metadata = { title: "기본 정보" };
export const dynamic = "force-dynamic";

export default async function BasicPage() {
  await requireGate({ kind: "onboarding", step: "basic" });
  const [regions, snap] = await Promise.all([loadRegions(), getOnboardingSnapshot()]);
  const s = snap.ok ? snap.data : null;
  return (
    <BasicScreen
      regions={regions}
      initial={{
        nickname: s?.profile.nickname ?? null,
        gender: s?.profile.gender ?? null,
        regionCode: s?.profile.regionCode ?? null,
        availability: s?.availability ?? [],
      }}
    />
  );
}
