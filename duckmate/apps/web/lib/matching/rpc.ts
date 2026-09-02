/**
 * D3 RPC 반환 타입 (jsonb 를 돌려주는 함수의 payload 모양).
 * 호출은 `supabase.rpc("...")` 로 직접 한다 — 함수 이름·인자는 `Database["public"]["Functions"]`(0071/H1 반영)가 검사한다.
 */
import type { Enums, FirstSuggestion } from "@duckmate/db";

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
