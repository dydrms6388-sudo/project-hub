// 소유권이전등기(매매) 비용 항목 데이터 — 법령·대법원 인터넷등기소 출처.
const CHECKED = "2026-08-19";

export const registration = {
  // 등기신청수수료(등기수입증지) — 등기사항증명서 등 수수료규칙
  filingFee: {
    value: { paperWon: 15_000, eFormWon: 13_000, fullEWon: 10_000, unit: "부동산 1개당" },
    source: "https://www.law.go.kr/대법원규칙/등기사항증명서등수수료규칙",
    checkedAt: CHECKED,
  },
  // 인지세(부동산 소유권 이전 증서) — 인지세법 제3조, 기재금액 기준
  stampDuty: {
    value: [
      [0,             10_000_000,     0],
      [10_000_000,    30_000_000,     20_000],
      [30_000_000,    50_000_000,     40_000],
      [50_000_000,    100_000_000,    70_000],
      [100_000_000,   1_000_000_000,  150_000],
      [1_000_000_000, Infinity,       350_000],
    ],
    source: "https://www.law.go.kr/법령/인지세법/제3조",
    checkedAt: CHECKED,
  },
  // 주택 1억원 이하 인지세 비과세 특례
  stampDutyHouseExempt: {
    value: { maxPriceWon: 100_000_000 },
    source: "https://www.law.go.kr/법령/인지세법/제6조",
    checkedAt: CHECKED,
  },
  // 제1종 국민주택채권 매입률(주택, 시가표준액 기준) — 주택도시기금법 시행령 [별표]
  // ⚠ 고시 개정 가능 → todo. [하한(이상), 상한(미만), 특별시·광역시 %, 그 밖 지역 %]
  bondBrackets: {
    value: [
      [20_000_000,    50_000_000,   1.3, 1.3],
      [50_000_000,    100_000_000,  1.9, 1.4],
      [100_000_000,   160_000_000,  2.1, 1.6],
      [160_000_000,   260_000_000,  2.3, 1.8],
      [260_000_000,   600_000_000,  2.6, 2.1],
      [600_000_000,   Infinity,     3.1, 2.6],
    ],
    source: "https://www.law.go.kr/법령/주택도시기금법시행령",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "국민주택채권 매입률 별표는 개정될 수 있음 — 인터넷등기소 계산기로 최종 확인 필요.",
  },
  // 채권 즉시매도 할인율 — 매일 변동값이라 데이터로 고정 불가 → 직접 입력(todo)
  bondDiscount: {
    value: { exampleDiscountPct: 10, note: "즉시매도 시 본인부담 = 매입금액 × 할인율. 할인율은 매일 고시" },
    source: "https://www.iros.go.kr",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "채권 할인율은 매일 변동 — 인터넷등기소 '채권 고객부담률'에서 당일 값 확인 후 입력.",
  },
  // 법무사 보수 — 자율화(참고 범위만). 대한법무사협회 보수기준 참고
  legalFee: {
    value: { note: "법무사 보수는 자율 — 통상 수십만원대, 견적 비교 권장" },
    source: "https://www.kjaa.or.kr",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "법무사 보수는 정해진 요율표가 없어 직접 견적 입력.",
  },
  // 매매 소유권이전등기의 등록면허세는 2011년부터 취득세로 통합 —
  // 별도 등록면허세는 근저당 설정 등 '취득 외 등기'에만 부과 (지방세법 제28조: 설정금액의 0.2% + 지방교육세 20%)
  mortgageRegTax: {
    value: { ratePct: 0.2, eduSurchargePct: 20 },
    source: "https://www.law.go.kr/법령/지방세법/제28조",
    checkedAt: CHECKED,
  },
};
