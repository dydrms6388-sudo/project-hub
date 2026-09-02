"use server";

/**
 * 푸시 구독·설정 서버 액션 (E4 설정 > 알림 화면 · E1 온보딩 후 권한 요청 · sw 재구독 API 가 호출).
 *  - subscribePush / unsubscribePush : push_subscriptions (본인 행, RLS)
 *  - updatePushPrefs                 : 슬롯 토글 · push_prefs(서비스 마스터·방해금지) · consents(marketing_push)
 *  - getPushPrefs                    : 설정 화면 초기값
 * 모든 액션은 ActionResult 를 반환하고 throw 하지 않는다(D2 §0-1).
 */
import { headers } from "next/headers";
import { recordConsent } from "@/lib/auth/consents";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { clientIp } from "@/lib/auth/otp";
import { requireProfileForAction, type ActionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPushSchema, type PushPrefsRow, type PushSupabase } from "./db-types";
import { subscribePushSchema, unsubscribePushSchema, updatePushPrefsSchema, type PushPrefsView, type SubscribePushInput, type UpdatePushPrefsInput } from "./schemas";

const MARKETING_RECHECK_DAYS = 730;

function toHm(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

async function loadPrefs(ctx: ActionContext): Promise<PushPrefsView> {
  const db: PushSupabase = withPushSchema(ctx.supabase);
  const [subs, prefs, consent] = await Promise.all([
    db
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at, last_sent_at, slot_a_enabled, slot_b_enabled, instant_enabled")
      .eq("user_id", ctx.user.id)
      .is("disabled_at", null)
      .order("created_at", { ascending: false }),
    db.from("push_prefs").select("*").eq("user_id", ctx.user.id).maybeSingle(),
    db
      .from("consents")
      .select("agreed, withdrawn_at, agreed_at, version")
      .eq("user_id", ctx.user.id)
      .eq("key", "marketing_push")
      .order("agreed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (subs.error) throw subs.error;
  if (prefs.error) throw prefs.error;
  if (consent.error) throw consent.error;

  const rows = subs.data ?? [];
  const p = (prefs.data ?? null) as PushPrefsRow | null;
  const agreed = Boolean(consent.data?.agreed && !consent.data.withdrawn_at);
  const agreedAt = agreed ? (consent.data?.agreed_at ?? null) : null;
  const recheckDueAt = agreedAt ? new Date(Date.parse(agreedAt) + MARKETING_RECHECK_DAYS * 86_400_000).toISOString() : null;
  const quietHours = p?.quiet_start && p.quiet_end ? { start: toHm(p.quiet_start) as string, end: toHm(p.quiet_end) as string } : null;

  return {
    subscriptions: rows.map((s) => ({
      id: s.id,
      endpointHost: (() => {
        try {
          return new URL(s.endpoint).host;
        } catch {
          return "";
        }
      })(),
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastSentAt: s.last_sent_at,
      slotA: s.slot_a_enabled,
      slotB: s.slot_b_enabled,
      instant: s.instant_enabled,
    })),
    subscribed: rows.length > 0,
    service: p?.service_enabled ?? true,
    slots: {
      slotA: rows.some((s) => s.slot_a_enabled),
      slotB: rows.some((s) => s.slot_b_enabled),
      instant: rows.some((s) => s.instant_enabled),
    },
    quietHours,
    marketing: { agreed, agreedAt, version: consent.data?.version ?? null, recheckDueAt },
  };
}

/**
 * 브라우저 PushSubscription 저장. 온보딩 중에도 허용(E1 이 온보딩 완료 직후 권한을 물을 수 있게).
 * 같은 endpoint 가 다른 계정에 남아 있으면(기기 공유·재로그인) service role 로 정리한 뒤 본인 행으로 upsert.
 */
export async function subscribePush(raw: SubscribePushInput): Promise<ActionResult<{ subscriptionId: string; prefs: PushPrefsView }>> {
  try {
    const parsed = subscribePushSchema.safeParse(raw);
    if (!parsed.success) return fail("INVALID_INPUT", "구독 정보를 확인해 주세요", { field: "subscription" });
    const { subscription, kinds, userAgent, previousEndpoint } = parsed.data;
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });

    const admin = createAdminClient();
    const stale = await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint).neq("user_id", ctx.user.id).select("id");
    if (stale.error) throw stale.error;
    if ((stale.data?.length ?? 0) > 0) console.info("[push] endpoint reassigned", { count: stale.data?.length });

    const h = await headers();
    const ua = (userAgent ?? h.get("user-agent") ?? "").slice(0, 300) || null;
    const row = {
      user_id: ctx.user.id,
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      user_agent: ua,
      slot_a_enabled: kinds?.slotA ?? true,
      slot_b_enabled: kinds?.slotB ?? true,
      instant_enabled: kinds?.instant ?? true,
      disabled_at: null,
    };
    const up = await ctx.supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" }).select("id").single();
    if (up.error) throw up.error;

    if (previousEndpoint && previousEndpoint !== subscription.endpoint) {
      await ctx.supabase.from("push_subscriptions").delete().eq("endpoint", previousEndpoint).eq("user_id", ctx.user.id);
    }
    return ok({ subscriptionId: up.data.id, prefs: await loadPrefs(ctx) });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function unsubscribePush(raw: { endpoint: string }): Promise<ActionResult<{ removed: number; prefs: PushPrefsView }>> {
  try {
    const parsed = unsubscribePushSchema.safeParse(raw);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "endpoint" });
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    const del = await ctx.supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", ctx.user.id).select("id");
    if (del.error) throw del.error;
    return ok({ removed: del.data?.length ?? 0, prefs: await loadPrefs(ctx) });
  } catch (e) {
    return toActionFailure(e);
  }
}

/**
 * 설정 > 알림. 서비스 알림(슬롯)과 마케팅 동의는 **별도 섹션**(B1 §0-20) — 여기서도 저장 경로가 다르다:
 *  service/slots/quiet_hours → push_subscriptions·push_prefs, marketing → consents(marketing_push) 새 행(철회 = agreed=false + withdrawn_at).
 */
export async function updatePushPrefs(raw: UpdatePushPrefsInput): Promise<ActionResult<PushPrefsView>> {
  try {
    const parsed = updatePushPrefsSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail("INVALID_INPUT", issue?.message, { field: issue?.path.join(".") });
    }
    const input = parsed.data;
    const ctx = await requireProfileForAction(1);
    const db = withPushSchema(ctx.supabase);

    // 슬롯 토글 (본인 구독 전체에 일괄)
    const slotPatch: { slot_a_enabled?: boolean; slot_b_enabled?: boolean; instant_enabled?: boolean } = {};
    if (input.service !== undefined) {
      slotPatch.slot_a_enabled = input.service;
      slotPatch.slot_b_enabled = input.service;
      slotPatch.instant_enabled = input.service;
    }
    if (input.slots?.slotA !== undefined) slotPatch.slot_a_enabled = input.slots.slotA;
    if (input.slots?.slotB !== undefined) slotPatch.slot_b_enabled = input.slots.slotB;
    if (input.slots?.instant !== undefined) slotPatch.instant_enabled = input.slots.instant;
    if (Object.keys(slotPatch).length > 0) {
      const r = await ctx.supabase.from("push_subscriptions").update(slotPatch).eq("user_id", ctx.user.id);
      if (r.error) throw r.error;
    }

    // push_prefs (서비스 마스터 · 방해금지)
    if (input.service !== undefined || input.quiet_hours !== undefined) {
      const patch: Partial<PushPrefsRow> & { user_id: string } = { user_id: ctx.user.id };
      if (input.service !== undefined) patch.service_enabled = input.service;
      if (input.quiet_hours !== undefined) {
        patch.quiet_start = input.quiet_hours ? `${input.quiet_hours.start}:00` : null;
        patch.quiet_end = input.quiet_hours ? `${input.quiet_hours.end}:00` : null;
      }
      const r = await db.from("push_prefs").upsert(patch, { onConflict: "user_id" });
      if (r.error) throw r.error;
    }

    // 마케팅 동의 (변경이 있을 때만 새 행)
    if (input.marketing !== undefined) {
      const cur = await db.rpc("has_marketing_consent", { p_user_id: ctx.user.id });
      if (cur.error) throw cur.error;
      if (Boolean(cur.data) !== input.marketing) {
        const h = await headers();
        await recordConsent(ctx.supabase, ctx.user.id, "marketing_push", input.marketing, "settings", { ip: clientIp(h), userAgent: h.get("user-agent") });
      }
    }
    return ok(await loadPrefs(ctx));
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function getPushPrefs(): Promise<ActionResult<PushPrefsView>> {
  try {
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    return ok(await loadPrefs(ctx));
  } catch (e) {
    return toActionFailure(e);
  }
}
