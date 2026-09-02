/**
 * rpc() 응답 언래핑 헬퍼 (H1).
 *
 * 호출 자체는 항상 타입이 붙은 클라이언트로 한다 — `supabase.rpc("함수명", { … })` 의 이름·인자·반환은
 * `Database["public"]["Functions"]`(packages/db) 가 검사한다. 이 헬퍼는 `{ data, error }` 에서 error 를 throw 하고
 * jsonb payload 를 도메인 타입으로 좁히는 일만 한다(예전 `callRpc`/`moderationRpc` 처럼 클라이언트를 캐스팅하지 않는다).
 */
export type RpcLike = { data: unknown; error: { message: string; code?: string; details?: string | null } | null };

export async function unwrapRpc<T>(res: PromiseLike<RpcLike>): Promise<T> {
  const { data, error } = await res;
  if (error) throw error;
  return data as T;
}
