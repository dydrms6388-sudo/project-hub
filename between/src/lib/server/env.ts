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
  })
  .superRefine((e, ctx) => {
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
