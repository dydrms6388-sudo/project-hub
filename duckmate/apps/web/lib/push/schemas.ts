/**
 * 푸시 서버 액션 입력 스키마 (서버·클라이언트 공용, Next 의존 없음).
 */
import { z } from "zod";

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** PushSubscription.toJSON() 형태 */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "https 엔드포인트만 허용해요"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(200),
    auth: z.string().min(16).max(64),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const slotPrefsSchema = z.object({
  slotA: z.boolean().optional(),
  slotB: z.boolean().optional(),
  instant: z.boolean().optional(),
});
export type SlotPrefs = z.infer<typeof slotPrefsSchema>;

export const subscribePushSchema = z.object({
  subscription: pushSubscriptionInputSchema,
  /** 슬롯별 초기값(생략 = 전부 on) */
  kinds: slotPrefsSchema.optional(),
  userAgent: z.string().max(300).optional(),
  /** pushsubscriptionchange 재구독 시 이전 endpoint 정리 */
  previousEndpoint: z.string().url().max(2048).optional(),
});
export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({ endpoint: z.string().url().max(2048) });

export const quietHoursSchema = z
  .object({ start: z.string().regex(HHMM, "HH:MM"), end: z.string().regex(HHMM, "HH:MM") })
  .refine((q) => q.start !== q.end, { message: "시작과 끝이 같을 수 없어요" });
export type QuietHoursInput = z.infer<typeof quietHoursSchema>;

export const updatePushPrefsSchema = z.object({
  /** 서비스 알림 마스터 토글(슬롯 3개 + push_prefs.service_enabled 일괄) */
  service: z.boolean().optional(),
  /** 슬롯 개별 토글 */
  slots: slotPrefsSchema.optional(),
  /** 마케팅 수신 동의 — consents(marketing_push) 로 기록 */
  marketing: z.boolean().optional(),
  /** 개인 방해금지(KST). null = 해제 */
  quiet_hours: quietHoursSchema.nullable().optional(),
});
export type UpdatePushPrefsInput = z.infer<typeof updatePushPrefsSchema>;

export const openedSchema = z.object({ qid: z.number().int().positive() });

export type PushPrefsView = {
  subscriptions: Array<{ id: string; endpointHost: string; userAgent: string | null; createdAt: string; lastSentAt: string | null; slotA: boolean; slotB: boolean; instant: boolean }>;
  /** 활성 구독이 하나라도 있음 */
  subscribed: boolean;
  service: boolean;
  slots: { slotA: boolean; slotB: boolean; instant: boolean };
  quietHours: QuietHoursInput | null;
  marketing: { agreed: boolean; agreedAt: string | null; version: string | null; recheckDueAt: string | null };
};
