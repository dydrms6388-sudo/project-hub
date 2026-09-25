import { type NextRequest } from "next/server";
import { sendAlimtalk } from "@/lib/alimtalk";
import { CronTally, unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매일 KST 19시: 시술 완료된 방문 중 후기 요청 미발송 건에 알림톡.
// 발송에 실패하면 review_sent_at이 null로 남아 다음날(최대 2일 유예) 크론이 다시 잡는다.

const GRACE_DAYS = 2;
const BATCH_LIMIT = 100;

interface ReviewTarget {
  id: string;
  visited_at: string;
  customers: { id: string; name: string; phone: string } | null;
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const db = createSupabaseServiceClient();
  const today = todayKST();
  const tally = new CronTally();

  const { data: targets, error } = await db
    .from("visits")
    .select("id, visited_at, customers(id, name, phone)")
    .gte("visited_at", addDays(today, -GRACE_DAYS))
    .lte("visited_at", today)
    .not("completed_at", "is", null)
    .is("review_sent_at", null)
    .order("visited_at", { ascending: true })
    .limit(BATCH_LIMIT)
    .returns<ReviewTarget[]>();
  if (error) {
    console.error("[cron/review] 조회 실패:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

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
    if (tally.add(result)) {
      const { error: updateError } = await db
        .from("visits")
        .update({ review_sent_at: new Date().toISOString() })
        .eq("id", visit.id);
      // 기록에 실패하면 내일 중복 발송될 수 있으므로 반드시 남긴다.
      if (updateError)
        console.error(`[cron/review] review_sent_at 기록 실패 (${visit.id}):`, updateError.message);
    }
  }

  return tally.toResponse(targets?.length ?? 0);
}
