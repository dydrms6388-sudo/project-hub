// 태양 위치 계산 — NOAA Solar Calculator 알고리즘 (Jean Meeus, Astronomical
// Algorithms 2nd ed. ch.25 기반). 전부 클라이언트 계산, 외부 호출 없음.
// 정확도: 일출·일몰 ±1~2분 (ΔT·기압 굴절 변동 범위).

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function julianDay(y: number, m: number, d: number): number {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    B -
    1524.5
  );
}

export interface SunParams {
  /** 태양 적위 (deg) */
  declDeg: number;
  /** 균시차 (분) */
  eqTimeMin: number;
}

export function sunParams(jd: number): SunParams {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * D2R) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * D2R) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  const eps0 =
    23 +
    (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * D2R);
  const declDeg =
    Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R)) * R2D;
  const y2 = Math.tan((eps / 2) * D2R) ** 2;
  const eqTimeMin =
    4 *
    R2D *
    (y2 * Math.sin(2 * L0 * D2R) -
      2 * e * Math.sin(M * D2R) +
      4 * e * y2 * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R) -
      0.5 * y2 * y2 * Math.sin(4 * L0 * D2R) -
      1.25 * e * e * Math.sin(2 * M * D2R));
  return { declDeg, eqTimeMin };
}

/** 특정 고도각 통과 시각 (UTC 시간, 소수). 통과 없으면 null */
export function altitudeCrossing(
  y: number,
  m: number,
  d: number,
  lat: number,
  lon: number,
  altDeg: number
): { rise: number; set: number } | null {
  const { declDeg, eqTimeMin } = sunParams(julianDay(y, m, d) + 0.5);
  const cosH =
    (Math.sin(altDeg * D2R) -
      Math.sin(lat * D2R) * Math.sin(declDeg * D2R)) /
    (Math.cos(lat * D2R) * Math.cos(declDeg * D2R));
  if (cosH > 1 || cosH < -1) return null;
  const H = Math.acos(cosH) * R2D;
  const noon = 12 - lon / 15 - eqTimeMin / 60;
  return { rise: noon - H / 15, set: noon + H / 15 };
}

/** 하루 고도 곡선: localHour(0~24) → 고도(deg). step 시간 간격 */
export function altitudeCurve(
  y: number,
  m: number,
  d: number,
  lat: number,
  lon: number,
  tzOffsetH: number,
  stepH = 0.1
): Array<{ hour: number; alt: number }> {
  const pts: Array<{ hour: number; alt: number }> = [];
  for (let h = 0; h <= 24 + 1e-9; h += stepH) {
    const utc = h - tzOffsetH;
    const jd = julianDay(y, m, d) + utc / 24;
    const { declDeg, eqTimeMin } = sunParams(jd);
    // 시간각: 진태양시 기준
    const solarTime = utc + lon / 15 + eqTimeMin / 60;
    const haDeg = (solarTime - 12) * 15;
    const alt =
      Math.asin(
        Math.sin(lat * D2R) * Math.sin(declDeg * D2R) +
          Math.cos(lat * D2R) *
            Math.cos(declDeg * D2R) *
            Math.cos(haDeg * D2R)
      ) * R2D;
    pts.push({ hour: h, alt });
  }
  return pts;
}

/** 촬영 구간 정의 (고도각, 페이지 상단 설명과 일치해야 함) */
export const SUN_BANDS = [
  { key: "golden", label: "골든아워", from: 6, to: -4 },
  { key: "blue", label: "블루아워", from: -4, to: -6 },
  { key: "civil", label: "시민박명", from: -0.833, to: -6 },
  { key: "nautical", label: "항해박명", from: -6, to: -12 },
  { key: "astro", label: "천문박명", from: -12, to: -18 },
] as const;

export const SUNRISE_ALT = -0.833; // 대기굴절 34′ + 태양 시반경 16′

export interface DayEvents {
  sunrise: number | null;
  sunset: number | null;
  goldenAmStart: number | null; // 아침: 고도 -4° 상향
  goldenAmEnd: number | null; // 아침: 고도 +6° 상향
  goldenPmStart: number | null; // 저녁: +6° 하향
  goldenPmEnd: number | null; // 저녁: -4° 하향
  blueAmStart: number | null;
  blueAmEnd: number | null;
  bluePmStart: number | null;
  bluePmEnd: number | null;
  civilDusk: number | null;
  nauticalDusk: number | null;
  astroDusk: number | null;
  civilDawn: number | null;
  nauticalDawn: number | null;
  astroDawn: number | null;
  polar: "night" | "day" | null;
}

export function dayEvents(
  y: number,
  m: number,
  d: number,
  lat: number,
  lon: number,
  tz: number
): DayEvents {
  const at = (alt: number) => {
    const c = altitudeCrossing(y, m, d, lat, lon, alt);
    return c ? { rise: c.rise + tz, set: c.set + tz } : null;
  };
  const sun = at(SUNRISE_ALT);
  const a6 = at(6);
  const am4 = at(-4);
  const am6 = at(-6);
  const am12 = at(-12);
  const am18 = at(-18);
  let polar: DayEvents["polar"] = null;
  if (!sun) {
    // 정오 고도로 극야/백야 판별
    const curve = altitudeCurve(y, m, d, lat, lon, tz, 6);
    const maxAlt = Math.max(...curve.map((p) => p.alt));
    polar = maxAlt < SUNRISE_ALT ? "night" : "day";
  }
  return {
    sunrise: sun?.rise ?? null,
    sunset: sun?.set ?? null,
    goldenAmStart: am4?.rise ?? null,
    goldenAmEnd: a6?.rise ?? null,
    goldenPmStart: a6?.set ?? null,
    goldenPmEnd: am4?.set ?? null,
    blueAmStart: am6?.rise ?? null,
    blueAmEnd: am4?.rise ?? null,
    bluePmStart: am4?.set ?? null,
    bluePmEnd: am6?.set ?? null,
    civilDawn: am6?.rise ?? null,
    civilDusk: am6?.set ?? null,
    nauticalDawn: am12?.rise ?? null,
    nauticalDusk: am12?.set ?? null,
    astroDawn: am18?.rise ?? null,
    astroDusk: am18?.set ?? null,
    polar,
  };
}

export function fmtHour(h: number | null): string {
  if (h === null) return "—";
  const hh = ((h % 24) + 24) % 24;
  const H = Math.floor(hh);
  const M = Math.round((hh - H) * 60);
  const H2 = M === 60 ? (H + 1) % 24 : H;
  const M2 = M === 60 ? 0 : M;
  return `${String(H2).padStart(2, "0")}:${String(M2).padStart(2, "0")}`;
}

/** 주요 도시 프리셋 — 위치 API 대신 정적 좌표 (측지 좌표, 소수 4자리) */
export const CITY_PRESETS = [
  { name: "서울", lat: 37.5665, lon: 126.978, tz: 9 },
  { name: "부산", lat: 35.1796, lon: 129.0756, tz: 9 },
  { name: "제주", lat: 33.4996, lon: 126.5312, tz: 9 },
  { name: "강릉", lat: 37.7519, lon: 128.8761, tz: 9 },
  { name: "도쿄", lat: 35.6762, lon: 139.6503, tz: 9 },
  { name: "뉴욕", lat: 40.7128, lon: -74.006, tz: -5 },
  { name: "런던", lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: "시드니", lat: -33.8688, lon: 151.2093, tz: 10 },
  { name: "트롬쇠", lat: 69.6492, lon: 18.9553, tz: 1 },
] as const;
