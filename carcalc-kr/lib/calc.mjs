// carcalc-kr 순수 계산 함수 — 브라우저(ES module)와 Node 테스트가 함께 import 한다.
// 의존성 0. 데이터(세율 등)는 data/*.mjs 에서 import.
import { PASSENGER_RATES, OTHER_PASSENGER_FLAT, EDUCATION_TAX_RATE, AGE_REDUCTION, PREPAY_DISCOUNT } from "../data/car-tax.mjs";
import { ACQ_RATES } from "../data/acquisition.mjs";

export const floor10 = (x) => Math.floor(x / 10) * 10;

// ── 자동차세 (승용) ─────────────────────────────────────────────
// cc: 배기량(0이면 전기차 등 "그 밖의 승용"), use: "nonbusiness" | "business"
// ageYears: 차령(1부터), prepayMonth: 연납 신청월(1|3|6|9|null)
export function carTax({ cc, use = "nonbusiness", ageYears = 1, prepayMonth = null }) {
  let raw; // 경감 전 연세액(본세)
  let perCc = null;
  if (!cc || cc <= 0) {
    raw = OTHER_PASSENGER_FLAT[use].value; // 전기·수소 등 배기량 없는 승용
  } else {
    const table = PASSENGER_RATES[use].value;
    perCc = table.find((r) => cc <= r.maxCc).perCc;
    raw = cc * perCc;
  }

  // 차령 경감: 3년차부터 5%p/년, 최대 50% (승용)
  const { startYear, stepRate, maxRate } = AGE_REDUCTION.value;
  const reduction = ageYears >= startYear ? Math.min(stepRate * (ageYears - 2), maxRate) : 0;
  const mainTax = floor10(raw * (1 - reduction)); // 본세 (10원 미만 절사)

  // 지방교육세: 비영업용에만 30%
  const educTax = use === "nonbusiness" ? floor10(mainTax * EDUCATION_TAX_RATE.value) : 0;
  const annualTotal = mainTax + educTax;

  // 연납 공제: 연세액 × 5% × (공제기간 일수 / 365)
  let prepayDiscount = 0;
  let prepayPaid = annualTotal;
  if (prepayMonth && PREPAY_DISCOUNT.periods.value[prepayMonth]) {
    const { days } = PREPAY_DISCOUNT.periods.value[prepayMonth];
    prepayDiscount = floor10(annualTotal * PREPAY_DISCOUNT.rate.value * (days / 365));
    prepayPaid = annualTotal - prepayDiscount;
  }

  return { cc: cc || 0, perCc, raw, reduction, mainTax, educTax, annualTotal, prepayDiscount, prepayPaid };
}

// ── 취득세 ─────────────────────────────────────────────────────
// price: 과세표준(원), type: ACQ_RATES 의 key
export function acquisitionTax({ price, type = "passengerNonbusiness" }) {
  const entry = ACQ_RATES[type];
  if (!entry) throw new Error("unknown type: " + type);
  const tax = floor10(price * entry.value);
  return { price, type, rate: entry.value, label: entry.label, tax };
}

// ── 할부(대출) 상환 스케줄 ──────────────────────────────────────
// principal: 원금(원), annualRate: 연이율(예: 0.059), months: 개월
// method: "equalPayment"(원리금균등) | "equalPrincipal"(원금균등)
export function loanSchedule({ principal, annualRate, months, method = "equalPayment" }) {
  const r = annualRate / 12;
  const rows = [];
  let balance = principal;

  if (method === "equalPayment") {
    const payment = r === 0 ? Math.round(principal / months) : Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
    for (let m = 1; m <= months; m++) {
      const interest = Math.round(balance * r);
      let principalPart = payment - interest;
      let pay = payment;
      if (m === months || principalPart >= balance) { // 마지막 회차 잔액 정리
        principalPart = balance;
        pay = principalPart + interest;
      }
      balance -= principalPart;
      rows.push({ m, pay, principalPart, interest, balance });
      if (balance <= 0) break;
    }
  } else {
    const basePrincipal = Math.floor(principal / months);
    for (let m = 1; m <= months; m++) {
      const interest = Math.round(balance * r);
      const principalPart = m === months ? balance : basePrincipal;
      const pay = principalPart + interest;
      balance -= principalPart;
      rows.push({ m, pay, principalPart, interest, balance });
    }
  }

  const totalPay = rows.reduce((s, x) => s + x.pay, 0);
  const totalPrincipal = rows.reduce((s, x) => s + x.principalPart, 0);
  const totalInterest = totalPay - totalPrincipal;
  return { rows, totalPay, totalPrincipal, totalInterest, firstPay: rows[0]?.pay ?? 0 };
}

// ── 타이어 규격 ────────────────────────────────────────────────
// "205/55R16" | "205/55 R 16 91V" 등 → {width, aspect, rim} (실패 시 null)
export function parseTire(spec) {
  const m = String(spec).trim().toUpperCase().match(/^(\d{3})\s*\/\s*(\d{2,3})\s*(?:R|ZR)\s*(\d{2})(?:\s*(\d{2,3})\s*([A-Z]))?$/);
  if (!m) return null;
  return {
    width: +m[1], aspect: +m[2], rim: +m[3],
    loadIndex: m[4] ? +m[4] : null, speedSymbol: m[5] || null,
  };
}

// 타이어 전체 지름(mm) = 림 지름(인치×25.4) + 사이드월 높이(폭×편평비%)×2
export function tireDiameter({ width, aspect, rim }) {
  return rim * 25.4 + 2 * (width * aspect / 100);
}

// 대체 규격 지름 오차(%) — 통상 ±3% 이내 권장(관행 기준, 참고용)
export function tireDiff(orig, alt) {
  const d1 = tireDiameter(orig);
  const d2 = tireDiameter(alt);
  return { d1, d2, diffMm: d2 - d1, diffPct: ((d2 - d1) / d1) * 100 };
}

// ── 중고차 감가 (단순 모델 — 시세 아님) ─────────────────────────
// 산식 공개: 1년차 -rateFirst, 이후 매년 -rateAfter (기하 감소),
// 주행 보정: 기준(연 15,000km) 대비 1만km 편차당 ∓2%, 보정 상하한 ±10%
export function depreciation({ price, ageYears, mileage,
  rateFirst = 0.2, rateAfter = 0.1, stdKmPerYear = 15000 }) {
  const age = Math.max(0, ageYears);
  let factor = 1;
  if (age >= 1) factor = (1 - rateFirst) * Math.pow(1 - rateAfter, age - 1);
  else factor = 1 - rateFirst * age;
  let mileageAdj = 0;
  if (mileage != null && age > 0) {
    const deltaMan = (mileage - stdKmPerYear * age) / 10000; // 1만km 단위 편차
    mileageAdj = Math.max(-0.1, Math.min(0.1, -0.02 * deltaMan));
  }
  const value = Math.max(0, Math.round(price * factor * (1 + mileageAdj)));
  return { value, factor, mileageAdj, lossPct: price > 0 ? (1 - value / price) * 100 : 0 };
}

// ── 연비·유류비 ────────────────────────────────────────────────
export const fuelEconomy = (km, liters) => (liters > 0 ? km / liters : 0); // km/L
export function fuelCost({ km, kmPerL, pricePerL, roundTrip = false, toll = 0 }) {
  const dist = roundTrip ? km * 2 : km;
  const liters = kmPerL > 0 ? dist / kmPerL : 0;
  const fuel = Math.round(liters * pricePerL);
  const tollTotal = roundTrip ? toll * 2 : toll;
  return { dist, liters, fuel, toll: tollTotal, total: fuel + tollTotal };
}
