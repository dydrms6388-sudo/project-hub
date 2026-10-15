// 도배·바닥·타일·페인트·커튼 자재 규격/로스율 — 각 항목 {value, source, checkedAt}
// ⚠ 아래 규격·로스율은 "업계 일반 관행, 참고용" 값이다. 제품 포장/시방서 표기가 있으면 그 값을 직접 입력하는 것이 우선.

export const WALLPAPER_ROLLS = {
  value: [
    { id: "wide", name: "광폭합지/실크 (106cm × 15.6m)", widthM: 1.06, lengthM: 15.6 },
    { id: "narrow", name: "소폭합지 (53cm × 12.5m)", widthM: 0.53, lengthM: 12.5 },
  ],
  source: "TODO", // 제조사별 상이 — 업계 일반 관행 규격. 제품 라벨 확인 필요.
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "벽지 1롤 규격은 제조사마다 다름. 위 값은 국내 유통 일반 규격(관행). 구매 제품 라벨 우선.",
};

export const WALLPAPER_LOSS = {
  value: { plain: 0.1, pattern: 0.15 },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "재단·무늬(리피트) 맞춤 여유. 민무늬 약 10%, 무늬 벽지 15% 내외로 잡는 관행. 참고용.",
};

export const FLOORING_PRODUCTS = {
  value: [
    { id: "gangmaru", name: "강마루/강화마루 (1박스 ≈ 1.5㎡)", boxCoverageM2: 1.5 },
    { id: "wonmaru", name: "원목/온돌마루 (1박스 ≈ 1.0㎡)", boxCoverageM2: 1.0 },
    { id: "jangpan-roll", name: "장판(모노륨) 폭 1.8m 롤 — ㎡ 단위 재단", boxCoverageM2: null },
  ],
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "박스당 시공 면적은 제품마다 다름(1.0~2.0㎡). 제품 상세 표기 우선. 참고용 관행값.",
};

export const FLOORING_LOSS = {
  value: { straight: 0.05, herringbone: 0.12 },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "일자 시공 5% 내외, 헤링본 등 패턴 시공 10~15% 로스가 일반 관행. 참고용.",
};

export const TILE_LOSS = {
  value: { straight: 0.08, diagonal: 0.15 },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "타일 파손·재단 로스: 정시공 5~10%, 대각선/패턴 시공 15% 내외 관행. 참고용.",
};

export const TILE_GROUT_DEFAULT_MM = {
  value: 3,
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "줄눈(메지) 폭은 통상 2~5mm. 제품·시공 방식에 따라 다름. 참고용.",
};

export const PAINT_COVERAGE = {
  value: { defaultM2PerL: 10, range: [8, 14] },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "수성 페인트 이론 도포율은 통상 1회 기준 8~14㎡/L. 반드시 구매 제품 라벨의 도포율을 직접 입력할 것.",
};

export const CURTAIN_DEFAULTS = {
  value: { fullness: 2.0, fabricWidthCm: 140, sideAllowCm: 10, hemAllowCm: 25 },
  source: "TODO",
  checkedAt: "2026-08-19",
  practice: true,
  todo: true,
  note: "주름 배수 1.5~2.5배, 원단 폭 110/140/150cm, 상하 시접 20~30cm — 커튼 업계 일반 관행. 참고용.",
};
