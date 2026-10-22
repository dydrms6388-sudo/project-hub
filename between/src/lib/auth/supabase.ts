import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/server/env";

/** 요청 쿠키 기반 Supabase 클라이언트 (Anonymous Auth 세션) */
export async function supabaseServer(): Promise<SupabaseClient> {
  const e = env();
  const store = await cookies();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Component 렌더 중에는 쿠키를 쓸 수 없다 — proxy.ts 가 세션을 갱신한다
        }
      },
    },
  });
}

/** service role 클라이언트 — 서버 전용 (Storage 업로드/삭제, 계정 삭제) */
export function supabaseAdmin(): SupabaseClient {
  const e = env();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
