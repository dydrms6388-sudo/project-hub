import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/server";
import { clientIp, hashIp, voterHash, newSessionId, SESSION_COOKIE } from "@/lib/voter";
import { getSurveyBySlug } from "@/lib/surveys";
import type { SurveyStats, OptionStat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_VOTE_LIMIT = 50; // V5: IP+세션당 1일 투표 50건
const DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_ATTR = {
  age_band: ["10s", "20s", "30s", "40s", "50s+"],
  gender: ["f", "m", "x"],
};

interface StatRow {
  opt_key: string;
  label: string;
  votes: number | string;
  n: number | string;
  show_stats: boolean;
}

function shapeStats(rows: StatRow[]): SurveyStats {
  const n = Number(rows[0]?.n) || 0;
  const options: OptionStat[] = rows.map((r) => ({
    key: r.opt_key,
    label: r.label,
    votes: Number(r.votes) || 0,
    pct: 0,
  }));
  const total = options.reduce((a, o) => a + o.votes, 0);
  for (const o of options) o.pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
  return { n, showStats: Boolean(rows[0]?.show_stats), options };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug: string | undefined = body?.slug;
  const optionKey: string | undefined = body?.optionKey;
  if (!slug || !optionKey) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // 설문·선택지 유효성은 로컬 시드로 우선 검증 (환각/임의 slug 차단)
  const seed = getSurveyBySlug(slug);
  if (!seed) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!seed.options.some((o) => o.key === optionKey)) {
    return NextResponse.json({ ok: false, error: "bad_option" }, { status: 400 });
  }

  // 세션 쿠키 확보 (없으면 발급)
  const store = await cookies();
  let sid = store.get(SESSION_COOKIE)?.value;
  const freshSession = !sid;
  if (!sid) sid = newSessionId();

  const withCookie = (payload: unknown, status = 200) => {
    const res = NextResponse.json(payload, { status });
    if (freshSession) {
      res.cookies.set(SESSION_COOKIE, sid!, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 400,
        path: "/",
      });
    }
    return res;
  };

  const admin = getAdminSupabase();
  // Supabase 미설정 = 오프라인 렌더. 로컬에서만 투표 처리한 척하고 통계는 집계 중.
  if (!admin) {
    return withCookie({ ok: true, offline: true, voted: true, stats: null });
  }

  const ip = clientIp(req.headers);
  const fingerprint = String(body?.fingerprint || "nofp").slice(0, 128);
  const ipHash = hashIp(ip);
  const vHash = voterHash(sid!, ip, fingerprint);

  // 승인된 설문만 (RLS와 별개로 서버에서도 방어)
  const { data: survey } = await admin
    .from("surveys")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!survey || survey.status !== "approved") {
    return withCookie({ ok: false, error: "not_available" }, 404);
  }

  const { data: option } = await admin
    .from("survey_options")
    .select("id")
    .eq("survey_id", survey.id)
    .eq("opt_key", optionKey)
    .maybeSingle();
  if (!option) return withCookie({ ok: false, error: "bad_option" }, 400);

  // 이미 투표했는지 (V1: survey당 voter_hash unique → 24h 재투표 금지 충족)
  const { data: existing } = await admin
    .from("votes")
    .select("id")
    .eq("survey_id", survey.id)
    .eq("voter_hash", vHash)
    .maybeSingle();

  let alreadyVoted = Boolean(existing);

  if (!alreadyVoted) {
    // rate limit: 지난 24h IP 투표 수
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { count } = await admin
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_VOTE_LIMIT) {
      return withCookie({ ok: false, error: "rate_limited" }, 429);
    }

    const attrs: Record<string, string> = {};
    if (ALLOWED_ATTR.age_band.includes(body?.attrs?.age_band)) attrs.age_band = body.attrs.age_band;
    if (ALLOWED_ATTR.gender.includes(body?.attrs?.gender)) attrs.gender = body.attrs.gender;
    if (typeof body?.attrs?.region === "string") attrs.region = String(body.attrs.region).slice(0, 16);

    const { error: insErr } = await admin.from("votes").insert({
      survey_id: survey.id,
      option_id: option.id,
      voter_hash: vHash,
      ip_hash: ipHash,
      fingerprint,
      ...attrs,
    });
    // unique 충돌(경합) = 이미 투표한 것으로 처리
    if (insErr && insErr.code === "23505") alreadyVoted = true;
    else if (insErr) return withCookie({ ok: false, error: "insert_failed" }, 500);
  }

  const { data: statRows } = await admin.rpc("get_survey_stats_by_slug", { p_slug: slug });
  const stats = statRows && (statRows as StatRow[]).length ? shapeStats(statRows as StatRow[]) : null;

  return withCookie({ ok: true, voted: true, alreadyVoted, stats });
}
