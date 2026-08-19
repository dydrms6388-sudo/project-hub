// 주택용 전기요금 데이터 (billcalc-kr 단일 소스)
// 규칙: 모든 항목은 {value, source, checkedAt}. 출처 불확실 값은 넣지 않고 TODO.
// ⚠ 요금표는 "2023년 5월 16일 개정 기준"(이후 주택용 추가 개정 시 갱신 필요).
//   최신 단가는 한전 사이버지점 요금표에서 확인: https://cyber.kepco.co.kr

export const CHECKED_AT = "2026-08-19";

const KEPCO_TABLE = "https://cyber.kepco.co.kr/ckepco/front/jsp/CY/E/E/CYEEHP00101.jsp"; // 한전 사이버지점 > 주택용 전기요금표
const KEPCO_HOME = "https://cyber.kepco.co.kr";
const LAW_ENFORCE = "https://www.law.go.kr/lsSc.do?menuId=1&query=%EC%A0%84%EA%B8%B0%EC%82%AC%EC%97%85%EB%B2%95%20%EC%8B%9C%ED%96%89%EB%A0%B9"; // 전기사업법 시행령(전력산업기반기금 부담금 요율)

export const TARIFF = {
  meta: {
    label: "주택용 전력",
    revision: "2023년 5월 16일 개정 기준",
    effectiveFrom: "2023-05-16",
    source: KEPCO_TABLE,
    sourceName: "한국전력 사이버지점 요금표",
    checkedAt: CHECKED_AT,
    note: "작성 시점(2026-08-19)까지 주택용 요금표 기준. 이후 개정 여부는 한전 사이버지점에서 최신 확인 필요.",
  },

  // 하계(7~8월) 누진 구간 완화
  summerMonths: { value: [7, 8], source: KEPCO_TABLE, checkedAt: CHECKED_AT },
  brackets: {
    other: { value: [200, 400], source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "기타계절(1~6월, 9~12월) 누진 구간" },
    summer: { value: [300, 450], source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "하계(7~8월) 누진 구간" },
  },

  // 저압 (대부분의 아파트 개별 계약·단독주택)
  low: {
    label: "저압",
    base: { value: [910, 1600, 7300], unit: "원/호", source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "구간별 기본요금" },
    energy: { value: [120.0, 214.6, 307.3], unit: "원/kWh", source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "구간별 전력량요금" },
    superUser: { value: 736.2, unit: "원/kWh", source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "슈퍼유저요금: 하계·동계 1,000kWh 초과분" },
  },

  // 고압 (아파트 단지 고압 일괄 계약)
  high: {
    label: "고압",
    base: { value: [730, 1260, 6060], unit: "원/호", source: KEPCO_TABLE, checkedAt: CHECKED_AT },
    energy: { value: [105.0, 174.0, 242.3], unit: "원/kWh", source: KEPCO_TABLE, checkedAt: CHECKED_AT },
    superUser: { value: 601.3, unit: "원/kWh", source: KEPCO_TABLE, checkedAt: CHECKED_AT },
  },

  superUser: {
    months: { value: [1, 2, 7, 8, 12], source: KEPCO_TABLE, checkedAt: CHECKED_AT, note: "슈퍼유저요금 적용월(하계 7~8월, 동계 12~2월)" },
    threshold: { value: 1000, unit: "kWh", source: KEPCO_TABLE, checkedAt: CHECKED_AT },
  },

  climate: {
    value: 9, unit: "원/kWh",
    source: KEPCO_HOME, checkedAt: CHECKED_AT,
    note: "기후환경요금 9원/kWh (2023.1.1 인상분 기준). 사용량 × 단가.",
  },

  fuelAdj: {
    value: 5, unit: "원/kWh",
    source: KEPCO_HOME, checkedAt: CHECKED_AT,
    note: "연료비조정요금(분기별 조정, 한도 ±5원/kWh). 최근 수년간 +5원 유지 — 변동 가능하므로 고지서·한전에서 확인. 계산기에서 직접 수정 가능.",
    editable: true,
  },

  vat: {
    value: 0.10,
    source: KEPCO_HOME, checkedAt: CHECKED_AT,
    note: "부가가치세 10% (전기요금계 × 10%, 원 미만 반올림)",
  },

  fund: {
    value: 0.027,
    source: LAW_ENFORCE, checkedAt: CHECKED_AT,
    note: "전력산업기반기금 부담금: 3.7% → 3.2%(2024.7.1) → 2.7%(2025.7.1), 전기요금계 × 요율, 10원 미만 절사. 요율 변동 시 계산기에서 수정 가능.",
    history: [
      { rate: 0.037, until: "2024-06-30" },
      { rate: 0.032, from: "2024-07-01" },
      { rate: 0.027, from: "2025-07-01" },
    ],
    editable: true,
  },

  rounding: {
    note: "요금 항목은 원 미만 절사, 부가세는 원 미만 반올림, 기반기금·최종 청구금액은 10원 미만 절사(국고금 단수 처리 관행).",
    source: KEPCO_HOME,
    checkedAt: CHECKED_AT,
  },
};

// TODO(확인 필요): 복지할인(장애인·다자녀·대가족 등) 할인액, 필수사용량 보장공제 폐지 경과 —
// 본 계산기는 할인 미적용 일반 가구 기준. 할인 대상은 한전 사이버지점에서 확인.
export const TODO_ITEMS = [
  { key: "welfare-discount", label: "복지할인(다자녀·장애인 등) 금액", link: KEPCO_HOME },
];
