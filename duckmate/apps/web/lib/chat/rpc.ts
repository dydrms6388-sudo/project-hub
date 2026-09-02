/**
 * D4 RPC 호출 헬퍼 — `Database.Functions` 에 D4 함수 타입이 병합되기 전까지 이름/인자를 느슨하게 넘긴다.
 * (병합 후에는 `supabase.rpc("send_message", …)` 로 교체하고 이 파일을 지운다.)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@duckmate/db";

export type ChatRpcName = "send_message" | "mark_read" | "leave_match" | "get_chat_list" | "get_report_context" | "can_send_chat_image" | "contact_unmasked";

type AnyRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string; details?: string } | null }>;

export async function callRpc<T>(client: SupabaseClient<Database>, fn: ChatRpcName, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (client.rpc as unknown as AnyRpc)(fn, args);
  if (error) throw error;
  return data as T;
}
