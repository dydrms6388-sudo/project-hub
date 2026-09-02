import type { DailyPick, DividendFilters, DividendRow, ScreenRow, ValueFilters } from "@/lib/types";
import { applyDividendFilters, applyValueFilters } from "@/lib/data/filters";
import { dividendHref, valueHref } from "@/lib/screener-params";
import { fmtNum, fmtPct } from "@/lib/format";

/**
 * 전략 정의 카탈로그.
 * - P1(현재 스택: 재무 스냅샷 + 배당 요약)에서 실행 가능한 전략은 4개.
 * - 나머지는 일별 시세 히스토리(daily_prices)가 필요하여 P2 에서 활성화(p1Executable:false).
 * 모든 문구는 "조건 충족" 관점으로만 서술한다 — 매매 권유 표현 금지.
 */

export type StrategyCategory = "value" | "dividend" | "momentum" | "quality" | "technical" | "composite";
export type StrategyTier = "free" | "basic" | "pro";

export interface Strategy {
  key: string;
  label: string;
  category: StrategyCategory;
  description: string;
  /** 사람이 읽는 규칙 목록 (필터 → 정렬 순) */
  rules: string[];
  tier: StrategyTier;
  p1Executable: boolean;
  /** 데이터 요건 메모 (P2 전략용) */
  requires?: string;
}

export const CATEGORY_LABEL: Record<StrategyCategory, string> = {
  value: "가치",
  dividend: "배당",
  momentum: "모멘텀",
  quality: "퀄리티",
  technical: "기술적",
  composite: "복합",
};

export const STRATEGIES: Strategy[] = [
  /* ── P1 실행 가능 (4) ── */
  {
    key: "low-pbr-high-roe",
    label: "저PBR + 고ROE",
    category: "value",
    description: "장부가 대비 낮은 가격(PBR)과 높은 자본 효율(ROE)이 동시에 성립하는 종목을 찾습니다.",
    rules: ["PBR 1배 이하 (0 초과)", "ROE 10% 이상", "부채비율 150% 이하", "정렬: ROE ÷ PBR 높은 순"],
    tier: "free",
    p1Executable: true,
  },
  {
    key: "magic-formula-lite",
    label: "매직 포뮬러 라이트",
    category: "composite",
    description: "그린블라트 매직 포뮬러의 간이 버전 — 이익 대비 가격(PER)과 자본 수익성(ROE) 순위를 합산합니다.",
    rules: ["PER 0 초과 (흑자)", "ROE 0% 이상", "부채비율 200% 이하", "정렬: PER 오름차순 순위 + ROE 내림차순 순위의 합이 작은 순"],
    tier: "free",
    p1Executable: true,
  },
  {
    key: "dividend-aristocrat-lite",
    label: "배당 귀족 라이트",
    category: "dividend",
    description: "여러 해 연속으로 배당을 이어 온 종목 가운데 배당수익률과 배당성향이 기준 범위에 있는 종목을 찾습니다.",
    rules: ["연속배당 5년 이상", "배당수익률 3% 이상", "배당성향 70% 이하", "정렬: 연속배당연수 긴 순 → 배당수익률 높은 순"],
    tier: "free",
    p1Executable: true,
  },
  {
    key: "graham-net",
    label: "그레이엄 순가치",
    category: "value",
    description: "벤저민 그레이엄의 보수적 가치 기준 — 낮은 PER·PBR 과 낮은 부채를 동시에 요구합니다.",
    rules: ["PER 10배 이하 (0 초과)", "PBR 1배 이하 (0 초과)", "부채비율 100% 이하", "ROE 0% 이상 (흑자)", "정렬: PER × PBR 낮은 순"],
    tier: "free",
    p1Executable: true,
  },

  /* ── P2 (시세 히스토리 필요) ── */
  {
    key: "golden-cross",
    label: "골든크로스",
    category: "technical",
    description: "단기 이동평균(20일)이 장기 이동평균(60일)을 아래에서 위로 교차한 종목.",
    rules: ["20일 이동평균 > 60일 이동평균", "직전 5거래일 내 교차 발생", "정렬: 교차 이후 거래량 증가율 높은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "daily_prices 60거래일 이상",
  },
  {
    key: "52w-high-breakout",
    label: "52주 신고가 돌파",
    category: "momentum",
    description: "전일 종가가 최근 52주 최고가를 넘어선 종목.",
    rules: ["전일 종가 ≥ 직전 52주 최고가", "20일 평균 거래대금 10억원 이상", "정렬: 돌파 폭(%) 큰 순"],
    tier: "basic",
    p1Executable: false,
    requires: "daily_prices 250거래일 이상",
  },
  {
    key: "bollinger-reversion",
    label: "볼린저 하단 회귀",
    category: "technical",
    description: "볼린저 밴드(20일, 2σ) 하단을 터치한 뒤 밴드 안으로 되돌아온 종목.",
    rules: ["직전 5거래일 내 종가 < 하단 밴드", "전일 종가 > 하단 밴드", "정렬: %B 낮은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "daily_prices 20거래일 이상",
  },
  {
    key: "rsi-oversold-reversion",
    label: "RSI 과매도 회귀",
    category: "technical",
    description: "RSI(14)가 30 아래로 내려간 뒤 다시 30 위로 올라온 종목.",
    rules: ["직전 10거래일 내 RSI(14) < 30", "전일 RSI(14) ≥ 30", "정렬: RSI 상승 폭 큰 순"],
    tier: "basic",
    p1Executable: false,
    requires: "daily_prices 30거래일 이상",
  },
  {
    key: "dividend-growth",
    label: "배당 성장",
    category: "dividend",
    description: "최근 5년간 주당배당금(DPS)이 매년 증가한 종목.",
    rules: ["5개년 DPS 연속 증가", "배당성향 80% 이하", "정렬: 5년 DPS 연평균 증가율 높은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "dividends 5개년 히스토리",
  },
  {
    key: "small-cap-effect",
    label: "소형주 효과",
    category: "value",
    description: "시가총액 하위 구간에서 재무 건전성 기준을 충족하는 종목.",
    rules: ["시가총액 하위 30%", "부채비율 100% 이하", "최근 4분기 영업이익 흑자", "정렬: PBR 낮은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "분기 재무 4개 분기",
  },
  {
    key: "low-volatility",
    label: "저변동성",
    category: "quality",
    description: "최근 1년 일간 수익률 변동성이 낮은 종목.",
    rules: ["250거래일 일간 변동성 하위 20%", "시가총액 3,000억원 이상", "정렬: 변동성 낮은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "daily_prices 250거래일 이상",
  },
  {
    key: "earnings-momentum",
    label: "이익 모멘텀",
    category: "momentum",
    description: "최근 분기 영업이익이 전년 동기 대비 크게 증가한 종목.",
    rules: ["최근 분기 영업이익 YoY +20% 이상", "2개 분기 연속 증가", "정렬: YoY 증가율 높은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "분기 재무 8개 분기",
  },
  {
    key: "dual-momentum",
    label: "듀얼 모멘텀",
    category: "momentum",
    description: "절대 모멘텀(12개월 수익률 > 0)과 상대 모멘텀(시장 대비 상위)을 함께 보는 종목.",
    rules: ["12개월 수익률 > 0", "12개월 수익률 시장 상위 20%", "정렬: 12개월 수익률 높은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "daily_prices 250거래일 이상 + 지수 데이터",
  },
  {
    key: "quality-gpa",
    label: "퀄리티 (GP/A)",
    category: "quality",
    description: "총자산 대비 매출총이익(GP/A)이 높은 종목 — 노비-마르크스의 수익성 지표.",
    rules: ["GP/A 상위 30%", "부채비율 150% 이하", "정렬: GP/A 높은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "매출총이익·총자산 항목",
  },
  {
    key: "piotroski-f",
    label: "F-스코어",
    category: "quality",
    description: "피오트로스키 F-스코어(9점 만점) 상위 종목.",
    rules: ["F-스코어 7점 이상", "PBR 하위 50%", "정렬: F-스코어 → PBR 낮은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "재무 2개년 상세 항목(현금흐름 포함)",
  },
  {
    key: "net-cash",
    label: "순현금",
    category: "value",
    description: "보유 현금이 총차입금을 넘어 순현금 상태인 종목.",
    rules: ["현금성자산 − 총차입금 > 0", "순현금 ÷ 시가총액 30% 이상", "정렬: 순현금 비율 높은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "현금성자산·차입금 항목",
  },
  {
    key: "turnaround",
    label: "턴어라운드",
    category: "composite",
    description: "적자에서 흑자로 전환한 종목.",
    rules: ["전년 순이익 < 0", "최근 4분기 합산 순이익 > 0", "정렬: 흑자 전환 규모 큰 순"],
    tier: "basic",
    p1Executable: false,
    requires: "분기 재무 8개 분기",
  },
  {
    key: "kosdaq-low-psr",
    label: "코스닥 저PSR",
    category: "value",
    description: "코스닥 종목 가운데 매출 대비 시가총액(PSR)이 낮은 종목.",
    rules: ["시장: 코스닥", "PSR 0.5배 이하", "최근 매출 YoY > 0", "정렬: PSR 낮은 순"],
    tier: "basic",
    p1Executable: false,
    requires: "매출 2개년",
  },
  {
    key: "buyback",
    label: "자사주 매입",
    category: "composite",
    description: "최근 3개월 내 자기주식 취득을 공시한 종목.",
    rules: ["3개월 내 자기주식 취득 결정 공시", "취득 규모 ÷ 시가총액 1% 이상", "정렬: 취득 비율 높은 순"],
    tier: "pro",
    p1Executable: false,
    requires: "DART 공시 이벤트 수집",
  },
  {
    key: "sector-relative-strength",
    label: "섹터 상대강도",
    category: "momentum",
    description: "소속 섹터 평균보다 3개월 수익률이 높은 종목.",
    rules: ["3개월 수익률 − 섹터 평균 > 0", "섹터 내 상위 20%", "정렬: 초과 수익률 큰 순"],
    tier: "pro",
    p1Executable: false,
    requires: "daily_prices 60거래일 이상 + 섹터 분류",
  },
];

export function getStrategy(key: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.key === key);
}

/* ───────────────────────── P1 실행 엔진 ───────────────────────── */

export interface Candidate {
  code: string;
  name: string;
  market: ScreenRow["market"];
  sector: string | null;
  conditions: string[];
  metrics: Record<string, number | string | null>;
  as_of: string;
}

interface Executable {
  key: string;
  kind: "value" | "dividend";
  /** 스크리너에서 유사 조건을 재현하는 링크 */
  screenerHref: string;
  run(rows: ScreenRow[], divRows: DividendRow[]): Candidate[];
}

const PER_ANY: ValueFilters["perMax"] = 200; // 스크리너 입력 상한과 동일 (= 사실상 무제한)

function valueCandidate(r: ScreenRow, conditions: string[], extra: Record<string, number | string | null> = {}): Candidate {
  return {
    code: r.code,
    name: r.name,
    market: r.market,
    sector: r.sector,
    conditions,
    metrics: {
      sector: r.sector,
      price: r.price,
      market_cap: r.market_cap,
      per: r.per,
      pbr: r.pbr,
      roe: r.roe,
      debt_ratio: r.debt_ratio,
      dividend_yield: r.dividend_yield,
      ...extra,
    },
    as_of: r.as_of,
  };
}

function dividendCandidate(r: DividendRow, conditions: string[], extra: Record<string, number | string | null> = {}): Candidate {
  return {
    code: r.code,
    name: r.name,
    market: r.market,
    sector: r.sector,
    conditions,
    metrics: {
      sector: r.sector,
      price: r.price,
      market_cap: r.market_cap,
      dps: r.dps,
      dividend_yield: r.dividend_yield,
      payout_ratio: r.payout_ratio,
      consecutive_years: r.consecutive_years,
      ex_dividend_date: r.ex_dividend_date,
      ...extra,
    },
    as_of: r.as_of,
  };
}

const LOW_PBR_HIGH_ROE: ValueFilters = { perMax: PER_ANY, pbrMax: 1, roeMin: 10, debtMax: 150, market: "ALL", sort: "roe" };
const MAGIC_LITE: ValueFilters = { perMax: PER_ANY, pbrMax: 50, roeMin: 0, debtMax: 200, market: "ALL", sort: "per" };
const GRAHAM: ValueFilters = { perMax: 10, pbrMax: 1, roeMin: 0, debtMax: 100, market: "ALL", sort: "pbr" };
const ARISTOCRAT: DividendFilters = { yieldMin: 3, yearsMin: 5, payoutMax: 70, market: "ALL", sort: "consecutive_years" };

const EXECUTABLES: Executable[] = [
  {
    key: "low-pbr-high-roe",
    kind: "value",
    screenerHref: valueHref(LOW_PBR_HIGH_ROE),
    run(rows) {
      const hit = applyValueFilters(rows, LOW_PBR_HIGH_ROE).filter((r) => r.pbr !== null && r.roe !== null);
      const scored = hit
        .map((r) => ({ r, score: (r.roe as number) / (r.pbr as number) }))
        .sort((a, b) => b.score - a.score);
      return scored.map(({ r, score }) =>
        valueCandidate(
          r,
          [
            `PBR ${fmtNum(r.pbr)}배 (조건: 1배 이하)`,
            `ROE ${fmtPct(r.roe)} (조건: 10% 이상)`,
            `부채비율 ${fmtPct(r.debt_ratio, 0)} (조건: 150% 이하)`,
            `ROE ÷ PBR = ${fmtNum(score, 1)} (정렬 기준, 높은 순)`,
          ],
          { score_roe_over_pbr: Math.round(score * 10) / 10 },
        ),
      );
    },
  },
  {
    key: "magic-formula-lite",
    kind: "value",
    screenerHref: valueHref(MAGIC_LITE),
    run(rows) {
      const hit = applyValueFilters(rows, MAGIC_LITE).filter((r) => r.per !== null && r.roe !== null);
      const byPer = [...hit].sort((a, b) => (a.per as number) - (b.per as number));
      const byRoe = [...hit].sort((a, b) => (b.roe as number) - (a.roe as number));
      const perRank = new Map(byPer.map((r, i) => [r.code, i + 1]));
      const roeRank = new Map(byRoe.map((r, i) => [r.code, i + 1]));
      const scored = hit
        .map((r) => {
          const pr = perRank.get(r.code) ?? hit.length;
          const rr = roeRank.get(r.code) ?? hit.length;
          return { r, pr, rr, total: pr + rr };
        })
        .sort((a, b) => a.total - b.total || a.pr - b.pr);
      return scored.map(({ r, pr, rr, total }) =>
        valueCandidate(
          r,
          [
            `PER ${fmtNum(r.per)}배 (조건: 0 초과 · ${hit.length}개 중 ${pr}위)`,
            `ROE ${fmtPct(r.roe)} (조건: 0% 이상 · ${hit.length}개 중 ${rr}위)`,
            `부채비율 ${fmtPct(r.debt_ratio, 0)} (조건: 200% 이하)`,
            `순위 합계 ${total} (정렬 기준, 낮은 순)`,
          ],
          { per_rank: pr, roe_rank: rr, rank_sum: total, universe: hit.length },
        ),
      );
    },
  },
  {
    key: "dividend-aristocrat-lite",
    kind: "dividend",
    screenerHref: dividendHref(ARISTOCRAT),
    run(_rows, divRows) {
      const hit = applyDividendFilters(divRows, ARISTOCRAT);
      const sorted = [...hit].sort(
        (a, b) => b.consecutive_years - a.consecutive_years || (b.dividend_yield ?? 0) - (a.dividend_yield ?? 0),
      );
      return sorted.map((r) =>
        dividendCandidate(r, [
          `연속배당 ${r.consecutive_years}년 (조건: 5년 이상)`,
          `배당수익률 ${fmtPct(r.dividend_yield, 2)} (조건: 3% 이상)`,
          `배당성향 ${fmtPct(r.payout_ratio)} (조건: 70% 이하)`,
          "정렬: 연속배당연수 긴 순 → 배당수익률 높은 순",
        ]),
      );
    },
  },
  {
    key: "graham-net",
    kind: "value",
    screenerHref: valueHref(GRAHAM),
    run(rows) {
      const hit = applyValueFilters(rows, GRAHAM).filter((r) => r.per !== null && r.pbr !== null);
      const scored = hit
        .map((r) => ({ r, score: (r.per as number) * (r.pbr as number) }))
        .sort((a, b) => a.score - b.score);
      return scored.map(({ r, score }) =>
        valueCandidate(
          r,
          [
            `PER ${fmtNum(r.per)}배 (조건: 10배 이하)`,
            `PBR ${fmtNum(r.pbr)}배 (조건: 1배 이하)`,
            `부채비율 ${fmtPct(r.debt_ratio, 0)} (조건: 100% 이하)`,
            `ROE ${fmtPct(r.roe)} (조건: 0% 이상)`,
            `PER × PBR = ${fmtNum(score, 2)} (정렬 기준, 낮은 순)`,
          ],
          { per_x_pbr: Math.round(score * 100) / 100 },
        ),
      );
    },
  },
];

/** 로테이션 순서 (day-of-year % 4) */
export const ROTATION: string[] = EXECUTABLES.map((e) => e.key);

export function executableStrategies(): Strategy[] {
  return ROTATION.map((k) => getStrategy(k)).filter((s): s is Strategy => Boolean(s));
}

/** 전략의 스크리너 재현 링크 (P1 실행 가능 전략만) */
export function strategyScreenerHref(key: string): string | null {
  return EXECUTABLES.find((e) => e.key === key)?.screenerHref ?? null;
}

export function dayOfYear(dateKst: string): number {
  const [y, m, d] = dateKst.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/** 해당 날짜에 1순위로 시도되는 전략 key */
export function strategyForDate(dateKst: string): string {
  return ROTATION[dayOfYear(dateKst) % ROTATION.length] ?? ROTATION[0] ?? "low-pbr-high-roe";
}

/**
 * 오늘의 "조건 충족 종목" 선정 — 날짜로 전략을 결정론적으로 로테이션하고
 * 상위 1개를 반환. 후보가 없으면 다음 전략으로 넘어가며, 모두 비면 null.
 */
export function pickDaily(rows: ScreenRow[], divRows: DividendRow[], dateKst: string): DailyPick | null {
  const start = dayOfYear(dateKst) % EXECUTABLES.length;
  for (let i = 0; i < EXECUTABLES.length; i++) {
    const ex = EXECUTABLES[(start + i) % EXECUTABLES.length];
    if (!ex) continue;
    const strategy = getStrategy(ex.key);
    if (!strategy) continue;
    const top = ex.run(rows, divRows)[0];
    if (!top) continue;
    return {
      pick_date: dateKst,
      code: top.code,
      name: top.name,
      market: top.market,
      strategy_key: strategy.key,
      strategy_label: strategy.label,
      conditions: top.conditions,
      metrics: { ...top.metrics, rotation_offset: i },
      data_as_of: top.as_of,
    };
  }
  return null;
}
