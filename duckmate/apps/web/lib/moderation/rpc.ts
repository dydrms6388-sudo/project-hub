/**
 * Database 타입에 아직 없는 D5 RPC 호출 헬퍼. packages/db/src/types.ts 에 ModerationFunctions 가 병합되면
 * `client.rpc(name, args)` 직접 호출로 교체하고 이 파일은 삭제한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModerationFunctionName, ModerationFunctions } from "./types";

type AnyClient = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type RpcArgs<N extends ModerationFunctionName> = ModerationFunctions[N]["Args"];
type RpcReturn<N extends ModerationFunctionName> = ModerationFunctions[N]["Returns"];

export async function moderationRpc<N extends ModerationFunctionName>(client: AnyClient, name: N, args: RpcArgs<N>): Promise<RpcReturn<N>> {
  const untyped = client as unknown as { rpc: (fn: string, params?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
  const { data, error } = await untyped.rpc(name, args as Record<string, unknown>);
  if (error) throw error;
  return data as RpcReturn<N>;
}
