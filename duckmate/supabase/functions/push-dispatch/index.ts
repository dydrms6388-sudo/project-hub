/**
 * push-dispatch — 큐 소비자 (pg_cron */5 → invoke_push_dispatch() → pg_net → 여기).
 *   POST (x-webhook-secret = PUSH_DISPATCH_SECRET 또는 Bearer service role)
 *   claim_push_queue(50) 를 시간 예산(~20s) 안에서 반복. 재시도는 SQL finish_push_queue(3회, 5/10분 백오프).
 * 로컬: supabase functions serve push-dispatch --env-file ./supabase/.env.local 후
 *       curl -X POST http://localhost:54321/functions/v1/push-dispatch -H "x-webhook-secret: $PUSH_DISPATCH_SECRET"
 */
import { json, preflight } from "../_shared/cors.ts";
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { dispatchQueue, type DispatchStats } from "../push-send/lib/send.ts";

const TIME_BUDGET_MS = 20_000;
const BATCH = 50;

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!isTrustedCaller(req, "PUSH_DISPATCH_SECRET")) return json({ error: "unauthorized" }, 401);

  const started = Date.now();
  const admin = adminClient();
  const total: DispatchStats & { rounds: number } = { claimed: 0, sent: 0, failed: 0, discarded: 0, errors: [], rounds: 0 };
  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const s = await dispatchQueue(admin, { limit: BATCH });
      total.rounds += 1;
      total.claimed += s.claimed;
      total.sent += s.sent;
      total.failed += s.failed;
      total.discarded += s.discarded;
      total.errors.push(...s.errors);
      if (s.claimed < BATCH || s.errors.some((e) => e.startsWith("claim:"))) break;
    }
  } catch (e) {
    total.errors.push(`fatal:${(e as Error).message}`);
    return json({ ...total, ms: Date.now() - started }, 500);
  }
  return json({ ...total, ms: Date.now() - started });
});
