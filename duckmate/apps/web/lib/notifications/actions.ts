"use server";

// =============================================================================
// D7 · 알림 Server Actions — 구독 토큰 등록/해제 + 알림 설정 저장
//
// D2 의 ActionResult 패턴(15_auth D2-1) 준수: throw 하지 않고 { ok, code } 반환.
// RLS 전제: push_tokens 본인 CRUD 허용(00003), notification_prefs 자기 행(00011).
// service role 불필요 — 전부 세션 클라이언트로 동작한다.
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "@/lib/auth/schemas";
import {
  DEFAULT_NOTIFICATION_PREFS,
  notificationPrefsSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  type NotificationPrefs,
} from "./schemas";

/** 세션 유저 조회 (없으면 null) */
async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// 구독 토큰 등록 — push_tokens upsert (멱등: (user_id, token) unique)
// ---------------------------------------------------------------------------
export async function registerPushToken(input: unknown): Promise<ActionResult<{ tokenId: string }>> {
  const parsed = registerPushTokenSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "구독 정보가 올바르지 않아요.");
  }

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const token = JSON.stringify(parsed.data.subscription);
  const { data, error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        platform: "web",
        token,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    )
    .select("id")
    .single();

  if (error || !data) return fail("DB_ERROR", "푸시 구독을 저장하지 못했어요.");
  return { ok: true, data: { tokenId: data.id as string } };
}

// ---------------------------------------------------------------------------
// 구독 토큰 해제 — endpoint 일치 토큰 비활성화 (행 삭제 대신 is_active=false —
// 발송 이력 추적성 유지. 만료 토큰 실삭제는 push-dispatch 의 정리 루틴과 동일 정책)
// ---------------------------------------------------------------------------
export async function unregisterPushToken(input: unknown): Promise<ActionResult> {
  const parsed = unregisterPushTokenSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "endpoint 가 올바르지 않아요.");
  }

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  // token 컬럼은 구독 JSON 문자열 — endpoint 는 JSON 내부에 있으므로
  // 본인 토큰(소수)을 읽어 endpoint 일치 행만 비활성화한다.
  const { data: rows, error } = await supabase
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (error) return fail("DB_ERROR", "푸시 구독 조회에 실패했어요.");

  const targetIds = (rows ?? [])
    .filter((r) => {
      try {
        return (JSON.parse(r.token as string) as { endpoint?: string }).endpoint === parsed.data.endpoint;
      } catch {
        return false;
      }
    })
    .map((r) => r.id as string);

  if (targetIds.length > 0) {
    const { error: updateError } = await supabase
      .from("push_tokens")
      .update({ is_active: false })
      .in("id", targetIds);
    if (updateError) return fail("DB_ERROR", "푸시 구독 해제에 실패했어요.");
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 알림 설정 저장 — notification_prefs 자기 행 upsert
// marketing_consent 변경 시각은 DB 트리거가 기록 (클라이언트 조작 불가)
// ---------------------------------------------------------------------------
export async function saveNotificationPrefs(input: unknown): Promise<ActionResult> {
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "설정 값이 올바르지 않아요.");
  }

  const { supabase, user } = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return fail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");

  const { error } = await supabase.from("notification_prefs").upsert(
    {
      profile_id: profile.id,
      channel_daily: parsed.data.channelDaily,
      channel_event: parsed.data.channelEvent,
      channel_reminder: parsed.data.channelReminder,
      marketing_consent: parsed.data.marketingConsent,
    },
    { onConflict: "profile_id" }
  );
  if (error) return fail("DB_ERROR", "알림 설정을 저장하지 못했어요.");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 알림 설정 조회 — E4 설정 화면 초기값 (행 없으면 opt-in 기본값)
// ---------------------------------------------------------------------------
export async function getNotificationPrefs(): Promise<ActionResult<NotificationPrefs>> {
  const { supabase, user } = await getSessionUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return fail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");

  const { data, error } = await supabase
    .from("notification_prefs")
    .select("channel_daily, channel_event, channel_reminder, marketing_consent, marketing_consent_at")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", "알림 설정 조회에 실패했어요.");

  if (!data) return { ok: true, data: DEFAULT_NOTIFICATION_PREFS };
  return {
    ok: true,
    data: {
      channelDaily: data.channel_daily as boolean,
      channelEvent: data.channel_event as boolean,
      channelReminder: data.channel_reminder as boolean,
      marketingConsent: data.marketing_consent as boolean,
      marketingConsentAt: (data.marketing_consent_at as string | null) ?? null,
    },
  };
}
