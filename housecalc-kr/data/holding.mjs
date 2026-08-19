// 보유세(재산세·종합부동산세) 간이 데이터 — 지방세법·종합부동산세법 출처.
const CHECKED = "2026-08-19";

export const holding = {
  // 재산세(주택) 표준세율 — 지방세법 제111조. [과표 하한(초과), 상한(이하), 누진공제 전 산식용: 기본세액, 초과분 세율%]
  propertyTaxStandard: {
    value: [
      [0,             60_000_000,   0,        0.10],
      [60_000_000,    150_000_000,  60_000,   0.15],
      [150_000_000,   300_000_000,  195_000,  0.25],
      [300_000_000,   Infinity,     570_000,  0.40],
    ],
    source: "https://www.law.go.kr/법령/지방세법/제111조",
    checkedAt: CHECKED,
  },
  // 1세대 1주택 특례세율(공시가격 9억 이하) — 지방세법 제111조의2
  propertyTaxOneHome: {
    value: {
      maxOfficialPrice: 900_000_000,
      brackets: [
        [0,             60_000_000,   0,        0.05],
        [60_000_000,    150_000_000,  30_000,   0.10],
        [150_000_000,   300_000_000,  120_000,  0.20],
        [300_000_000,   Infinity,     420_000,  0.35],
      ],
    },
    source: "https://www.law.go.kr/법령/지방세법/제111조의2",
    checkedAt: CHECKED,
  },
  // 재산세 과세표준 = 공시가격 × 공정시장가액비율(주택 60%). 1주택 한시 인하 특례는 연도별 변동 → todo
  fairMarketRatio: {
    value: { housePct: 60, oneHomeReliefNote: "1주택자 43~45% 한시 특례가 연도별로 적용된 바 있음" },
    source: "https://www.law.go.kr/법령/지방세법시행령/제109조",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "1주택자 공정시장가액비율 특례(43~45%)는 연도별로 바뀜 — 당해연도 시행령 확인 후 직접 조정.",
  },
  // 도시지역분(재산세 과세특례): 과세표준의 0.14% — 지방세법 제112조
  urbanAreaTax: {
    value: { ratePct: 0.14 },
    source: "https://www.law.go.kr/법령/지방세법/제112조",
    checkedAt: CHECKED,
  },
  // 지방교육세: 재산세액(도시지역분 제외)의 20% — 지방세법 제151조
  localEduTax: {
    value: { ratePct: 20 },
    source: "https://www.law.go.kr/법령/지방세법/제151조",
    checkedAt: CHECKED,
  },
  // 종부세 기본공제 — 종합부동산세법 제8조: 9억(1세대 1주택 12억)
  jongbuDeduction: {
    value: { basicWon: 900_000_000, oneHomeWon: 1_200_000_000 },
    source: "https://www.law.go.kr/법령/종합부동산세법/제8조",
    checkedAt: CHECKED,
  },
  // 종부세 공정시장가액비율 — 시행령, 60% 적용 이력. 연도별 변동 가능 → todo
  jongbuFairRatio: {
    value: { pct: 60 },
    source: "https://www.law.go.kr/법령/종합부동산세법시행령/제2조의4",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "종부세 공정시장가액비율은 시행령으로 조정될 수 있음 — 당해연도 값 확인 후 직접 조정.",
  },
  // 종부세 세율 — 종합부동산세법 제9조 (2주택 이하 / 3주택 이상). [과표 하한(초과), 상한(이하), 세율%]
  jongbuRates: {
    value: {
      general: [
        [0,               300_000_000,    0.5],
        [300_000_000,     600_000_000,    0.7],
        [600_000_000,     1_200_000_000,  1.0],
        [1_200_000_000,   2_500_000_000,  1.3],
        [2_500_000_000,   5_000_000_000,  1.5],
        [5_000_000_000,   9_400_000_000,  2.0],
        [9_400_000_000,   Infinity,       2.7],
      ],
      multi3: [
        [0,               300_000_000,    0.5],
        [300_000_000,     600_000_000,    0.7],
        [600_000_000,     1_200_000_000,  1.0],
        [1_200_000_000,   2_500_000_000,  2.0],
        [2_500_000_000,   5_000_000_000,  3.0],
        [5_000_000_000,   9_400_000_000,  4.0],
        [9_400_000_000,   Infinity,       5.0],
      ],
    },
    source: "https://www.law.go.kr/법령/종합부동산세법/제9조",
    checkedAt: CHECKED,
  },
  // 세부담 상한·재산세 공제·세액공제(고령·장기보유) 등은 간이 계산에서 제외 — 안내만
  simplifiedNote: {
    value: "종부세는 재산세 공제, 세부담 상한, 1주택 고령·장기보유 세액공제 등으로 실제 세액이 크게 달라짐 — 국세청 홈택스 모의계산 확인",
    source: "https://www.hometax.go.kr",
    checkedAt: CHECKED,
  },
};
