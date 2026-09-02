// =============================================================================
// E1 · /onboarding/phone — 휴대폰 인증 (2/7) [F-ONB-02] · Lv0→Lv1
// 스킵 불가 (Lv1 없이는 탐색 자체가 불가 — 12_flows §2.2).
// =============================================================================

import { redirect } from "next/navigation";
import { getIdentityVerifier } from "@/lib/auth/identity-verifier";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { PhoneForm } from "./phone-form";

export default async function PhonePage() {
  const profile = await requireOnboardingStep("phone");
  if (profile.verify_level >= 1 && profile.onboarding_step !== "phone") {
    redirect(`/onboarding/${profile.onboarding_step}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 프로덕션 stub 차단(G2-01)으로 팩토리가 throw 할 수 있다 — 화면은 렌더되어야 하므로
  // 여기서는 "stub 아님"으로 간주한다(실제 인증 시도는 액션에서 코드로 거부된다).
  let stubMode = false;
  try {
    stubMode = getIdentityVerifier(user?.email).name === "stub";
  } catch {
    stubMode = false;
  }

  return (
    <section data-testid="onboarding-step-phone">
      <h1 className="text-h1">휴대폰 번호를 인증해요</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        번호 1개당 계정 1개예요. 번호는 인증에만 쓰고 상대에게 보이지 않아요.
      </p>

      <PhoneForm stubMode={stubMode} />
    </section>
  );
}
