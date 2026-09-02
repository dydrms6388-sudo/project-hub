import type { Metadata } from "next";
import { getSession, requireProfile } from "@/lib/auth/session";
import { VerifyCenterScreen } from "@/components/settings/VerifyCenterScreen";
import { loadMyPhotos } from "../../me/load";

export const metadata: Metadata = { title: "인증 센터", robots: { index: false, follow: false } };

/** /settings/verify — L0~L3 진행 표시 + 단계별 CTA (12_flows §6.3) */
export default async function VerifyCenterPage() {
  const { state, profile } = await requireProfile(1);
  const { supabase } = await getSession();
  const photos = await loadMyPhotos(supabase, profile.id);
  return (
    <VerifyCenterScreen
      verifyLevel={state.verifyLevel}
      mode={profile.mode}
      photoCounts={{
        pending: photos.filter((p) => p.reviewStatus === "pending").length,
        approved: photos.filter((p) => p.reviewStatus === "approved").length,
        hasApprovedPrimary: photos.some((p) => p.isPrimary && p.reviewStatus === "approved"),
      }}
    />
  );
}
