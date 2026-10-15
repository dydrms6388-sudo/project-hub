// =============================================================================
// D7 · 알림 입력 스키마 + 공용 타입
// actions.ts 는 "use server" 파일이라 async 함수 외 export 불가 → 스키마는 여기
// (D2 의 lib/auth/schemas.ts 와 동일 패턴).
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Web Push 구독 (PushSubscription.toJSON() 결과)
// push_tokens.token 에는 이 JSON 을 문자열 그대로 저장한다 —
// Edge Function(push-dispatch)이 endpoint/keys 를 파싱해 발송.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// [G2-07] endpoint 호스트 화이트리스트 — blind SSRF 차단
//
// push_tokens.token 에 저장된 endpoint 로 Edge Function(push-dispatch)이 그대로
// POST 한다. 예전 스키마는 z.string().url() 뿐이라 인증 유저가
// `http://169.254.169.254/...` 같은 내부 주소를 등록하면 서비스 롤 런타임이
// 그 주소로 요청을 보냈다(상태코드·응답시간 기반 내부 스캔, 반사 발송).
//
// 허용 대상 = 실제 웹푸시 서비스 호스트뿐:
//   Chrome/Android FCM : fcm.googleapis.com, android.googleapis.com
//   Firefox            : *.push.services.mozilla.com
//   Safari/Apple       : web.push.apple.com (*.push.apple.com)
//   Edge/WNS           : *.notify.windows.com
// 같은 목록의 DB CHECK 가 00014_security_hardening.sql 에 이중으로 있다.
// ---------------------------------------------------------------------------
export const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
] as const;

/** https + 화이트리스트 호스트(또는 그 하위 도메인)만 true. 그 외 전부 false. */
export function isAllowedPushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  // 사용자정보(user:pass@)·비표준 포트는 우회 수법이므로 불허
  if (url.username || url.password || url.port) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

const pushEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine(isAllowedPushEndpoint, {
    message: "지원하지 않는 푸시 서비스 주소예요.",
  });

export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

export const registerPushTokenSchema = z.object({
  subscription: pushSubscriptionSchema,
});
export type RegisterPushTokenInput = z.input<typeof registerPushTokenSchema>;

// 해제는 "내 토큰 중 endpoint 가 같은 행 비활성화"일 뿐이라 화이트리스트를 걸면
// 과거에 저장된 비허용 endpoint 를 유저가 스스로 정리할 수 없다 → url 검증만 유지.
export const unregisterPushTokenSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type UnregisterPushTokenInput = z.input<typeof unregisterPushTokenSchema>;

// ---------------------------------------------------------------------------
// 알림 설정 (notification_prefs — 자기 행 upsert)
//   · channelDaily / channelReminder 는 광고성 계열 — 실제 발송은
//     marketingConsent 와 AND (00011 pick_* 함수가 판정)
//   · channelEvent 는 기능성(매칭/메시지/좋아요). 안전·법적 고지(system)는
//     이 토글과 무관하게 발송됨을 E4 화면에 명시할 것 (B1 §6-③ E4 지시)
// ---------------------------------------------------------------------------
export const notificationPrefsSchema = z.object({
  channelDaily: z.boolean(),
  channelEvent: z.boolean(),
  channelReminder: z.boolean(),
  marketingConsent: z.boolean(),
});
export type NotificationPrefsInput = z.input<typeof notificationPrefsSchema>;

export interface NotificationPrefs {
  channelDaily: boolean;
  channelEvent: boolean;
  channelReminder: boolean;
  marketingConsent: boolean;
  /** 동의/철회 시각 (서버 트리거 기록 — 읽기 전용) */
  marketingConsentAt: string | null;
}

/** 행이 아직 없는 유저의 기본값 (광고성 동의는 opt-in 이므로 false) */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  channelDaily: true,
  channelEvent: true,
  channelReminder: true,
  marketingConsent: false,
  marketingConsentAt: null,
};
