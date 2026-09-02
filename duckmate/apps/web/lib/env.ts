/**
 * env — zod 검증 (.env.example 키 기준). 서버/클라이언트 분리.
 *
 * - 검증은 **lazy**(호출 시점). 빌드 시 env 가 없어도 import 자체는 실패하지 않는다.
 * - `serverEnv()` 는 서버 전용 값(service role 키·솔트)을 포함하므로 클라이언트 컴포넌트에서 import 금지.
 *   (lib/supabase/admin.ts 만 service role 을 읽고, 그 파일은 `server-only` 로 번들 차단)
 * - `publicEnv()` 는 NEXT_PUBLIC_* 만.
 */
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_COMPANY_URL: z.string().url().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
});

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

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

let publicCache: PublicEnv | null = null;
let serverCache: ServerEnv | null = null;

function formatIssues(prefix: string, error: z.ZodError): string {
  return `${prefix}: ${error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
}

/** NEXT_PUBLIC_* — Next 는 빌드 시 문자열 치환하므로 process.env.X 를 명시적으로 나열한다 */
export function publicEnv(): PublicEnv {
  if (publicCache) return publicCache;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_COMPANY_URL: process.env.NEXT_PUBLIC_COMPANY_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!parsed.success) throw new Error(formatIssues("[env] public env invalid", parsed.error));
  publicCache = parsed.data;
  return publicCache;
}

/** 서버 전용. 클라이언트 번들에서 호출되면 값이 undefined 라 검증 실패로 즉시 드러난다 */
export function serverEnv(): ServerEnv {
  if (serverCache) return serverCache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(formatIssues("[env] server env invalid", parsed.error));
  serverCache = parsed.data;
  return serverCache;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 게이트 캐시 서명 키 (미들웨어 전용). 없으면 캐시 비활성 */
export function gateCacheSecret(): string | undefined {
  const explicit = process.env.AUTH_GATE_SECRET?.trim();
  if (explicit) return explicit;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return fallback && fallback.length > 0 ? fallback : undefined;
}
