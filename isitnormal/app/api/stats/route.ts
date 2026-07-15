import { NextResponse, type NextRequest } from "next/server";
import { getStatsBySlug } from "@/lib/stats";
import { getSurveyBySlug } from "@/lib/surveys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 결과만 보기 — 투표 없이 통계 조회 (n<30이면 집계 중). */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!getSurveyBySlug(slug)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const stats = await getStatsBySlug(slug);
  return NextResponse.json({ ok: true, stats });
}
