/**
 * /login — 재방문 OTP 로그인 (12_flows §0-5: PhoneOtpScreen mode="login"). noindex. 비로그인만(게이트 auth/login).
 * `?next=` 는 같은 오리진 경로만 사용(미들웨어가 pathname 만 싣는다).
 */
import type { Metadata } from "next";
import { gatePublic } from "@/components/auth/public-gate";
import { PhoneOtpScreen } from "@/components/onboarding/PhoneOtpScreen";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePublic({ kind: "auth", route: "login" });
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  return <PhoneOtpScreen mode="login" next={next} />;
}
