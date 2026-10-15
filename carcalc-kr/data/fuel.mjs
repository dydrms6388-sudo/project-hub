// 유류세 구조 참고 데이터 — 법정 기본세율 기준.
// ⚠ 유류세는 탄력세율·한시 인하 조치로 실제 부과액이 수시로 달라진다.
//   실시간 유가·세금 반영액은 오피넷 확인. 계산기에서 유가는 사용자 입력값을 쓴다.
const SRC_TRAFFIC_TAX = "https://www.law.go.kr/법령/교통·에너지·환경세법";
const SRC_OPINET = "https://www.opinet.co.kr";
const CHECKED = "2026-08-19";

export const FUEL_TAX_STRUCTURE = {
  gasoline: {
    label: "휘발유",
    base: { value: 475, unit: "원/L", desc: "교통·에너지·환경세 법정 기본세율", source: SRC_TRAFFIC_TAX, checkedAt: CHECKED },
    surcharges: [
      { name: "교육세", value: "교통세의 15%", source: "https://www.law.go.kr/법령/교육세법", checkedAt: CHECKED },
      { name: "주행세(자동차세 주행분)", value: "교통세의 26%", source: "https://www.law.go.kr/법령/지방세법/제136조", checkedAt: CHECKED },
      { name: "부가가치세", value: "공급가액의 10%", source: "https://www.law.go.kr/법령/부가가치세법", checkedAt: CHECKED },
    ],
  },
  diesel: {
    label: "경유",
    base: { value: 340, unit: "원/L", desc: "교통·에너지·환경세 법정 기본세율", source: SRC_TRAFFIC_TAX, checkedAt: CHECKED },
    surcharges: [
      { name: "교육세", value: "교통세의 15%", source: "https://www.law.go.kr/법령/교육세법", checkedAt: CHECKED },
      { name: "주행세(자동차세 주행분)", value: "교통세의 26%", source: "https://www.law.go.kr/법령/지방세법/제136조", checkedAt: CHECKED },
      { name: "부가가치세", value: "공급가액의 10%", source: "https://www.law.go.kr/법령/부가가치세법", checkedAt: CHECKED },
    ],
  },
};

// 확인 필요 — 탄력세율(한시 인하) 적용 현황은 시행령 개정으로 수시 변동
export const TODO_ITEMS = [
  {
    key: "flexible-rate",
    label: "현재 적용 중인 탄력세율(유류세 한시 인하율)",
    note: "인하율·적용 기한이 자주 바뀌어 값을 고정 기재하지 않는다. 기획재정부 보도자료·오피넷 참조.",
    link: SRC_OPINET,
  },
];

// 전국 평균 유가는 API·서버 없이 제공 불가 — 사용자 입력 + 오피넷 링크로 대체
export const PRICE_LOOKUP = { label: "오피넷 — 실시간 전국 유가 조회", url: SRC_OPINET, checkedAt: CHECKED };
