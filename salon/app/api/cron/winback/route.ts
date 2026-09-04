import { type NextRequest } from "next/server";
import { alimtalkConfigured, sendAlimtalk } from "@/lib/alimtalk";
import { CronTally, unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매주 월요일 KST 9시. 마지막 방문 90일 초과 + 마케팅 동의 고객에게 재방문 쿠폰.
// Phase 1.5: winback 템플릿 심사 전에는 대상만 집계하고 발송하지 않는다.
// ALIMTALK_TEMPLATE_WINBACK이 채워지는 순간 자동으로 발송 모드로 전환된다.

const DORMANT_DAYS = 90;
/** 한 번 보낸 고객에게 반복 발송하지 않기 위한 재발송 금지 기간 */
const RESEND_BLOCK_DAYS = 180;
const BATCH_LIMIT = 50;

interface CustomerWithVisits {
  id: string;
  name: string;
  phone: string;
  visits: { visited_at: string }[];
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const db = createSupabaseServiceClient();
  const today = todayKST();
  const dormantCutoff = addDays(today, -DORMANT_DAYS);
  const tally = new CronTally();

  const { data: customers, error } = await db
    .from("customers")
    .select("id, name, phone, visits(visited_at)")
    .eq("consent_marketing", true)
    .returns<CustomerWithVisits[]>();
  if (error) {
    console.error("[cron/winback] 조회 실패:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 최근 발송분 조회 — 같은 고객에게 반복해서 쿠폰이 가지 않게 한다.
  const { data: recent } = await db
    .from("messages")
    .select("customer_id")
    .eq("kind", "winback")
    .eq("status", "sent")
    .gte("sent_at", `${addDays(today, -RESEND_BLOCK_DAYS)}T00:00:00Z`);
  const recentlySent = new Set((recent ?? []).map((m) => m.customer_id));

  const candidates = (customers ?? []).filter((c) => {
    if (recentlySent.has(c.id)) return false;
    if (!c.visits.length) return false;
    const lastVisit = c.visits.map((v) => v.visited_at).sort().at(-1)!;
    return lastVisit < dormantCutoff;
  });

  if (!alimtalkConfigured("winback")) {
    return tally.toResponse(candidates.length, {
      phase: "1.5-pending",
      note: "ALIMTALK_TEMPLATE_WINBACK 미설정 — 집계만 수행",
    });
  }

  for (const customer of candidates.slice(0, BATCH_LIMIT)) {
    tally.add(
      await sendAlimtalk({
        kind: "winback",
        customerId: customer.id,
        phone: customer.phone,
        variables: {
          "#{이름}": customer.name,
          "#{예약링크}": process.env.BOOKING_LINK ?? "",
        },
      })
    );
  }

  return tally.toResponse(candidates.length);
}
