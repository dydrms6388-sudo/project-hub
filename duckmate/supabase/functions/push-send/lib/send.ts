/**
 * 발송 코어 (push-send 즉시 경로 · push-dispatch 큐 소비 공용).
 *   claim_push_queue(전송 직전 재판정) → 템플릿 렌더 + 카피 lint → 구독별 Web Push → complete_push_send → finish_push_queue
 * 정책 판정은 전부 SQL(can_send_push). 여기서는 렌더·전송·기록만 한다.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { buildPayload, isPushTemplateKey, lintCopy, MARKETING_PREFIX, renderPush, type PushKind, type PushSlot } from "./templates.ts";
import { loadVapidFromEnv, sendWebPush, sha256Hex, type VapidKeys } from "./webpush.ts";

export type QueueRow = {
  id: number;
  user_id: string;
  profile_id: string | null;
  template: string;
  kind: PushKind;
  slot: PushSlot;
  params: Record<string, unknown> | null;
  merged_count: number;
  attempts: number;
  like_id: string | null;
};

type SubRow = { id: string; endpoint: string; keys: { p256dh?: string; auth?: string } | null; slot_a_enabled: boolean; slot_b_enabled: boolean; instant_enabled: boolean };

export type DispatchStats = { claimed: number; sent: number; failed: number; discarded: number; errors: string[] };

function ttlFor(slot: PushSlot): number {
  return slot === "A" ? 4 * 3600 : slot === "B" ? 2 * 3600 : 6 * 3600;
}

function slotEnabled(s: SubRow, slot: PushSlot): boolean {
  return slot === "A" ? s.slot_a_enabled : slot === "B" ? s.slot_b_enabled : s.instant_enabled;
}

export async function sendQueueItem(admin: SupabaseClient, q: QueueRow, vapid: VapidKeys, serviceName?: string): Promise<"sent" | "failed" | "discarded"> {
  const finish = async (ok: boolean, error: string | null, discard = false) => {
    const { error: e } = await admin.rpc("finish_push_queue", { p_queue_id: q.id, p_ok: ok, p_error: error, p_discard: discard });
    if (e) console.error("[push] finish_push_queue failed", q.id, e.message);
  };

  if (!isPushTemplateKey(q.template)) {
    await finish(false, `UNKNOWN_TEMPLATE:${q.template}`, true);
    return "discarded";
  }
  const params = { ...(q.params ?? {}), count: q.merged_count };
  const rendered = renderPush(q.template, params, serviceName ? { serviceName } : {});

  // 법정 표기·카피 가드(닉네임 등 동적 값 포함). 정책 자체는 SQL 이 이미 판정했다.
  if (q.kind === "marketing" && !rendered.title.startsWith(MARKETING_PREFIX)) {
    await finish(false, "MARKETING_PREFIX_MISSING", true);
    return "discarded";
  }
  const hits = lintCopy(`${rendered.title}\n${rendered.body}`);
  if (hits.length > 0) {
    await finish(false, `COPY_LINT:${hits.join(",")}`, true);
    return "discarded";
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys, slot_a_enabled, slot_b_enabled, instant_enabled")
    .eq("user_id", q.user_id)
    .is("disabled_at", null);
  if (subErr) {
    await finish(false, `SUBS_QUERY:${subErr.message}`);
    return "failed";
  }
  const targets = ((subs ?? []) as SubRow[]).filter((s) => q.kind === "marketing" || slotEnabled(s, q.slot));
  if (targets.length === 0) {
    await finish(false, "NO_SUBSCRIPTION", true);
    return "discarded";
  }

  const payload = JSON.stringify(buildPayload(rendered, q.id));
  const payloadHash = await sha256Hex(payload);
  let okAny = false;
  let lastError: string | null = null;

  for (const s of targets) {
    const p256dh = s.keys?.p256dh;
    const auth = s.keys?.auth;
    let ok = false;
    let status: number | null = null;
    let err: string | null = null;
    if (!p256dh || !auth) {
      err = "INVALID_KEYS";
      status = 400;
    } else {
      try {
        const r = await sendWebPush({ endpoint: s.endpoint, keys: { p256dh, auth } }, payload, vapid, { ttl: ttlFor(q.slot), urgency: "normal", topic: rendered.tag });
        ok = r.ok;
        status = r.status;
        if (!ok) err = `PUSH_${r.status}${r.body ? `:${r.body.slice(0, 80)}` : ""}`;
      } catch (e) {
        err = `PUSH_EXCEPTION:${(e as Error).message}`.slice(0, 160);
      }
    }
    const { error: logErr } = await admin.rpc("complete_push_send", {
      p_queue_id: q.id,
      p_subscription_id: s.id,
      p_ok: ok,
      p_status_code: status,
      p_error: err,
      p_payload_hash: payloadHash,
    });
    if (logErr) console.error("[push] complete_push_send failed", q.id, s.id, logErr.message);
    okAny ||= ok;
    if (!ok) lastError = err;
  }

  await finish(okAny, okAny ? null : lastError);
  return okAny ? "sent" : "failed";
}

/** 큐 소비 1라운드. onlyId 지정 시 그 행만(push-send 즉시 경로) */
export async function dispatchQueue(admin: SupabaseClient, opts: { limit?: number; onlyId?: number | null } = {}): Promise<DispatchStats> {
  const stats: DispatchStats = { claimed: 0, sent: 0, failed: 0, discarded: 0, errors: [] };
  const vapid = loadVapidFromEnv();
  const serviceName = Deno.env.get("SERVICE_NAME") ?? undefined;
  const { data, error } = await admin.rpc("claim_push_queue", { p_limit: opts.limit ?? 50, p_queue_id: opts.onlyId ?? null });
  if (error) {
    stats.errors.push(`claim:${error.message}`);
    return stats;
  }
  const rows = (data ?? []) as QueueRow[];
  stats.claimed = rows.length;
  for (const q of rows) {
    try {
      const r = await sendQueueItem(admin, q, vapid, serviceName);
      stats[r] += 1;
    } catch (e) {
      stats.errors.push(`${q.id}:${(e as Error).message}`.slice(0, 200));
      await admin.rpc("finish_push_queue", { p_queue_id: q.id, p_ok: false, p_error: `EXCEPTION:${(e as Error).message}`.slice(0, 200), p_discard: false });
      stats.failed += 1;
    }
  }
  return stats;
}
