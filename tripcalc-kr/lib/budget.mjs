// tripcalc-kr 여행 예산·정산 계산 (순수 함수)

export const BUDGET_CATS = [
  { id: "flight", name: "항공권", emoji: "✈️", per: "person" },
  { id: "stay", name: "숙소", emoji: "🏨", per: "trip" },
  { id: "food", name: "식비", emoji: "🍽️", per: "personDay" },
  { id: "transit", name: "현지 교통", emoji: "🚇", per: "personDay" },
  { id: "activity", name: "관광·액티비티", emoji: "🎟️", per: "person" },
  { id: "shopping", name: "쇼핑·기념품", emoji: "🛍️", per: "person" },
  { id: "insurance", name: "보험·로밍·기타", emoji: "🧾", per: "person" },
];

/**
 * 항목 합계 계산.
 * items: [{id, amount, currency, per}] — per: "trip"(총액) | "person"(1인당) | "personDay"(1인 1일)
 * 환산은 rateToKrw(code) 로 위임한다(없으면 KRW 로 간주).
 */
export function totalize({ items = [], people = 1, days = 1, rateToKrw = () => 1 } = {}) {
  const p = Math.max(1, people), d = Math.max(1, days);
  const rows = items.map((it) => {
    const amt = Number(it.amount) || 0;
    const rate = it.currency && it.currency !== "KRW" ? (rateToKrw(it.currency) || 0) : 1;
    const krwUnit = amt * rate;
    const mult = it.per === "person" ? p : it.per === "personDay" ? p * d : 1;
    return { ...it, amount: amt, rate, krwUnit, mult, krw: krwUnit * mult };
  });
  const total = rows.reduce((s, r) => s + r.krw, 0);
  return {
    rows, total,
    perPerson: total / p,
    perDay: total / d,
    perPersonDay: total / p / d,
    people: p, days: d,
  };
}

/**
 * N빵 정산: 누가 얼마 냈는지 → 누가 누구에게 얼마 보내면 되는지.
 * payers: [{name, paid}]
 */
export function settle(payers = []) {
  const n = payers.length;
  if (!n) return { each: 0, total: 0, transfers: [], balances: [] };
  const total = payers.reduce((s, p) => s + (Number(p.paid) || 0), 0);
  const each = total / n;
  const balances = payers.map((p) => ({ name: p.name, paid: Number(p.paid) || 0, diff: (Number(p.paid) || 0) - each }));
  const debtors = balances.filter((b) => b.diff < -0.5).map((b) => ({ ...b, left: -b.diff })).sort((a, b) => b.left - a.left);
  const creditors = balances.filter((b) => b.diff > 0.5).map((b) => ({ ...b, left: b.diff })).sort((a, b) => b.left - a.left);
  const transfers = [];
  let i = 0, j = 0, guard = 0;
  while (i < debtors.length && j < creditors.length && guard++ < 500) {
    const amt = Math.min(debtors[i].left, creditors[j].left);
    if (amt > 0.5) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amt) });
    debtors[i].left -= amt; creditors[j].left -= amt;
    if (debtors[i].left <= 0.5) i++;
    if (creditors[j].left <= 0.5) j++;
  }
  return { each, total, transfers, balances };
}
