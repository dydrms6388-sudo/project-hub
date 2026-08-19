import {
  JEONSE_CONVERSION_CAP,
  JEONSE_CONVERSION_SPREAD,
  SUBSCRIPTION_SCORE_MAX,
} from "@/data/rates-2026";
import { num, pct, won } from "@/lib/money";
import { step, type Step } from "./core";

/* ================================================================== */
/* 전월세 전환율                                                        */
/* ================================================================== */

export const legalConversionRate = (baseRate: number): number =>
  Math.min(JEONSE_CONVERSION_CAP.value, baseRate + JEONSE_CONVERSION_SPREAD.value);

export type JeonseResult = {
  legalRate: number;
  monthlyRent: number;
  convertedDeposit: number;
  actualRate: number;
  overLegal: boolean;
  steps: Step[];
};

/** 전세보증금 일부(또는 전부)를 월세로 전환할 때 */
export function jeonseToMonthly(
  convertAmount: number,
  baseRate: number,
  customRate: number | null,
): JeonseResult {
  const legalRate = legalConversionRate(baseRate);
  const rate = customRate ?? legalRate;
  const monthlyRent = (convertAmount * rate) / 12;

  const steps: Step[] = [
    step(
      "법정 전환율",
      `min(연 10%, 기준금리 ${pct(baseRate, 2)} + 2%)`,
      legalRate,
      "pct",
      "주택임대차보호법 제7조의2 및 시행령 제9조.",
    ),
    step("전환할 보증금", `${won(convertAmount)}`, convertAmount),
    step(
      "월세",
      `${won(convertAmount)} × ${pct(rate, 3)} ÷ 12개월`,
      monthlyRent,
      "won",
      "연 환산 임대료를 12로 나눈 값이 월세다.",
    ),
  ];

  return {
    legalRate,
    monthlyRent,
    convertedDeposit: convertAmount,
    actualRate: rate,
    overLegal: rate > legalRate + 1e-9,
    steps,
  };
}

/** 월세를 보증금으로 되돌릴 때 */
export function monthlyToJeonse(
  monthlyRent: number,
  baseRate: number,
  customRate: number | null,
): JeonseResult {
  const legalRate = legalConversionRate(baseRate);
  const rate = customRate ?? legalRate;
  const convertedDeposit = rate > 0 ? (monthlyRent * 12) / rate : 0;

  const steps: Step[] = [
    step("법정 전환율", `min(연 10%, 기준금리 ${pct(baseRate, 2)} + 2%)`, legalRate, "pct"),
    step("연 환산 월세", `${won(monthlyRent)} × 12개월`, monthlyRent * 12),
    step("환산 보증금", `${won(monthlyRent * 12)} ÷ ${pct(rate, 3)}`, convertedDeposit),
  ];

  return { legalRate, monthlyRent, convertedDeposit, actualRate: rate, overLegal: rate > legalRate + 1e-9, steps };
}

/** 실제 계약이 몇 %로 전환되었는지 역산 */
export function actualConversionRate(convertAmount: number, monthlyRent: number): number {
  return convertAmount > 0 ? (monthlyRent * 12) / convertAmount : 0;
}

/* ================================================================== */
/* 월세 vs 전세                                                        */
/* ================================================================== */

export type RentCompareInput = {
  /** 전세보증금 */
  jeonseDeposit: number;
  /** 전세대출 금액 */
  jeonseLoan: number;
  /** 전세대출 금리(연) */
  jeonseLoanRate: number;
  /** 월세 보증금 */
  monthlyDeposit: number;
  /** 월세 */
  monthlyRent: number;
  /** 월세 관리비 차액(월세 쪽이 더 내면 +) */
  monthlyExtra: number;
  /** 여윳돈 예금 금리(기회비용, 연) */
  savingRate: number;
  /** 비교 기간(개월) */
  months: number;
};

export type RentCompareResult = {
  jeonseMonthlyCost: number;
  monthlyCost: number;
  jeonseTotal: number;
  monthlyTotal: number;
  winner: "jeonse" | "monthly" | "tie";
  gap: number;
  steps: Step[];
};

export function rentVsBuy(input: RentCompareInput): RentCompareResult {
  // 전세: 대출이자 + (자기자금 × 예금금리) 기회비용
  const jeonseOwn = Math.max(0, input.jeonseDeposit - input.jeonseLoan);
  const jeonseInterest = (input.jeonseLoan * input.jeonseLoanRate) / 12;
  const jeonseOpportunity = (jeonseOwn * input.savingRate) / 12;
  const jeonseMonthlyCost = jeonseInterest + jeonseOpportunity;

  // 월세: 월세 + 관리비차액 + (월세보증금 × 예금금리) 기회비용
  const monthlyOpportunity = (input.monthlyDeposit * input.savingRate) / 12;
  const monthlyCost = input.monthlyRent + input.monthlyExtra + monthlyOpportunity;

  const jeonseTotal = jeonseMonthlyCost * input.months;
  const monthlyTotal = monthlyCost * input.months;
  const gap = Math.abs(jeonseTotal - monthlyTotal);
  const winner =
    Math.abs(jeonseTotal - monthlyTotal) < 1
      ? "tie"
      : jeonseTotal < monthlyTotal
        ? "jeonse"
        : "monthly";

  const steps: Step[] = [
    step("전세 — 자기자금", `${won(input.jeonseDeposit)} − 대출 ${won(input.jeonseLoan)}`, jeonseOwn),
    step("전세 — 월 대출이자", `${won(input.jeonseLoan)} × ${pct(input.jeonseLoanRate, 2)} ÷ 12`, jeonseInterest),
    step(
      "전세 — 자기자금 기회비용",
      `${won(jeonseOwn)} × ${pct(input.savingRate, 2)} ÷ 12`,
      jeonseOpportunity,
      "won",
      "보증금으로 묶인 내 돈이 예금에 있었다면 받았을 이자.",
    ),
    step("전세 — 월 실질 주거비", `${won(jeonseInterest)} + ${won(jeonseOpportunity)}`, jeonseMonthlyCost),
    step("월세 — 보증금 기회비용", `${won(input.monthlyDeposit)} × ${pct(input.savingRate, 2)} ÷ 12`, monthlyOpportunity),
    step(
      "월세 — 월 실질 주거비",
      `${won(input.monthlyRent)} + ${won(input.monthlyExtra)} + ${won(monthlyOpportunity)}`,
      monthlyCost,
    ),
    step(`${num(input.months)}개월 누적 — 전세`, `${won(jeonseMonthlyCost)} × ${num(input.months)}`, jeonseTotal),
    step(`${num(input.months)}개월 누적 — 월세`, `${won(monthlyCost)} × ${num(input.months)}`, monthlyTotal),
  ];

  return { jeonseMonthlyCost, monthlyCost, jeonseTotal, monthlyTotal, winner, gap, steps };
}

/* ================================================================== */
/* 청약 가점                                                            */
/* ================================================================== */

export type SubscriptionInput = {
  /** 무주택 기간(년) */
  noHouseYears: number;
  /** 부양가족 수(본인 제외) */
  dependents: number;
  /** 청약통장 가입기간(년) */
  accountYears: number;
  /** 무주택 세대주인가 */
  isNoHouse: boolean;
};

export type SubscriptionResult = {
  noHouseScore: number;
  dependentScore: number;
  accountScore: number;
  total: number;
  steps: Step[];
};

export function subscriptionScore(input: SubscriptionInput): SubscriptionResult {
  const max = SUBSCRIPTION_SCORE_MAX.value;

  // 무주택기간: 1년 미만 2점, 이후 1년마다 2점씩 최대 32점(15년 이상)
  const y = Math.max(0, Math.floor(input.noHouseYears));
  const noHouseScore = input.isNoHouse ? Math.min(max.noHouse, 2 + y * 2) : 0;

  // 부양가족: 0명 5점, 1명당 5점 추가, 6명 이상 35점
  const d = Math.max(0, Math.min(6, Math.floor(input.dependents)));
  const dependentScore = Math.min(max.dependents, 5 + d * 5);

  // 청약통장: 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 1점, 15년 이상 17점
  const a = Math.max(0, Math.floor(input.accountYears));
  const accountScore = Math.min(max.account, a >= 1 ? a + 2 : 2);

  const total = noHouseScore + dependentScore + accountScore;

  const steps: Step[] = [
    step(
      "무주택기간",
      input.isNoHouse ? `1년 미만 2점 + ${y}년 × 2점` : "유주택 → 0점",
      noHouseScore,
      "num",
      "만 30세(또는 혼인신고일)부터 계산하며 최대 32점(15년 이상).",
    ),
    step(
      "부양가족수",
      `기본 5점 + ${d}명 × 5점`,
      dependentScore,
      "num",
      "본인 제외. 배우자·직계존속(3년 이상 동일 등본)·미혼 직계비속. 최대 35점(6명 이상).",
    ),
    step(
      "청약통장 가입기간",
      a >= 1 ? `${a}년 → ${accountScore}점` : "1년 미만 → 2점",
      accountScore,
      "num",
      "6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 1점. 최대 17점(15년 이상).",
    ),
    step("총 가점", `${noHouseScore} + ${dependentScore} + ${accountScore}`, total, "num", "84점 만점."),
  ];

  return { noHouseScore, dependentScore, accountScore, total, steps };
}
