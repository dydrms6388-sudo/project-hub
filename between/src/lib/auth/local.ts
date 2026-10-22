import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { withService } from "@/lib/server/db";
import { env } from "@/lib/server/env";

// 로컬 인증 드라이버 (개발/테스트용). Supabase Anonymous Auth 와 같은 모델:
//  - 익명 사용자 = auth.users 행 (is_anonymous=true)
//  - 세션 = 서버가 서명한 JWT(HS256), httpOnly·SameSite=Lax 쿠키
//  - 매 요청 서명 검증 + auth.users 존재 확인 (삭제/정지 계정의 토큰 무효화)

export const LOCAL_COOKIE = "btw_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;

function key() {
  return new TextEncoder().encode(env().LOCAL_JWT_SECRET);
}

export async function signLocalSession(userId: string): Promise<string> {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuer("between-local")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifyLocalSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: "authenticated",
      issuer: "between-local",
    });
    return typeof payload.sub === "string" && /^[0-9a-f-]{36}$/.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function lookupLocalUser(userId: string): Promise<{ isAnonymous: boolean } | null> {
  return withService(async (db) => {
    const r = await db.query<{ is_anonymous: boolean }>("select is_anonymous from auth.users where id = $1", [userId]);
    return r.rows[0] ? { isAnonymous: r.rows[0].is_anonymous } : null;
  });
}

export async function createLocalAnonymousUser(): Promise<string> {
  return withService(async (db) => {
    const r = await db.query<{ id: string }>(
      "insert into auth.users (is_anonymous, last_sign_in_at) values (true, now()) returning id",
    );
    return r.rows[0].id;
  });
}

export async function deleteLocalUser(userId: string): Promise<void> {
  await withService((db) => db.query("delete from auth.users where id = $1", [userId]));
}

// ---------------------------------------------------------------------------
// 복구 코드: 160bit 랜덤, 사용자에게 한 번만 보여주고 sha-256 해시만 저장
// ---------------------------------------------------------------------------
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 문자(0,O,1,I) 제외

export function generateRecoveryCode(): string {
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) out += ALPHABET[bytes[i] % 32];
  return out.match(/.{5}/g)!.join("-");
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(`between-recovery:${normalized}`).digest("hex");
}

export async function saveRecoveryCode(userId: string, code: string): Promise<void> {
  await withService((db) =>
    db.query(
      `insert into public.account_recovery (user_id, code_hash) values ($1, $2)
       on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now()`,
      [userId, hashRecoveryCode(code)],
    ),
  );
}

export async function findUserByRecoveryCode(code: string): Promise<string | null> {
  return withService(async (db) => {
    const r = await db.query<{ user_id: string }>("select user_id from public.account_recovery where code_hash = $1", [
      hashRecoveryCode(code),
    ]);
    return r.rows[0]?.user_id ?? null;
  });
}
