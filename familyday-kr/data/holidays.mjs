/**
 * data/holidays.mjs — 설날·추석 양력 날짜 (2025~2030)
 * 음력 대응 양력 날짜는 한국천문연구원(KASI) 음양력 변환 기준으로 확인해야 한다.
 *   변환기: https://astro.kasi.re.kr/life/pageView/8
 * 연휴 규정(전날·당일·다음 날 공휴일): 「관공서의 공휴일에 관한 규정」 제2조
 *   https://www.law.go.kr (법령명 검색: 관공서의 공휴일에 관한 규정)
 *
 * needsCheck=true 인 항목은 작성 시점에 KASI 변환으로 재확인하지 못한 값이다.
 * UI에서 반드시 "확인 필요" 배지를 붙여 노출한다. — TODO: 2027 설날 이후 값 KASI 재확인.
 * checkedAt: 2026-08-19
 */

export const HOLIDAY_META = {
  source: "한국천문연구원 음양력 변환, 관공서의 공휴일에 관한 규정 제2조",
  urls: ["https://astro.kasi.re.kr/life/pageView/8", "https://www.law.go.kr"],
  checkedAt: "2026-08-19",
};

// 설날 = 음력 1월 1일, 추석 = 음력 8월 15일. date는 당일(양력).
export const SEOLLAL = [
  { year: 2025, date: "2025-01-29", needsCheck: false },
  { year: 2026, date: "2026-02-17", needsCheck: false },
  { year: 2027, date: "2027-02-07", needsCheck: true },
  { year: 2028, date: "2028-01-26", needsCheck: true },
  { year: 2029, date: "2029-02-13", needsCheck: true },
  { year: 2030, date: "2030-02-03", needsCheck: true },
];

export const CHUSEOK = [
  { year: 2025, date: "2025-10-06", needsCheck: false },
  { year: 2026, date: "2026-09-25", needsCheck: false },
  { year: 2027, date: "2027-09-15", needsCheck: false },
  { year: 2028, date: "2028-10-03", needsCheck: true },
  { year: 2029, date: "2029-09-22", needsCheck: true },
  { year: 2030, date: "2030-09-12", needsCheck: true },
];

export function holidayRange(dateStr) {
  // 전날~다음 날 3일 연휴 (대체공휴일은 그해 달력에 따라 달라지므로 계산하지 않음)
  const [y, m, dd] = dateStr.split("-").map(Number);
  const base = Date.UTC(y, m - 1, dd);
  const fmt = (t) => new Date(t).toISOString().slice(0, 10);
  return { prev: fmt(base - 86400000), day: dateStr, next: fmt(base + 86400000) };
}
