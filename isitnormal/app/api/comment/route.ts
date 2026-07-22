import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/server";
import { clientIp, voterHash, newSessionId, SESSION_COOKIE } from "@/lib/voter";
import { scanUgc } from "@/lib/moderation";
import { getSurveyBySlug } from "@/lib/surveys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_COMMENT_LIMIT = 20;

/** 한 줄 의견(참여 계단 2단계). 스캔 통과분은 즉시 승인, 마스킹/보류분은 pending. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string = (body?.slug || "").trim();
  const text: string = (body?.body || "").trim();
  if (!getSurveyBySlug(slug) || text.length < 2 || text.length > 300) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const scan = scanUgc(text);
  if (scan.action === "reject") {
    return NextResponse.json({ ok: false, error: "moderation", reason: scan.reason }, { status: 400 });
  }
  const safe = scan.action === "mask" ? scan.text : text;
  const status = scan.action === "accept" ? "approved" : "pending";

  const store = await cookies();
  let sid = store.get(SESSION_COOKIE)?.value;
  const fresh = !sid;
  if (!sid) sid = newSessionId();
  const ip = clientIp(req.headers);
  const vHash = voterHash(sid, ip, "comment");

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true, status });

  const { data: survey } = await admin
    .from("surveys")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!survey || survey.status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await admin
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("voter_hash", vHash)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_COMMENT_LIMIT) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const { error } = await admin
    .from("comments")
    .insert({ survey_id: survey.id, body: safe, status, voter_hash: vHash });
  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  const res = NextResponse.json({ ok: true, status, body: safe });
  if (fresh) {
    res.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
  }
  return res;
}
