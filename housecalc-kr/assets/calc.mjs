// housecalc-kr 순수 계산 함수 모음 (브라우저 <script type="module"> + Node 테스트 공용)
// 모든 함수는 참고용 추정 — 실제 세액·한도는 기관(위택스·홈택스·은행) 확인 필요.

/* ---------- 공통 유틸 ---------- */
export function round4(x) { return Math.round(x * 10000) / 10000; }
export function fmtWon(n) {
  if (!isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ko-KR") + "원";
}
export function fmtEok(n) {
  // 12_3456원 → "1억 2,345만원" 스타일 근사 표기
  const won = Math.round(n);
  const eok = Math.floor(won / 100_000_000);
  const man = Math.round((won - eok * 100_000_000) / 10_000);
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${man.toLocaleString("ko-KR")}만원`;
}

/* ---------- 취득세 (지방세법 §11, §13조의2) ---------- */
// 주택 유상취득 표준세율(%): 6억 이하 1, 6~9억 (가액×2/3억−3), 9억 초과 3
export function acqStandardRatePct(price) {
  if (price <= 600_000_000) return 1;
  if (price <= 900_000_000) return round4(price * 2 / 300_000_000 - 3);
  return 3;
}
// homes: 취득 후 보유 주택 수(신규 포함), adjusted: 조정대상지역 여부
export function acqRatePct(price, { homes = 1, adjusted = false, overrideRatePct = null } = {}) {
  if (overrideRatePct != null && overrideRatePct !== "") {
    return { ratePct: Number(overrideRatePct), surcharged: Number(overrideRatePct) >= 8, basis: "직접 입력 세율" };
  }
  if (adjusted && homes >= 3) return { ratePct: 12, surcharged: true, basis: "조정대상지역 3주택 이상 중과 12%" };
  if (adjusted && homes === 2) return { ratePct: 8, surcharged: true, basis: "조정대상지역 2주택 중과 8%" };
  if (!adjusted && homes >= 4) return { ratePct: 12, surcharged: true, basis: "4주택 이상 중과 12%" };
  if (!adjusted && homes === 3) return { ratePct: 8, surcharged: true, basis: "3주택 중과 8%" };
  const r = acqStandardRatePct(price);
  const basis = price <= 600_000_000 ? "6억 이하 표준세율 1%"
    : price <= 900_000_000 ? "6~9억 구간 산식 (가액×2/3억−3)%"
    : "9억 초과 표준세율 3%";
  return { ratePct: r, surcharged: false, basis };
}
// 취득세 + 지방교육세 + 농특세 합산
export function acquisitionTax(price, { homes = 1, adjusted = false, areaOver85 = false, overrideRatePct = null } = {}) {
  const { ratePct, surcharged, basis } = acqRatePct(price, { homes, adjusted, overrideRatePct });
  const tax = Math.round(price * ratePct / 100);
  const eduPct = surcharged ? 0.4 : round4(ratePct * 0.1);
  const eduTax = Math.round(price * eduPct / 100);
  let ruralPct = 0;
  if (areaOver85) ruralPct = surcharged ? (ratePct >= 12 ? 1.0 : 0.6) : 0.2;
  const ruralTax = Math.round(price * ruralPct / 100);
  return { ratePct, surcharged, basis, tax, eduPct, eduTax, ruralPct, ruralTax, total: tax + eduTax + ruralTax };
}

/* ---------- 중개보수 (공인중개사법 시행규칙 별표1) ---------- */
export function findBracket(brackets, amount) {
  return brackets.find(([lo, hi]) => amount >= lo && amount < hi) || brackets[brackets.length - 1];
}
export function brokerFeeCalc(amount, brackets) {
  const [, , ratePct, cap] = findBracket(brackets, amount);
  const raw = amount * ratePct / 100;
  const fee = cap != null ? Math.min(raw, cap) : raw;
  return { ratePct, cap, raw: Math.round(raw), fee: Math.round(fee), capped: cap != null && raw > cap };
}
// 임대차 거래금액 환산: 보증금 + 월세×100 (5천만 미만이면 보증금 + 월세×70)
export function leaseAmount(deposit, monthly, conv = { multiplier: 100, smallMultiplier: 70, smallThreshold: 50_000_000 }) {
  const a = deposit + monthly * conv.multiplier;
  if (a < conv.smallThreshold) return deposit + monthly * conv.smallMultiplier;
  return a;
}

/* ---------- 청약 가점 (주택공급에 관한 규칙 별표1) ---------- */
// 무주택기간 점수: 유주택 0 / 1년 미만 2 / 이후 1년당 +2 / 15년 이상 32
export function noHousePts(years, hasHouse = false) {
  if (hasHouse) return 0;
  if (years < 0) years = 0;
  if (years < 1) return 2;
  return Math.min(32, 2 * (Math.floor(years) + 1));
}
// 부양가족 점수(본인 제외): 0명 5 / 1명당 +5 / 6명 이상 35
export function dependentsPts(n) {
  return 5 * (Math.min(Math.max(0, Math.floor(n)), 6) + 1);
}
// 통장 가입기간 점수: 6개월 미만 1 / 6개월~1년 2 / 이후 1년당 +1 / 15년 이상 17
export function accountPts(years) {
  if (years < 0) years = 0;
  if (years < 0.5) return 1;
  if (years < 1) return 2;
  return Math.min(17, Math.floor(years) + 2);
}
export function subscriptionScore({ noHouseYears = 0, hasHouse = false, dependents = 0, accountYears = 0 }) {
  const a = noHousePts(noHouseYears, hasHouse);
  const b = dependentsPts(dependents);
  const c = accountPts(accountYears);
  return { noHousePts: a, dependentsPts: b, accountPts: c, total: a + b + c };
}

/* ---------- 대출(원리금균등) ---------- */
// 월 상환액: 원리금균등. annualRatePct=0이면 원금/개월수
export function monthlyPayment(principal, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return NaN;
  if (r === 0) return principal / months;
  return principal * r / (1 - Math.pow(1 + r, -months));
}
// 월 상환액으로 역산한 대출원금
export function maxLoanFromPayment(monthly, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return NaN;
  if (r === 0) return monthly * months;
  return monthly * (1 - Math.pow(1 + r, -months)) / r;
}
// 총이자
export function totalInterest(principal, annualRatePct, months) {
  return monthlyPayment(principal, annualRatePct, months) * months - principal;
}
// DSR(%) = 연간 전체 원리금 / 연소득 × 100
export function dsrPct(annualIncome, annualDebtService) {
  if (annualIncome <= 0) return NaN;
  return annualDebtService / annualIncome * 100;
}
// DSR 한도 내 신규대출 가능액(스트레스 금리 가산 반영)
export function dsrMaxLoan({ annualIncome, dsrLimitPct = 40, existingAnnual = 0, ratePct, stressAddPct = 0, months }) {
  const capacityYear = annualIncome * dsrLimitPct / 100 - existingAnnual;
  if (capacityYear <= 0) return { maxLoan: 0, capacityYear, monthlyBudget: 0 };
  const monthlyBudget = capacityYear / 12;
  const maxLoan = maxLoanFromPayment(monthlyBudget, ratePct + stressAddPct, months);
  return { maxLoan, capacityYear, monthlyBudget };
}

/* ---------- 인지세 (인지세법 §3) ---------- */
export function stampDuty(price, brackets, { isHouse = false, houseExemptMax = 100_000_000 } = {}) {
  if (isHouse && price <= houseExemptMax) return 0;
  const b = brackets.find(([lo, hi]) => price > lo && price <= hi) || brackets[brackets.length - 1];
  return b[2];
}

/* ---------- 누진세율표 (재산세·종부세 공용) ---------- */
// brackets: [하한(초과), 상한(이하), 기본세액, 초과분 세율%] — 재산세형
export function progressiveTax(base, brackets) {
  if (base <= 0) return 0;
  const b = brackets.find(([lo, hi]) => base > lo && base <= hi) || brackets[brackets.length - 1];
  const [lo, , baseTax, ratePct] = b;
  return Math.round(baseTax + (base - lo) * ratePct / 100);
}
// brackets: [하한(초과), 상한(이하), 세율%] — 종부세형(구간별 한계세율 누적)
export function marginalTax(base, brackets) {
  if (base <= 0) return 0;
  let tax = 0;
  for (const [lo, hi, ratePct] of brackets) {
    if (base <= lo) break;
    const span = Math.min(base, hi) - lo;
    if (span > 0) tax += span * ratePct / 100;
  }
  return Math.round(tax);
}

/* ---------- 수익률 ---------- */
export function rentYield({ price, deposit = 0, monthly, loan = 0, loanRatePct = 0, expenseMonthly = 0 }) {
  const annualRent = monthly * 12 - expenseMonthly * 12;
  const gross = (monthly * 12) / (price - deposit) * 100;
  const invested = price - deposit - loan;
  const annualInterest = loan * loanRatePct / 100;
  const net = invested > 0 ? (annualRent - annualInterest) / invested * 100 : NaN;
  return { gross, net, invested, annualRent, annualInterest };
}

/* ---------- 대출 상환 스케줄 (loan-compare / affordability 공용) ---------- */
// 원리금균등: paidMonths 회차 납입 후 잔액
export function remainingBalance(principal, annualRatePct, months, paidMonths) {
  const r = annualRatePct / 100 / 12;
  const k = Math.min(Math.max(0, paidMonths), months);
  if (k >= months) return 0;
  if (r === 0) return principal * (1 - k / months);
  const pay = monthlyPayment(principal, annualRatePct, months);
  return principal * Math.pow(1 + r, k) - pay * (Math.pow(1 + r, k) - 1) / r;
}
// 원리금균등: k회차까지 누적 이자
export function cumulativeInterest(principal, annualRatePct, months, paidMonths) {
  const k = Math.min(Math.max(0, paidMonths), months);
  const pay = monthlyPayment(principal, annualRatePct, months);
  const bal = remainingBalance(principal, annualRatePct, months, k);
  return pay * k - (principal - bal);
}
// 원금균등: 매월 원금 일정, 이자는 잔액 기준 체감
export function equalPrincipal(principal, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  const per = principal / months;
  return {
    principalPerMonth: per,
    firstPayment: per + principal * r,
    lastPayment: per + per * r,
    totalInterest: principal * r * (months + 1) / 2,
  };
}
export function equalPrincipalBalance(principal, months, paidMonths) {
  const k = Math.min(Math.max(0, paidMonths), months);
  return principal * (1 - k / months);
}
export function equalPrincipalCumInterest(principal, annualRatePct, months, paidMonths) {
  const r = annualRatePct / 100 / 12;
  const per = principal / months;
  const k = Math.min(Math.max(0, paidMonths), months);
  // Σ_{i=0}^{k-1} (principal - per*i) * r
  return r * (principal * k - per * k * (k - 1) / 2);
}
// 중도상환수수료: 잔액 × 요율 × (잔여 면제기간/면제기간) — 슬라이딩(체감) 방식 선택
export function prepayFee(balance, feePct, { sliding = true, exemptMonths = 36, paidMonths = 0 } = {}) {
  if (balance <= 0 || feePct <= 0) return 0;
  if (!sliding) return balance * feePct / 100;
  const left = Math.max(0, exemptMonths - paidMonths);
  return balance * feePct / 100 * (left / exemptMonths);
}
