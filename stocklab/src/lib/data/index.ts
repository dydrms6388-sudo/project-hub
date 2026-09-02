import type { DataSource } from "./source";
import { sampleSource } from "./sample";
import { createSupabaseSource } from "./supabase";

let cached: DataSource | null = null;

/** env 가 있으면 Supabase, 없으면 샘플 데이터. 페이지는 `source.mode` 로 배너를 판단한다. */
export function getDataSource(): DataSource {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    cached = createSupabaseSource(url, anon, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    cached = sampleSource;
  }
  return cached;
}

export type { DataSource } from "./source";
