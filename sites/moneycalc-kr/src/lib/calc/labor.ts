import {
  ANNUAL_LEAVE_RULES,
  EARNED_INCOME_DEDUCTION,
  EARNED_INCOME_DEDUCTION_CAP,
  EARNED_INCOME_TAX_CREDIT,
  EARNED_INCOME_TAX_CREDIT_CAPS,
  EI_RATE_EMPLOYEE,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
  LTC_RATE_OF_HEALTH,
  MIN_WAGE_HOURLY,
  MONTHLY_WORK_HOURS,
  NHIS_RATE_EMPLOYEE,
  NPS_BASE_MAX,
  NPS_BASE_MIN,
  NPS_RATE_EMPLOYEE,
  PERSONAL_DEDUCTION,
  SEVERANCE_DAYS_PER_YEAR,
} from "@/data/rates-2026";
import { clamp, floorTo, num, pct, won } from "@/lib/money";
import { bracketOf, progressive, step, type Step } from "./core";

/* ================================================================== */
/* 4대보험 (근로자 부담분)                                              */
/* ================================================================== */

export type InsuranceResult = {
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  total: number;
  steps: Step[];
};

/**
 * 월 과세대상 급여(비과세 제외) 기준 근로자 부담 4대보험료.
 * 보험료는 원 단위 절사 관행을 따라 10원 미만을 버린다.
 */
export function employeeInsurance(taxableMonthly: number): InsuranceResult {
  const pensionBase = clamp(
    floorTo(taxableMonthly, 1000),
    NPS_BASE_MIN.value,
    NPS_BASE_MAX.value,
  );
  const pension = floorTo(pensionBase * NPS_RATE_EMPLOYEE.value, 10);
  const health = floorTo(taxableMonthly * NHIS_RATE_EMPLOYEE.value, 10);
  const longTermCare = floorTo(health * LTC_RATE_OF_HEALTH.value, 10);
  const employment = floorTo(taxableMonthly * EI_RATE_EMPLOYEE.value, 10);
  const total = pension + health + longTermCare + employment;

  const steps: Step[] = [
    step(
      "국민연금 기준소득월액",
      `${won(taxableMonthly)} → 상·하한 적용 → ${won(pensionBase)}`,
      pensionBase,
      "won",
      `하한 ${won(NPS_BASE_MIN.value)} · 상한 ${won(NPS_BASE_MAX.value)}`,
    ),
    step(
      "국민연금(근로자 4.75%)",
      `${won(pensionBase)} × ${pct(NPS_RATE_EMPLOYEE.value, 3)}`,
      pension,
      "won",
      "총 9.5% 중 절반. 나머지 절반은 회사가 낸다.",
    ),
    step(
      "건강보험(근로자 3.595%)",
      `${won(taxableMonthly)} × ${pct(NHIS_RATE_EMPLOYEE.value, 3)}`,
      health,
      "won",
      "2026년 건강보험료율 7.19%의 절반.",
    ),
    step(
      "장기요양보험(건강보험료의 13.14%)",
      `${won(health)} × ${pct(LTC_RATE_OF_HEALTH.value, 2)}`,
      longTermCare,
      "won",
      "소득 대비로는 0.9448%.",
    ),
    step(
      "고용보험(근로자 0.9%)",
      `${won(taxableMonthly)} × ${pct(EI_RATE_EMPLOYEE.value, 2)}`,
      employment,
      "won",
      "실업급여 계정만 근로자가 부담한다. 산재보험은 전액 회사 부담.",
    ),
    step(
      "4대보험 합계",
      `${won(pension)} + ${won(health)} + ${won(longTermCare)} + ${won(employment)}`,
      total,
    ),
  ];

  return { pension, health, longTermCare, employment, total, steps };
}

/* ================================================================== */
/* 근로소득세 (간이세액표 방식 추정)                                     */
/* ================================================================== */

export function earnedIncomeDeduction(gross: number): number {
  const { bracket, lower } = bracketOf(gross, EARNED_INCOME_DEDUCTION.value);
  const raw = (bracket.deduction ?? 0) + (gross - lower) * bracket.rate;
  return Math.min(raw, EARNED_INCOME_DEDUCTION_CAP.value);
}

export function earnedIncomeTaxCredit(calculatedTax: number, gross: number): number {
  const { threshold, lowRate, highRate } = EARNED_INCOME_TAX_CREDIT.value;
  const raw =
    calculatedTax <= threshold
      ? calculatedTax * lowRate
      : threshold * lowRate + (calculatedTax - threshold) * highRate;
  const capRow =
    EARNED_INCOME_TAX_CREDIT_CAPS.value.find((c) => c.upTo === null || gross <= c.upTo) ??
    EARNED_INCOME_TAX_CREDIT_CAPS.value[EARNED_INCOME_TAX_CREDIT_CAPS.value.length - 1];
  return Math.min(raw, capRow.cap);
}

export type IncomeTaxResult = {
  incomeTax: number;
  localTax: number;
  total: number;
  steps: Step[];
};

/**
 * 근로소득 간이세액표와 같은 절차로 월 원천징수세액을 추정한다.
 * 연환산 총급여 → 근로소득공제 → 기본공제(가족수 × 150만) → 과세표준 →
 * 기본세율 → 근로소득세액공제 → 12분할 → 지방소득세 10% 가산.
 *
 * ⚠️ 국세청 간이세액표 원본(수천 행)을 그대로 담지 않은 추정치다.
 */
export function monthlyIncomeTax(taxableMonthly: number, family: number): IncomeTaxResult {
  const annual = taxableMonthly * 12;
  const eid = earnedIncomeDeduction(annual);
  const incomeAmount = Math.max(0, annual - eid);
  const personal = PERSONAL_DEDUCTION.value * Math.max(1, family);
  const base = Math.max(0, incomeAmount - personal);
  const { tax: calculated, bracket } = progressive(base, INCOME_TAX_BRACKETS.value);
  const credit = earnedIncomeTaxCredit(calculated, annual);
  const annualTax = Math.max(0, calculated - credit);
  const incomeTax = floorTo(annualTax / 12, 10);
  const localTax = floorTo(incomeTax * LOCAL_INCOME_TAX_RATE.value, 10);

  const steps: Step[] = [
    step("연환산 총급여", `${won(taxableMonthly)} × 12개월`, annual),
    step(
      "근로소득공제",
      `구간 ${pct(bracketOf(annual, EARNED_INCOME_DEDUCTION.value).bracket.rate, 0)} 적용`,
      eid,
      "won",
      "소득세법 제47조. 한도 2,000만원.",
    ),
    step("근로소득금액", `${won(annual)} − ${won(eid)}`, incomeAmount),
    step(
      "기본공제",
      `${won(PERSONAL_DEDUCTION.value)} × ${num(Math.max(1, family))}명`,
      personal,
      "won",
      "본인 포함 공제대상 가족수.",
    ),
    step("과세표준", `${won(incomeAmount)} − ${won(personal)}`, base),
    step(
      "산출세액",
      `${won(base)} × ${pct(bracket.rate, 0)} − ${won(bracket.deduction ?? 0)}`,
      calculated,
      "won",
      "종합소득세 기본세율(초과누진).",
    ),
    step("근로소득세액공제", `130만원 이하 55% + 초과분 30% (한도 적용)`, credit),
    step("연간 결정세액(추정)", `${won(calculated)} − ${won(credit)}`, annualTax),
    step("월 소득세", `${won(annualTax)} ÷ 12`, incomeTax),
    step("지방소득세", `${won(incomeTax)} × 10%`, localTax),
  ];

  return { incomeTax, localTax, total: incomeTax + localTax, steps };
}

/* ================================================================== */
/* 연봉 실수령액                                                        */
/* ================================================================== */

export type NetSalaryInput = {
  /** 연봉(세전, 원) */
  annualGross: number;
  /** 월 비과세액 (식대 등) */
  nonTaxableMonthly: number;
  /** 공제대상 가족 수(본인 포함) */
  family: number;
  /** 퇴직금 별도(false 면 연봉에 퇴직금 포함 → 13분할) */
  severanceSeparate: boolean;
};

export type NetSalaryResult = {
  monthlyGross: number;
  taxableMonthly: number;
  insurance: InsuranceResult;
  tax: IncomeTaxResult;
  deductionTotal: number;
  monthlyNet: number;
  annualNet: number;
  effectiveRate: number;
  steps: Step[];
};

export function netSalary(input: NetSalaryInput): NetSalaryResult {
  const divisor = input.severanceSeparate ? 12 : 13;
  const monthlyGross = input.annualGross / divisor;
  const taxableMonthly = Math.max(0, monthlyGross - input.nonTaxableMonthly);
  const insurance = employeeInsurance(taxableMonthly);
  const tax = monthlyIncomeTax(taxableMonthly, input.family);
  const deductionTotal = insurance.total + tax.total;
  const monthlyNet = monthlyGross - deductionTotal;
  const annualNet = monthlyNet * 12;

  const steps: Step[] = [
    step(
      "월 급여(세전)",
      `${won(input.annualGross)} ÷ ${divisor}`,
      monthlyGross,
      "won",
      input.severanceSeparate
        ? "퇴직금 별도 계약 → 12분할"
        : "퇴직금 포함 연봉 → 13분할(1개월분이 퇴직금)",
    ),
    step(
      "과세대상 급여",
      `${won(monthlyGross)} − 비과세 ${won(input.nonTaxableMonthly)}`,
      taxableMonthly,
      "won",
      "식대는 월 20만원까지 비과세다.",
    ),
    ...insurance.steps,
    ...tax.steps,
    step(
      "공제 합계",
      `4대보험 ${won(insurance.total)} + 소득세 ${won(tax.total)}`,
      deductionTotal,
    ),
    step("월 실수령액", `${won(monthlyGross)} − ${won(deductionTotal)}`, monthlyNet),
  ];

  return {
    monthlyGross,
    taxableMonthly,
    insurance,
    tax,
    deductionTotal,
    monthlyNet,
    annualNet,
    effectiveRate: monthlyGross > 0 ? deductionTotal / monthlyGross : 0,
    steps,
  };
}

/* ================================================================== */
/* 퇴직금                                                              */
/* ================================================================== */

export type SeveranceInput = {
  joinDate: string;
  leaveDate: string;
  /** 최근 3개월 임금 총액(세전) */
  lastThreeMonthsPay: number;
  /** 연간 상여금 총액 */
  annualBonus: number;
  /** 연차수당(전년도 지급분) */
  annualLeaveAllowance: number;
  /** 1일 통상임금(비교용, 0이면 비교 생략) */
  dailyOrdinaryWage: number;
};

export type SeveranceResult = {
  serviceDays: number;
  periodDays: number;
  averageDailyWage: number;
  usedDailyWage: number;
  usedOrdinary: boolean;
  severance: number;
  steps: Step[];
};

export const daysBetween = (a: string, b: string): number => {
  const d1 = new Date(`${a}T00:00:00Z`).getTime();
  const d2 = new Date(`${b}T00:00:00Z`).getTime();
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / 86_400_000));
};

export function severanceCalc(input: SeveranceInput): SeveranceResult {
  // 재직일수 = 입사일 ~ 퇴사일(마지막 근무일 다음날) 까지의 일수
  const serviceDays = daysBetween(input.joinDate, input.leaveDate);
  // 평균임금 산정기간: 퇴직일 이전 3개월. 달력 기준 일수는 89~92일로 달라진다.
  const end = new Date(`${input.leaveDate}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

  const bonusShare = (input.annualBonus * 3) / 12;
  const leaveShare = (input.annualLeaveAllowance * 3) / 12;
  const totalPay = input.lastThreeMonthsPay + bonusShare + leaveShare;
  const averageDailyWage = totalPay / periodDays;

  const usedOrdinary =
    input.dailyOrdinaryWage > 0 && input.dailyOrdinaryWage > averageDailyWage;
  const usedDailyWage = usedOrdinary ? input.dailyOrdinaryWage : averageDailyWage;

  const severance =
    (usedDailyWage * SEVERANCE_DAYS_PER_YEAR.value * serviceDays) / 365;

  const steps: Step[] = [
    step("재직일수", `${input.joinDate} ~ ${input.leaveDate}`, serviceDays, "day"),
    step(
      "평균임금 산정기간",
      "퇴직일 이전 3개월(달력 기준)",
      periodDays,
      "day",
      "달에 따라 89~92일로 달라진다.",
    ),
    step("3개월 임금 총액", `${won(input.lastThreeMonthsPay)}`, input.lastThreeMonthsPay),
    step(
      "상여금 안분",
      `${won(input.annualBonus)} × 3 ÷ 12`,
      bonusShare,
      "won",
      "연간 상여금의 3개월분만 산입한다.",
    ),
    step(
      "연차수당 안분",
      `${won(input.annualLeaveAllowance)} × 3 ÷ 12`,
      leaveShare,
      "won",
      "퇴직 전전년도 출근율로 발생해 전년도에 지급된 연차수당의 3/12.",
    ),
    step("산정 임금총액", `${won(input.lastThreeMonthsPay)} + ${won(bonusShare)} + ${won(leaveShare)}`, totalPay),
    step("1일 평균임금", `${won(totalPay)} ÷ ${num(periodDays)}일`, averageDailyWage),
    step(
      "적용 임금",
      usedOrdinary
        ? `통상임금 ${won(input.dailyOrdinaryWage)} > 평균임금 ${won(averageDailyWage)} → 통상임금 적용`
        : `평균임금 적용`,
      usedDailyWage,
      "won",
      "평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 본다(근로기준법 제2조 제2항).",
    ),
    step(
      "퇴직금",
      `${won(usedDailyWage)} × 30일 × ${num(serviceDays)}일 ÷ 365`,
      severance,
    ),
  ];

  return { serviceDays, periodDays, averageDailyWage, usedDailyWage, usedOrdinary, severance, steps };
}

/* ================================================================== */
/* 연차                                                                */
/* ================================================================== */

export type AnnualLeaveResult = {
  years: number;
  months: number;
  joinBasis: number;
  fiscalBasis: number;
  steps: Step[];
};

/** 계속근로연수 n년차(1년 이상)에 발생하는 연차일수 */
export function leaveDaysForYears(fullYears: number): number {
  const rules = ANNUAL_LEAVE_RULES.value;
  if (fullYears < 1) return 0;
  const extra = fullYears >= rules.extraFromYear
    ? Math.floor((fullYears - 1) / rules.extraEveryYears)
    : 0;
  return Math.min(rules.maxDays, rules.baseDays + extra);
}

export function annualLeave(joinDate: string, baseDate: string): AnnualLeaveResult {
  const rules = ANNUAL_LEAVE_RULES.value;
  const days = daysBetween(joinDate, baseDate);
  const join = new Date(`${joinDate}T00:00:00Z`);
  const base = new Date(`${baseDate}T00:00:00Z`);
  let months =
    (base.getUTCFullYear() - join.getUTCFullYear()) * 12 +
    (base.getUTCMonth() - join.getUTCMonth());
  if (base.getUTCDate() < join.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);

  // 입사일 기준
  let joinBasis: number;
  if (years < 1) {
    joinBasis = Math.min(rules.firstYearMax, months * rules.firstYearMonthly);
  } else {
    joinBasis = leaveDaysForYears(years);
  }

  // 회계연도(1/1) 기준: 첫 해는 입사일~12/31 비례 배분
  const firstYearEnd = Date.UTC(join.getUTCFullYear(), 11, 31);
  const daysInFirstYear = Math.max(
    0,
    Math.round((firstYearEnd - join.getTime()) / 86_400_000) + 1,
  );
  const proRated = (rules.baseDays * daysInFirstYear) / 365;
  const fiscalYears = base.getUTCFullYear() - join.getUTCFullYear();
  let fiscalBasis: number;
  if (fiscalYears <= 0) {
    fiscalBasis = Math.min(rules.firstYearMax, months * rules.firstYearMonthly);
  } else if (fiscalYears === 1) {
    fiscalBasis = Math.round(proRated * 10) / 10;
  } else {
    fiscalBasis = leaveDaysForYears(fiscalYears - 1);
  }

  const steps: Step[] = [
    step("근속기간", `${joinDate} ~ ${baseDate}`, days, "day"),
    step("만 근속 개월", "월 단위 환산", months, "month"),
    step("만 근속 연수", `${num(months)}개월 ÷ 12`, years, "year"),
    step(
      "입사일 기준 연차",
      years < 1
        ? `1년 미만 → 개근 1개월당 1일 (최대 11일)`
        : `1년 이상 15일 + (${years}년차 가산)`,
      joinBasis,
      "day",
      "근로기준법 제60조. 3년 이상부터 2년마다 1일 가산, 최대 25일.",
    ),
    step(
      "회계연도 기준 연차",
      fiscalYears === 1
        ? `15일 × ${num(daysInFirstYear)}일 ÷ 365 (입사 첫 해 비례배분)`
        : `회계연도(1/1) 재산정`,
      fiscalBasis,
      "day",
      "회계연도 방식이 근로자에게 불리하면 퇴직 시 입사일 기준으로 정산해 줘야 한다.",
    ),
  ];

  return { years, months, joinBasis, fiscalBasis, steps };
}

/* ================================================================== */
/* 시급 ↔ 월급                                                         */
/* ================================================================== */

export type HourlyResult = {
  weeklyHours: number;
  weeklyHolidayHours: number;
  monthlyHours: number;
  monthlyPay: number;
  hourly: number;
  belowMinimum: boolean;
  steps: Step[];
};

export function hourlyToMonthly(
  hourly: number,
  hoursPerWeek: number,
  includeWeeklyHoliday: boolean,
): HourlyResult {
  const eligible = includeWeeklyHoliday && hoursPerWeek >= 15;
  const weeklyHolidayHours = eligible ? Math.min(8, hoursPerWeek / 40 * 8) : 0;
  const weekly = hoursPerWeek + weeklyHolidayHours;
  const monthlyHours = Math.round((weekly * 365) / 7 / 12);
  const monthlyPay = hourly * monthlyHours;

  const steps: Step[] = [
    step("주 소정근로시간", `${num(hoursPerWeek, 1)}시간`, hoursPerWeek, "num"),
    step(
      "주휴시간",
      eligible
        ? `8시간 × (${num(hoursPerWeek, 1)} ÷ 40) = ${num(weeklyHolidayHours, 2)}시간`
        : hoursPerWeek < 15
          ? "주 15시간 미만 → 주휴수당 없음"
          : "주휴수당 미포함 선택",
      weeklyHolidayHours,
      "num",
      "근로기준법 제55조·제18조 제3항.",
    ),
    step("월 환산 시간", `(${num(weekly, 2)}시간 × 365 ÷ 7) ÷ 12 → 반올림`, monthlyHours, "num",
      "주 40시간 + 주휴 8시간이면 208.57시간이고, 고용노동부는 이를 반올림한 209시간을 쓴다."),
    step("월급(세전)", `${won(hourly)} × ${num(monthlyHours, 2)}시간`, monthlyPay),
  ];

  return {
    weeklyHours: hoursPerWeek,
    weeklyHolidayHours,
    monthlyHours,
    monthlyPay,
    hourly,
    belowMinimum: hourly < MIN_WAGE_HOURLY.value,
    steps,
  };
}

export function monthlyToHourly(
  monthlyPay: number,
  hoursPerWeek: number,
  includeWeeklyHoliday: boolean,
): HourlyResult {
  const eligible = includeWeeklyHoliday && hoursPerWeek >= 15;
  const weeklyHolidayHours = eligible ? Math.min(8, hoursPerWeek / 40 * 8) : 0;
  const weekly = hoursPerWeek + weeklyHolidayHours;
  const monthlyHours = Math.round((weekly * 365) / 7 / 12);
  const hourly = monthlyHours > 0 ? monthlyPay / monthlyHours : 0;

  const steps: Step[] = [
    step("월 환산 시간", `((${num(hoursPerWeek, 1)} + ${num(weeklyHolidayHours, 2)}) × 365 ÷ 7) ÷ 12 → 반올림`, monthlyHours, "num",
      "주 40시간 + 주휴 8시간 → 209시간."),
    step("시급", `${won(monthlyPay)} ÷ ${num(monthlyHours, 2)}시간`, hourly, "won",
      `2026년 최저임금 ${won(MIN_WAGE_HOURLY.value)}과 비교하세요.`),
  ];

  return {
    weeklyHours: hoursPerWeek,
    weeklyHolidayHours,
    monthlyHours,
    monthlyPay,
    hourly,
    belowMinimum: hourly < MIN_WAGE_HOURLY.value,
    steps,
  };
}

export const STANDARD_MONTHLY_HOURS = MONTHLY_WORK_HOURS.value;
