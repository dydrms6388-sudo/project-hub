import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HIDE_THRESHOLD = 3; // 누적 신고 3건 → 자동 숨김(held)

/** 신고 접수 → 임계치 도달 시 해당 설문 자동 숨김(D6). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string = (body?.slug || "").trim();
  const reason: string = (body?.reason || "").trim();
  if (!slug || reason.length < 2) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true });

  const { data: survey } = await admin
    .from("surveys")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!survey) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await admin.from("reports").insert({ target: "survey", target_id: survey.id, reason });

  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target", "survey")
    .eq("target_id", survey.id)
    .eq("handled", false);

  if ((count ?? 0) >= HIDE_THRESHOLD && survey.status === "approved") {
    await admin.from("surveys").update({ status: "held" }).eq("id", survey.id);
  }

  return NextResponse.json({ ok: true });
}
