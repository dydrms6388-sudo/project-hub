// 단백질 섭취·분배 권장치 — {value, source, checkedAt} 규율. 참고용(개인차·질환 시 전문가 상담).
export const CHECKED_AT = "2026-08-19";

// 근력 트레이닝 시 하루 단백질: 근비대 이득은 약 1.6 g/kg/일에서 정체(상한 신뢰구간 ~2.2)
// 출처: Morton et al. 2018, Br J Sports Med 메타분석
export const DAILY_TARGETS = [
  { id: "base", name: "일반 활동 유지", gPerKg: { value: 1.2, source: "https://pubmed.ncbi.nlm.nih.gov/28698222/", checkedAt: CHECKED_AT }, note: "규칙적 운동을 하는 일반 성인 하한선 참고치" },
  { id: "muscle", name: "근성장(웨이트)", gPerKg: { value: 1.6, source: "https://pubmed.ncbi.nlm.nih.gov/28698222/", checkedAt: CHECKED_AT }, note: "메타분석에서 추가 이득이 정체되기 시작하는 지점" },
  { id: "cut", name: "체중 감량 중 고단백", gPerKg: { value: 2.0, source: "https://pubmed.ncbi.nlm.nih.gov/28698222/", checkedAt: CHECKED_AT }, note: "감량기 근손실 최소화 목적의 상단 참고치(상한 CI 2.2)" },
];

// 한 끼 분배 기준: 끼니당 약 0.4 g/kg × 하루 4끼 분배 권고
// 출처: Schoenfeld & Aragon 2018, JISSN
export const PER_MEAL = {
  value: 0.4,
  unit: "g/kg/끼",
  source: "https://jissn.biomedcentral.com/articles/10.1186/s12970-018-0215-1",
  checkedAt: CHECKED_AT,
};

// 식품별 단백질 함량 예시(100g당, 조리 기준 일반값) — 출처: USDA FoodData Central
const USDA = "https://fdc.nal.usda.gov/";
export const FOOD_EXAMPLES = [
  { name: "닭가슴살(익힌 것) 100g", protein: { value: 31, source: USDA, checkedAt: CHECKED_AT } },
  { name: "달걀 1개(대란)", protein: { value: 6, source: USDA, checkedAt: CHECKED_AT } },
  { name: "우유 200ml", protein: { value: 7, source: USDA, checkedAt: CHECKED_AT } },
  { name: "두부 100g", protein: { value: 8, source: USDA, checkedAt: CHECKED_AT } },
  { name: "그릭요거트 100g", protein: { value: 10, source: USDA, checkedAt: CHECKED_AT } },
  { name: "유청 단백질 1스쿱(30g)", protein: { value: 24, source: USDA, checkedAt: CHECKED_AT } },
];
