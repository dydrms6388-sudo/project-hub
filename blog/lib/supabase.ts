// supabase.ts — 서버 전용 Supabase 클라이언트.
// - 읽기(목록/상세/사이트맵): anon 키. RLS 의 public read 정책으로 조회.
// - 쓰기(크론 발행): service_role 키. RLS 우회하여 insert.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

// 공개 읽기용 (anon). 서버 컴포넌트에서 사용.
export function getSupabase(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", url),
    required("SUPABASE_ANON_KEY", anonKey),
    { auth: { persistSession: false } }
  );
}

// 발행 쓰기용 (service_role). 크론 라우트에서만 사용.
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL", url),
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false } }
  );
}

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  html: string;
  excerpt: string | null;
  tags: string[] | null;
  tool_slug: string | null;
  keyword: string | null;
  published_at: string;
  created_at: string;
}
