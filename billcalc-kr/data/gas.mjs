// 도시가스 데이터 (billcalc-kr)
// 규칙: {value, source, checkedAt}. 지역 소매단가는 지역·용도·시기마다 달라 값 미기재(TODO).

export const CHECKED_AT = "2026-08-19";

export const GAS = {
  // 부피(㎥) → 열량(MJ) 환산계수. 도시가스는 "사용량(㎥) × 평균열량(MJ/㎥) × 단가(원/MJ)"로 청구.
  // 평균열량은 지역 도시가스사가 월별로 고시(대략 42.5~43.5 MJ/㎥ 수준). 기본값은 참고용.
  heatFactor: {
    value: 42.7, unit: "MJ/㎥",
    source: "https://www.citygas.or.kr", sourceName: "한국도시가스협회(지역사별 월별 평균열량 고시)",
    checkedAt: CHECKED_AT,
    note: "참고 기본값. 실제 계수는 고지서의 '평균열량'을 입력하세요.",
    editable: true,
  },

  // 에너지 단위 정의(고정 상수)
  mjPerKwh: {
    value: 3.6, unit: "MJ/kWh",
    source: "https://www.kats.go.kr", sourceName: "국가표준(SI 단위 정의: 1 kWh = 3.6 MJ)",
    checkedAt: CHECKED_AT,
  },

  vat: { value: 0.10, note: "부가가치세 10%", source: "https://www.citygas.or.kr", checkedAt: CHECKED_AT },

  // TODO(확인 필요): 지역별 주택난방용 소매단가(원/MJ)·월 기본요금 — 지역 도시가스사 고시 확인 후 직접 입력.
  retailPrice: {
    value: null, unit: "원/MJ", todo: true,
    note: "지역·용도별 상이. 고지서 또는 지역 도시가스사 요금표에서 확인해 직접 입력하세요.",
    links: [
      { name: "한국도시가스협회 (지역사 찾기)", url: "https://www.citygas.or.kr" },
      { name: "서울도시가스", url: "https://www.seoulgas.co.kr" },
      { name: "삼천리 (경기·인천)", url: "https://www.samchully.co.kr" },
      { name: "경동도시가스 (울산)", url: "https://www.kdgas.co.kr" },
      { name: "부산도시가스", url: "https://www.busangas.co.kr" },
    ],
    checkedAt: CHECKED_AT,
  },

  baseCharge: {
    value: null, unit: "원/월", todo: true,
    note: "월 기본요금도 지역사별 상이(대략 800~1,100원 수준이나 확인 필요). 고지서 확인 후 직접 입력.",
    checkedAt: CHECKED_AT,
  },

  // 절약 참고: 난방 설정온도 1℃ 낮추면 난방에너지 약 7% 절감(캠페인 안내치, 참고용)
  savePerDegree: {
    value: 0.07,
    source: "https://www.energy.or.kr", sourceName: "한국에너지공단 에너지절약 캠페인 안내치",
    checkedAt: CHECKED_AT,
    note: "주택 단열·외기온에 따라 달라지는 참고값(재미·참고용, 보장 아님).",
  },
};

// 수도요금: 지자체(광역·기초)별 요금 구조가 달라 계산기 미제공 — 링크 안내만.
export const WATER_LINKS = [
  { name: "서울 아리수 사이버고객센터", url: "https://i121.seoul.go.kr" },
  { name: "내 지역 상수도 요금(지자체 상수도사업본부 검색)", url: "https://www.gov.kr" },
];
