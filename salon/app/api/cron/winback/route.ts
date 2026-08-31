import { NextResponse, type NextRequest } from "next/server";
import { unauthorizedCron } from "@/lib/cron";
import { addDays, todayKST } from "@/lib/dates";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 매주 월요일 KST 9시. Phase 1.5: 쿠폰 템플릿 심사 전까지는
// 대상자만 집계해서 반환하고 발송하지 않는다.

interface CustomerWithVisits {
  id: string;
  name: string;
  visits: { visited_at: string }[];
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const db = createSupabaseServiceClient();
  const cutoff = addDays(todayKST(), -90);

  const { data: customers, error } = await db
    .from("customers")
    .select("id, name, visits(visited_at)")
    .eq("consent_marketing", true)
    .returns<CustomerWithVisits[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (customers ?? []).filter((c) => {
    if (!c.visits.length) return false;
    const lastVisit = c.visits.map((v) => v.visited_at).sort().at(-1)!;
    return lastVisit < cutoff;
  });

  // TODO(Phase 1.5): winback 템플릿 심사 통과 후 sendAlimtalk 연결 + messages.kind='winback' 기록
  return NextResponse.json({
    phase: "1.5-pending",
    candidates: candidates.length,
    sent: 0,
  });
}
