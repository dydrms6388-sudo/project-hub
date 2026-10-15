import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from './env.js';

let client: SupabaseClient | null = null;

/** service_role 클라이언트 (서버 전용). 없으면 예외. */
export function supabase(): SupabaseClient {
  if (!hasSupabase()) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정');
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
