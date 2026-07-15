import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getSurveyBySlug } from "@/lib/surveys";
import { makeShortId } from "@/lib/shortid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 공유용 짧은링크 생성 → /s/{shortId}. 실패/오프라인이면 offline:true (호출측이 /q/ 로 폴백). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  const optionKey: string | undefined = body?.optionKey;
  const seed = slug ? getSurveyBySlug(slug) : undefined;
  if (!seed || !optionKey || !seed.options.some((o) => o.key === optionKey)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true });

  for (let attempt = 0; attempt < 4; attempt++) {
    const shortId = makeShortId();
    const { error } = await admin
      .from("short_links")
      .insert({ short_id: shortId, slug, opt_key: optionKey });
    if (!error) return NextResponse.json({ ok: true, shortId, url: `/s/${shortId}` });
    if (error.code !== "23505") break; // 중복 외 오류면 중단
  }
  return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
}
