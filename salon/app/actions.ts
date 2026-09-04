"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAlimtalk } from "@/lib/alimtalk";
import { requireOwner } from "@/lib/auth";
import { addDays, formatKoreanDate, formatTime, isPast } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase";
import {
  clampMemo,
  isServiceType,
  isValidDate,
  isValidName,
  isValidPhone,
  isValidTime,
  normalizePhone,
  parsePrice,
} from "@/lib/validate";

// 모든 서버액션은 requireOwner()로 로그인 + owners 등록을 확인한 뒤 동작한다.
// 오류는 throw 대신 FormState로 돌려줘 화면에 그대로 보여준다.

export interface FormState {
  error?: string;
  ok?: boolean;
}

const TOUCHUP_DAYS = 35; // 붙임머리 리터치 주기 5주

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface VisitInput {
  visitedAt: string;
  serviceType: string;
  price: number | null;
  reservedTime: string | null;
  memo: string | null;
}

/** 폼에서 방문 정보를 읽고 검증한다. 날짜가 비어 있으면 null(방문 등록 안 함). */
function readVisitInput(form: FormData): VisitInput | null | { error: string } {
  const visitedAt = String(form.get("visited_at") ?? "").trim();
  if (!visitedAt) return null;
  if (!isValidDate(visitedAt)) return { error: "방문 날짜가 올바르지 않습니다." };

  const serviceType = String(form.get("service_type") ?? "other");
  if (!isServiceType(serviceType)) return { error: "시술 종류를 확인해주세요." };

  const price = parsePrice(String(form.get("price") ?? ""));
  if (price === undefined) return { error: "가격은 0 이상의 숫자로 입력해주세요." };

  const rawTime = String(form.get("reserved_time") ?? "").trim();
  if (rawTime && !isValidTime(rawTime)) return { error: "시간 형식을 확인해주세요." };

  return {
    visitedAt,
    serviceType,
    price,
    reservedTime: rawTime || null,
    memo: clampMemo(String(form.get("memo") ?? "")),
  };
}

async function insertVisit(
  supabase: Supabase,
  customer: { id: string; name: string; phone: string },
  input: VisitInput
): Promise<{ error?: string }> {
  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      customer_id: customer.id,
      service_type: input.serviceType,
      price: input.price,
      memo: input.memo,
      visited_at: input.visitedAt,
      reserved_time: input.reservedTime,
      next_touchup_at:
        input.serviceType === "extension"
          ? addDays(input.visitedAt, TOUCHUP_DAYS)
          : null,
    })
    .select("id")
    .single();
  if (error) return { error: `예약 저장 실패: ${error.message}` };

  // 지난 날짜를 소급 입력한 경우에는 예약 확인 알림톡을 보내지 않는다.
  if (!isPast(input.visitedAt)) {
    await sendAlimtalk({
      kind: "booking_confirm",
      customerId: customer.id,
      visitId: visit.id,
      phone: customer.phone,
      variables: {
        "#{이름}": customer.name,
        "#{날짜}": formatKoreanDate(input.visitedAt),
        "#{시간}": input.reservedTime ? formatTime(input.reservedTime) : "예약된 시간",
      },
    });
  }
  return {};
}

/** 신규 고객 등록 (+ 선택: 첫 예약) */
export async function createCustomer(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const { supabase } = await requireOwner();

  const name = String(form.get("name") ?? "").trim();
  if (!isValidName(name)) return { error: "이름을 입력해주세요." };

  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!isValidPhone(phone))
    return { error: "연락처를 010-0000-0000 형식으로 입력해주세요." };

  const visitInput = readVisitInput(form);
  if (visitInput && "error" in visitInput) return { error: visitInput.error };

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      name,
      phone,
      consent_marketing: form.get("consent_marketing") === "on",
      consent_photo: form.get("consent_photo") === "on",
    })
    .select("id, name, phone")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "이미 등록된 연락처입니다." };
    return { error: `고객 등록 실패: ${error.message}` };
  }

  if (visitInput) {
    const result = await insertVisit(supabase, customer, visitInput);
    // 고객은 저장됐으므로 상세 화면으로 보내되 예약 실패는 알린다.
    if (result.error) return { error: result.error };
  }

  revalidatePath("/");
  redirect(`/customers/${customer.id}`);
}

/** 기존 고객에 예약 추가 */
export async function createVisit(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const { supabase } = await requireOwner();

  const customerId = String(form.get("customer_id") ?? "");
  if (!customerId) return { error: "고객 정보가 없습니다." };

  const visitInput = readVisitInput(form);
  if (!visitInput) return { error: "방문 날짜를 입력해주세요." };
  if ("error" in visitInput) return { error: visitInput.error };

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("id", customerId)
    .single();
  if (error || !customer) return { error: "고객을 찾을 수 없습니다." };

  const result = await insertVisit(supabase, customer, visitInput);
  if (result.error) return result;

  revalidatePath("/");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

/** "시술 완료" — 완료 시각 기록. 당일 19시(KST) 크론이 후기 알림톡을 보낸다. */
export async function completeVisit(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const { supabase } = await requireOwner();

  const visitId = String(form.get("visit_id") ?? "");
  if (!visitId) return { error: "예약 정보가 없습니다." };

  const { error } = await supabase
    .from("visits")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", visitId)
    .is("completed_at", null);
  if (error) return { error: `완료 처리 실패: ${error.message}` };

  revalidatePath("/");
  revalidatePath(`/customers`);
  return { ok: true };
}

/** 실수로 누른 "시술 완료" 되돌리기. 후기 알림톡이 이미 나갔으면 막는다. */
export async function undoCompleteVisit(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const { supabase } = await requireOwner();

  const visitId = String(form.get("visit_id") ?? "");
  if (!visitId) return { error: "예약 정보가 없습니다." };

  const { data, error } = await supabase
    .from("visits")
    .update({ completed_at: null })
    .eq("id", visitId)
    .is("review_sent_at", null)
    .select("id");
  if (error) return { error: `되돌리기 실패: ${error.message}` };
  if (!data?.length)
    return { error: "후기 알림톡이 이미 발송되어 되돌릴 수 없습니다." };

  revalidatePath("/");
  return { ok: true };
}
