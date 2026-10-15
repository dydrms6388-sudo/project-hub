import { NextResponse, type NextRequest } from "next/server";
import { getDataSource } from "@/lib/data";
import type { DividendRow } from "@/lib/types";
import { PLAN_LIMITS } from "@/lib/dividend-plan";

export const runtime = "nodejs";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * GET /api/dividends?codes=005930,000660
 * → { items: DividendRow[] } — 6자리 종목코드 최대 30개. 배당 정보가 없는 코드는 결과에서 빠진다.
 * 공개 데이터(일배치 적재)이므로 인증 없이 캐시 가능.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("codes") ?? "";
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const code = part.trim();
    if (!/^\d{6}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= PLAN_LIMITS.holdings) break;
  }
  if (codes.length === 0) {
    return NextResponse.json(
      { items: [], error: `codes 파라미터에 6자리 종목코드를 1~${PLAN_LIMITS.holdings}개 지정해 주세요. 예: ?codes=005930,000660` },
      { status: 400 },
    );
  }

  const source = getDataSource();
  try {
    const rows = await Promise.all(codes.map((code) => source.getDividendRow(code)));
    const items = rows.filter((r): r is DividendRow => r !== null);
    return NextResponse.json({ items }, { headers: { "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json({ items: [], error: "배당 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
