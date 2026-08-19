// 전월세 전환율 — 법정 산식 {value, source, checkedAt}
export const LEGAL_CONVERSION_CAP = {
  value: { fixedCap: 0.10, baseRateSpread: 0.02 },
  source: "https://www.law.go.kr/법령/주택임대차보호법/제7조의2", // + 시행령 제9조 (연 1할 vs 기준금리+2%p 중 낮은 비율)
  checkedAt: "2026-08-19",
  note: "보증금→월세 전환 시 상한 = min(연 10%, 한국은행 기준금리 + 2%p). 주택임대차보호법 제7조의2·시행령 제9조.",
};

export const BASE_RATE_EXAMPLE = {
  value: 0.025, // 예시 2.50% — 실제 기준금리는 한국은행 발표 확인 필요
  source: "https://www.bok.or.kr/portal/singl/baseRate/progress.do", // 한국은행 기준금리 추이
  checkedAt: "2026-08-19",
  todo: true,
  note: "예시값. 한국은행 기준금리는 수시로 변경되므로 위 링크에서 현재 값을 확인해 직접 입력할 것 (확인 필요 배지).",
};
