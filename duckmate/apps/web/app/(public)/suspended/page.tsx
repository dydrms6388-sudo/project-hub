/**
 * /suspended — 제재 중 화면 (게이트 ③ 대상: banned 또는 활성 제재 ≥3). 12_flows §0-28 레벨별 4종 카피.
 * 라우트 그룹 규칙(12_flows §0-1)에 따라 (public) 그룹에 두되 게이트는 status/suspended 로 판정한다.
 */
import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { getMySanctions } from "@/lib/moderation/queries";
import { SessionHydrator } from "@/components/auth/SessionHydrator";
import { SuspendedScreen } from "@/components/auth/SuspendedScreen";

export const metadata: Metadata = { title: "이용 제한 안내", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const { state } = await requireGate({ kind: "status", route: "suspended" });
  const mod = await getMySanctions();
  return (
    <>
      <SessionHydrator state={state} />
      <SuspendedScreen state={mod} />
    </>
  );
}
