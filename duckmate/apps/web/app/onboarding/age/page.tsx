// =============================================================================
// E1 · /onboarding/age — 연령 확인 (1/7) [F-ONB-01] · 이벤트 age_gate_pass
//
// D2-7: 생년월일은 가입 폼(signUpWithAge)에 통합돼 있다. 이 화면은
//   ① 비로그인(미들웨어 PUBLIC) 진입 시 = 가입 전 연령 게이트 → 통과하면
//      /signup 으로 생년월일을 프리필해 넘긴다(입력을 서버에 저장하지 않는다).
//   ② 로그인 상태 = 이미 저장된 birth_date 확인 화면 → 다음(휴대폰 인증)으로.
// 만 19세 미만이면 즉시 차단 화면 + 입력 미저장 고지(A5 §1.3-1).
// =============================================================================

import { redirect } from "next/navigation";
import { Card } from "@duckmate/ui";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@duckmate/db";
import { AgeGateForm } from "./age-gate-form";

export default async function AgePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile = data as Profile | null;
    if (!profile) redirect("/login");
    if (profile.onboarding_step === "done") redirect("/home");
    // age 스텝은 가입 시 이미 통과했다 — 저장된 스텝으로 이어서 진행한다
    if (profile.onboarding_step !== "age") redirect(`/onboarding/${profile.onboarding_step}`);
  }

  return (
    <section data-testid="onboarding-step-age">
      <h1 className="text-h1">만 19세 이상만 이용할 수 있어요</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        생년월일을 알려주시면 바로 다음 단계로 넘어가요.
      </p>

      <Card className="mt-5">
        <AgeGateForm loggedIn={Boolean(user)} />
      </Card>

      <p className="mt-4 text-caption text-ink-muted">
        본인인증 시 실제 생년월일과 대조합니다. 다르면 이용이 제한돼요.
      </p>
    </section>
  );
}
