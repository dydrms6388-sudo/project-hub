import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/auth/routes";
import { getMySanctions } from "@/lib/moderation/queries";
import { AppealScreen } from "@/components/settings/AppealScreen";

export const metadata: Metadata = { title: "이의신청", robots: { index: false, follow: false } };

/**
 * /appeal — 정지(level ≥3) 중 7일 이내 1회 · 72h 답변 · 상태 조회 (18_moderation 결정 9~10).
 * 게이트 ③ 이 `status:appeal` 라우트를 통과시키므로 requireProfile 대신 세션 + 제재 상태만 본다.
 * (E2 `(app)/layout.tsx` 는 /appeal 에 requireProfile 을 걸지 말 것 — 25_fe_profile 계약)
 */
export default async function AppealPage() {
  const { user } = await getSession();
  if (!user) redirect(`${ROUTES.login}?next=${ROUTES.appeal}`);
  const state = await getMySanctions().catch(() => null);
  if (!state || (state.screen !== "suspended" && state.screen !== "permanent")) redirect(ROUTES.home);
  return <AppealScreen state={state} />;
}
