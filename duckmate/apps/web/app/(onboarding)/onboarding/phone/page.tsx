/** S2 휴대폰 OTP + 약관 동의 — 비로그인 전용. 로그인 상태(생년월일 미확정)면 /onboarding/age 에서 submitBirthDate */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { gatePublic } from "@/components/auth/public-gate";
import { PhoneOtpScreen } from "@/components/onboarding/PhoneOtpScreen";

export const metadata: Metadata = { title: "휴대폰 인증" };
export const dynamic = "force-dynamic";

export default async function PhonePage() {
  const { user } = await gatePublic({ kind: "auth", route: "phone" });
  if (user) redirect("/onboarding/age");
  return <PhoneOtpScreen mode="signup" />;
}
