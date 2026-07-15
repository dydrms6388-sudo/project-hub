import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getSurveyBySlug } from "@/lib/surveys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 알림 opt-in (R1) — 이메일만, 로그인 강요 없음. 내 글/투표에 반응 오면 알림. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string = (body?.email || "").trim();
  const slug: string | null = body?.slug || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  }
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true });

  // slug가 있으면 해당 설문 구독, 없으면 주간 통계 구독
  let surveyId: string | null = null;
  if (slug && getSurveyBySlug(slug)) {
    const { data } = await admin.from("surveys").select("id").eq("slug", slug).maybeSingle();
    surveyId = data?.id ?? null;
  }
  const { error } = await admin
    .from("notify_optin")
    .insert({ email: email.slice(0, 200), survey_id: surveyId });
  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
