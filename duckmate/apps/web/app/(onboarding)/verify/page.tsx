/**
 * /verify — S7 본인인증 게이트 (12_flows §2 S7). requireGate(verify): 온보딩 완료(step verify|done) + verify_level<2 만, L2+ 는 /home.
 * 개발 환경(NODE_ENV≠production)이면 simulate 셀렉트를 노출한다(15_auth §0-10). IDENTITY_VERIFIER 는 공개값이 아니지만 mock|portone 구분만 넘긴다.
 */
import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { SessionHydrator } from "@/components/auth/SessionHydrator";
import { VerifyScreen } from "@/components/auth/VerifyScreen";

export const metadata: Metadata = { title: "본인인증" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { state } = await requireGate({ kind: "verify" });
  const sp = await searchParams;
  const callbackError = typeof sp.error === "string" ? sp.error : null;
  const verifier = process.env.IDENTITY_VERIFIER === "portone" ? "portone" : "mock";
  return (
    <>
      <SessionHydrator state={state} />
      <VerifyScreen devMode={process.env.NODE_ENV !== "production"} verifier={verifier} callbackError={callbackError} />
    </>
  );
}
