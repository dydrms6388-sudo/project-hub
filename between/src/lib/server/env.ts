import "server-only";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_ORIGIN: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL 이 필요합니다."),
    DATABASE_SSL_CA: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    LOCAL_JWT_SECRET: z.string().optional(),
    STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    // IP 당 시간당 신규 익명 계정 생성 한도 (봇 방지). E2E 처럼 한 IP 에서 다수 계정을 만드는 환경에서만 상향
    START_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(10_000).default(8),
  })
  .superRefine((e, ctx) => {
    // local 드라이버(자체 서명 JWT·파일 저장소)는 개발/테스트 전용 — 공개 https 배포에서 실수로 쓰이지 않게 차단
    const publicOrigin =
      e.APP_ORIGIN.startsWith("https://") && !/^https:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(e.APP_ORIGIN);
    if (
      publicOrigin &&
      (e.AUTH_PROVIDER === "local" || e.STORAGE_PROVIDER === "local") &&
      process.env.ALLOW_LOCAL_DRIVERS !== "1"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_PROVIDER"],
        message: "공개 배포에서는 supabase 드라이버를 사용해야 합니다",
      });
    }
    if (e.AUTH_PROVIDER === "local" && (!e.LOCAL_JWT_SECRET || e.LOCAL_JWT_SECRET.length < 32)) {
      ctx.addIssue({ code: "custom", path: ["LOCAL_JWT_SECRET"], message: "32자 이상 필요" });
    }
    const needsSupabase = e.AUTH_PROVIDER === "supabase" || e.STORAGE_PROVIDER === "supabase";
    if (needsSupabase && (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Supabase URL/anon key 필요" });
    }
    if (e.STORAGE_PROVIDER === "supabase" && !e.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "Storage 서버 업로드에 필요" });
    }
  });

export type Env = z.output<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`환경변수 오류 — ${msg}`);
  }
  cached = parsed.data;
  return cached;
}
