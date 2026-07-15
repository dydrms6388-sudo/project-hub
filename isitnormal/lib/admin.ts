import { cookies } from "next/headers";

export const ADMIN_COOKIE = "isn_admin";

/** 서버 전용 관리자 인증. ADMIN_TOKEN 미설정이면 항상 false(관리 UI 비활성). */
export async function isAdmin(): Promise<boolean> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === token;
}
