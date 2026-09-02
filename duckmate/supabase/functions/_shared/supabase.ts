/**
 * Edge Function 용 service role 클라이언트. 키는 Supabase 가 함수 런타임에 자동 주입하는
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 만 읽는다(PRD §0-48: Edge Function 은 secrets 에서만).
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export type AdminClient = SupabaseClient;

let cached: AdminClient | null = null;

export function adminClient(): AdminClient {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/**
 * 호출자 인증: (a) Authorization: Bearer <service role key> (서버 액션 functions.invoke)
 *            (b) x-webhook-secret 헤더 = 지정 env (Storage/DB 웹훅)
 * 둘 다 아니면 false. anon 키·사용자 JWT 로는 실행 불가.
 */
export function isTrustedCaller(req: Request, webhookSecretEnv: string): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true;
  const secret = Deno.env.get(webhookSecretEnv);
  const given = req.headers.get("x-webhook-secret");
  return Boolean(secret && given && secret === given);
}
