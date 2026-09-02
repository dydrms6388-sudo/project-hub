import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MODERATION_RULES } from "@/lib/moderation/constants";
import { getGateState, getSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/gate";
import { ROUTES } from "@/lib/auth/routes";
import { RestoreScreen } from "@/components/settings/RestoreScreen";

export const metadata: Metadata = { title: "탈퇴 취소", robots: { index: false, follow: false } };
/** 세션·쿠키 기반 게이트 — 빌드 시 프리렌더 금지 */
export const dynamic = "force-dynamic";

/** /account/restore — 탈퇴 유예(status=deleting) 중 로그인 시 게이트 ④ 가 보내는 화면. [탈퇴 취소] 1탭 → cancel_delete → /home */
export default async function RestorePage() {
  const { user } = await getSession();
  if (!user) redirect(`${ROUTES.login}?next=${ROUTES.restore}`);
  const state = await getGateState();
  if (!state) redirect(ROUTES.login);
  if (state.status !== "deleting") redirect(homeFor(state));
  const requestedAt = state.deleteRequestedAt ?? new Date().toISOString();
  const purgeAt = new Date(new Date(requestedAt).getTime() + MODERATION_RULES.deleteGraceDays * 86_400_000).toISOString();
  return <RestoreScreen requestedAt={requestedAt} purgeAt={purgeAt} />;
}
