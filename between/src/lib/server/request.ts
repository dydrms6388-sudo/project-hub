import "server-only";
import { headers } from "next/headers";
import type { Db } from "./db";
import { withService } from "./db";
import { env } from "./env";
import { AppError, RateLimitError } from "./errors";

/** Route Handler 용 CSRF 방어: 상태 변경 요청은 동일 origin 에서만 (Server Action 은 Next 가 자체 검사) */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new AppError("잘못된 요청이에요.", 403);
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    throw new AppError("잘못된 요청이에요.", 403);
  }
  const allowed = new URL(env().APP_ORIGIN).host;
  if (o.host !== host && o.host !== allowed) throw new AppError("잘못된 요청이에요.", 403);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel 은 x-forwarded-for 의 첫 값을 클라이언트 IP 로 설정한다
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return ip.slice(0, 64);
}

/** 사용자 단위 rate limit (DB 함수가 키를 auth.uid() 로 강제) */
export async function limitUser(db: Db, bucket: string, limit: number, windowSeconds: number) {
  const r = await db.query<{ ok: boolean }>("select public.rate_limit_hit($1, $2, $3) as ok", [
    bucket,
    limit,
    windowSeconds,
  ]);
  if (!r.rows[0]?.ok) throw new RateLimitError();
}

/** 익명/사전 인증 단계용 IP 단위 rate limit */
export async function limitIp(bucket: string, limit: number, windowSeconds: number) {
  const ip = await clientIp();
  const ok = await withService(async (db) => {
    const r = await db.query<{ ok: boolean }>("select public.rate_limit_hit($1, $2, $3) as ok", [
      `ip:${ip}:${bucket}`,
      limit,
      windowSeconds,
    ]);
    return r.rows[0]?.ok;
  });
  if (!ok) throw new RateLimitError();
}
