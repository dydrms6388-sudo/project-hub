import "server-only";
import { SolapiMessageService } from "solapi";
import { createSupabaseServiceClient } from "./supabase";

// 알림톡 발송 래퍼. 성공/실패/건너뜀을 모두 messages 테이블에 기록한다.
// 재시도는 하지 않는다 — visits.*_sent_at이 null로 남으므로 다음날 크론이 다시 잡는다.

export type AlimtalkKind =
  | "booking_confirm"
  | "review_request"
  | "touchup_reminder"
  | "winback";

const SEND_TIMEOUT_MS = 10_000;

function templateId(kind: AlimtalkKind): string | undefined {
  const raw = {
    booking_confirm: process.env.ALIMTALK_TEMPLATE_BOOKING_CONFIRM,
    review_request: process.env.ALIMTALK_TEMPLATE_REVIEW_REQUEST,
    touchup_reminder: process.env.ALIMTALK_TEMPLATE_TOUCHUP_REMINDER,
    winback: process.env.ALIMTALK_TEMPLATE_WINBACK, // Phase 1.5
  }[kind];
  return raw?.trim() || undefined;
}

export function alimtalkConfigured(kind: AlimtalkKind): boolean {
  return Boolean(
    process.env.SOLAPI_API_KEY?.trim() &&
      process.env.SOLAPI_API_SECRET?.trim() &&
      process.env.KAKAO_PFID?.trim() &&
      templateId(kind)
  );
}

export interface SendResult {
  ok: boolean;
  /** 미설정으로 건너뛴 경우. 크론이 실패와 구분해 집계한다. */
  skipped?: boolean;
  providerId?: string;
  error?: string;
}

/** 로그에 고객 전화번호가 통째로 남지 않도록 마스킹한다. */
export function maskPhone(digits: string): string {
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`발송 응답 없음 (${ms}ms 초과)`)), ms)
    ),
  ]);
}

/**
 * 알림톡 1건 발송 + messages 기록.
 * variables 키는 템플릿 치환자 그대로: { "#{이름}": "...", "#{날짜}": "..." }
 */
export async function sendAlimtalk(params: {
  kind: AlimtalkKind;
  customerId: string;
  visitId?: string | null;
  phone: string;
  variables: Record<string, string>;
}): Promise<SendResult> {
  const { kind, customerId, visitId, phone, variables } = params;
  const template = templateId(kind);
  const db = createSupabaseServiceClient();

  const record = async (status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await db.from("messages").insert({
      customer_id: customerId,
      visit_id: visitId ?? null,
      kind,
      template_code: template ?? null,
      status,
      ...extra,
    });
    if (error) console.error(`[alimtalk] messages 기록 실패 (${kind}):`, error.message);
  };

  if (!alimtalkConfigured(kind)) {
    await record("skipped_unconfigured", { error: "알림톡 환경변수 미설정" });
    return { ok: false, skipped: true, error: "알림톡 환경변수 미설정" };
  }

  const to = phone.replace(/\D/g, "");
  try {
    const service = new SolapiMessageService(
      process.env.SOLAPI_API_KEY!,
      process.env.SOLAPI_API_SECRET!
    );
    const res = await withTimeout(
      service.sendOne({
        to,
        kakaoOptions: {
          pfId: process.env.KAKAO_PFID!,
          templateId: template!,
          variables,
          disableSms: true, // 알림톡 실패 시 문자 대체발송 금지 (비용/동의 이슈)
        },
      }),
      SEND_TIMEOUT_MS
    );
    await record("sent", { provider_id: res.messageId });
    return { ok: true, providerId: res.messageId };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await record("failed", { error: message });
    console.error(`[alimtalk] ${kind} 발송 실패 (${maskPhone(to)}):`, message);
    return { ok: false, error: message };
  }
}
