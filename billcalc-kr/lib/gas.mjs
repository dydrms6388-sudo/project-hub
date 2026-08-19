// 도시가스 단위 변환·요금 계산 (순수 함수 — 브라우저·Node 공용)
import { GAS } from "../data/gas.mjs";

const MJ_PER_KWH = GAS.mjPerKwh.value; // 3.6 (정의값)

export function m3ToMj(m3, factor = GAS.heatFactor.value) { return m3 * factor; }
export function mjToM3(mj, factor = GAS.heatFactor.value) { return factor > 0 ? mj / factor : 0; }
export function mjToKwh(mj) { return mj / MJ_PER_KWH; }
export function kwhToMj(kwh) { return kwh * MJ_PER_KWH; }
export function m3ToKwh(m3, factor = GAS.heatFactor.value) { return mjToKwh(m3ToMj(m3, factor)); }
export function kwhToM3(kwh, factor = GAS.heatFactor.value) { return mjToM3(kwhToMj(kwh), factor); }

/**
 * 도시가스 요금 = (기본요금 + 사용량㎥ × 평균열량 × 단가원/MJ) × (1+부가세)
 * 단가·기본요금은 지역 고시값을 사용자가 입력(데이터에 값 미기재 — TODO).
 */
export function calcGasBill(m3, pricePerMj, { baseCharge = 0, factor = GAS.heatFactor.value, vatRate = GAS.vat.value } = {}) {
  const mj = m3ToMj(Math.max(0, m3), factor);
  const usageCharge = Math.floor(mj * Math.max(0, pricePerMj));
  const supply = Math.floor(baseCharge) + usageCharge; // 공급가액
  const vat = Math.round(supply * vatRate);
  const total = Math.floor((supply + vat) / 10) * 10; // 10원 미만 절사(청구 관행)
  return { m3, mj, factor, pricePerMj, baseCharge: Math.floor(baseCharge), usageCharge, supply, vat, total };
}
