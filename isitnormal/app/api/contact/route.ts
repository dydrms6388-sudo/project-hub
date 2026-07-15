import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 문의 접수 (실동작). 이메일은 선택 — 회신 원할 때만. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message: string = (body?.message || "").trim();
  const email: string = (body?.email || "").trim();
  if (message.length < 5) {
    return NextResponse.json({ ok: false, error: "too_short" }, { status: 400 });
  }
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true });

  const { error } = await admin.from("contact_messages").insert({
    email: email ? email.slice(0, 200) : null,
    message: message.slice(0, 4000),
  });
  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
