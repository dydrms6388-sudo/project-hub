// 조명 권장 조도 — KS A 3011(조도 기준) 기반. 각 항목 {value, source, checkedAt}
// ⚠ KS 원문은 유료 열람이라 아래 수치는 통용 인용값. todo:true = 원문 대조 확인 필요 → UI에 "확인 필요" 배지.
export const ROOM_LUX = {
  value: [
    { id: "living", name: "거실(전반)", lux: [150, 300] },
    { id: "bedroom", name: "침실(전반)", lux: [100, 200] },
    { id: "kitchen", name: "주방(작업면)", lux: [300, 600] },
    { id: "study", name: "서재·공부방(책상면)", lux: [600, 1000] },
    { id: "bath", name: "욕실·세면대", lux: [150, 300] },
    { id: "entry", name: "현관·복도", lux: [60, 150] },
  ],
  source: "https://standard.go.kr", // KS A 3011 조도 기준 (e나라표준인증에서 표준번호 KS A 3011 검색)
  checkedAt: "2026-08-19",
  todo: true,
  note: "KS A 3011 조도 기준의 통용 인용 범위. 원문 표와 대조 확인 필요(확인 필요 배지 표시).",
};

// 광속법 보정: 필요 램프 광속 = 조도 × 면적 ÷ (조명률 × 보수율)
export const UTILIZATION_DEFAULT = {
  value: { utilization: 0.6, maintenance: 0.8 },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "조명률(기구·천장 반사 조건) 0.5~0.7, 보수율 0.7~0.8 — 조명 설계 일반 관행값. 참고용.",
};

export const BULB_PRESETS = {
  value: [
    { name: "LED 전구 8W", lm: 800 },
    { name: "LED 전구 12W", lm: 1200 },
    { name: "LED 방등 50W", lm: 4500 },
    { name: "LED 거실등 100W", lm: 9000 },
    { name: "형광등 30W(대체형)", lm: 2400 },
  ],
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "제품별 광속(lm)은 라벨 표기 확인. 위는 통상 효율 90~100lm/W 가정의 예시값. 참고용.",
};
