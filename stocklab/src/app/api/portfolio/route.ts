import { NextResponse, type NextRequest } from "next/server";
import { getDataSource } from "@/lib/data";
import { CODE_RE, MAX_ITEMS, correlationMatrix, logReturns, normalizeItems, type PortfolioItem } from "@/lib/portfolio";
import type { DividendRow, PricePoint, ScreenRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 포트폴리오 X-ray 조회 API.
 *
 * 개인정보·보유 내역을 서버에 저장하지 않습니다. 요청 본문(종목코드·평가금액)은
 * 응답을 만드는 동안만 메모리에서 사용되고, 로그·DB 어디에도 기록하지 않습니다.
 *
 * POST { items: [{ code, amount }] }  → 종목 행 + 배당 행 + 일간 로그수익률 상관계수 행렬
 * GET  ?codes=005930,000660           → 종목 행만
 */

/** 상관계수 계산에 쓰는 최대 거래일 수 (약 1년) */
const CORR_WINDOW = 250;
/** 상관계수를 산출하기 위한 최소 공통 거래일 수 */
const MIN_OVERLAP = 60;
/** 250 거래일을 확보하기 위한 달력일 여유 */
const LOOKBACK_DAYS = 420;

interface PortfolioResponse {
  rows: (ScreenRow | null)[];
  dividends: (DividendRow | null)[];
  corr: number[][] | null;
  codes: string[];
  /** 상관계수 산출에 사용된 공통 거래일 수 (없으면 0) */
  corrDays: number;
  mode: "supabase" | "sample";
  asOf: string | null;
}

function parseItems(input: unknown): PortfolioItem[] | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "요청 본문이 올바르지 않습니다." };
  const items = (input as { items?: unknown }).items;
  if (!Array.isArray(items)) return { error: "items 배열이 필요합니다." };
  if (items.length === 0) return { error: "종목을 1개 이상 입력해 주세요." };
  if (items.length > MAX_ITEMS) return { error: `종목은 최대 ${MAX_ITEMS}개까지 입력할 수 있습니다.` };
  const parsed: PortfolioItem[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) return { error: "items 항목 형식이 올바르지 않습니다." };
    const code = String((raw as { code?: unknown }).code ?? "").trim();
    const amount = Number((raw as { amount?: unknown }).amount);
    if (!CODE_RE.test(code)) return { error: `종목코드는 6자리 숫자여야 합니다: ${code.slice(0, 12) || "(빈 값)"}` };
    if (!Number.isFinite(amount) || amount <= 0) return { error: `평가금액은 0보다 커야 합니다: ${code}` };
    parsed.push({ code, amount });
  }
  const normalized = normalizeItems(parsed);
  if (normalized.length === 0) return { error: "유효한 종목이 없습니다." };
  return normalized;
}

function fromDateString(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/** 모든 종목에 공통으로 존재하는 거래일만 남겨 종목별 종가 배열을 만든다 */
function alignCloses(histories: readonly PricePoint[][]): { dates: string[]; closes: number[][] } {
  const first = histories[0];
  if (!first || histories.length === 0) return { dates: [], closes: [] };
  const maps = histories.map((h) => new Map(h.map((p) => [p.trade_date, p.close])));
  const dates: string[] = [];
  for (const p of first) {
    if (maps.every((m) => (m.get(p.trade_date) ?? 0) > 0)) dates.push(p.trade_date);
  }
  dates.sort();
  const window = dates.slice(-CORR_WINDOW);
  const closes = maps.map((m) => window.map((d) => m.get(d) ?? 0));
  return { dates: window, closes };
}

async function buildCorr(codes: readonly string[]): Promise<{ corr: number[][] | null; days: number }> {
  if (codes.length < 2) return { corr: null, days: 0 };
  const src = getDataSource();
  const from = fromDateString(LOOKBACK_DAYS);
  const histories = await Promise.all(codes.map((c) => src.getPriceHistory(c, from).catch(() => [] as PricePoint[])));
  if (histories.some((h) => h.length === 0)) return { corr: null, days: 0 };
  const { dates, closes } = alignCloses(histories);
  if (dates.length < MIN_OVERLAP) return { corr: null, days: dates.length };
  const returns = closes.map((c) => logReturns(c));
  if (returns.some((r) => r.length < MIN_OVERLAP - 1)) return { corr: null, days: dates.length };
  return { corr: correlationMatrix(returns), days: dates.length };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문을 읽을 수 없습니다." }, { status: 400 });
  }
  const parsed = parseItems(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const src = getDataSource();
  const codes = parsed.map((i) => i.code);
  try {
    const [rows, dividends, corrResult, asOf] = await Promise.all([
      Promise.all(codes.map((c) => src.getScreenRow(c))),
      Promise.all(codes.map((c) => src.getDividendRow(c))),
      buildCorr(codes),
      src.dataAsOf(),
    ]);
    const payload: PortfolioResponse = {
      rows,
      dividends,
      corr: corrResult.corr,
      codes,
      corrDays: corrResult.days,
      mode: src.mode,
      asOf,
    };
    // 입력값을 저장하지 않으므로 응답도 캐시하지 않는다.
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("codes") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const codes = [...new Set(raw.filter((c) => CODE_RE.test(c)))].slice(0, MAX_ITEMS);
  if (codes.length === 0) return NextResponse.json({ error: "codes 파라미터가 필요합니다 (예: ?codes=005930,000660)." }, { status: 400 });
  const src = getDataSource();
  try {
    const rows = await Promise.all(codes.map((c) => src.getScreenRow(c)));
    return NextResponse.json(
      { rows, codes, mode: src.mode },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "데이터를 불러오지 못했습니다." }, { status: 502 });
  }
}
