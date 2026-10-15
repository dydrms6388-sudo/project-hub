/**
 * daily-recommendations — 일일 추천 배치 (D3 · F-014)
 *
 * 정식 스케줄은 pg_cron(0021: 21:50 UTC = 06:50 KST → `run_daily_recommendation_batch(null, null, 0)`).
 * 이 함수는 (a) 운영자 수동 재실행 / 재시도, (b) pg_cron 을 못 쓰는 환경에서 외부 스케줄러(Supabase cron→HTTP, GitHub Actions 등)가
 * 호출하는 HTTP 진입점이다. 페이지(batch_size) 단위로 RPC 를 반복 호출하고, 페이지 실패 시 지수 백오프로 재시도한다.
 * RPC 자체가 프로필별 예외 격리 + 멱등(같은 loop_date 는 skip)이므로 몇 번을 다시 돌려도 안전하다.
 *
 * 인증: Authorization: Bearer <service role> 또는 x-webhook-secret = DAILY_RECO_WEBHOOK_SECRET
 * 입력(JSON, 전부 선택): { loop_date?: "YYYY-MM-DD", batch_size?: number (기본 200), max_batches?: number (기본 500), start_offset?: number }
 * 출력: { ok, loop_date, batches, processed, generated, skipped, failed, total, done, errors[] }
 */
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";

type BatchResult = {
  loop_date: string;
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  total: number;
  next_offset: number;
  done: boolean;
  errors: Array<{ profile_id: string; error: string }>;
};

const DEFAULT_BATCH = 200;
const DEFAULT_MAX_BATCHES = 500;
const RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runBatch(loopDate: string | null, batchSize: number, offset: number): Promise<BatchResult> {
  const supabase = adminClient();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const { data, error } = await supabase.rpc("run_daily_recommendation_batch", {
      p_loop_date: loopDate,
      p_batch_size: batchSize,
      p_offset: offset,
    });
    if (!error) return data as BatchResult;
    lastErr = error;
    console.error(`[daily-recommendations] batch offset=${offset} attempt=${attempt + 1} failed: ${error.message}`);
    await sleep(500 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String((lastErr as { message?: string })?.message ?? lastErr));
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isTrustedCaller(req, "DAILY_RECO_WEBHOOK_SECRET")) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const loopDate = typeof body.loop_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.loop_date) ? body.loop_date : null;
  const batchSize = Math.min(1000, Math.max(1, Number(body.batch_size ?? DEFAULT_BATCH) || DEFAULT_BATCH));
  const maxBatches = Math.max(1, Number(body.max_batches ?? DEFAULT_MAX_BATCHES) || DEFAULT_MAX_BATCHES);
  let offset = Math.max(0, Number(body.start_offset ?? 0) || 0);

  const totals = { batches: 0, processed: 0, generated: 0, skipped: 0, failed: 0, total: 0, done: false, loop_date: loopDate ?? "" };
  const errors: Array<{ profile_id: string; error: string }> = [];
  const startedAt = Date.now();

  try {
    while (totals.batches < maxBatches) {
      const r = await runBatch(loopDate, batchSize, offset);
      totals.batches += 1;
      totals.processed += r.processed;
      totals.generated += r.generated;
      totals.skipped += r.skipped;
      totals.failed += r.failed;
      totals.total = r.total;
      totals.loop_date = r.loop_date;
      for (const e of r.errors ?? []) if (errors.length < 50) errors.push(e);
      offset = r.next_offset;
      if (r.done || r.processed === 0) {
        totals.done = true;
        break;
      }
    }
  } catch (e) {
    console.error("[daily-recommendations] aborted", e instanceof Error ? e.message : e);
    return json({ ok: false, ...totals, next_offset: offset, errors, duration_ms: Date.now() - startedAt, error: e instanceof Error ? e.message : String(e) }, 500);
  }

  console.log(`[daily-recommendations] loop_date=${totals.loop_date} processed=${totals.processed} generated=${totals.generated} skipped=${totals.skipped} failed=${totals.failed} done=${totals.done}`);
  return json({ ok: true, ...totals, next_offset: offset, errors, duration_ms: Date.now() - startedAt });
});
