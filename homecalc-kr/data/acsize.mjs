// 에어컨 필요 냉방능력 — 각 항목 {value, source, checkedAt}
// ⚠ 공식 고시 형태의 '평당 필요 냉방능력' 단일 기준은 확인하지 못함 → todo:true, UI에 "확인 필요" 배지.
export const COOLING_PER_PYEONG_KW = {
  value: { home: 0.4, living: 0.5, office: 0.55 },
  source: "TODO", // 제조사 권장 매칭(예: '○평형' 제품의 정격 냉방능력)을 역산한 통용 관행값. 공적 출처 확인 필요.
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "방(침실) 평당 약 0.4kW, 거실 0.5kW, 사무실·상업 0.55kW 내외로 잡는 업계 관행. 제조사 평형 표기·정격 냉방능력(kW)이 우선.",
};

export const CEILING_BASE_M = {
  value: 2.3,
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "평당 계수의 전제 층고(약 2.3m). 층고가 높으면 비례 보정하는 관행. 참고용.",
};

export const EFFICIENCY_LABEL_INFO = {
  value: "에어컨 정격 냉방능력(kW)·소비전력은 제품의 에너지소비효율등급 라벨과 제원표에 표기된다.",
  source: "https://eep.energy.or.kr", // 한국에너지공단 효율관리제도
  checkedAt: "2026-08-19",
};
