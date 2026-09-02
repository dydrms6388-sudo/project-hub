import { NextResponse, type NextRequest } from "next/server";
import { getDataSource } from "@/lib/data";
import { DCA_LIMITS, downsampleHistory, isValidDateString, yearsAgoDate } from "@/lib/dca";
import { kstDateString } from "@/lib/kst";

export const runtime = "nodejs";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * GET /api/prices/005930?from=2019-09-01
 * → { points: PricePoint[] } 종가 시계열(오름차순). from 기본값 = 5년 전.
 * 점이 많으면 매수일 후보(1·15·25일 이후 첫 거래일)와 월말·최신 점을 남겨 약 1,600점 이하로 축약한다.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ points: [], error: "종목코드는 6자리 숫자여야 합니다." }, { status: 400 });
  }

  const today = kstDateString();
  const raw = req.nextUrl.searchParams.get("from");
  let from = yearsAgoDate(today, 5);
  if (raw !== null && raw !== "") {
    if (!isValidDateString(raw)) {
      return NextResponse.json({ points: [], error: "from 은 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
    }
    if (raw < DCA_LIMITS.minStartDate) {
      return NextResponse.json({ points: [], error: `from 은 ${DCA_LIMITS.minStartDate} 이후여야 합니다.` }, { status: 400 });
    }
    if (raw > today) {
      return NextResponse.json({ points: [], error: "from 은 오늘 이후일 수 없습니다." }, { status: 400 });
    }
    from = raw;
  }

  try {
    const hist = await getDataSource().getPriceHistory(code, from);
    const { points, downsampled } = downsampleHistory(hist, DCA_LIMITS.maxPoints);
    return NextResponse.json(
      { points, from, downsampled, sourcePoints: hist.length },
      { headers: { "Cache-Control": CACHE } },
    );
  } catch {
    return NextResponse.json({ points: [], error: "주가 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
