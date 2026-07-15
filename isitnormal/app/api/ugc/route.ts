import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/server";
import { clientIp, voterHash, newSessionId, SESSION_COOKIE } from "@/lib/voter";
import { scanUgc } from "@/lib/moderation";
import { makeShortId } from "@/lib/shortid";
import { CATEGORY_BY_SLUG, type CategorySlug } from "@/content/categories";
import { UGC_ENABLED } from "@/site.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_UGC_LIMIT = 3; // V5: IP+세션당 1일 작성 3건
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!UGC_ENABLED) {
    return NextResponse.json({ ok: false, error: "closed" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const categorySlug: string = body?.categorySlug;
  const title: string = (body?.title || "").trim();
  const bodyText: string = (body?.body || "").trim();
  const optA: string = (body?.optionA || "").trim();
  const optB: string = (body?.optionB || "").trim();

  if (!CATEGORY_BY_SLUG[categorySlug as CategorySlug])
    return NextResponse.json({ ok: false, error: "bad_category" }, { status: 400 });
  if (title.length < 6 || bodyText.length < 10 || !optA || !optB)
    return NextResponse.json({ ok: false, error: "too_short" }, { status: 400 });

  // 법무 스캔 (L1~L3) — title/body/선택지 전부
  for (const field of [title, bodyText, optA, optB]) {
    const r = scanUgc(field);
    if (r.action === "reject")
      return NextResponse.json({ ok: false, error: "moderation", reason: r.reason }, { status: 400 });
  }
  const sTitle = scanUgc(title);
  const sBody = scanUgc(bodyText);
  const safeTitle = sTitle.action === "mask" ? sTitle.text : title;
  const safeBody = sBody.action === "mask" ? sBody.text : bodyText;

  // 세션 확보
  const store = await cookies();
  let sid = store.get(SESSION_COOKIE)?.value;
  const freshSession = !sid;
  if (!sid) sid = newSessionId();
  const ip = clientIp(req.headers);
  const submitterHash = voterHash(sid, ip, "ugc");

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true, status: "pending" });

  // rate limit: 지난 24h 작성 수
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await admin
    .from("surveys")
    .select("id", { count: "exact", head: true })
    .eq("submitter_hash", submitterHash)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_UGC_LIMIT) {
    const res = NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    return res;
  }

  const cat = CATEGORY_BY_SLUG[categorySlug as CategorySlug];
  const catId =
    Object.keys(CATEGORY_BY_SLUG).indexOf(categorySlug) + 1; // schema 고정 id 1..12
  const slug = `u-${makeShortId(7)}`;

  const { data: survey, error } = await admin
    .from("surveys")
    .insert({
      slug,
      category_id: catId,
      title: safeTitle,
      body: safeBody,
      vote_kind: "binary",
      origin: "user",
      status: "pending", // 승인 전엔 익명 SELECT 불가 (E3)
      submitter_hash: submitterHash,
    })
    .select("id")
    .single();
  if (error || !survey)
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  await admin.from("survey_options").insert([
    { survey_id: survey.id, opt_key: "a", label: scanMaskLabel(optA), sort: 0 },
    { survey_id: survey.id, opt_key: "b", label: scanMaskLabel(optB), sort: 1 },
  ]);

  const res = NextResponse.json({ ok: true, status: "pending", category: cat.name });
  if (freshSession) {
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

function scanMaskLabel(s: string): string {
  const r = scanUgc(s);
  return r.action === "mask" ? r.text : s;
}
