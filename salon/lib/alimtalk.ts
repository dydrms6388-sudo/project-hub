import { SolapiMessageService } from "solapi";
import { createSupabaseServiceClient } from "./supabase";

// 알림톡 발송 래퍼. 발송 결과는 성공/실패 모두 messages 테이블에 기록한다.
// 실패 시 재시도하지 않는다 — *_sent_at이 null로 남으므로 다음날 크론이 다시 잡는다.

export type AlimtalkKind =
  | "booking_confirm"
  | "review_request"
  | "touchup_reminder"
  | "winback";

const TEMPLATE_ENV: Record<AlimtalkKind, string | undefined> = {
  booking_confirm: process.env.ALIMTALK_TEMPLATE_BOOKING_CONFIRM,
  review_request: process.env.ALIMTALK_TEMPLATE_REVIEW_REQUEST,
  touchup_reminder: process.env.ALIMTALK_TEMPLATE_TOUCHUP_REMINDER,
  winback: undefined, // Phase 1.5 — 템플릿 심사 후 추가
};

export function alimtalkConfigured(kind: AlimtalkKind): boolean {
  return Boolean(
    process.env.SOLAPI_API_KEY &&
      process.env.SOLAPI_API_SECRET &&
      process.env.KAKAO_PFID &&
      TEMPLATE_ENV[kind]
  );
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
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
  const templateId = TEMPLATE_ENV[kind];
  const db = createSupabaseServiceClient();

  if (!alimtalkConfigured(kind)) {
    await db.from("messages").insert({
      customer_id: customerId,
      visit_id: visitId ?? null,
      kind,
      template_code: templateId ?? null,
      status: "skipped_unconfigured",
    });
    return { ok: false, error: "알림톡 환경변수 미설정" };
  }

  try {
    const service = new SolapiMessageService(
      process.env.SOLAPI_API_KEY!,
      process.env.SOLAPI_API_SECRET!
    );
    const res = await service.sendOne({
      to: phone.replace(/\D/g, ""),
      kakaoOptions: {
        pfId: process.env.KAKAO_PFID!,
        templateId: templateId!,
        variables,
        disableSms: true,
      },
    });
    await db.from("messages").insert({
      customer_id: customerId,
      visit_id: visitId ?? null,
      kind,
      template_code: templateId,
      provider_id: res.messageId,
      status: "sent",
    });
    return { ok: true, providerId: res.messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("messages").insert({
      customer_id: customerId,
      visit_id: visitId ?? null,
      kind,
      template_code: templateId,
      status: "failed",
    });
    console.error(`[alimtalk] ${kind} 발송 실패 (${customerId}):`, message);
    return { ok: false, error: message };
  }
}
