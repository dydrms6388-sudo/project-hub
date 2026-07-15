import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Supabase 환경변수 존재 여부. 미설정이면 앱은 로컬 시드로 렌더하고 통계는 "집계 중". */
export function hasSupabase(): boolean {
  return Boolean(URL && ANON);
}

/** 익명(anon) 권한 서버 클라이언트. RLS가 적용된다. */
export async function getServerSupabase() {
  if (!URL || !ANON) return null;
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          list.forEach(({ name, value, options }) =>
            store.set(name, value, options as Parameters<typeof store.set>[2]),
          );
        } catch {
          /* Server Component 컨텍스트에서는 무시 */
        }
      },
    },
  });
}

/**
 * 쿠키 없는 anon 클라이언트 — 공개 읽기 전용(is_indexed 등). sitemap 등 쿠키 컨텍스트가
 * 없는 곳에서 사용. RLS는 그대로 적용된다(승인분만 조회).
 */
export function getAnonSupabase() {
  if (!URL || !ANON) return null;
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

/**
 * 서비스롤 클라이언트 — 서버 전용 특권 작업(모더레이션, 짧은링크 생성, 승인 등).
 * RLS를 우회하므로 절대 클라이언트로 노출 금지. env 없으면 null.
 */
export function getAdminSupabase() {
  if (!URL || !SERVICE) return null;
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
