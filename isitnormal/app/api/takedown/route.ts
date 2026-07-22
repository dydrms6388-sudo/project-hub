import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 삭제 요청 접수 (L4: 48시간 내 처리 약속 + 실제 처리 큐). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const targetRef: string = (body?.targetRef || "").trim();
  const contact: string = (body?.contact || "").trim();
  const reason: string = (body?.reason || "").trim();
  if (targetRef.length < 3 || contact.length < 3 || reason.length < 3) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true, slaHours: 48 });

  const { error } = await admin.from("takedown_requests").insert({
    target_ref: targetRef.slice(0, 500),
    contact: contact.slice(0, 200),
    reason: reason.slice(0, 2000),
  });
  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, slaHours: 48 });
}
