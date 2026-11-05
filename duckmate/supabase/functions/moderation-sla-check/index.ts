/**
 * moderation-sla-check — 신고 SLA 감시 (D5 · A5 §6). cron 15분.
 *   1. sla_check() RPC: due_at 초과·미종결 신고마다 audit_logs(sla_overdue) + notify_admin(큐 행) — 재알림 간격은 우선순위별
 *   2. moderation_notifications(audience=admin, delivered_at null) 을 MODERATION_ALERT_WEBHOOK_URL(선택, Slack incoming webhook 등)로 전달하고 delivered_at 갱신.
 *      URL 이 없으면 큐에만 남기고 D7 배치가 전달한다(이메일/푸시). payload 에 개인정보 없음.
 * 인증: Authorization Bearer <service role> 또는 x-webhook-secret = MODERATION_WEBHOOK_SECRET
 */
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";

type Notification = { id: number; kind: string; report_id: string | null; sanction_id: string | null; payload: Record<string, unknown>; created_at: string };

function formatLine(n: Notification): string {
  const p = n.payload;
  switch (n.kind) {
    case "sla_overdue":
      return `[SLA 초과] ${p.priority} ${p.reason_code} report=${n.report_id} status=${p.status} +${p.overdue_min}분`;
    case "appeal_submitted":
      return `[이의신청] level ${p.level} appeal=${p.appeal_id} (72h 내 판정)`;
    case "moderation_job_failed":
      return `[작업 실패] ${p.kind} job=${p.job_id}: ${p.error}`;
    case "purge_summary":
      return `[파기] evidence=${p.evidence} profiles=${p.profiles}`;
    default:
      return `[${n.kind}] ${JSON.stringify(p).slice(0, 200)}`;
  }
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isTrustedCaller(req, "MODERATION_WEBHOOK_SECRET")) return json({ error: "unauthorized" }, 401);

  const supabase = adminClient();
  const { data: sla, error: slaErr } = await supabase.rpc("sla_check");
  if (slaErr) return json({ ok: false, reason: "sla_check_failed", detail: slaErr.message }, 500);

  const { data: pending, error: qErr } = await supabase
    .from("moderation_notifications")
    .select("id, kind, report_id, sanction_id, payload, created_at")
    .eq("audience", "admin")
    .is("delivered_at", null)
    .order("created_at")
    .limit(50);
  if (qErr) return json({ ok: false, reason: "queue_read_failed", detail: qErr.message }, 500);

  const webhook = Deno.env.get("MODERATION_ALERT_WEBHOOK_URL");
  let delivered = 0;
  if (webhook && pending && pending.length > 0) {
    const lines = (pending as Notification[]).map(formatLine);
    const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lines.join("\n") }) });
    const ok = res.ok;
    await supabase
      .from("moderation_notifications")
      .update(ok ? { delivered_at: new Date().toISOString(), delivery: { channel: "webhook", ok: true } } : { delivery: { channel: "webhook", ok: false, error: `HTTP ${res.status}` } })
      .in("id", (pending as Notification[]).map((n) => n.id));
    if (ok) delivered = pending.length;
  }

  return json({ ok: true, sla, queued: pending?.length ?? 0, delivered, webhook_configured: Boolean(webhook) });
});
