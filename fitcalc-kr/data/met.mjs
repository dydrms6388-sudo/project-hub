// 운동별 MET 값 — 출처: 2011 Compendium of Physical Activities (Ainsworth BE et al.,
// Med Sci Sports Exerc 2011;43(8):1575-81). 각 항목 {value, source, checkedAt}.
export const CHECKED_AT = "2026-08-19";
const SRC = "https://pubmed.ncbi.nlm.nih.gov/21681120/"; // 2011 Compendium 원 논문
const SRC_SITE = "https://pacompendium.com/"; // Compendium 공식 사이트

export const MET_SOURCES = [
  { label: "2011 Compendium of Physical Activities (Ainsworth et al.)", url: SRC },
  { label: "Compendium of Physical Activities 공식 사이트", url: SRC_SITE },
];

const m = (id, group, name, value) => ({ id, group, name, met: { value, source: SRC, checkedAt: CHECKED_AT } });

export const MET_TABLE = [
  m("walk32", "걷기", "걷기 · 천천히 3.2 km/h", 2.8),
  m("walk48", "걷기", "걷기 · 보통 4.8 km/h", 3.5),
  m("walk56", "걷기", "걷기 · 빠르게 5.6 km/h", 4.3),
  m("walk64", "걷기", "걷기 · 매우 빠르게 6.4 km/h", 5.0),
  m("run80", "러닝", "러닝 8.0 km/h (7'30\"/km)", 8.3),
  m("run97", "러닝", "러닝 9.7 km/h (6'11\"/km)", 9.8),
  m("run113", "러닝", "러닝 11.3 km/h (5'19\"/km)", 11.0),
  m("run129", "러닝", "러닝 12.9 km/h (4'39\"/km)", 11.8),
  m("run145", "러닝", "러닝 14.5 km/h (4'08\"/km)", 12.8),
  m("cycleL", "자전거", "자전거 · 여가 (16 km/h 미만)", 4.0),
  m("cycleM", "자전거", "자전거 · 16~19 km/h", 6.8),
  m("cycleF", "자전거", "자전거 · 19~22 km/h", 8.0),
  m("swimM", "수영", "수영 · 자유형 보통", 5.8),
  m("swimF", "수영", "수영 · 자유형 빠르게", 9.8),
  m("weightG", "근력", "웨이트 트레이닝 · 일반 (8~15회 다종목)", 3.5),
  m("weightV", "근력", "웨이트 트레이닝 · 고강도", 6.0),
  m("yoga", "실내", "요가 · 하타", 2.5),
  m("pilates", "실내", "필라테스 · 일반", 3.0),
  m("aerobics", "실내", "에어로빅 · 일반", 7.3),
  m("elliptical", "실내", "일립티컬 · 보통 강도", 5.0),
  m("jumprope", "실내", "줄넘기 · 보통 속도", 11.8),
  m("stairS", "실내", "계단 오르기 · 천천히", 4.0),
  m("hiking", "야외", "등산 · 크로스컨트리", 6.0),
  m("soccer", "구기", "축구 · 캐주얼", 7.0),
  m("basketball", "구기", "농구 · 일반", 6.5),
  m("tennis", "구기", "테니스 · 일반", 7.3),
  m("badminton", "구기", "배드민턴 · 사교 경기", 5.5),
  m("tabletennis", "구기", "탁구", 4.0),
  m("golf", "구기", "골프 · 일반(걷기)", 4.8),
];

// 소모 칼로리 공식: kcal/min = MET × 3.5 × 체중(kg) / 200
// (1 MET = 3.5 mL O2/kg/min, 산소 1L ≈ 5 kcal 환산 관행 — ACSM 대사 공식)
export const KCAL_FORMULA = {
  value: "kcal/분 = MET × 3.5 × 체중(kg) ÷ 200",
  fn: (met, weightKg, minutes) => (met * 3.5 * weightKg / 200) * minutes,
  source: "https://en.wikipedia.org/wiki/Metabolic_equivalent_of_task",
  checkedAt: CHECKED_AT,
};
