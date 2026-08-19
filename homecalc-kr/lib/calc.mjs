// homecalc-kr 공용 순수 계산 함수 — 브라우저(<script type="module">)와 Node 테스트가 함께 사용한다.
// 부수효과·DOM 접근 금지.

export const M2_PER_PYEONG = 3.305785; // 1평 = 400/121㎡ (계량법 관용 환산)

export const pyeongToM2 = (p) => p * M2_PER_PYEONG;
export const m2ToPyeong = (m2) => m2 / M2_PER_PYEONG;

const EPS = 1e-9;
export const ceilSafe = (x) => Math.ceil(x - EPS);

/* ---------- 도배 ---------- */
// perimeterM: 벽 둘레(m), heightM: 천장고(m), openingsM2: 문/창 등 제외 면적(㎡)
// rollWidthM/rollLengthM: 벽지 1롤 규격, lossRate: 재단·무늬 여유율(0.1 = 10%)
export function wallpaperCalc({ perimeterM, heightM, openingsM2 = 0, rollWidthM, rollLengthM, lossRate = 0.1 }) {
  const wallArea = Math.max(0, perimeterM * heightM - openingsM2);
  const rollArea = rollWidthM * rollLengthM;
  const needArea = wallArea * (1 + lossRate);
  const rolls = rollArea > 0 ? ceilSafe(needArea / rollArea) : 0;
  return { wallArea, rollArea, needArea, rolls };
}

/* ---------- 장판/마루 ---------- */
// areaM2: 바닥 면적, boxCoverageM2: 1박스 시공 면적, lossRate: 로스율
export function flooringCalc({ areaM2, boxCoverageM2, lossRate = 0.05 }) {
  const needArea = areaM2 * (1 + lossRate);
  const boxes = boxCoverageM2 > 0 ? ceilSafe(needArea / boxCoverageM2) : 0;
  return { needArea, boxes };
}

/* ---------- 타일 ---------- */
// tileWmm/tileHmm: 타일 한 변(mm), groutMm: 줄눈 폭(mm), lossRate: 시공 로스
export function tileCalc({ areaM2, tileWmm, tileHmm, groutMm = 3, lossRate = 0.08 }) {
  const unitMm2 = (tileWmm + groutMm) * (tileHmm + groutMm);
  const perM2 = 1e6 / unitMm2; // ㎡당 장수(줄눈 포함)
  const rawCount = areaM2 * perM2;
  const tiles = ceilSafe(rawCount * (1 + lossRate));
  return { perM2, rawCount, tiles };
}

/* ---------- 페인트 ---------- */
// coveragePerL: 1회 도장 기준 도포율(㎡/L) — 제품 라벨 값 우선
export function paintCalc({ areaM2, coats = 2, coveragePerL, lossRate = 0 }) {
  const liters = (areaM2 * coats) / coveragePerL * (1 + lossRate);
  // 캔 조합 제안: 4L 캔 + 1L 캔
  const litersUp = Math.ceil(liters * 10 - EPS) / 10;
  const can4 = Math.floor(litersUp / 4);
  const can1 = Math.max(0, Math.ceil(litersUp - can4 * 4 - EPS));
  return { liters, litersUp, can4, can1 };
}

/* ---------- 커튼 ---------- */
export function curtainCalc({ windowWcm, fullness = 2, fabricWcm = 140, sideAllowCm = 10, lengthCm, hemAllowCm = 25 }) {
  const neededWidth = windowWcm * fullness + sideAllowCm * 2;
  const panels = fabricWcm > 0 ? ceilSafe(neededWidth / fabricWcm) : 0; // 원단 폭 기준 필요 폭 수
  const cutLengthCm = lengthCm + hemAllowCm;
  const totalFabricCm = panels * cutLengthCm;
  return { neededWidth, panels, cutLengthCm, totalFabricCm, totalFabricM: totalFabricCm / 100 };
}

/* ---------- 가구 배치(furniture-fit) 코어 ---------- */
// rect: {x, y, w, h} — 단위 cm, 회전은 w/h 스왑으로 표현
export function rectsOverlap(a, b) {
  // 모서리가 맞닿기만 한 경우(간격 0)는 겹침으로 보지 않는다
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function inRoom(rect, room) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= room.w && rect.y + rect.h <= room.h;
}

export function clampToRoom(rect, room) {
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, room.w - rect.w));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, room.h - rect.h));
  return { ...rect, x, y };
}

export function rotateRect(rect) {
  return { ...rect, w: rect.h, h: rect.w };
}

// items 중 idx 항목이 다른 항목과 겹치는지
export function anyCollision(items, idx) {
  const t = items[idx];
  return items.some((o, i) => i !== idx && rectsOverlap(t, o));
}

/* ---------- 조명 ---------- */
// 광속법: 필요 광속(lm) = 조도(lx) × 면적(㎡) ÷ (조명률 × 보수율)
export function lightingCalc({ areaM2, lux, utilization = 0.6, maintenance = 0.8, bulbLm }) {
  const lumens = (lux * areaM2) / (utilization * maintenance);
  const bulbs = bulbLm > 0 ? ceilSafe(lumens / bulbLm) : 0;
  return { lumens, bulbs };
}

/* ---------- 에어컨 평수 ---------- */
export function acSizeCalc({ pyeong, perPyeongKw, ceilingM = 2.3, baseCeilingM = 2.3 }) {
  const factor = ceilingM / baseCeilingM;
  const kw = pyeong * perPyeongKw * factor;
  return { kw, factor, btu: kw * 3412.14 }; // 1kW ≈ 3412.14 BTU/h
}

/* ---------- 전월세 전환 ---------- */
// 법정 상한 전환율 = min(연 10%, 기준금리 + 2%p)
export function legalCapRate(baseRate, { fixedCap = 0.10, spread = 0.02 } = {}) {
  return Math.min(fixedCap, baseRate + spread);
}
// 보증금 diff 원을 월세로: 월세 = diff × 전환율 / 12
export function depositToMonthly(depositDiff, annualRate) {
  return (depositDiff * annualRate) / 12;
}
// 월세 → 보증금 환산: 보증금 = 월세 × 12 / 전환율
export function monthlyToDeposit(monthly, annualRate) {
  return annualRate > 0 ? (monthly * 12) / annualRate : 0;
}

/* ---------- 이사 견적 참고 범위 ---------- */
export function movingCostEstimate({ base, packing, packingMult, distanceKm, perKmOver30, ladderSides, ladderPer, noElevFloors, perFloor, acMove, acRange }) {
  const lo = { v: 0 }, hi = { v: 0 };
  const add = (r) => { lo.v += r[0]; hi.v += r[1]; };
  const baseR = packing ? [base[0] * packingMult[0], base[1] * packingMult[1]] : base;
  add(baseR);
  const over = Math.max(0, distanceKm - 30);
  add([over * perKmOver30[0], over * perKmOver30[1]]);
  add([ladderSides * ladderPer[0], ladderSides * ladderPer[1]]);
  add([noElevFloors * perFloor[0], noElevFloors * perFloor[1]]);
  if (acMove) add(acRange);
  return { min: Math.round(lo.v), max: Math.round(hi.v) };
}
