// =============================================================================
// D7 · push-dispatch — Deno Edge Function (푸시 발송 파이프라인의 단일 출구)
//
// 호출 계약:
//   POST /functions/v1/push-dispatch   (Authorization: Bearer <SERVICE_ROLE_KEY>)
//   · { "job": "slot1" }
//       pg_cron(KST 08:00)이 호출. pick_daily_push_targets() → 슬롯1 데일리 앵커,
//       이어서 pick_reminder_push_targets() → 미접속 D3/D7 리마인더(슬롯1 대체).
//   · { "job": "event", "profile_id": uuid, "kind": "match_created" | "new_message"
//       | "like_received" | "match_no_chat_24h", "params": { nickname?, matchId? } }
//       D3/D4 서버 로직이 이벤트 발생 즉시 호출. 12:00~21:00(KST) 창 밖이면 폐기
//       (이월 없음 — A3 §3.1), 슬롯2 하루 1건·일 2건 상한은 여기서 판정.
//
// 발송 순서(경쟁 안전): notification_log 선점 insert(sent) → Web Push 발송 →
//   전 토큰 실패 시 status='failed' 로 갱신. 슬롯별 하루 1건은 DB partial unique
//   (uq_notification_log_slot_per_day)가 최종 방어선 — 동시 호출은 insert 충돌로 탈락.
//
// 환경변수: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (자동 주입),
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (수동 설정 —
//   `supabase secrets set`. 공개키는 apps/web 의 NEXT_PUBLIC_VAPID_PUBLIC_KEY 와 동일값)
// =============================================================================

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush, type VapidConfig, type WebPushSubscription } from "./webpush.ts";
import { buildPayload, COPY, type CopyParams, type PushKind } from "./copy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID: VapidConfig = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@example.com",
};

const EVENT_KINDS = new Set<PushKind>([
  "match_created",
  "new_message",
  "like_received",
  "match_no_chat_24h",
]);

function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000); // UTC+9 (getUTC* 로 읽는다)
}
function kstToday(): string {
  return kstNow().toISOString().slice(0, 10);
}
function kstHour(): number {
  return kstNow().getUTCHours();
}

function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

interface TokenRow {
  id: string;
  token: string;
}

/** 유저의 활성 web 토큰으로 발송. 만료(404/410) 토큰은 비활성화. 성공 1건 이상이면 true. */
async function pushToUser(
  client: SupabaseClient,
  userId: string,
  payloadJson: string
): Promise<{ delivered: boolean; lastError?: string }> {
  const { data: tokens, error } = await client
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", userId)
    .eq("platform", "web")
    .eq("is_active", true);
  if (error) return { delivered: false, lastError: error.message };
  if (!tokens || tokens.length === 0) return { delivered: false, lastError: "no active token" };

  let delivered = false;
  let lastError: string | undefined;
  const goneIds: string[] = [];
  const usedIds: string[] = [];

  for (const row of tokens as TokenRow[]) {
    let sub: WebPushSubscription | null = null;
    try {
      const parsed = JSON.parse(row.token);
      if (parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth) {
        sub = parsed as WebPushSubscription;
      }
    } catch {
      // FCM 토큰 등 비-웹푸시 형식 — platform='web' 필터로 원천 배제되지만 방어
    }
    if (!sub) {
      goneIds.push(row.id); // 파싱 불가 토큰은 사용 불능 → 정리
      continue;
    }
    const res = await sendWebPush(sub, payloadJson, VAPID);
    if (res.ok) {
      delivered = true;
      usedIds.push(row.id);
    } else if (res.gone) {
      goneIds.push(row.id);
    } else {
      lastError = res.error ?? `push endpoint status ${res.status}`;
    }
  }

  // 만료 토큰 정리 + last_used_at 갱신 (실패해도 발송 결과에는 영향 없음)
  if (goneIds.length > 0) {
    await client.from("push_tokens").update({ is_active: false }).in("id", goneIds);
  }
  if (usedIds.length > 0) {
    await client
      .from("push_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", usedIds);
  }
  return { delivered, lastError };
}

/**
 * 발송 1건 실행: 로그 선점 → 발송 → 실패 시 로그 갱신.
 * unique 충돌(이미 오늘 해당 슬롯 발송) 이면 조용히 skip.
 */
async function dispatchOne(
  client: SupabaseClient,
  profileId: string,
  userId: string,
  kind: PushKind,
  params: CopyParams
): Promise<"sent" | "skipped" | "failed"> {
  const payload = buildPayload(kind, params);
  const { data: logRow, error: insertError } = await client
    .from("notification_log")
    .insert({
      profile_id: profileId,
      slot: payload.slot,
      kind,
      is_marketing: payload.unsubscribePath !== undefined,
      title: payload.title,
      body: payload.body,
      deeplink: payload.deeplink,
      status: "sent",
      for_date: kstToday(),
    })
    .select("id")
    .single();

  if (insertError || !logRow) {
    // 23505 = unique_violation → 오늘 이 슬롯은 이미 소진 (동시 호출 방어)
    return "skipped";
  }

  const { delivered, lastError } = await pushToUser(client, userId, JSON.stringify(payload));
  if (!delivered) {
    await client
      .from("notification_log")
      .update({ status: "failed", error: lastError ?? "all tokens failed" })
      .eq("id", logRow.id);
    return "failed";
  }

  // 서버 계측: push_sent (A3 §4.1 — 이름 고정)
  await client.from("analytics_events").insert({
    profile_id: profileId,
    name: "push_sent",
    props: { slot: payload.slot === "daily" ? 1 : payload.slot === "event" ? 2 : "reminder", copy_variant: kind },
  });
  return "sent";
}

// ---------------------------------------------------------------------------
// job: slot1 — 데일리 앵커 + 미접속 리마인더 (cron KST 08:00)
// ---------------------------------------------------------------------------
interface DailyTarget {
  profile_id: string;
  user_id: string;
  nickname: string;
  reco_count: number;
}
interface ReminderTarget {
  profile_id: string;
  user_id: string;
  nickname: string;
  days_inactive: number;
}

async function runSlot1(client: SupabaseClient) {
  const counters = { sent: 0, failed: 0, skipped: 0 };

  const { data: daily, error: e1 } = await client.rpc("pick_daily_push_targets");
  if (e1) throw new Error(`pick_daily_push_targets: ${e1.message}`);
  for (const t of (daily ?? []) as DailyTarget[]) {
    const r = await dispatchOne(client, t.profile_id, t.user_id, "daily_card", {
      recoCount: t.reco_count,
    });
    counters[r]++;
  }

  const { data: reminders, error: e2 } = await client.rpc("pick_reminder_push_targets");
  if (e2) throw new Error(`pick_reminder_push_targets: ${e2.message}`);
  for (const t of (reminders ?? []) as ReminderTarget[]) {
    const kind: PushKind = t.days_inactive >= 7 ? "reminder_d7" : "reminder_d3";
    const r = await dispatchOne(client, t.profile_id, t.user_id, kind, {});
    counters[r]++;
  }

  return counters;
}

// ---------------------------------------------------------------------------
// job: event — 슬롯2 이벤트성 (발생 즉시, 12:00~21:00 창 밖은 폐기)
// ---------------------------------------------------------------------------
interface EventJob {
  profile_id?: string;
  kind?: string;
  params?: CopyParams;
}

async function runEvent(client: SupabaseClient, body: EventJob) {
  const kind = body.kind as PushKind;
  if (!body.profile_id || !kind || !EVENT_KINDS.has(kind)) {
    return { status: 400, result: { ok: false, error: "invalid event job (profile_id/kind)" } };
  }

  // ① 발송 창 12:00~20:59 KST — 창 밖 발생 건은 폐기 (이월 금지, 로그도 남기지 않음)
  const hour = kstHour();
  if (hour < 12 || hour >= 21) {
    return { status: 200, result: { ok: true, outcome: "discarded", reason: "outside 12-21 KST window" } };
  }

  // ② 프로필 상태 + 기능성 채널 설정 (행 부재 = 기본 on. 기능성이므로 marketing_consent 불요)
  const { data: profile } = await client
    .from("profiles")
    .select("id, user_id, status")
    .eq("id", body.profile_id)
    .single();
  if (!profile || profile.status !== "active") {
    return { status: 200, result: { ok: true, outcome: "skipped", reason: "profile not active" } };
  }
  const { data: prefs } = await client
    .from("notification_prefs")
    .select("channel_event")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (prefs && !prefs.channel_event) {
    return { status: 200, result: { ok: true, outcome: "skipped", reason: "channel_event off" } };
  }

  // ③ 일 2건 상한 (슬롯2 하루 1건은 dispatchOne 의 unique 선점이 보장)
  const { count } = await client
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("for_date", kstToday())
    .eq("status", "sent")
    .in("slot", ["daily", "event", "reminder"]);
  if ((count ?? 0) >= 2) {
    return { status: 200, result: { ok: true, outcome: "discarded", reason: "daily cap reached" } };
  }

  const outcome = await dispatchOne(client, profile.id, profile.user_id, kind, body.params ?? {});
  return { status: 200, result: { ok: true, outcome } };
}

// ---------------------------------------------------------------------------
// 엔트리포인트
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
  }
  // 게이트웨이 JWT 검증과 별개로 service role 만 허용 (cron·서버 로직 전용 — 클라이언트 호출 금지)
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE_KEY || bearer !== SERVICE_ROLE_KEY) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!VAPID.publicKey || !VAPID.privateKey) {
    return Response.json({ ok: false, error: "VAPID keys not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body 없는 호출은 slot1 로 처리 (cron 안전 기본값)
  }
  const job = (body.job as string) ?? "slot1";
  const client = db();

  try {
    if (job === "slot1") {
      const counters = await runSlot1(client);
      return Response.json({ ok: true, job, ...counters });
    }
    if (job === "event") {
      const { status, result } = await runEvent(client, body as EventJob);
      return Response.json({ job, ...result }, { status });
    }
    return Response.json({ ok: false, error: `unknown job: ${job}` }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[push-dispatch]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});

// COPY 를 재노출 — 슬롯2 발화자(D3/D4)가 카피 프리뷰를 원할 때 단일 소스 참조용
export { COPY };
