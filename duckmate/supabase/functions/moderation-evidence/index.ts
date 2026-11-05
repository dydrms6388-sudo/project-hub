/**
 * moderation-evidence — 파일 작업 큐 처리 (D5 · A5 §5)
 *
 * 입력(둘 중 하나, 없으면 큐 드레인):
 *   (a) 서버/DB 웹훅: { report_id }  또는 { type:"INSERT", table:"reports", record:{ id } }  → 해당 신고의 evidence_copy 작업을 즉시 처리
 *   (b) cron(5분): {}                → claim_moderation_jobs(20) 로 pending 작업 처리
 * 인증: Authorization Bearer <service role> 또는 x-webhook-secret = MODERATION_WEBHOOK_SECRET
 *
 * 작업 종류(moderation_jobs.kind):
 *   evidence_copy   photos/{path} → evidence/{report_id}/{photo_id}.webp 복사(service role). 원본이 이미 없으면 missing 으로 기록(성공 처리)
 *   evidence_purge  evidence/{report_id}/ 프리픽스 전체 삭제 (purge_expired_evidence 가 enqueue)
 *   storage_delete  payload.bucket 의 payload.paths 삭제 (purge_deleted_profiles 가 enqueue)
 * 실패는 finish_moderation_job(ok=false) → 지수 백오프, 상한 초과 시 failed + notify_admin.
 */
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";

const PHOTOS = "photos";
const EVIDENCE = "evidence";

type Job = { id: number; kind: "evidence_copy" | "evidence_purge" | "storage_delete"; report_id: string | null; payload: Record<string, unknown>; attempts: number };
type PhotoRef = { photo_id: string; path: string; evidence_path: string };

async function copyEvidence(job: Job): Promise<Record<string, unknown>> {
  const supabase = adminClient();
  const photos = (job.payload.photos as PhotoRef[] | undefined) ?? [];
  const copied: string[] = [];
  const missing: string[] = [];
  const failed: Array<{ photo_id: string; error: string }> = [];
  for (const p of photos) {
    // 이미 복사돼 있으면 건너뜀(재시도 멱등)
    const folder = p.evidence_path.split("/").slice(0, -1).join("/");
    const file = p.evidence_path.split("/").pop() ?? "";
    const { data: existing } = await supabase.storage.from(EVIDENCE).list(folder, { search: file, limit: 1 });
    if (existing && existing.some((o) => o.name === file)) {
      copied.push(p.photo_id);
      continue;
    }
    const { data: blob, error: dlErr } = await supabase.storage.from(PHOTOS).download(p.path);
    if (dlErr || !blob) {
      const msg = dlErr?.message ?? "download failed";
      if (/not found|404|object not found/i.test(msg)) missing.push(p.photo_id);
      else failed.push({ photo_id: p.photo_id, error: msg });
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(EVIDENCE).upload(p.evidence_path, bytes, { contentType: blob.type || "image/webp", upsert: true });
    if (upErr) failed.push({ photo_id: p.photo_id, error: upErr.message });
    else copied.push(p.photo_id);
  }
  if (failed.length > 0) throw new Error(`copy failed for ${failed.length}: ${failed.map((f) => f.error).join("; ").slice(0, 300)}`);
  return { copied: copied.length, missing, total: photos.length };
}

async function purgeEvidence(job: Job): Promise<Record<string, unknown>> {
  const supabase = adminClient();
  const prefix = String(job.payload.prefix ?? `${job.report_id}/`).replace(/\/$/, "");
  const { data, error } = await supabase.storage.from(EVIDENCE).list(prefix, { limit: 200 });
  if (error) throw error;
  const names = (data ?? []).map((o) => `${prefix}/${o.name}`);
  if (names.length > 0) {
    const { error: rmErr } = await supabase.storage.from(EVIDENCE).remove(names);
    if (rmErr) throw rmErr;
  }
  return { removed: names.length };
}

async function storageDelete(job: Job): Promise<Record<string, unknown>> {
  const supabase = adminClient();
  const bucket = String(job.payload.bucket ?? PHOTOS);
  const paths = (job.payload.paths as string[] | undefined) ?? [];
  if (paths.length === 0) return { removed: 0 };
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
  return { removed: paths.length, bucket };
}

async function runJob(job: Job): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  try {
    const result = job.kind === "evidence_copy" ? await copyEvidence(job) : job.kind === "evidence_purge" ? await purgeEvidence(job) : await storageDelete(job);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isTrustedCaller(req, "MODERATION_WEBHOOK_SECRET")) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const supabase = adminClient();

  let jobs: Job[] = [];
  const reportId = typeof body.report_id === "string" ? body.report_id : body.type === "INSERT" && typeof (body.record as { id?: string })?.id === "string" ? (body.record as { id: string }).id : null;
  if (reportId) {
    // 특정 신고: pending 작업을 직접 클레임(리스 갱신)
    const { data, error } = await supabase
      .from("moderation_jobs")
      .update({ next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString() })
      .eq("report_id", reportId)
      .eq("status", "pending")
      .select("id, kind, report_id, payload, attempts");
    if (error) return json({ ok: false, reason: "claim_failed", detail: error.message }, 500);
    jobs = (data ?? []) as Job[];
    if (jobs.length > 0) {
      await supabase.from("moderation_jobs").update({ attempts: jobs[0].attempts + 1 }).in("id", jobs.map((j) => j.id));
      jobs = jobs.map((j) => ({ ...j, attempts: j.attempts + 1 }));
    }
  } else {
    const { data, error } = await supabase.rpc("claim_moderation_jobs", { p_limit: 20 });
    if (error) return json({ ok: false, reason: "claim_failed", detail: error.message }, 500);
    jobs = (data ?? []) as Job[];
  }

  const results: Array<{ id: number; kind: string; ok: boolean; error?: string }> = [];
  for (const job of jobs) {
    const r = await runJob(job);
    await supabase.rpc("finish_moderation_job", { p_job_id: job.id, p_ok: r.ok, p_result: r.result ?? null, p_error: r.error ?? null });
    results.push({ id: job.id, kind: job.kind, ok: r.ok, ...(r.error ? { error: r.error.slice(0, 200) } : {}) });
  }
  return json({ ok: true, processed: results.length, results });
});
