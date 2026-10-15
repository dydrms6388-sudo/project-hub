// 대기전력·태양광·전기차 충전 참고 데이터 (billcalc-kr)
// 규칙: {value, source, checkedAt}. 확신 없는 값은 todo:true + 링크.

export const CHECKED_AT = "2026-08-19";

// ── 대기전력 ─────────────────────────────────────────────
// 국내 대기전력 저감 프로그램(에너지이용 합리화법)은 대상 기기 대기전력 1W 이하를 권고 기준으로 운영.
// 아래 값은 "구형·일반 기기 참고 범위"로, 실제는 기기·연식별 편차가 크다(직접 수정 가능).
export const STANDBY_SOURCE = {
  name: "한국에너지공단 대기전력저감 프로그램(참고 범위) · 구형 기기 실측조사 통념치",
  url: "https://eep.energy.or.kr",
  checkedAt: CHECKED_AT,
  note: "최신 기기는 대기전력 1W 이하가 많고, 셋톱박스 등 일부는 예외적으로 큽니다. 값은 참고 범위이며 수정 가능합니다.",
};

export const STANDBY_ITEMS = [
  { slug: "settop", name: "셋톱박스", w: 12, range: [8, 15], note: "국내 가정 대기전력 1위로 알려진 기기" },
  { slug: "router", name: "인터넷 모뎀·공유기", w: 6, range: [4, 10], note: "상시 사용 기기라 완전 차단은 비추천" },
  { slug: "aircon", name: "에어컨 (플러그 꽂아둠)", w: 4, range: [2, 6] },
  { slug: "audio", name: "오디오·사운드바", w: 4, range: [2, 8] },
  { slug: "riceCooker", name: "전기밥솥 (예약 대기)", w: 3, range: [2, 5] },
  { slug: "microwave", name: "전자레인지 (시계 표시)", w: 3, range: [1, 4] },
  { slug: "tv", name: "TV (대기)", w: 1, range: [0.5, 3], note: "최신 제품은 1W 이하 규제 수준" },
  { slug: "desktop", name: "데스크톱 (꺼짐+플러그)", w: 3, range: [1, 6] },
  { slug: "charger", name: "충전기 (기기 미연결)", w: 0.3, range: [0.1, 1] },
  { slug: "bidet", name: "비데 (온수 대기)", w: 15, range: [5, 40], note: "저장식 온수 유지 전력, 편차 큼" },
];

// ── 가정용 태양광 ────────────────────────────────────────
export const SOLAR = {
  // 국내 연평균 일 발전시간(설비이용률 환산 약 15% 내외 = 하루 약 3.6시간)의 통념적 참고값.
  peakHours: {
    value: 3.6, unit: "시간/일",
    source: "https://kier-solar.org", sourceName: "국가 참조 표준 태양광 데이터(재생에너지 데이터센터)",
    checkedAt: CHECKED_AT,
    note: "전국 연평균 참고값. 지역·방위각·경사·계절에 따라 대략 3.2~3.9시간 — 정확한 지역값은 데이터센터에서 확인 후 직접 입력.",
    editable: true,
  },
  // TODO(확인 필요): 시·도별 세부 일사량 표 — 값 확정 전까지 미기재, 링크 안내.
  regionTable: {
    todo: true,
    links: [
      { name: "재생에너지 데이터센터 (지역별 일사량)", url: "https://kier-solar.org" },
      { name: "한국에너지공단 신재생에너지센터", url: "https://www.knrec.or.kr" },
    ],
    checkedAt: CHECKED_AT,
  },
  systemLoss: {
    value: 0.85,
    source: "https://www.knrec.or.kr", sourceName: "인버터·배선 손실 등 종합효율 참고치",
    checkedAt: CHECKED_AT,
    note: "설비 종합효율(약 80~90%) 참고 기본값. 수정 가능.",
    editable: true,
  },
  netMeteringNote: "주택용 태양광은 '상계거래' — 발전량만큼 사용량에서 차감되고, 남으면 다음 달로 이월(현금 정산 아님). 자세한 조건은 한전 사이버지점 참조.",
  netMeteringSource: { url: "https://cyber.kepco.co.kr", name: "한국전력 사이버지점(상계거래 안내)", checkedAt: CHECKED_AT },
};

// ── 전기차 충전 ──────────────────────────────────────────
// 충전 단가는 사업자·요금제·시간대별로 수시 변동 → 사용자 직접 입력이 원칙. 아래는 "예시값".
export const EV = {
  examples: [
    { name: "환경부 공공 급속(100kW급) 예시", price: 347.2, unit: "원/kWh", source: "https://ev.or.kr", sourceName: "무공해차 통합누리집", note: "2022년 9월 조정 당시 단가 예시 — 현재 단가는 ev.or.kr에서 확인 필요", todo: true },
    { name: "아파트 완속(야간) 예시", price: 180, unit: "원/kWh", source: "https://ev.or.kr", note: "사업자·계절·시간대별 편차 큼 — 예시값", todo: true },
  ],
  chargeLoss: {
    value: 0.10,
    source: "https://ev.or.kr", sourceName: "충전 손실(약 5~15%) 통념적 참고치",
    checkedAt: CHECKED_AT,
    note: "충전 시 배터리에 들어가는 것보다 계량되는 전력이 5~15% 많음(참고값, 수정 가능).",
    editable: true,
  },
  checkedAt: CHECKED_AT,
};
