import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withPushSchema } from "@/lib/push/db-types";
import { openedSchema } from "@/lib/push/schemas";

export const dynamic = "force-dynamic";

/**
 * 알림 클릭 보고 (sw notificationclick → POST {qid}). `mark_push_opened` 는 auth.uid() 본인 행만 갱신.
 * sendBeacon(text/plain) 도 받는다. 실패해도 200 (UX 에 영향 없음, push_opened 지표만).
 */
export async function POST(req: Request): Promise<NextResponse> {
  let parsed: { qid: number } | null = null;
  try {
    const text = await req.text();
    const json = JSON.parse(text) as unknown;
    const r = openedSchema.safeParse(json);
    parsed = r.success ? r.data : null;
  } catch {
    parsed = null;
  }
  if (!parsed) return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });

  const supabase = withPushSchema(await createClient());
  const { data, error } = await supabase.rpc("mark_push_opened", { p_queue_id: parsed.qid });
  if (error) {
    // 세션 없음(로그아웃 상태에서 클릭) 등 — 지표 누락일 뿐이므로 조용히 200
    return NextResponse.json({ ok: true, updated: 0 }, { headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: true, updated: data ?? 0 }, { headers: { "cache-control": "no-store" } });
}
