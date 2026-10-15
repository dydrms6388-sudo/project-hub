import { INTEREST_TAX_RATE } from "@/data/rates-2026";
import { num, pct, won } from "@/lib/money";
import { step, type Step } from "./core";

/* ================================================================== */
/* 대출 상환                                                            */
/* ================================================================== */

export type RepaymentType = "equalPayment" | "equalPrincipal" | "bullet";

export type LoanRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  /** 그 달에 넣은 중도상환금 */
  prepay: number;
};

export type LoanInput = {
  /** 대출 원금 */
  principal: number;
  /** 연이율 (0.045 = 4.5%) */
  annualRate: number;
  /** 총 상환 개월수 */
  months: number;
  /** 거치기간(개월) — 이 기간에는 이자만 낸다 */
  graceMonths: number;
  type: RepaymentType;
  /** 중도상환: n개월 차에 amount 원을 원금에서 뺀다 */
  prepayMonth?: number;
  prepayAmount?: number;
  /** 중도상환수수료율 (0.012 = 1.2%) */
  prepayFeeRate?: number;
};

export type LoanResult = {
  rows: LoanRow[];
  firstPayment: number;
  lastPayment: number;
  totalInterest: number;
  totalPayment: number;
  prepayFee: number;
  paidOffMonth: number;
  steps: Step[];
};

/** 원리금균등 월 상환액: P × i × (1+i)^n / ((1+i)^n − 1) */
export function annuityPayment(principal: number, monthlyRate: number, n: number): number {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return principal / n;
  const f = Math.pow(1 + monthlyRate, n);
  return (principal * monthlyRate * f) / (f - 1);
}

export function loanSchedule(input: LoanInput): LoanResult {
  const i = input.annualRate / 12;
  const n = Math.max(1, Math.round(input.months));
  const grace = Math.max(0, Math.min(input.graceMonths, n - 1));
  const repayMonths = n - grace;
  const rows: LoanRow[] = [];

  let balance = input.principal;
  let totalInterest = 0;
  let prepayFee = 0;
  let paidOffMonth = n;

  // 원리금균등은 거치 종료 시점 잔액 기준으로 월 상환액을 정한다.
  let payment = annuityPayment(input.principal, i, repayMonths);
  const flatPrincipal = input.principal / repayMonths;

  for (let m = 1; m <= n; m += 1) {
    if (balance <= 0.5) break;
    const interest = balance * i;
    let principalPart = 0;
    let pay = 0;

    if (m <= grace) {
      pay = interest;
      principalPart = 0;
    } else if (input.type === "bullet") {
      principalPart = m === n ? balance : 0;
      pay = interest + principalPart;
    } else if (input.type === "equalPrincipal") {
      principalPart = Math.min(balance, flatPrincipal);
      pay = interest + principalPart;
    } else {
      pay = Math.min(payment, balance + interest);
      principalPart = pay - interest;
    }

    balance -= principalPart;

    // 중도상환
    let prepay = 0;
    if (input.prepayMonth === m && (input.prepayAmount ?? 0) > 0) {
      prepay = Math.min(balance, input.prepayAmount ?? 0);
      prepayFee += prepay * (input.prepayFeeRate ?? 0);
      balance -= prepay;
      // 남은 회차를 유지한 채 월 상환액을 다시 계산(기간 단축이 아니라 월납 축소가 기본)
      if (input.type === "equalPayment") {
        payment = annuityPayment(balance, i, Math.max(1, n - m));
      }
    }

    totalInterest += interest;
    rows.push({
      month: m,
      payment: pay,
      interest,
      principal: principalPart,
      balance: Math.max(0, balance),
      prepay,
    });

    if (balance <= 0.5) {
      paidOffMonth = m;
      break;
    }
  }

  const totalPayment = rows.reduce((s, r) => s + r.payment + r.prepay, 0);
  const first = rows.find((r) => r.month === grace + 1) ?? rows[0];

  const steps: Step[] = [
    step("월 이자율", `연 ${pct(input.annualRate, 3)} ÷ 12`, i, "pct"),
    ...(input.type === "equalPayment"
      ? [
          step(
            "원리금균등 월 상환액",
            `${won(input.principal)} × ${num(i, 6)} × (1+${num(i, 6)})^${repayMonths} ÷ ((1+${num(i, 6)})^${repayMonths} − 1)`,
            annuityPayment(input.principal, i, repayMonths),
            "won",
            "매달 내는 금액이 같고, 초반에 이자 비중이 크다.",
          ),
        ]
      : input.type === "equalPrincipal"
        ? [
            step(
              "매월 상환 원금",
              `${won(input.principal)} ÷ ${repayMonths}회`,
              flatPrincipal,
              "won",
              "원금은 고정, 이자는 잔액에 붙으므로 상환액이 매달 줄어든다.",
            ),
          ]
        : [
            step(
              "매월 이자",
              `${won(input.principal)} × ${num(i, 6)}`,
              input.principal * i,
              "won",
              "만기일시상환은 매달 이자만 내고 만기에 원금을 한 번에 갚는다.",
            ),
          ]),
    ...(grace > 0
      ? [step("거치기간", `${grace}개월 동안 이자만 납부`, grace, "month")]
      : []),
    step("총 이자", "회차별 (잔액 × 월이자율) 합계", totalInterest),
    ...(prepayFee > 0
      ? [
          step(
            "중도상환수수료",
            `${won(input.prepayAmount ?? 0)} × ${pct(input.prepayFeeRate ?? 0, 2)}`,
            prepayFee,
          ),
        ]
      : []),
    step("총 상환액(원금+이자)", `${won(input.principal)} + ${won(totalInterest)}`, input.principal + totalInterest),
  ];

  return {
    rows,
    firstPayment: first ? first.payment : 0,
    lastPayment: rows.length ? rows[rows.length - 1].payment : 0,
    totalInterest,
    totalPayment,
    prepayFee,
    paidOffMonth,
    steps,
  };
}

/* ================================================================== */
/* 적금 / 예금                                                          */
/* ================================================================== */

export type SavingsMode = "installmentSimple" | "installmentCompound" | "depositSimple" | "depositCompound";

export type SavingsResult = {
  principal: number;
  grossInterest: number;
  tax: number;
  netInterest: number;
  maturity: number;
  steps: Step[];
};

/**
 * 적금 단리(대부분의 은행 적금 방식):
 * 첫 회차는 n개월, 마지막 회차는 1개월치 이자가 붙는다.
 * 이자 = 월납입액 × 연이율 ÷ 12 × n(n+1)/2
 */
export function savings(
  mode: SavingsMode,
  amount: number,
  months: number,
  annualRate: number,
  taxed: boolean,
): SavingsResult {
  const n = Math.max(1, Math.round(months));
  const i = annualRate / 12;
  let principal = 0;
  let grossInterest = 0;
  const steps: Step[] = [];

  if (mode === "installmentSimple") {
    principal = amount * n;
    grossInterest = (amount * annualRate * (n * (n + 1))) / 24;
    steps.push(
      step("납입 원금", `${won(amount)} × ${n}회`, principal),
      step(
        "세전 이자(단리)",
        `${won(amount)} × ${pct(annualRate, 3)} ÷ 12 × ${n}×${n + 1}÷2`,
        grossInterest,
        "won",
        "회차마다 예치기간이 달라 n(n+1)/2 개월분 이자가 붙는다. 은행이 광고하는 '연 이율'은 이 방식이다.",
      ),
    );
  } else if (mode === "installmentCompound") {
    principal = amount * n;
    // 매월 말 납입, 월복리
    const fv = i === 0 ? amount * n : amount * ((Math.pow(1 + i, n) - 1) / i);
    grossInterest = fv - principal;
    steps.push(
      step("납입 원금", `${won(amount)} × ${n}회`, principal),
      step(
        "만기 원리금(월복리)",
        `${won(amount)} × ((1+${num(i, 6)})^${n} − 1) ÷ ${num(i, 6)}`,
        fv,
      ),
      step("세전 이자", `${won(fv)} − ${won(principal)}`, grossInterest),
    );
  } else if (mode === "depositSimple") {
    principal = amount;
    grossInterest = (amount * annualRate * n) / 12;
    steps.push(
      step("예치 원금", `${won(amount)}`, principal),
      step("세전 이자(단리)", `${won(amount)} × ${pct(annualRate, 3)} × ${n} ÷ 12`, grossInterest),
    );
  } else {
    principal = amount;
    const fv = amount * Math.pow(1 + i, n);
    grossInterest = fv - principal;
    steps.push(
      step("예치 원금", `${won(amount)}`, principal),
      step("만기 원리금(월복리)", `${won(amount)} × (1+${num(i, 6)})^${n}`, fv),
      step("세전 이자", `${won(fv)} − ${won(principal)}`, grossInterest),
    );
  }

  const tax = taxed ? grossInterest * INTEREST_TAX_RATE.value : 0;
  const netInterest = grossInterest - tax;

  steps.push(
    step(
      "이자소득세",
      taxed
        ? `${won(grossInterest)} × ${pct(INTEREST_TAX_RATE.value, 1)}`
        : "비과세 상품 선택 → 0원",
      tax,
      "won",
      "소득세 14% + 지방소득세 1.4%.",
    ),
    step("세후 이자", `${won(grossInterest)} − ${won(tax)}`, netInterest),
    step("만기 수령액", `${won(principal)} + ${won(netInterest)}`, principal + netInterest),
  );

  return { principal, grossInterest, tax, netInterest, maturity: principal + netInterest, steps };
}

/** 목표액 역산 — 목표 만기수령액을 맞추려면 매월 얼마를 넣어야 하나 */
export function requiredMonthlyDeposit(
  goal: number,
  months: number,
  annualRate: number,
  taxed: boolean,
  compound: boolean,
): number {
  const n = Math.max(1, Math.round(months));
  const i = annualRate / 12;
  const taxRate = taxed ? INTEREST_TAX_RATE.value : 0;
  // 만기수령액 = 원금 + 세후이자 = amount × f(n) 형태이므로 계수 f 를 구해 나눈다.
  let factor: number;
  if (compound) {
    const fv = i === 0 ? n : (Math.pow(1 + i, n) - 1) / i;
    factor = n + (fv - n) * (1 - taxRate);
  } else {
    const interestFactor = (annualRate * n * (n + 1)) / 24;
    factor = n + interestFactor * (1 - taxRate);
  }
  return factor > 0 ? goal / factor : 0;
}

/* ================================================================== */
/* 복리                                                                */
/* ================================================================== */

export type CompoundPoint = { year: number; principal: number; balance: number };

export type CompoundResult = {
  finalBalance: number;
  totalPrincipal: number;
  totalInterest: number;
  series: CompoundPoint[];
  steps: Step[];
};

export function compoundGrowth(
  initial: number,
  monthlyContribution: number,
  annualRate: number,
  years: number,
  compoundPerYear: 1 | 12,
): CompoundResult {
  const totalMonths = Math.max(1, Math.round(years * 12));
  const monthlyRate =
    compoundPerYear === 12 ? annualRate / 12 : Math.pow(1 + annualRate, 1 / 12) - 1;

  let balance = initial;
  let principal = initial;
  const series: CompoundPoint[] = [{ year: 0, principal, balance }];

  for (let m = 1; m <= totalMonths; m += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    principal += monthlyContribution;
    if (m % 12 === 0) series.push({ year: m / 12, principal, balance });
  }
  if (totalMonths % 12 !== 0) {
    series.push({ year: totalMonths / 12, principal, balance });
  }

  const steps: Step[] = [
    step("적용 월 수익률", compoundPerYear === 12
      ? `연 ${pct(annualRate, 3)} ÷ 12`
      : `(1 + ${pct(annualRate, 3)})^(1/12) − 1`, monthlyRate, "pct",
      compoundPerYear === 12 ? "연 이율을 12로 나누는 명목 월복리." : "연복리를 월 단위로 환산한 실효 수익률."),
    step("초기 투자금", `${won(initial)}`, initial),
    step("총 납입 원금", `${won(initial)} + ${won(monthlyContribution)} × ${totalMonths}개월`, principal),
    step("최종 평가액", `매월 (잔액 × (1+r) + 납입액) 반복 ${totalMonths}회`, balance),
    step("누적 수익", `${won(balance)} − ${won(principal)}`, balance - principal),
  ];

  return {
    finalBalance: balance,
    totalPrincipal: principal,
    totalInterest: balance - principal,
    series,
    steps,
  };
}
