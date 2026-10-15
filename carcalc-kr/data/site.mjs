// carcalc-kr 사이트 공통 설정 — SITE_ORIGIN 은 여기 한 곳에서만 관리한다.
// gen.mjs(사이트맵·롱테일 생성)와 tests/run.mjs(정합성 검사)가 이 값을 import 한다.
export const SITE_ORIGIN = "https://carcalc-kr.vercel.app";
export const SITE_NAME = "카캘크 — 자동차 계산기 허브";
export const CHECKED_AT = "2026-08-19";

// 허브 도구 목록 (허브 index·사이트맵·크로스링크에서 사용)
export const TOOLS = [
  { slug: "fuel-economy", name: "연비 계산기", emoji: "⛽", desc: "주행거리와 주유량으로 실연비 계산, 주유 기록 누적 그래프" },
  { slug: "fuel-cost", name: "유류비 계산기", emoji: "🛣️", desc: "거리·연비·유가로 편도/왕복 기름값 + 톨비 계산" },
  { slug: "car-tax", name: "자동차세 계산기", emoji: "🧾", desc: "배기량·차령·연납 할인 반영 자동차세(지방교육세 포함)" },
  { slug: "acquisition", name: "자동차 취등록세 계산기", emoji: "🏷️", desc: "차량가액·용도별 취득세 계산" },
  { slug: "depreciation", name: "중고차 감가 계산기", emoji: "📉", desc: "연식·주행거리 기반 단순 감가 모델(시세 아님)" },
  { slug: "tire-decoder", name: "타이어 규격 해독기", emoji: "🛞", desc: "205/55R16 91V 읽는 법 + 대체 규격 지름 오차" },
  { slug: "maintenance", name: "소모품 교체 주기 기록", emoji: "🔧", desc: "엔진오일·필터 등 교체 기록과 주행거리 기반 D-day" },
  { slug: "fine-table", name: "과태료·범칙금 조회표", emoji: "🚨", desc: "속도·신호·주정차 등 위반유형별 과태료/범칙금/벌점" },
  { slug: "lease-vs-buy", name: "리스·렌트 vs 구매 비교", emoji: "⚖️", desc: "총 보유비용 기준 리스/렌트/할부 구매 비교" },
  { slug: "ev-vs-ice", name: "전기차 유지비 비교", emoji: "🔌", desc: "연간 주행거리 기준 전기차 vs 내연기관 유지비" },
  { slug: "loan", name: "자동차 할부 계산기", emoji: "💳", desc: "원리금균등/원금균등 월납입금과 전체 상환 스케줄" },
  { slug: "trip-share", name: "여행 기름값 N빵 계산기", emoji: "🧮", desc: "거리·연비·유가·톨비를 인원수로 나누기" },
];

// tomatoeggcat.com 기존 도구 크로스링크(절대 URL)
export const CROSS_LINKS = {
  maintenanceCycle: { url: "https://tomatoeggcat.com/car-maintenance-cycle/", name: "차량 소모품 교체주기 가이드" },
  insuranceRider: { url: "https://tomatoeggcat.com/car-insurance-rider/", name: "자동차보험 특약 점검" },
  loanRefi: { url: "https://tomatoeggcat.com/loan-refi-calc/", name: "대출 갈아타기 계산기" },
  yeonbigak: { url: "https://tomatoeggcat.com/dydrms-yeonbigak/", name: "연비각 — 연비 기록장" },
  drivingTest: { url: "https://tomatoeggcat.com/dydrms-driving-test/", name: "운전면허 필기 모의고사" },
};
