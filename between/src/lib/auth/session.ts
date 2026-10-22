import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Claims } from "@/lib/server/db";
import { AuthError } from "@/lib/server/errors";
import { env } from "@/lib/server/env";
import {
  createLocalAnonymousUser,
  deleteLocalUser,
  LOCAL_COOKIE,
  lookupLocalUser,
  SESSION_TTL_SECONDS,
  signLocalSession,
  verifyLocalSession,
} from "./local";
import { supabaseAdmin, supabaseServer } from "./supabase";

// 세션 = "누구인가" 의 유일한 근거. 서버에서 서명/토큰을 검증해 얻은 사용자 ID 만 신뢰한다.
// (기기 ID, localStorage, 폼 hidden 값 등 클라이언트가 보낸 식별자는 권한 판단에 쓰지 않는다.)

export type Session = { userId: string; isAnonymous: boolean; claims: Claims };

function toSession(userId: string, isAnonymous: boolean): Session {
  return { userId, isAnonymous, claims: { sub: userId, role: "authenticated", is_anonymous: isAnonymous } };
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return toSession(data.user.id, data.user.is_anonymous ?? false);
  }
  const token = (await cookies()).get(LOCAL_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifyLocalSession(token);
  if (!userId) return null;
  const user = await lookupLocalUser(userId);
  return user ? toSession(userId, user.isAnonymous) : null;
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError();
  return s;
}

export async function setLocalSessionCookie(userId: string) {
  (await cookies()).set(LOCAL_COOKIE, await signLocalSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** 익명 세션 시작 (Server Action / Route Handler 에서만 호출) */
export async function startAnonymousSession(): Promise<Session> {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) throw new AuthError("익명 세션을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    return toSession(data.user.id, true);
  }
  const userId = await createLocalAnonymousUser();
  await setLocalSessionCookie(userId);
  return toSession(userId, true);
}

export async function endSession() {
  if (env().AUTH_PROVIDER === "supabase") {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    return;
  }
  (await cookies()).delete(LOCAL_COOKIE);
}

/** 계정 완전 삭제: auth 사용자 삭제 → FK cascade 로 모든 개인 데이터 삭제 */
export async function deleteAuthUser(userId: string) {
  if (env().AUTH_PROVIDER === "supabase") {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) throw error;
  } else {
    await deleteLocalUser(userId);
  }
}
