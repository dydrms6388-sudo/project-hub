/**
 * D3 RPC 호출 헬퍼 + 반환 타입.
 * `packages/db/src/types.ts` 는 D3 경로가 아니므로 Functions 타입을 여기서 로컬 선언한다
 * (오케스트레이터 병합 요청: 16_matching §7 의 블록을 Database["public"]["Functions"] 에 추가하면 이 파일의 캐스팅을 제거할 수 있다).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, FirstSuggestion } from "@duckmate/db";
import type { SuggestionInputJson } from "./suggestions";

export type MatchingRpcName =
  | "ensure_today_recommendations"
  | "act_on_recommendation"
  | "undo_last_action"
  | "likers_count"
  | "pending_likes_count"
  | "matching_home_summary"
  | "superlike_status"
  | "match_suggestion_input"
  | "set_match_first_suggestion"
  | "run_daily_recommendation_batch"
  | "generate_daily_recommendations";

export type RecoAction = Enums["reco_action"];

export type EnsureTodayResult = {
  generated: boolean;
  skipped: boolean;
  loop_date: string;
  count: number;
  limit?: number;
  candidates?: number;
  liker_count?: number;
  pool_size?: number;
  nationwide?: boolean;
  gender_balance_applied?: boolean;
  reason?: string;
};

export type SuperlikeStatus = {
  tier: Enums["subscription_tier"];
  weekly_quota: number;
  weekly_used: number;
  weekly_remaining: number;
  daily_cap: number;
  used_today: number;
  week_start: string;
  resets_at: string;
};

export type ActResult = {
  action: RecoAction;
  reco_id: string;
  loop_date: string;
  already: boolean;
  matched: boolean;
  match_id: string | null;
  like_id?: string | null;
  existing_match_status?: Enums["match_status"] | null;
  suggestion_input?: SuggestionInputJson | null;
  superlike?: SuperlikeStatus | null;
};

export type UndoResult = { reco_id: string; target_id: string; previous_action: RecoAction; loop_date: string };

export type HomeSummary = {
  loop_date: string;
  reco_total: number;
  reco_remaining: number;
  pending_results: number;
  matches_today: number;
  likers_count: number;
  superlike: SuperlikeStatus;
};

export type SetFirstSuggestionResult = { set: boolean; first_suggestion: FirstSuggestion[] };

export type BatchResult = {
  loop_date: string;
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  total: number;
  next_offset: number;
  done: boolean;
  errors: Array<{ profile_id: string; error: string }>;
};

type LooseRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string; details?: string } | null }>;
};

/** 타입 미등록 RPC 호출. 에러는 그대로 throw (호출자가 toActionFailure 로 매핑) */
export async function callRpc<T>(client: SupabaseClient<Database>, fn: MatchingRpcName, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (client as unknown as LooseRpc).rpc(fn, args);
  if (error) throw error;
  return data as T;
}
