// 자동차 취득세 데이터 — 근거: 지방세법 제12조(부동산 외 취득의 세율)
const LAW_12 = "https://www.law.go.kr/법령/지방세법/제12조";
const CHECKED = "2026-08-19";

export const ACQ_RATES = {
  passengerNonbusiness: {
    label: "승용차 (비영업용)",
    value: 0.07,
    source: LAW_12,
    checkedAt: CHECKED,
  },
  lightCar: {
    label: "경자동차 (비영업용)",
    value: 0.04,
    source: LAW_12,
    checkedAt: CHECKED,
  },
  nonPassengerNonbusiness: {
    label: "승합·화물 등 그 밖의 자동차 (비영업용)",
    value: 0.05,
    source: LAW_12,
    checkedAt: CHECKED,
  },
  business: {
    label: "영업용 (모든 차종)",
    value: 0.04,
    source: LAW_12,
    checkedAt: CHECKED,
  },
  motorcycle: {
    label: "이륜자동차 (125cc 초과)",
    value: 0.02,
    source: LAW_12,
    checkedAt: CHECKED,
  },
};

// 확인 필요(TODO) — 감면·특례는 일몰 연장 여부가 수시로 바뀌므로 값 확정 전엔 배지 처리
export const TODO_ITEMS = [
  {
    key: "light-car-exemption",
    label: "경차 취득세 감면 한도(75만원)·일몰 기한",
    note: "지방세특례제한법상 경차 감면은 일몰 연장 여부 확인 필요. 계산기에는 미적용 — 관할 지자체·위택스 확인.",
    link: "https://www.law.go.kr/법령/지방세특례제한법",
  },
  {
    key: "ev-exemption",
    label: "전기차·수소차 취득세 감면(한도)",
    note: "친환경차 감면 한도·기한은 연도별로 바뀌어 확인 필요. 계산기에는 미적용.",
    link: "https://www.law.go.kr/법령/지방세특례제한법",
  },
  {
    key: "bond",
    label: "공채(도시철도채권 등) 매입·할인 비용",
    note: "지역·배기량별 매입률이 달라 본 계산기에서 제외. 등록 대행 견적에서 확인.",
    link: "https://www.wetax.go.kr",
  },
];

// 과세표준 참고
export const TAX_BASE_NOTE = {
  value: "신차: 실제 취득가격(부가세 제외 공급가액 기준). 중고차: 신고가액과 시가표준액 중 높은 금액.",
  source: "https://www.law.go.kr/법령/지방세법/제10조의2",
  checkedAt: CHECKED,
};
