import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 관리자 모더레이션 — 설문 승인/반려/보류 처리, takedown·신고 완료 처리. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: "offline" }, { status: 503 });

  const { kind, id, action } = body ?? {};

  if (kind === "survey" && ["approved", "rejected", "held"].includes(action)) {
    const { error } = await admin.from("surveys").update({ status: action }).eq("id", id);
    return NextResponse.json({ ok: !error });
  }
  if (kind === "takedown" && action === "handle") {
    const { error } = await admin
      .from("takedown_requests")
      .update({ handled: true, handled_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: !error });
  }
  if (kind === "comment" && ["approved", "rejected", "held"].includes(action)) {
    const { error } = await admin.from("comments").update({ status: action }).eq("id", id);
    return NextResponse.json({ ok: !error });
  }
  if (kind === "report" && action === "handle") {
    const { error } = await admin.from("reports").update({ handled: true }).eq("id", id);
    return NextResponse.json({ ok: !error });
  }
  return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
}
