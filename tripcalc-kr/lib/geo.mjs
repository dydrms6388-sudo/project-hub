// tripcalc-kr 지리·비행 계산 (순수 함수, 브라우저/Node 공용)
// 대권거리(great-circle)는 지구를 완전한 구로 가정한 "추정치"다.
// 실제 항로는 항공로·관제·바람 때문에 더 길며, 비행시간도 편차가 있다.

export const EARTH_R = 6371.0088; // km (IUGG 평균 반지름)

const rad = (d) => (d * Math.PI) / 180;

/** 두 좌표 사이 대권거리(km, 추정치) */
export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 공항 객체 두 개의 대권거리 */
export function distanceBetween(a, b) {
  return haversine(a.lat, a.lon, b.lat, b.lon);
}

/**
 * 대권거리 → 블록타임(게이트-투-게이트) 추정 시간(시간 단위).
 * 순항속도는 거리대별 평균 대지속도 가정 + 지상활주·이착륙 고정 시간.
 * 실제 스케줄과 ±10% 내외 차이가 날 수 있다(추정치).
 */
export function cruiseSpeed(km) {
  if (km < 800) return 620;
  if (km < 2000) return 740;
  if (km < 5000) return 810;
  return 860;
}

export function flightHours(km) {
  const ground = km < 800 ? 0.45 : 0.6; // 활주·이륙상승·강하 보정
  return km / cruiseSpeed(km) + ground;
}

/** 시간(소수) → "13시간 40분" */
export function hoursToKo(h) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return (hh ? hh + "시간 " : "") + mm + "분";
}

/** 시간(소수) → "13h 40m" 형태 짧은 표기 */
export function hoursToHm(h) {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
