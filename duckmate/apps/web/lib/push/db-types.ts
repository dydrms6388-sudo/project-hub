/**
 * 0050/0051 이 추가한 테이블·RPC 의 타입 확장. `packages/db/src/types.ts` 는 D1 소유라 직접 손대지 않고
 * 여기서 `Database` 를 확장해 캐스팅한다(병합 요청: 20_notifications.md §6 — 반영되면 이 파일은 삭제).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json } from "@duckmate/db";

type InsertOf<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
type TableDef<Row, Optional extends keyof Row> = { Row: Row; Insert: InsertOf<Row, Optional>; Update: Partial<Row>; Relationships: [] };

export type PushQueueStatus = "pending" | "held" | "sending" | "sent" | "failed" | "discarded";

export type PushPrefsRow = {
  user_id: string;
  service_enabled: boolean;
  /** "HH:MM:SS" (Postgres time) · KST */
  quiet_start: string | null;
  quiet_end: string | null;
  updated_at: string;
};

export type PushTemplateRow = {
  key: string;
  kind: Enums["push_kind"];
  slot: Enums["push_slot"];
  consumes_budget: boolean;
  bundle_minutes: number;
  hold_at_night: boolean;
  priority_rank: number | null;
  deeplink: string;
  description: string | null;
};

export type PushQueueRow = {
  id: number;
  user_id: string;
  profile_id: string | null;
  template: string;
  kind: Enums["push_kind"];
  slot: Enums["push_slot"];
  params: Json;
  dedupe_key: string;
  merged_count: number;
  scheduled_at: string;
  status: PushQueueStatus;
  hold_reason: string | null;
  discard_reason: string | null;
  attempts: number;
  last_error: string | null;
  like_id: string | null;
  notification_log_id: number | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export type ConsentRecheckRow = {
  id: number;
  user_id: string;
  consent_id: number;
  notified_at: string | null;
  due_at: string;
  resolved_at: string | null;
  outcome: "renewed" | "withdrawn" | "expired" | null;
  created_at: string;
};

/** can_send_push / notify_profile 반환 */
export type PushDecisionJson = {
  allowed?: boolean;
  action: "send" | "hold" | "discard";
  reason: string;
  release_at?: string;
  budget_used?: number;
  budget_limit?: number;
};
export type NotifyProfileResult = PushDecisionJson & { queued: boolean; queue_id?: number; merged?: boolean; merged_count?: number; scheduled_at?: string };

type P = Database["public"];

export type PushDatabase = Omit<Database, "public"> & {
  public: Omit<P, "Tables" | "Functions"> & {
    Tables: P["Tables"] & {
      push_prefs: TableDef<PushPrefsRow, "service_enabled" | "quiet_start" | "quiet_end" | "updated_at">;
      push_templates: TableDef<PushTemplateRow, "bundle_minutes" | "hold_at_night" | "priority_rank" | "description">;
      push_queue: TableDef<PushQueueRow, "id" | "profile_id" | "params" | "merged_count" | "scheduled_at" | "status" | "hold_reason" | "discard_reason" | "attempts" | "last_error" | "like_id" | "notification_log_id" | "created_at" | "updated_at" | "sent_at">;
      consent_rechecks: TableDef<ConsentRecheckRow, "id" | "notified_at" | "resolved_at" | "outcome" | "created_at">;
    };
    Functions: P["Functions"] & {
      has_marketing_consent: { Args: { p_user_id: string }; Returns: boolean };
      mark_push_opened: { Args: { p_queue_id: number }; Returns: number };
      /** service role 전용 */
      can_send_push: { Args: { p_profile_id: string; p_kind: Enums["push_kind"]; p_template?: string | null; p_at?: string }; Returns: Json };
      /** service role 전용 */
      notify_profile: { Args: { p_profile_id: string; p_template_key: string; p_params?: Json }; Returns: Json };
      /** service role 전용 */
      notify_admin_push: { Args: { p_kind: string; p_payload?: Json; p_source_id?: number | null }; Returns: number };
    };
  };
};

export type PushSupabase = SupabaseClient<PushDatabase>;

/** 기존 클라이언트(사용자/admin)를 확장 스키마로 캐스팅 */
export function withPushSchema(client: SupabaseClient<Database>): PushSupabase {
  return client as unknown as PushSupabase;
}
