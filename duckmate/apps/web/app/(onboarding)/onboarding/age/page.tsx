/** S1 연령 확인 — 비로그인(드래프트) 또는 로그인+생년월일 미확정(has_birth_date=false) */
import type { Metadata } from "next";
import { gatePublic } from "@/components/auth/public-gate";
import { AgeScreen } from "@/components/onboarding/AgeScreen";

export const metadata: Metadata = { title: "연령 확인" };
export const dynamic = "force-dynamic";

export default async function AgePage() {
  const { user } = await gatePublic({ kind: "auth", route: "age" });
  return <AgeScreen loggedIn={user !== null} />;
}
