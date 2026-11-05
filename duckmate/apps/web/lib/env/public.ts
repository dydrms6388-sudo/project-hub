/**
 * env/public — 클라이언트 안전 env (NEXT_PUBLIC_* 만). H2 분리: G3 관찰 1(서버 스키마 키 이름이 클라이언트 청크에 포함) 해소.
 *
 * - `"use client"` 경로(lib/supabase/client.ts 등)는 **이 파일만** import 한다. 서버 전용 키 이름·스키마는 여기 없다.
 * - 검증은 lazy(호출 시점). Next 는 NEXT_PUBLIC_* 를 빌드 시 문자열 치환하므로 process.env.X 를 명시적으로 나열한다.
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

export type PublicEnv = z.infer<typeof publicSchema>;

let publicCache: PublicEnv | null = null;

export function formatEnvIssues(prefix: string, error: z.ZodError): string {
  return `${prefix}: ${error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
}

/** NEXT_PUBLIC_* — 클라이언트·서버 어디서든 호출 가능 */
export function publicEnv(): PublicEnv {
  if (publicCache) return publicCache;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_COMPANY_URL: process.env.NEXT_PUBLIC_COMPANY_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!parsed.success) throw new Error(formatEnvIssues("[env] public env invalid", parsed.error));
  publicCache = parsed.data;
  return publicCache;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
