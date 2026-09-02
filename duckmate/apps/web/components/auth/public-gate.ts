/**
 * 공개·진입(auth)·상태(status) 라우트용 게이트 (서버 컴포넌트 전용).
 * lib/auth/session.requireGate() 는 통과 후에도 세션이 없으면 /login 으로 보내므로(비로그인 화면에서 루프)
 * 세션 없이도 렌더돼야 하는 화면(/, /login, /onboarding/age, /onboarding/phone, /blocked/age)은 이 함수를 쓴다.
 */
import { redirect } from "next/navigation";
import type { GateState, RouteTarget } from "@duckmate/db";
import type { User } from "@supabase/supabase-js";
import { evaluateGate } from "@/lib/auth/gate";
import { getGateState, getSession } from "@/lib/auth/session";

export async function gatePublic(target: RouteTarget): Promise<{ user: User | null; state: GateState | null }> {
  const { user } = await getSession();
  const state = user ? await getGateState() : null;
  const result = evaluateGate(state, target);
  if (!result.allow) redirect(result.redirectTo);
  return { user, state };
}
