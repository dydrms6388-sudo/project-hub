import "server-only";

/**
 * (admin) 2차 게이트 (D8). 미들웨어(1차, app_role() 캐시 60s)와 별도로 layout·서버 액션이 매번 DB 를 다시 본다.
 *
 *  - 세션: auth.getUser() (서버 검증) — lib/auth/session.getSession
 *  - 역할: 사용자 JWT 클라이언트로 `app_role()` RPC 호출 = JWT app_metadata.role 우선, 없으면 admin_users 조회(0009)
 *  - 페이지: 실패 시 notFound() → 진짜 404 (존재 비노출, 미들웨어 rewrite 와 동일 화면)
 *  - 액션: 실패 시 AuthError(FORBIDDEN) → ActionResult 로 변환
 *  - service role 클라이언트는 여기서만 만들어 AdminContext 로 넘긴다(호출자 검증 뒤에만 생성).
 */
import { cache } from "react";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/errors";
import { createAdminClient, type AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { isAdminRole, roleSatisfies } from "./permissions";
import type { AdminRole } from "./constants";

export type AdminContext = {
  user: User;
  role: AdminRole;
  /** 사용자 권한(RLS) 클라이언트 */
  supabase: ServerSupabase;
  /** service role — 호출자 검증 뒤에만 사용. 모든 판정은 audit_logs 로 */
  admin: AdminSupabase;
};

/** 요청당 1회: 세션 + app_role() DB 재조회. 관리자가 아니면 null */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data, error } = await supabase.rpc("app_role");
  if (error) {
    console.error("[admin] app_role failed", error.message);
    return null;
  }
  if (!isAdminRole(data)) return null;
  return { user, role: data, supabase, admin: createAdminClient() };
});

/** layout / page: 역할 미충족 → 404 */
export async function requireAdminPage(min: AdminRole = "moderator"): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx || !roleSatisfies(ctx.role, min)) notFound();
  return ctx;
}

/** 서버 액션: 역할 미충족 → FORBIDDEN (redirectTo 없음 — 어드민 화면은 404 로 응답하지 않고 메시지만) */
export async function requireAdminAction(min: AdminRole = "moderator"): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new AuthError("FORBIDDEN", "관리자 권한이 필요해요");
  if (!roleSatisfies(ctx.role, min)) throw new AuthError("FORBIDDEN", `이 작업은 ${min} 권한이 필요해요`);
  return ctx;
}
