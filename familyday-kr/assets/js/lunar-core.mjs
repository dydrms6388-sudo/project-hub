/**
 * lunar-core.mjs — 음양력 변환 순수 로직 (브라우저/Node 공용, 의존성 0)
 *
 * 방식: 천문 계산으로 삭(朔, 신월) 시각과 태양 황경(중기)을 구해 한국 표준시(KST, UTC+9)
 * 기준 음력 달력을 재구성한다. 규칙은 동아시아 태음태양력의 표준 규칙을 따른다.
 *   1) 삭이 드는 날이 그 달의 초하루(음력 1일).
 *   2) 동지(태양 황경 270°)가 드는 달이 11월.
 *   3) 동지 달에서 다음 동지 달까지 13개월이면 윤달이 있는 해이고,
 *      그 사이 달 가운데 중기(황경 30°의 배수)가 들지 않는 첫 달이 윤달이다.
 *
 * 계산식 출처: Jean Meeus, 『Astronomical Algorithms』 2nd ed.
 *   - 49장 삭·망(Phases of the Moon), 25장 태양의 위치(Solar Coordinates)
 *   - ΔT 근사: Espenak & Meeus, NASA Eclipse Web Site 다항식
 * 정확도: 현대(1900~2100) 구간에서 날짜 단위로 한국천문연구원(KASI) 음양력 변환과
 * 일치하는 것을 설날·추석 실제 날짜로 검증했다. 다만 삭 시각이 자정에 극히 가까운
 * 드문 경우 하루 차이가 날 수 있으므로, 제사·기일처럼 중요한 날짜는 KASI 변환기로
 * 최종 확인하도록 UI에 안내한다. (https://astro.kasi.re.kr/life/pageView/8)
 */

export const KASI_URL = "https://astro.kasi.re.kr/life/pageView/8";
export const LUNAR_META = {
  source: "Meeus, Astronomical Algorithms (삭·태양황경) / KST(UTC+9) 기준 재구성",
  urls: [KASI_URL],
  checkedAt: "2026-08-19",
};

const RAD = Math.PI / 180;
const S = (d) => Math.sin(d * RAD);

/** 그레고리력 → 율리우스일수(JDN, 정수) */
export function g2jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** JDN(정수) → {y,m,d} */
export function jdn2g(jdn) {
  let a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d2 = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d2 / 4);
  const m2 = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m2 + 2) / 5) + 1;
  const month = m2 + 3 - 12 * Math.floor(m2 / 10);
  const year = 100 * b + d2 - 4800 + Math.floor(m2 / 10);
  return { y: year, m: month, d: day };
}

/** ΔT(초) 근사 — Espenak & Meeus */
export function deltaT(year) {
  let u, t;
  if (year >= 2005 && year < 2050) { t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (year >= 1986 && year < 2005) {
    t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3
      + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (year >= 1961 && year < 1986) { t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (year >= 1941 && year < 1961) { t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (year >= 1920 && year < 1941) { t = year - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  if (year >= 1900 && year < 1920) { t = year - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (year >= 2050 && year < 2150) { u = (year - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - year); }
  u = (year - 1820) / 100;
  return -20 + 32 * u * u;
}

/** k번째 삭(신월)의 JDE(역학시). k=0 은 2000-01-06 삭. */
export function newMoonJDE(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;

  jde += -0.40720 * S(Mp)
    + 0.17241 * E * S(M)
    + 0.01608 * S(2 * Mp)
    + 0.01039 * S(2 * F)
    + 0.00739 * E * S(Mp - M)
    - 0.00514 * E * S(Mp + M)
    + 0.00208 * E * E * S(2 * M)
    - 0.00111 * S(Mp - 2 * F)
    - 0.00057 * S(Mp + 2 * F)
    + 0.00056 * E * S(2 * Mp + M)
    - 0.00042 * S(3 * Mp)
    + 0.00042 * E * S(M + 2 * F)
    + 0.00038 * E * S(M - 2 * F)
    - 0.00024 * E * S(2 * Mp - M)
    - 0.00017 * S(Om)
    - 0.00007 * S(Mp + 2 * M)
    + 0.00004 * S(2 * Mp - 2 * F)
    + 0.00004 * S(3 * M)
    + 0.00003 * S(Mp + M - 2 * F)
    + 0.00003 * S(2 * Mp + 2 * F)
    - 0.00003 * S(Mp + M + 2 * F)
    + 0.00003 * S(Mp - M + 2 * F)
    - 0.00002 * S(Mp - M - 2 * F)
    - 0.00002 * S(3 * Mp + M)
    + 0.00002 * S(4 * Mp);

  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T2, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.000110],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.000060],
    [154.84 + 7.306860 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.000040],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023],
  ];
  for (const [ang, amp] of A) jde += amp * S(ang);
  return jde;
}

/** JDE(역학시) → KST 기준 달력 날짜의 JDN */
function jdeToKstJdn(jde) {
  const approxYear = 2000 + (jde - 2451545) / 365.25;
  const jdUt = jde - deltaT(approxYear) / 86400;
  return Math.floor(jdUt + 9 / 24 + 0.5);
}

/** 태양의 겉보기 황경(도) — Meeus 25장 저정밀도 */
export function sunLongitude(jde) {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * S(M)
    + (0.019993 - 0.000101 * T) * S(2 * M)
    + 0.000289 * S(3 * M);
  const Om = 125.04 - 1934.136 * T;
  let lam = L0 + C - 0.00569 - 0.00478 * S(Om);
  lam %= 360; if (lam < 0) lam += 360;
  return lam;
}

function norm180(x) { let v = x % 360; if (v > 180) v -= 360; if (v < -180) v += 360; return v; }

/** 태양 황경이 targetDeg 가 되는 시각(JDE) — jdGuess 근처에서 반복 수렴 */
export function solarTermJDE(targetDeg, jdGuess) {
  let jd = jdGuess;
  for (let i = 0; i < 30; i++) {
    const diff = norm180(targetDeg - sunLongitude(jd));
    if (Math.abs(diff) < 1e-7) break;
    jd += diff * 365.2422 / 360;
  }
  return jd;
}

/** 그해 12월 동지의 KST 날짜(JDN) */
function winterSolsticeJdn(year) {
  const guess = g2jdn(year, 12, 21) - 0.5;
  return jdeToKstJdn(solarTermJDE(270, guess));
}
function winterSolsticeJDE(year) {
  return solarTermJDE(270, g2jdn(year, 12, 21) - 0.5);
}

const cycleCache = new Map();

/**
 * 음력 "동지월 주기" 계산.
 * cycle(y) = 음력 (y-1)년 11월부터 y년 11월 직전까지의 달 목록.
 * 반환: [{ startJdn, year, month, leap }]  (마지막 원소는 y년 11월의 시작 = 경계용으로 포함)
 */
export function cycle(y) {
  if (cycleCache.has(y)) return cycleCache.get(y);
  const ws0jde = winterSolsticeJDE(y - 1);
  const ws1jde = winterSolsticeJDE(y);
  const ws0 = jdeToKstJdn(ws0jde);
  const ws1 = jdeToKstJdn(ws1jde);

  // 삭 목록: ws0 이전 45일 ~ ws1 이후 45일
  const kStart = Math.floor((ws0 - 45 - 2451550.09766) / 29.530588861) - 1;
  const moons = [];
  for (let k = kStart; k < kStart + 20; k++) {
    const jdn = jdeToKstJdn(newMoonJDE(k));
    if (jdn > ws1 + 45) break;
    if (moons.length === 0 || jdn > moons[moons.length - 1]) moons.push(jdn);
  }
  // 동지가 드는 달(= 11월)의 인덱스
  let i0 = -1, i1 = -1;
  for (let i = 0; i < moons.length; i++) {
    if (moons[i] <= ws0) i0 = i;
    if (moons[i] <= ws1) i1 = i;
  }
  const count = i1 - i0; // 동지월 사이 개월 수 (12 또는 13)
  const months = [];
  for (let i = i0; i <= i1; i++) months.push({ startJdn: moons[i], nextJdn: moons[i + 1] });

  // 윤달 판정: 중기(황경 30° 배수)가 들지 않는 첫 달
  let leapIdx = -1;
  if (count === 13) {
    // 동지월부터 각 달에 중기가 있는지 검사
    const termJdns = [];
    for (let t = 0; t <= 13; t++) {
      const deg = (270 + 30 * t) % 360;
      const jde = solarTermJDE(deg, ws0jde + t * 30.4368);
      termJdns.push(jdeToKstJdn(jde));
    }
    for (let i = 1; i < months.length; i++) {
      const has = termJdns.some((tj) => tj >= months[i].startJdn && tj < months[i].nextJdn);
      if (!has) { leapIdx = i; break; }
    }
    if (leapIdx === -1) leapIdx = months.length - 1;
  }

  // 번호 매기기: index 0 = (y-1)년 11월
  const out = [];
  let num = 11, yr = y - 1;
  for (let i = 0; i < months.length; i++) {
    if (i === leapIdx) {
      out.push({ startJdn: months[i].startJdn, nextJdn: months[i].nextJdn, year: out[i - 1].year, month: out[i - 1].month, leap: true });
      continue;
    }
    if (i > 0) {
      num += 1;
      if (num > 12) { num = 1; yr += 1; }
    }
    out.push({ startJdn: months[i].startJdn, nextJdn: months[i].nextJdn, year: yr, month: num, leap: false });
  }
  cycleCache.set(y, out);
  return out;
}

/** 음력 y년의 모든 달 목록 (1월~12월, 윤달 포함) */
export function lunarYearMonths(y) {
  const a = cycle(y).filter((m) => m.year === y);
  const b = cycle(y + 1).filter((m) => m.year === y);
  const seen = new Set();
  const all = [...a, ...b].filter((m) => {
    const key = m.startJdn;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  all.sort((x, z) => x.startJdn - z.startJdn);
  return all;
}

/** 양력 → 음력. 반환 {year, month, day, leap, days} (days=그 음력 달의 일수) */
export function solarToLunar(y, m, d) {
  const jdn = g2jdn(y, m, d);
  for (const cy of [y, y + 1, y - 1]) {
    for (const mo of cycle(cy)) {
      if (jdn >= mo.startJdn && jdn < mo.nextJdn) {
        return {
          year: mo.year, month: mo.month, leap: mo.leap,
          day: jdn - mo.startJdn + 1, days: mo.nextJdn - mo.startJdn,
        };
      }
    }
  }
  return null;
}

/** 음력 → 양력. 없으면 null (예: 그해에 없는 윤달, 30일이 없는 작은달) */
export function lunarToSolar(y, m, d, leap = false) {
  const months = lunarYearMonths(y);
  const mo = months.find((x) => x.month === m && !!x.leap === !!leap);
  if (!mo) return null;
  const len = mo.nextJdn - mo.startJdn;
  if (d < 1 || d > len) return null;
  return { ...jdn2g(mo.startJdn + d - 1), days: len };
}

/** 그 해 음력 m월(평달)의 일수. 없으면 0 */
export function lunarMonthLength(y, m, leap = false) {
  const mo = lunarYearMonths(y).find((x) => x.month === m && !!x.leap === !!leap);
  return mo ? mo.nextJdn - mo.startJdn : 0;
}

/** 음력 y년에 있는 윤달 번호. 없으면 0 */
export function leapMonthOf(y) {
  const mo = lunarYearMonths(y).find((x) => x.leap);
  return mo ? mo.month : 0;
}

/** 요일 (0=일) */
export function dowOf(y, m, d) { return (g2jdn(y, m, d) + 1) % 7; }
export const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
