import { NextResponse, type NextRequest } from "next/server";
import { sendAlimtalk } from "@/lib/alimtalk";
import { unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 매일 KST 9시: 리터치 예정일이 된 붙임머리 고객에게 안내 알림톡.
// 마케팅 동의 고객에게만 발송. 실패 시 다음날 다시 잡는다(최근 3일 범위).

interface TouchupTarget {
  id: string;
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

  const { data: targets, error } = await db
    .from("visits")
    .select("id, customers!inner(id, name, phone, consent_marketing)")
    .gte("next_touchup_at", addDays(today, -2))
    .lte("next_touchup_at", today)
    .is("touchup_sent_at", null)
    .eq("customers.consent_marketing", true)
    .returns<TouchupTarget[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const visit of targets ?? []) {
    if (!visit.customers) continue;
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
    if (result.ok) {
      await db
        .from("visits")
        .update({ touchup_sent_at: new Date().toISOString() })
        .eq("id", visit.id);
      sent++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ candidates: targets?.length ?? 0, sent, failed });
}
