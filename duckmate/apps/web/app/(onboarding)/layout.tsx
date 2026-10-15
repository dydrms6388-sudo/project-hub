/**
 * (onboarding) 그룹 layout — noindex 소유 (12_flows §0-6). 접근 게이트는
 *  - /onboarding/age·/onboarding/phone: 각 page 의 gatePublic(auth) (세션 없이 렌더)
 *  - /onboarding/{basic..photos}: 하위 (steps)/layout.tsx 의 requireGate(onboarding) + 각 page 의 step 별 requireGate
 *  - /verify: page 의 requireGate(verify)
 * (Next layout 은 pathname 을 모르므로 step 별 정확한 판정은 page 가 한다. 미들웨어가 1차 방어.)
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function OnboardingGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
