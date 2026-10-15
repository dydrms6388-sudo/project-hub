import { NextResponse, type NextRequest } from "next/server";
import { getDataSource } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stocks/search?q=삼성 → 종목명/코드 부분 일치 최대 10건 (공개 데이터, 키 불필요) */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 30);
  if (q.length < 1) return NextResponse.json({ items: [] });
  const items = await getDataSource().searchStocks(q, 10);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
