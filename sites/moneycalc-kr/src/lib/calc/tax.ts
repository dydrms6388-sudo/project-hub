import {
  CAPITAL_GAINS_BASIC_DEDUCTION,
  CAR_AGE_DISCOUNT,
  CAR_EDU_TAX_RATE,
  CAR_EV_FLAT_TAX,
  CAR_TAX_RATES,
  FREELANCER_WITHHOLDING_RATE,
  GIFT_DEDUCTIONS,
  GIFT_FILING_CREDIT,
  GIFT_GENERATION_SKIP_SURCHARGE,
  GIFT_MARRIAGE_DEDUCTION,
  GIFT_TAX_BRACKETS,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
  LTHD_TABLE,
  ONE_HOUSE_EXEMPT_PRICE,
} from "@/data/rates-2026";
import { num, pct, won } from "@/lib/money";
import { progressive, step, type Step } from "./core";

/* ================================================================== */
/* 증여세                                                              */
/* ================================================================== */

export type GiftRelation =
  | "spouse"
  | "linealAscendantToAdult"
  | "linealAscendantToMinor"
  | "linealDescendant"
  | "otherRelative"
  | "stranger";

export const GIFT_RELATION_LABEL: Record<GiftRelation, string> = {
  spouse: "배우자에게서",
  linealAscendantToAdult: "부모·조부모 → 성년 자녀·손자녀",
  linealAscendantToMinor: "부모·조부모 → 미성년 자녀·손자녀",
  linealDescendant: "자녀·손자녀 → 부모·조부모",
  otherRelative: "기타 친족(6촌 이내 혈족, 4촌 이내 인척)",
  stranger: "친족이 아닌 사람",
};

export type GiftInput = {
  amount: number;
  relation: GiftRelation;
  /** 최근 10년간 같은 그룹에서 이미 받은 증여재산가액 */
  priorGifts: number;
  /** 혼인·출산 공제 사용 */
  useMarriageDeduction: boolean;
  /** 세대생략(조부모 → 손자녀) */
  generationSkip: boolean;
  /** 신고기한 내 신고 */
  fileOnTime: boolean;
};

export type GiftResult = {
  deduction: number;
  usedDeduction: number;
  taxBase: number;
  calculatedTax: number;
  surcharge: number;
  filingCredit: number;
  finalTax: number;
  effectiveRate: number;
  steps: Step[];
};

export function giftTax(input: GiftInput): GiftResult {
  const limit = GIFT_DEDUCTIONS.value[input.relation];
  const marriage =
    input.useMarriageDeduction &&
    (input.relation === "linealAscendantToAdult" || input.relation === "linealAscendantToMinor")
      ? GIFT_MARRIAGE_DEDUCTION.value
      : 0;

  const remaining = Math.max(0, limit - input.priorGifts);
  const usedDeduction = Math.min(input.amount, remaining + marriage);
  const taxBase = Math.max(0, input.amount - usedDeduction);
  const { tax: calculatedTax, bracket } = progressive(taxBase, GIFT_TAX_BRACKETS.value);
  const surcharge = input.generationSkip
    ? calculatedTax * GIFT_GENERATION_SKIP_SURCHARGE.value
    : 0;
  const beforeCredit = calculatedTax + surcharge;
  const filingCredit = input.fileOnTime ? beforeCredit * GIFT_FILING_CREDIT.value : 0;
  const finalTax = Math.max(0, beforeCredit - filingCredit);

  const steps: Step[] = [
    step("증여재산가액", `${won(input.amount)}`, input.amount),
    step(
      "증여재산공제 한도",
      `${GIFT_RELATION_LABEL[input.relation]} → ${won(limit)}`,
      limit,
      "won",
      "10년간 합산 한도다.",
    ),
    step(
      "10년 내 기증여 차감",
      `${won(limit)} − ${won(input.priorGifts)}`,
      remaining,
      "won",
      "같은 그룹(예: 부모+조부모)에서 10년간 받은 금액을 모두 합쳐 한도를 본다.",
    ),
    ...(marriage > 0
      ? [step("혼인·출산 공제", `추가 ${won(marriage)}`, marriage, "won", "기본공제와 별도로 평생 1억원 한도.")]
      : []),
    step("적용 공제액", `min(증여액, 남은 한도 + 추가공제)`, usedDeduction),
    step("과세표준", `${won(input.amount)} − ${won(usedDeduction)}`, taxBase),
    step(
      "산출세액",
      `${won(taxBase)} × ${pct(bracket.rate, 0)} − ${won(bracket.deduction ?? 0)}`,
      calculatedTax,
      "won",
      "1억 10% / 5억 20% / 10억 30% / 30억 40% / 초과 50%.",
    ),
    ...(surcharge > 0
      ? [step("세대생략 할증", `${won(calculatedTax)} × 30%`, surcharge, "won", "조부모가 손자녀에게 바로 증여할 때.")]
      : []),
    step(
      "신고세액공제",
      input.fileOnTime ? `${won(beforeCredit)} × 3%` : "기한 내 미신고 → 공제 없음",
      filingCredit,
    ),
    step("납부할 증여세", `${won(beforeCredit)} − ${won(filingCredit)}`, finalTax),
  ];

  return {
    deduction: limit,
    usedDeduction,
    taxBase,
    calculatedTax,
    surcharge,
    filingCredit,
    finalTax,
    effectiveRate: input.amount > 0 ? finalTax / input.amount : 0,
    steps,
  };
}

/* ================================================================== */
/* 양도소득세 (간이)                                                    */
/* ================================================================== */

export type CapitalGainsInput = {
  salePrice: number;
  buyPrice: number;
  /** 취득세·중개수수료 등 필요경비 */
  expenses: number;
  holdYears: number;
  liveYears: number;
  isOneHouse: boolean;
  /** 조정대상지역 주택인가 */
  adjustedArea: boolean;
};

export type CapitalGainsCheck = { label: string; ok: boolean; note: string };

export type CapitalGainsResult = {
  gain: number;
  exempt: boolean;
  taxableGain: number;
  longTermDeduction: number;
  taxBase: number;
  incomeTax: number;
  localTax: number;
  total: number;
  checks: CapitalGainsCheck[];
  steps: Step[];
};

export function capitalGainsSimple(input: CapitalGainsInput): CapitalGainsResult {
  const gain = Math.max(0, input.salePrice - input.buyPrice - input.expenses);

  const checks: CapitalGainsCheck[] = [
    {
      label: "1세대가 국내에 1주택만 보유",
      ok: input.isOneHouse,
      note: "분양권·입주권·오피스텔도 주택 수에 들어갈 수 있다.",
    },
    {
      label: "보유기간 2년 이상",
      ok: input.holdYears >= 2,
      note: "취득일부터 양도일까지.",
    },
    {
      label: input.adjustedArea ? "조정대상지역 → 거주기간 2년 이상" : "비조정지역 → 거주요건 없음",
      ok: !input.adjustedArea || input.liveYears >= 2,
      note: "2017.8.3. 이후 조정대상지역에서 취득한 주택은 2년 이상 실거주해야 한다.",
    },
    {
      label: `양도가액 ${won(ONE_HOUSE_EXEMPT_PRICE.value)} 이하`,
      ok: input.salePrice <= ONE_HOUSE_EXEMPT_PRICE.value,
      note: "12억 초과분은 비과세되지 않고 안분 과세된다.",
    },
  ];

  const allOk = checks.every((c) => c.ok);
  const exempt = allOk;

  // 1세대1주택 고가주택: 12억 초과분 비율만 과세
  const ratio =
    input.isOneHouse && input.salePrice > ONE_HOUSE_EXEMPT_PRICE.value && checks[1].ok && checks[2].ok
      ? (input.salePrice - ONE_HOUSE_EXEMPT_PRICE.value) / input.salePrice
      : 1;

  const taxableGain = exempt ? 0 : gain * ratio;

  const t = LTHD_TABLE.value;
  let ltRate = 0;
  if (input.holdYears >= 3) {
    if (input.isOneHouse && input.liveYears >= 2) {
      ltRate = Math.min(
        t.cap1H,
        Math.min(10, input.holdYears) * t.perYearHold1H +
          Math.min(10, input.liveYears) * t.perYearLive1H,
      );
    } else {
      ltRate = Math.min(t.capGeneral, Math.min(15, input.holdYears) * t.perYearGeneral);
    }
  }
  const longTermDeduction = taxableGain * ltRate;
  const afterLt = Math.max(0, taxableGain - longTermDeduction);
  const taxBase = Math.max(0, afterLt - CAPITAL_GAINS_BASIC_DEDUCTION.value);
  const { tax: incomeTax, bracket } = progressive(taxBase, INCOME_TAX_BRACKETS.value);
  const localTax = incomeTax * LOCAL_INCOME_TAX_RATE.value;

  const steps: Step[] = [
    step("양도차익", `${won(input.salePrice)} − ${won(input.buyPrice)} − 필요경비 ${won(input.expenses)}`, gain),
    ...(exempt
      ? [step("비과세 판정", "1세대 1주택 비과세 요건 충족 → 과세 대상 없음", 0)]
      : [
          ...(ratio < 1
            ? [
                step(
                  "고가주택 과세 비율",
                  `(${won(input.salePrice)} − ${won(ONE_HOUSE_EXEMPT_PRICE.value)}) ÷ ${won(input.salePrice)}`,
                  ratio,
                  "pct",
                  "12억 초과분에 해당하는 양도차익만 과세한다.",
                ),
              ]
            : []),
          step("과세대상 양도차익", `${won(gain)} × ${pct(ratio, 2)}`, taxableGain),
          step(
            "장기보유특별공제",
            ltRate > 0
              ? `${won(taxableGain)} × ${pct(ltRate, 0)} (보유 ${num(input.holdYears)}년${
                  input.isOneHouse && input.liveYears >= 2 ? ` · 거주 ${num(input.liveYears)}년` : ""
                })`
              : "보유 3년 미만 → 공제 없음",
            longTermDeduction,
          ),
          step("양도소득금액", `${won(taxableGain)} − ${won(longTermDeduction)}`, afterLt),
          step("양도소득 기본공제", "연 250만원", CAPITAL_GAINS_BASIC_DEDUCTION.value),
          step("과세표준", `${won(afterLt)} − ${won(CAPITAL_GAINS_BASIC_DEDUCTION.value)}`, taxBase),
          step(
            "양도소득세",
            `${won(taxBase)} × ${pct(bracket.rate, 0)} − ${won(bracket.deduction ?? 0)}`,
            incomeTax,
            "won",
            "보유 2년 이상 기본세율 기준. 단기보유·다주택 중과는 반영하지 않았다.",
          ),
          step("지방소득세", `${won(incomeTax)} × 10%`, localTax),
        ]),
  ];

  return {
    gain,
    exempt,
    taxableGain,
    longTermDeduction,
    taxBase,
    incomeTax: exempt ? 0 : incomeTax,
    localTax: exempt ? 0 : localTax,
    total: exempt ? 0 : incomeTax + localTax,
    checks,
    steps,
  };
}

/* ================================================================== */
/* 자동차세                                                            */
/* ================================================================== */

export type CarTaxResult = {
  baseTax: number;
  discountRate: number;
  reducedTax: number;
  eduTax: number;
  total: number;
  prepay: number;
  steps: Step[];
};

export function carTax(cc: number, ageYears: number, isEv: boolean): CarTaxResult {
  const row = CAR_TAX_RATES.value.find((x) => x.upTo === null || cc <= x.upTo)!;
  const baseTax = isEv ? CAR_EV_FLAT_TAX.value : Math.floor(cc * row.perCc);

  const d = CAR_AGE_DISCOUNT.value;
  const discountRate =
    ageYears >= d.startYear ? Math.min(d.max, (ageYears - d.startYear + 1) * d.perYear) : 0;
  const reducedTax = Math.floor(baseTax * (1 - discountRate));
  const eduTax = Math.floor(reducedTax * CAR_EDU_TAX_RATE.value);
  const total = reducedTax + eduTax;

  const steps: Step[] = [
    step(
      "연세액(경감 전)",
      isEv ? "전기·수소차 정액 100,000원" : `${num(cc)}cc × ${row.perCc}원`,
      baseTax,
      "won",
      isEv ? "배기량이 없는 승용차는 정액." : "1,000cc 이하 80원 / 1,600cc 이하 140원 / 초과 200원.",
    ),
    step(
      "차령 경감",
      discountRate > 0
        ? `차령 ${num(ageYears)}년 → ${pct(discountRate, 0)} 경감`
        : "차령 3년 미만 → 경감 없음",
      discountRate,
      "pct",
      "3년째부터 매년 5%씩, 최대 50%까지.",
    ),
    step("경감 후 자동차세", `${won(baseTax)} × (1 − ${pct(discountRate, 0)})`, reducedTax),
    step("지방교육세", `${won(reducedTax)} × 30%`, eduTax),
    step("연간 납부액", `${won(reducedTax)} + ${won(eduTax)}`, total, "won", "6월·12월에 절반씩 나눠 낸다."),
  ];

  return { baseTax, discountRate, reducedTax, eduTax, total, prepay: total, steps };
}

/* ================================================================== */
/* 프리랜서 3.3%                                                        */
/* ================================================================== */

export type FreelancerResult = {
  gross: number;
  incomeTax: number;
  localTax: number;
  withheld: number;
  net: number;
  annualGross: number;
  estimatedExpense: number;
  estimatedFinalTax: number;
  refundOrPay: number;
  steps: Step[];
};

export function freelancerTax(
  gross: number,
  monthsPerYear: number,
  expenseRate: number,
  deductions: number,
): FreelancerResult {
  const rate = FREELANCER_WITHHOLDING_RATE.value;
  const incomeTax = Math.floor(gross * 0.03 / 10) * 10;
  const localTax = Math.floor(gross * 0.003 / 10) * 10;
  const withheld = incomeTax + localTax;
  const net = gross - withheld;

  const annualGross = gross * monthsPerYear;
  const estimatedExpense = annualGross * expenseRate;
  const incomeAmount = Math.max(0, annualGross - estimatedExpense);
  const base = Math.max(0, incomeAmount - deductions);
  const { tax: calc, bracket } = progressive(base, INCOME_TAX_BRACKETS.value);
  const localFinal = calc * LOCAL_INCOME_TAX_RATE.value;
  const estimatedFinalTax = calc + localFinal;
  const totalWithheld = withheld * monthsPerYear;
  const refundOrPay = totalWithheld - estimatedFinalTax;

  const steps: Step[] = [
    step("계약금액(세전)", `${won(gross)}`, gross),
    step("소득세 원천징수 3%", `${won(gross)} × 3%`, incomeTax),
    step("지방소득세 0.3%", `${won(gross)} × 0.3%`, localTax, "won", "소득세의 10%."),
    step("원천징수 합계 3.3%", `${won(incomeTax)} + ${won(localTax)}`, withheld),
    step("실수령액", `${won(gross)} − ${won(withheld)}`, net),
    step("연 환산 수입", `${won(gross)} × ${num(monthsPerYear)}개월`, annualGross),
    step(
      "추정 필요경비",
      `${won(annualGross)} × ${pct(expenseRate, 0)}`,
      estimatedExpense,
      "won",
      "단순경비율·기준경비율은 업종코드마다 다르다. 직접 입력한 값이다.",
    ),
    step("소득금액", `${won(annualGross)} − ${won(estimatedExpense)}`, incomeAmount),
    step("소득공제", `본인 기본공제 등 직접 입력`, deductions),
    step("과세표준", `${won(incomeAmount)} − ${won(deductions)}`, base),
    step("산출세액", `${won(base)} × ${pct(bracket.rate, 0)} − ${won(bracket.deduction ?? 0)}`, calc),
    step("지방소득세", `${won(calc)} × 10%`, localFinal),
    step("연간 결정세액(추정)", `${won(calc)} + ${won(localFinal)}`, estimatedFinalTax),
    step("기납부 원천징수세액", `${won(withheld)} × ${num(monthsPerYear)}개월`, totalWithheld),
    step(
      refundOrPay >= 0 ? "예상 환급액" : "예상 추가 납부액",
      `${won(totalWithheld)} − ${won(estimatedFinalTax)}`,
      Math.abs(refundOrPay),
      "won",
      "5월 종합소득세 신고로 정산된다. 세액공제는 반영하지 않은 추정치다.",
    ),
  ];

  return {
    gross,
    incomeTax,
    localTax,
    withheld,
    net,
    annualGross,
    estimatedExpense,
    estimatedFinalTax,
    refundOrPay,
    steps,
  };
}
