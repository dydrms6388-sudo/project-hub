// 자동차세 데이터 — 근거: 지방세법 제127조(과세표준과 세율), 제128조(납기와 징수방법),
// 지방세법 시행령 제125조(연세액 일시납부 시 공제).
// 모든 항목 {value, source, checkedAt} 규율. 값이 불확실하면 넣지 않고 todo 로 남긴다.
const LAW_127 = "https://www.law.go.kr/법령/지방세법/제127조";
const LAW_128 = "https://www.law.go.kr/법령/지방세법/제128조";
const DECREE_125 = "https://www.law.go.kr/법령/지방세법시행령/제125조";
const CHECKED = "2026-08-19";

// 승용자동차 cc당 세율 (원/cc)
export const PASSENGER_RATES = {
  nonbusiness: {
    // 비영업용 승용
    value: [
      { maxCc: 1000, perCc: 80 },
      { maxCc: 1600, perCc: 140 },
      { maxCc: Infinity, perCc: 200 },
    ],
    source: LAW_127,
    checkedAt: CHECKED,
  },
  business: {
    // 영업용 승용
    value: [
      { maxCc: 1000, perCc: 18 },
      { maxCc: 1600, perCc: 18 },
      { maxCc: 2000, perCc: 19 },
      { maxCc: 2500, perCc: 19 },
      { maxCc: Infinity, perCc: 24 },
    ],
    source: LAW_127,
    checkedAt: CHECKED,
  },
};

// "그 밖의 승용자동차" — 전기차·수소차 등 배기량 없는 승용
export const OTHER_PASSENGER_FLAT = {
  nonbusiness: { value: 100000, source: LAW_127, checkedAt: CHECKED },
  business: { value: 20000, source: LAW_127, checkedAt: CHECKED },
};

// 지방교육세: 자동차세(비영업용 승용 등 지방세법상 과세 대상)의 30%
export const EDUCATION_TAX_RATE = {
  value: 0.3,
  source: "https://www.law.go.kr/법령/지방세법/제151조",
  checkedAt: CHECKED,
  note: "영업용 승용자동차분 자동차세에는 지방교육세가 부과되지 않는다.",
};

// 차령 경감(승용): 차령 3년차부터 매년 5%p 씩 경감, 최대 50%
// 산식: 경감률 = 5% × (차령 - 2), 차령 12년 이상은 50% 고정
export const AGE_REDUCTION = {
  value: { startYear: 3, stepRate: 0.05, maxRate: 0.5 },
  source: LAW_127,
  checkedAt: CHECKED,
};

// 연납(연세액 일시납부) 공제 — 2025년 이후 공제율 5%,
// 공제액 = 연세액 × 5% × (신청 납기 다음 달 1일부터 12월 31일까지 일수 / 365)
export const PREPAY_DISCOUNT = {
  rate: { value: 0.05, source: DECREE_125, checkedAt: CHECKED },
  law: LAW_128,
  // 평년 기준 공제 대상 일수 (신청월 → 공제기간)
  periods: {
    value: {
      1: { label: "1월 연납 (2~12월분)", days: 334 },
      3: { label: "3월 연납 (4~12월분)", days: 275 },
      6: { label: "6월 연납 (7~12월분)", days: 184 },
      9: { label: "9월 연납 (10~12월분)", days: 92 },
    },
    source: DECREE_125,
    checkedAt: CHECKED,
  },
  note: "공제율·기간 산정 방식은 시행령 개정으로 바뀔 수 있다. 실제 고지액은 위택스 확인.",
};

// 납부액 절사: 지방세 고지 세액은 10원 미만 절사(국고금 단수 계산 관행)
export const ROUNDING = {
  value: 10,
  source: "https://www.law.go.kr/법령/지방세징수법",
  checkedAt: CHECKED,
  note: "10원 미만 절사. 지자체 고지서와 1원 단위 차이가 날 수 있음(참고용).",
};

// 확인이 덜 된 항목 — UI에 '확인 필요' 배지로 노출
export const TODO_ITEMS = [
  {
    key: "van-truck-rates",
    label: "승합·화물·특수차 세율표",
    note: "승용 외 차종 세율은 아직 출처 대조 전이라 계산기에서 제외. 위택스 모의계산 이용 권장.",
    link: "https://www.wetax.go.kr",
  },
];
