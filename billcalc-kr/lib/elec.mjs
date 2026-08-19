// 주택용 전기요금 계산 엔진 (순수 함수 — 브라우저·Node 공용)
import { TARIFF } from "../data/electric.mjs";

/**
 * 주택용 전기요금 계산.
 * @param {number} kwh 월 사용량(kWh)
 * @param {object} opts { month:1~12, voltage:"low"|"high", fuelAdj(원/kWh), climate(원/kWh), fundRate, tariff }
 * @returns 항목별 산출 내역
 */
export function calcBill(kwh, opts = {}) {
  const {
    month = new Date().getMonth() + 1,
    voltage = "low",
    tariff = TARIFF,
  } = opts;
  const fuelAdj = opts.fuelAdj ?? tariff.fuelAdj.value;
  const climate = opts.climate ?? tariff.climate.value;
  const fundRate = opts.fundRate ?? tariff.fund.value;

  kwh = Math.max(0, Number(kwh) || 0);
  const v = tariff[voltage];
  const isSummer = tariff.summerMonths.value.includes(month);
  const br = (isSummer ? tariff.brackets.summer : tariff.brackets.other).value;

  // 누진 구간(기본요금 결정)
  const tier = kwh <= br[0] ? 1 : kwh <= br[1] ? 2 : 3;
  const base = v.base.value[tier - 1];

  // 전력량요금: 구간별 단가 × 해당 구간 사용량 (항목별 원 미만 절사)
  const superOn = tariff.superUser.months.value.includes(month);
  const th = tariff.superUser.threshold.value;
  const steps = [];
  const t1 = Math.min(kwh, br[0]);
  steps.push({ label: `1단계 처음 ${br[0]}kWh`, kwh: t1, rate: v.energy.value[0] });
  if (kwh > br[0]) {
    steps.push({ label: `2단계 ${br[0] + 1}~${br[1]}kWh`, kwh: Math.min(kwh, br[1]) - br[0], rate: v.energy.value[1] });
  }
  if (kwh > br[1]) {
    const upper = superOn ? Math.min(kwh, th) : kwh;
    steps.push({ label: `3단계 ${br[1]}kWh 초과`, kwh: upper - br[1], rate: v.energy.value[2] });
    if (superOn && kwh > th) {
      steps.push({ label: `슈퍼유저 ${th.toLocaleString()}kWh 초과`, kwh: kwh - th, rate: v.superUser.value, superUser: true });
    }
  }
  for (const s of steps) s.amount = Math.floor(s.kwh * s.rate);
  const energy = steps.reduce((a, s) => a + s.amount, 0);

  const climateCharge = Math.floor(kwh * climate);
  const fuelCharge = Math.trunc(kwh * fuelAdj); // 음수 가능(절대값 원 미만 버림)

  const subtotal = base + energy + climateCharge + fuelCharge; // 전기요금계
  const vat = Math.round(subtotal * tariff.vat.value);          // 부가세: 원 미만 반올림
  const fund = Math.floor((subtotal * fundRate) / 10) * 10;      // 기반기금: 10원 미만 절사
  const total = Math.floor((subtotal + vat + fund) / 10) * 10;   // 청구금액: 10원 미만 절사

  return {
    kwh, month, isSummer, voltage, voltageLabel: v.label,
    tier, brackets: br,
    base, steps, energy,
    climate: climateCharge, fuel: fuelCharge,
    subtotal, vat, fund, total,
    rates: { fuelAdj, climate, fundRate },
  };
}

/**
 * 추가 사용량으로 인한 실제 증가액(누진 구간 이동 반영).
 * @returns {before, after, addKwh, delta, avgPerKwh, tierMoved}
 */
export function calcDelta(baseKwh, addKwh, opts = {}) {
  const before = calcBill(baseKwh, opts);
  const after = calcBill(Math.max(0, baseKwh) + Math.max(0, addKwh), opts);
  const delta = after.total - before.total;
  return {
    before, after,
    addKwh: Math.max(0, addKwh),
    delta,
    avgPerKwh: addKwh > 0 ? delta / addKwh : 0,
    tierMoved: after.tier !== before.tier,
  };
}

/** 소비전력(W)·하루 h·일수 → 월 kWh */
export function kwhOf(watt, hoursPerDay, days = 30) {
  return (Math.max(0, watt) * Math.max(0, hoursPerDay) * Math.max(0, days)) / 1000;
}
