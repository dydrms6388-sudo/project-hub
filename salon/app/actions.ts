"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAlimtalk } from "@/lib/alimtalk";
import { addDays, formatKoreanDate, formatTime, todayKST } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase";

// 서버액션은 전부 로그인 세션 클라이언트(RLS 적용)를 쓴다.
// owners에 없는 계정이면 insert/select가 RLS에 막혀 실패한다.

const TOUCHUP_DAYS = 35; // 붙임머리 리터치 주기 5주

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function insertVisit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customer: { id: string; name: string; phone: string },
  form: FormData
): Promise<string | null> {
  const visitedAt = String(form.get("visited_at") || "").trim();
  if (!visitedAt) return null;

  const serviceType = String(form.get("service_type") || "other");
  const priceRaw = String(form.get("price") || "").replace(/\D/g, "");
  const reservedTime = String(form.get("reserved_time") || "").trim() || null;
  const memo = String(form.get("memo") || "").trim() || null;

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      customer_id: customer.id,
      service_type: serviceType,
      price: priceRaw ? Number(priceRaw) : null,
      memo,
      visited_at: visitedAt,
      reserved_time: reservedTime,
      next_touchup_at:
        serviceType === "extension" ? addDays(visitedAt, TOUCHUP_DAYS) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`예약 저장 실패: ${error.message}`);

  // 오늘 이후 예약이면 예약 확인 알림톡 (미설정이면 skipped로 기록만 됨)
  if (visitedAt >= todayKST()) {
    await sendAlimtalk({
      kind: "booking_confirm",
      customerId: customer.id,
      visitId: visit.id,
      phone: customer.phone,
      variables: {
        "#{이름}": customer.name,
        "#{날짜}": formatKoreanDate(visitedAt),
        "#{시간}": reservedTime ? formatTime(reservedTime) : "예약된 시간",
      },
    });
  }
  return visit.id;
}

/** 신규 고객 등록 (+ 선택: 첫 예약) */
export async function createCustomer(form: FormData) {
  const supabase = await createSupabaseServerClient();

  const name = String(form.get("name") || "").trim();
  const phone = normalizePhone(String(form.get("phone") || ""));
  if (!name || phone.length < 10) throw new Error("이름과 연락처를 확인해주세요.");

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
    if (error.code === "23505") throw new Error("이미 등록된 연락처입니다.");
    throw new Error(`고객 등록 실패: ${error.message}`);
  }

  await insertVisit(supabase, customer, form);

  revalidatePath("/");
  redirect(`/customers/${customer.id}`);
}

/** 기존 고객에 예약 추가 */
export async function createVisit(customerId: string, form: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("id", customerId)
    .single();
  if (error || !customer) throw new Error("고객을 찾을 수 없습니다.");

  await insertVisit(supabase, customer, form);

  revalidatePath("/");
  revalidatePath(`/customers/${customerId}`);
}

/** "시술 완료" — 완료 시각 기록. 오늘 19시(KST) 크론이 후기 알림톡을 보낸다. */
export async function completeVisit(visitId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("visits")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", visitId)
    .is("completed_at", null);
  if (error) throw new Error(`완료 처리 실패: ${error.message}`);
  revalidatePath("/");
}
