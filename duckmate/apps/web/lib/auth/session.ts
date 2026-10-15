/**
 * 서버 컴포넌트 / 서버 액션용 세션·프로필·게이트 헬퍼 (Node 런타임, next/headers 사용).
 *
 *   const { user } = await getSession();                   // 세션만 (없으면 user=null)
 *   const { profile } = await requireProfile(2);           // 서버 컴포넌트: 미충족 시 redirect()
 *   const ctx = await requireProfileForAction(1);          // 서버 액션: 미충족 시 AuthError throw
 *   await requireGate({ kind: "onboarding", step: "hobbies" });   // layout 별 게이트
 *
 * 요청 단위 캐시(React cache) → 같은 요청에서 여러 번 불러도 DB 는 1회.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { parseGateState } from "@duckmate/db";
import type { GateState, ProfileRow, RouteTarget, VerifyLevel } from "@duckmate/db";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { AuthError } from "@/lib/auth/errors";
import { GATE_COOKIE, checkActionAccess, evaluateGate } from "@/lib/auth/gate";

export type SessionContext = { supabase: ServerSupabase; user: User | null };

/** getUser() 는 Auth 서버 검증. 쿠키의 getSession() 값은 신뢰하지 않는다 */
export const getSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

/** get_gate_state() 1회 호출. 세션 없음 → null */
export const getGateState = cache(async (): Promise<GateState | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data, error } = await supabase.rpc("get_gate_state");
  if (error) {
    console.error("[auth] get_gate_state failed", error.message);
    return null;
  }
  return parseGateState(data);
});

/** 본인 프로필 전체 행 (RLS: profiles_self_read). 없으면 null */
export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("[auth] profile fetch failed", error.message);
    return null;
  }
  return data;
});

/** 상태 변경 액션 후 미들웨어 캐시 무효화 (쿠키 삭제). 서버 액션/라우트 핸들러에서만 호출 가능 */
export async function invalidateGateCache(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(GATE_COOKIE);
  } catch {
    // 서버 컴포넌트 렌더 중에는 쿠키 쓰기 불가 — 무시(60s 후 자연 만료)
  }
}

/** layout / page 용: 대상 라우트에 대한 게이트 판정, 실패 시 redirect() (never 반환) */
export async function requireGate(target: RouteTarget): Promise<{ user: User; state: GateState }> {
  const { user } = await getSession();
  const state = user ? await getGateState() : null;
  const result = evaluateGate(state, target);
  if (!result.allow) redirect(result.redirectTo);
  // evaluateGate 가 통과시킨 경우 세션·상태는 존재(public 제외)
  if (!user || !state) {
    if (target.kind === "public" || target.kind === "auth") {
      // 공개 라우트에서 호출된 경우: 호출자가 user null 을 처리해야 하므로 여기서는 로그인으로 보낸다
      redirect("/login");
    }
    redirect("/login");
  }
  return { user, state };
}

/**
 * 서버 컴포넌트용: 온보딩 완료 + verify_level ≥ minLevel. 실패 시 서버 리다이렉트.
 * minLevel 1 = /me·/settings 류, 2 = /home·/reco·/chat 류, 3 = 데이팅 전용 화면.
 */
export async function requireProfile(minLevel: VerifyLevel = 1): Promise<{ user: User; state: GateState; profile: ProfileRow }> {
  const { user } = await getSession();
  const state = user ? await getGateState() : null;
  const result = checkActionAccess(state, minLevel);
  if (!result.allow) redirect(result.redirectTo);
  const profile = await getProfile();
  if (!user || !state || !profile) redirect("/login");
  return { user, state, profile };
}

export type ActionContext = {
  supabase: ServerSupabase;
  user: User;
  state: GateState;
  profileId: string;
};

/**
 * 서버 액션용: redirect 대신 AuthError 를 던진다(액션은 ActionResult 로 변환).
 * 온보딩 중인 사용자가 호출하는 액션은 `allowOnboarding: true` 로 게이트 ⑤-b 를 건너뛴다(대신 세션·상태만 확인).
 */
export async function requireProfileForAction(
  minLevel: VerifyLevel = 1,
  opts: { allowOnboarding?: boolean } = {},
): Promise<ActionContext> {
  const { supabase, user } = await getSession();
  if (!user) throw new AuthError("NOT_AUTHENTICATED", undefined, { redirectTo: "/login" });
  const state = await getGateState();
  if (!state) throw new AuthError("NOT_AUTHENTICATED", undefined, { redirectTo: "/login" });

  if (opts.allowOnboarding) {
    // 온보딩 액션: ①~④ 만 검사 (age_blocked/banned/deleting 은 어떤 액션도 불가)
    const pre = evaluateGate(state, { kind: "onboarding", step: "basic" });
    if (!pre.allow && pre.code !== "ONBOARDING_INCOMPLETE" && pre.code !== "REDIRECT") {
      throw new AuthError(pre.code === "FORBIDDEN" ? "FORBIDDEN" : pre.code, undefined, { redirectTo: pre.redirectTo });
    }
  } else {
    const result = checkActionAccess(state, minLevel);
    if (!result.allow) {
      const code = result.code === "REDIRECT" || result.code === "FORBIDDEN" ? "NOT_ENTITLED" : result.code;
      throw new AuthError(code, undefined, { redirectTo: result.redirectTo });
    }
  }
  if (!state.profileId) throw new AuthError("ONBOARDING_INCOMPLETE", undefined, { redirectTo: "/onboarding/age" });
  return { supabase, user, state, profileId: state.profileId };
}

/** (admin) 전용: app_role() admin/moderator. 아니면 404 */
export async function requireAdmin(role: "moderator" | "admin" = "moderator"): Promise<{ user: User; state: GateState }> {
  const { user } = await getSession();
  const state = user ? await getGateState() : null;
  const result = evaluateGate(state, { kind: "admin" });
  if (!result.allow || !user || !state) redirect("/404");
  if (role === "admin" && state.role !== "admin") redirect("/404");
  return { user, state };
}
