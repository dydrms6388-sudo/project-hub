"use client";

/**
 * 브라우저 Supabase 클라이언트 (@supabase/ssr 표준 패턴). anon 키만 사용.
 * 클라이언트 컴포넌트에서 `createClient()` 로 생성. 싱글턴 캐시.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@duckmate/db";
import { publicEnv } from "@/lib/env";

export type BrowserSupabase = SupabaseClient<Database>;

let cached: BrowserSupabase | null = null;

export function createClient(): BrowserSupabase {
  if (cached) return cached;
  const env = publicEnv();
  cached = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return cached;
}
