import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";
import { MeScreen } from "@/components/profile/MeScreen";
import { loadMyProfileView } from "./load";

export const metadata: Metadata = { title: "나", robots: { index: false, follow: false } };
/** 세션·쿠키 기반 게이트 — 빌드 시 프리렌더 금지 */
export const dynamic = "force-dynamic";

/** /me — 내 덕질 카드 미리보기 + 인증·모드·편집 진입 (L1+done). 게이트는 (app) layout(E2) + 여기서 재확인. */
export default async function MePage() {
  const { profile } = await requireProfile(1);
  const { supabase } = await getSession();
  const view = await loadMyProfileView(supabase, profile);
  return <MeScreen view={view} />;
}
