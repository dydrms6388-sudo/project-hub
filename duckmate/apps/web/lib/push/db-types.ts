/**
 * (레거시 shim) 0050/0051 테이블·RPC 타입은 `packages/db/src/types.ts` 로 병합됐다(H1 — 20_notifications §6 병합 요청 처리).
 *
 * `withPushSchema()` 는 이제 아무 캐스팅도 하지 않는 항등 함수이고, Row 타입은 `@duckmate/db` 재수출이다.
 * 남은 이유는 `app/api/push/opened/route.ts` 가 아직 이 모듈을 import 하기 때문 — 그 import 가 정리되면 파일째 삭제한다(H2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json } from "@duckmate/db";

export type { AdminNotificationRow, ConsentRecheckRow, PushPrefsRow, PushQueueRow, PushTemplateRow } from "@duckmate/db";

export type PushQueueStatus = Enums["push_queue_status"];
export type PushSupabase = SupabaseClient<Database>;

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

/** @deprecated 확장 캐스팅이 필요 없다 — 클라이언트를 그대로 쓴다 */
export function withPushSchema(client: SupabaseClient<Database>): PushSupabase {
  return client;
}

export type { Json };
