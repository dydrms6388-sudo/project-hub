import { type NextRequest } from "next/server";
import { sendAlimtalk } from "@/lib/alimtalk";
import { CronTally, unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매일 KST 9시: 리터치 예정일이 된 붙임머리 고객에게 안내 알림톡.
// 마케팅 동의 고객에게만 발송한다(정보통신망법). 실패 시 다음날 다시 잡는다.

const GRACE_DAYS = 2;
const BATCH_LIMIT = 100;

interface TouchupTarget {
  id: string;
  next_touchup_at: string;
  customers: {
    id: string;
    name: string;
    phone: string;
    consent_marketing: boolean;
  } | null;
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const db = createSupabaseServiceClient();
  const today = todayKST();
  const tally = new CronTally();

  const { data: targets, error } = await db
    .from("visits")
    .select("id, next_touchup_at, customers!inner(id, name, phone, consent_marketing)")
    .gte("next_touchup_at", addDays(today, -GRACE_DAYS))
    .lte("next_touchup_at", today)
    .is("touchup_sent_at", null)
    .eq("customers.consent_marketing", true)
    .order("next_touchup_at", { ascending: true })
    .limit(BATCH_LIMIT)
    .returns<TouchupTarget[]>();
  if (error) {
    console.error("[cron/touchup] 조회 실패:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  for (const visit of targets ?? []) {
    // 조인 필터가 이미 걸러주지만, 동의 확인은 발송 직전에 한 번 더 본다.
    if (!visit.customers?.consent_marketing) continue;
    const result = await sendAlimtalk({
      kind: "touchup_reminder",
      customerId: visit.customers.id,
      visitId: visit.id,
      phone: visit.customers.phone,
      variables: {
        "#{이름}": visit.customers.name,
        "#{예약링크}": process.env.BOOKING_LINK ?? "",
      },
    });
    if (tally.add(result)) {
      const { error: updateError } = await db
        .from("visits")
        .update({ touchup_sent_at: new Date().toISOString() })
        .eq("id", visit.id);
      if (updateError)
        console.error(`[cron/touchup] touchup_sent_at 기록 실패 (${visit.id}):`, updateError.message);
    }
  }

  return tally.toResponse(targets?.length ?? 0);
}
