import type { Metadata } from "next";
import { getProfile, requireProfile } from "@/lib/auth/session";
import { getBlockList, getMySanctions } from "@/lib/moderation/queries";
import { isPaymentsEnabled } from "@/lib/payments";
import { APP_VERSION, companyUrl, paymentsAllowedByLegal } from "@/config/company";
import { SettingsHubScreen } from "@/components/settings/SettingsHubScreen";

export const metadata: Metadata = { title: "설정", robots: { index: false, follow: false } };

/** /settings — 설정 허브 (12_flows §6.4). 서버 컴포넌트가 카운트·제재 상태를 모아 클라이언트 화면에 넘긴다. */
export default async function SettingsPage() {
  const { state } = await requireProfile(1);
  const profile = await getProfile();
  const [blocks, sanctions] = await Promise.all([
    getBlockList().catch(() => []),
    getMySanctions().catch(() => null),
  ]);
  return (
    <SettingsHubScreen
      mode={profile?.mode ?? state.mode}
      verifyLevel={state.verifyLevel}
      blockCount={blocks.length}
      canAppeal={Boolean(sanctions?.active.some((s) => s.level >= 3))}
      paymentsEnabled={isPaymentsEnabled() && paymentsAllowedByLegal()}
      companyContactUrl={companyUrl("/contact/")}
      appVersion={APP_VERSION}
    />
  );
}
