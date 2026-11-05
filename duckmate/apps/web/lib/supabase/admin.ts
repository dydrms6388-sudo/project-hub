import "server-only";

/**
 * service role 클라이언트 — RLS 우회. **서버 액션 / 라우트 핸들러 전용.**
 * - `server-only` import 로 클라이언트 번들에 포함되면 빌드가 실패한다.
 * - 사용처는 반드시 `requireProfileForAction()` 등으로 호출자 권한을 먼저 확인한 뒤,
 *   판정을 `audit_logs` 에 남긴다(§0-4). 이 클라이언트로 사용자 입력을 그대로 테이블에 쓰지 말 것.
 * - 세션을 저장하지 않는다(persistSession=false). 요청마다 새로 만들어도 무방(경량).
 */
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@duckmate/db";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

export type AdminSupabase = SupabaseClient<Database>;

let cached: AdminSupabase | null = null;

export function createAdminClient(): AdminSupabase {
  if (cached) return cached;
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  cached = createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-duckmate-client": "web-admin" } },
  });
  return cached;
}
