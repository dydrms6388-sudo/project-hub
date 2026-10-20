import "server-only";
import pg from "pg";
import { env } from "./env";

// Postgres 접속 계층.
// 앱 접속 역할은 권한이 없고(noinherit), 트랜잭션마다 SET LOCAL ROLE 로 전환한다:
//   withUser    → role=authenticated + request.jwt.claims (PostgREST 와 동일) → RLS 그대로 적용
//   withService → role=service_role (RLS 우회) — 인증 생성·삭제·레이트리밋 등 서버 전용 작업에만 사용
// 따라서 Supabase 에 배포해도, 로컬 Postgres 에서 테스트해도 같은 정책이 같은 방식으로 평가된다.

export type Claims = { sub: string; role: "authenticated"; is_anonymous: boolean; aud?: string };
export type Db = Pick<pg.PoolClient, "query">;

declare global {
  var __betweenPool: pg.Pool | undefined;
}

function pool(): pg.Pool {
  if (!globalThis.__betweenPool) {
    const e = env();
    const url = new URL(e.DATABASE_URL);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    globalThis.__betweenPool = new pg.Pool({
      connectionString: e.DATABASE_URL,
      max: e.DATABASE_POOL_MAX,
      idleTimeoutMillis: 10_000,
      // 운영: DATABASE_SSL_CA(Supabase 대시보드의 CA 인증서 PEM)로 서버 인증서를 검증한다
      ssl: local
        ? undefined
        : e.DATABASE_SSL_CA
          ? { ca: e.DATABASE_SSL_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true }
          : { rejectUnauthorized: false },
      statement_timeout: 8_000,
    });
  }
  return globalThis.__betweenPool;
}

async function tx<T>(setup: (c: pg.PoolClient) => Promise<void>, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await setup(client);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export function withUser<T>(claims: Claims, fn: (db: Db) => Promise<T>): Promise<T> {
  return tx(async (c) => {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ aud: "authenticated", ...claims }),
    ]);
  }, fn);
}

export function withService<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return tx(async (c) => {
    await c.query("set local role service_role");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
  }, fn);
}

/** Postgres 에러 코드/메시지 → 앱 에러 식별 */
export function pgErrorCode(e: unknown): { code?: string; message: string } {
  if (e && typeof e === "object" && "message" in e) {
    return { code: (e as { code?: string }).code, message: String((e as { message: unknown }).message) };
  }
  return { message: String(e) };
}

export async function closePool() {
  await globalThis.__betweenPool?.end();
  globalThis.__betweenPool = undefined;
}
