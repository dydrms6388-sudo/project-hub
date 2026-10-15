/**
 * phase1.spec 전용 DB 테스트 헬퍼 — service role 키는 **env(SUPABASE_SERVICE_ROLE_KEY) 로만** 받는다. 코드·문서에 값 금지.
 * 용도: (1) 재실행을 위한 E2E 계정 정리, (2) A↔B 가 서로의 오늘 추천에 포함되도록 daily_recommendations 보강,
 *       (3) 결과 검증(matches/blocks 행). 프로덕션 URL 에는 절대 쓰지 않는다(호출부가 E2E_SUPABASE=1 로 게이트).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AdminDb = SupabaseClient;

export function adminDb(): AdminDb {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요해요 (env 로만 전달)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** KST 07:00 경계 loop_date (public.loop_date(now()) 와 동일 규칙) */
export function loopDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + 9 * 3600_000 - 7 * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

/** auth.users 에서 휴대폰(E.164 숫자)으로 사용자 찾기 (admin listUsers 페이지네이션) */
export async function findUserIdByPhone(db: AdminDb, phoneE164: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.phone ?? "").replace(/^\+/, "") === phoneE164);
    if (hit) return hit.id;
    if (data.users.length < 500) break;
  }
  return null;
}

export async function findProfileIdByPhone(db: AdminDb, phoneE164: string): Promise<string | null> {
  const userId = await findUserIdByPhone(db, phoneE164);
  if (!userId) return null;
  const { data, error } = await db.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** 재실행 대비: E2E 번호의 auth.users 삭제 (profiles 등은 cascade). 없으면 no-op */
export async function deleteUsersByPhone(db: AdminDb, phones: string[]): Promise<number> {
  let n = 0;
  for (const phone of phones) {
    const id = await findUserIdByPhone(db, phone);
    if (!id) continue;
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw error;
    n += 1;
  }
  return n;
}

/** A↔B 가 서로의 오늘 추천에 포함되도록 보강 (ensure_today_recommendations 가 이미 넣었으면 유지) */
export async function ensureMutualRecommendation(db: AdminDb, aId: string, bId: string): Promise<void> {
  const ld = loopDate();
  const reasons = [{ kind: "hobby_overlap", hobbies: ["idol"], label: "공통 취미: 아이돌" }];
  const rows = [
    { profile_id: aId, target_id: bId, loop_date: ld, position: 1, score: 0.81, reasons },
    { profile_id: bId, target_id: aId, loop_date: ld, position: 1, score: 0.81, reasons },
  ];
  const { error } = await db.from("daily_recommendations").upsert(rows, { onConflict: "profile_id,target_id,loop_date", ignoreDuplicates: true });
  if (error) throw error;
}

export async function matchBetween(db: AdminDb, aId: string, bId: string): Promise<{ id: string; status: string } | null> {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  const { data, error } = await db.from("matches").select("id,status").eq("a_id", lo).eq("b_id", hi).maybeSingle();
  if (error) throw error;
  return (data as { id: string; status: string } | null) ?? null;
}

export async function blockCount(db: AdminDb, blockerId: string): Promise<number> {
  const { count, error } = await db.from("blocks").select("*", { count: "exact", head: true }).eq("blocker_id", blockerId);
  if (error) throw error;
  return count ?? 0;
}
