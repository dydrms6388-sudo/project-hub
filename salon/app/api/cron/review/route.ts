import { NextResponse, type NextRequest } from "next/server";
import { sendAlimtalk } from "@/lib/alimtalk";
import { unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 매일 KST 19시: 시술 완료된 방문 중 후기 요청 미발송 건에 알림톡.
// 발송 실패 시 review_sent_at이 null로 남아 다음날 크론이 다시 잡는다(최근 3일 범위).

interface ReviewTarget {
  id: string;
  customers: { id: string; name: string; phone: string } | null;
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const db = createSupabaseServiceClient();
  const today = todayKST();

  const { data: targets, error } = await db
    .from("visits")
    .select("id, customers(id, name, phone)")
    .gte("visited_at", addDays(today, -2))
    .lte("visited_at", today)
    .not("completed_at", "is", null)
    .is("review_sent_at", null)
    .returns<ReviewTarget[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const visit of targets ?? []) {
    if (!visit.customers) continue;
    const result = await sendAlimtalk({
      kind: "review_request",
      customerId: visit.customers.id,
      visitId: visit.id,
      phone: visit.customers.phone,
      variables: {
        "#{이름}": visit.customers.name,
        "#{리뷰링크}": process.env.REVIEW_LINK ?? "",
      },
    });
    if (result.ok) {
      await db
        .from("visits")
        .update({ review_sent_at: new Date().toISOString() })
        .eq("id", visit.id);
      sent++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ candidates: targets?.length ?? 0, sent, failed });
}
