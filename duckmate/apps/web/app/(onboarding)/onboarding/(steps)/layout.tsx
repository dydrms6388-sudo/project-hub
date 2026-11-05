/**
 * 온보딩 6화면(basic..photos) 공통 게이트 layout — requireGate(onboarding) 로 ①~⑤-a 판정(세션·연령차단·정지·탈퇴·생년월일)
 * + 완료자(verify/done)는 homeFor 로. step 별 앞서가기 차단은 각 page 의 requireGate({step}) 가 담당.
 * session 슬라이스 hydrate.
 */
import { requireGate } from "@/lib/auth/session";
import { SessionHydrator } from "@/components/auth/SessionHydrator";

export const dynamic = "force-dynamic";

export default async function OnboardingStepsLayout({ children }: { children: React.ReactNode }) {
  const { state } = await requireGate({ kind: "onboarding", step: "basic" });
  return (
    <>
      <SessionHydrator state={state} />
      {children}
    </>
  );
}
