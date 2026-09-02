import "server-only";

/**
 * env/server — 서버 전용 env (service role 키·솔트·인증 공급자 키). `server-only` 로 클라이언트 번들 유입 시 빌드가 실패한다.
 *
 * - 클라이언트 컴포넌트·"use client" 경로에서 import 금지. NEXT_PUBLIC_* 는 `@/lib/env/public` 을 쓴다.
 * - `serverEnv()` 는 lazy 검증(호출 시점). 빌드 시 env 가 없어도 import 자체는 실패하지 않는다.
 * - 이 파일의 키 **이름**조차 클라이언트 청크에 남지 않도록 분리했다(G3 관찰 1 / G2 §G3-9 "= 0"). CI Bundle guard 가 grep 으로 고정.
 */
import { z } from "zod";
import { formatEnvIssues } from "./public";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** mock | portone (PRD §5.3 의 IDENTITY_PROVIDER 와 동일 의미. .env.example 키명 유지) */
  IDENTITY_VERIFIER: z.enum(["mock", "portone"]).default("mock"),
  /** 프로덕션 mock 통과 목록: 휴대폰 E.164(+ 없이 숫자만, 예 821012345678) 의 sha256 hex, 쉼표 구분 */
  IDENTITY_MOCK_ALLOWLIST: optionalString,
  /** sha256(CI + salt). 32바이트 이상 무작위. 바뀌면 기존 ci_hash 와 매칭 불가 → 절대 회전 금지 */
  IDENTITY_CI_SALT: optionalString,
  /** profiles.phone_hash = sha256(E.164 + salt). IDENTITY_CI_SALT 와 분리(D1 §7 권고) */
  PHONE_HASH_SALT: optionalString,
  /** consents.ip_hash / ua_hash 솔트 */
  CONSENT_HASH_SALT: optionalString,
  /** 미들웨어 게이트 캐시 쿠키 HMAC 키. 없으면 SUPABASE_SERVICE_ROLE_KEY 로 대체 */
  AUTH_GATE_SECRET: optionalString,
  PORTONE_API_KEY: optionalString,
  PORTONE_API_SECRET: optionalString,
  PORTONE_WEBHOOK_SECRET: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let serverCache: ServerEnv | null = null;

/** 서버 전용. 클라이언트 번들에서 호출되면 값이 undefined 라 검증 실패로 즉시 드러난다(그 전에 server-only 가 빌드를 막는다) */
export function serverEnv(): ServerEnv {
  if (serverCache) return serverCache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(formatEnvIssues("[env] server env invalid", parsed.error));
  serverCache = parsed.data;
  return serverCache;
}

/** 게이트 캐시 서명 키 (미들웨어 전용). 없으면 캐시 비활성 */
export function gateCacheSecret(): string | undefined {
  const explicit = process.env.AUTH_GATE_SECRET?.trim();
  if (explicit) return explicit;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return fallback && fallback.length > 0 ? fallback : undefined;
}
