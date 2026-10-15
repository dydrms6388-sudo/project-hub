// 러닝 페이스·시간·거리 계산 유틸 — 브라우저와 Node 테스트 공유 단일 소스.
export const CHECKED_AT = "2026-08-19";

// 공인 대회 거리 (출처: 세계육상연맹이 정한 표준 거리를 정리한 위키백과 문서)
export const RACE_DISTANCES = [
  { id: "5k", name: "5K", km: { value: 5, source: "https://en.wikipedia.org/wiki/5K_run", checkedAt: CHECKED_AT } },
  { id: "10k", name: "10K", km: { value: 10, source: "https://en.wikipedia.org/wiki/10K_run", checkedAt: CHECKED_AT } },
  { id: "half", name: "하프 마라톤", km: { value: 21.0975, source: "https://en.wikipedia.org/wiki/Half_marathon", checkedAt: CHECKED_AT } },
  { id: "full", name: "풀 마라톤", km: { value: 42.195, source: "https://en.wikipedia.org/wiki/Marathon", checkedAt: CHECKED_AT } },
];

export const MILE_KM = { value: 1.609344, source: "https://en.wikipedia.org/wiki/Mile", checkedAt: CHECKED_AT };

/* ---- 3변수 상호 계산 (거리 km, 시간 sec, 페이스 sec/km) ---- */
export function paceFrom(distKm, timeSec) { return timeSec / distKm; }
export function timeFrom(distKm, paceSecPerKm) { return distKm * paceSecPerKm; }
export function distFrom(timeSec, paceSecPerKm) { return timeSec / paceSecPerKm; }
export function speedKmh(paceSecPerKm) { return 3600 / paceSecPerKm; }

/* ---- 시간 문자열 파싱/포맷 ---- */
/** "h:mm:ss" | "mm:ss" | "mm" → 초. 실패 시 null */
export function parseHMS(str) {
  if (str == null) return null;
  const s = String(str).trim().replace(/\s/g, "");
  if (!s) return null;
  const parts = s.split(":").map((p) => p.replace(",", "."));
  if (parts.length > 3 || parts.some((p) => p === "" || isNaN(Number(p)) || Number(p) < 0)) return null;
  const nums = parts.map(Number);
  let sec = 0;
  if (nums.length === 1) sec = nums[0] * 60; // 단독 숫자는 '분'으로 해석
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1];
  else sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  return sec > 0 ? sec : null;
}

/** 초 → "h:mm:ss" 또는 "mm:ss" */
export function fmtHMS(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** 초/km → "m'ss\"" 표기 */
export function fmtPace(secPerKm) {
  const sec = Math.round(secPerKm);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}'${String(s).padStart(2, "0")}"`;
}
