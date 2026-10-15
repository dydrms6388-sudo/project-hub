// 부동산 중개보수 상한 요율 — 공인중개사법 시행규칙 [별표 1] (2021-10-19 개정 요율 체계)
// 상한 요율이며 실제 보수는 한도 내에서 협의. 지자체 조례로 달리 정할 수 있음.
const CHECKED = "2026-08-19";
const SRC = "https://www.law.go.kr/법령/공인중개사법시행규칙";

export const brokerFee = {
  // 주택 매매·교환 — [거래금액 하한(이상), 상한(미만), 상한요율%, 한도액(없으면 null)]
  saleBrackets: {
    value: [
      [0,               50_000_000,      0.6, 250_000],
      [50_000_000,      200_000_000,     0.5, 800_000],
      [200_000_000,     900_000_000,     0.4, null],
      [900_000_000,     1_200_000_000,   0.5, null],
      [1_200_000_000,   1_500_000_000,   0.6, null],
      [1_500_000_000,   Infinity,        0.7, null],
    ],
    source: SRC,
    checkedAt: CHECKED,
  },
  // 주택 임대차 등
  leaseBrackets: {
    value: [
      [0,               50_000_000,      0.5, 200_000],
      [50_000_000,      100_000_000,     0.4, 300_000],
      [100_000_000,     600_000_000,     0.3, null],
      [600_000_000,     1_200_000_000,   0.4, null],
      [1_200_000_000,   1_500_000_000,   0.5, null],
      [1_500_000_000,   Infinity,        0.6, null],
    ],
    source: SRC,
    checkedAt: CHECKED,
  },
  // 월세 거래금액 환산: 보증금 + 월세×100, 단 그 값이 5천만 미만이면 보증금 + 월세×70
  monthlyConversion: {
    value: { multiplier: 100, smallMultiplier: 70, smallThreshold: 50_000_000 },
    source: "https://www.law.go.kr/법령/공인중개사법시행령/제27조의2",
    checkedAt: CHECKED,
  },
  // 오피스텔(주거 전용 85㎡ 이하 등 요건 충족 시): 매매 0.5% / 임대차 0.4%
  officetel: {
    value: { salePct: 0.5, leasePct: 0.4 },
    source: SRC,
    checkedAt: CHECKED,
  },
  // 주택 외(토지·상가 등): 0.9% 이내 협의
  nonHousing: {
    value: { maxPct: 0.9 },
    source: SRC,
    checkedAt: CHECKED,
  },
  vatNote: {
    value: "중개보수와 별도로 부가가치세(일반과세 10%)가 붙을 수 있음",
    source: "https://www.law.go.kr/법령/부가가치세법",
    checkedAt: CHECKED,
  },
};
