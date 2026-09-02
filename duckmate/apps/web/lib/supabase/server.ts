/**
 * 서버 컴포넌트 / 서버 액션 / 라우트 핸들러용 Supabase 클라이언트 (@supabase/ssr).
 * - 세션은 쿠키에서 읽는다. 사용자 권한(RLS 적용) 클라이언트.
 * - 서버 컴포넌트에서는 쿠키 쓰기가 불가하므로 setAll 실패를 무시한다(미들웨어가 리프레시 담당).
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@duckmate/db";
import { publicEnv } from "@/lib/env";

export type ServerSupabase = SupabaseClient<Database>;

export async function createClient(): Promise<ServerSupabase> {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서 호출된 경우: 미들웨어가 세션 리프레시를 담당하므로 무시
        }
      },
    },
  });
}
