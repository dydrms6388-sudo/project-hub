// 소모품 교체 주기 — "제조사 일반 권고, 참고용" 데이터.
// 차종·엔진·운전 조건(가혹조건)에 따라 크게 달라진다. 실제 기준은 본인 차량 취급설명서.
const SRC_HYUNDAI = "https://www.hyundai.com/kr/ko/e/customer/center/manual"; // 현대차 오너스 매뉴얼
const SRC_KIA = "https://www.kia.com/kr/customer-service/center/manual"; // 기아 취급설명서
const SRC_SAFETY_RULE = "https://www.law.go.kr/법령/자동차및자동차부품의성능과기준에관한규칙"; // 타이어 마모한계 등
const CHECKED = "2026-08-19";

export const MAINT_LABEL = "제조사 일반 권고, 참고용 — 실제 주기는 차량 취급설명서·정비지침 기준";

export const MAINT_ITEMS = [
  { key: "engine-oil", name: "엔진오일·오일필터", km: 10000, months: 12,
    note: "가혹조건(짧은 거리 반복, 공회전 잦음 등)은 5,000~7,500km 권고", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "cabin-filter", name: "에어컨(캐빈) 필터", km: 15000, months: 12,
    note: "미세먼지 심한 환경은 더 자주", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "air-cleaner", name: "에어클리너 필터", km: 40000, months: null,
    note: "10,000km마다 점검, 먼지 많은 지역은 조기 교체", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "brake-fluid", name: "브레이크액", km: 40000, months: 24,
    note: "수분 흡수 시 제동력 저하 — 2년 주기 점검·교체 권고", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "coolant", name: "냉각수(부동액)", km: 40000, months: 24,
    note: "최초 주입분은 장수명(예: 20만km/10년)인 차량이 많음 — 이후 4만km/2년", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "tire-rotation", name: "타이어 위치 교환", km: 10000, months: null,
    note: "편마모 방지. 공기압은 월 1회 점검", source: SRC_KIA, checkedAt: CHECKED },
  { key: "tire", name: "타이어 교체", km: 50000, months: null,
    note: "거리보다 마모 기준 — 트레드 마모한계선 1.6mm 도달 시 교체(법정 안전기준)", source: SRC_SAFETY_RULE, checkedAt: CHECKED },
  { key: "brake-pad", name: "브레이크 패드(앞)", km: 35000, months: null,
    note: "운전 습관에 따라 2만~5만km — 소음·두께로 점검", source: SRC_KIA, checkedAt: CHECKED },
  { key: "spark-plug", name: "점화플러그", km: 100000, months: null,
    note: "이리듐 기준(일반 플러그는 4만km 수준) — 엔진별 차이 큼", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "transmission", name: "자동변속기 오일", km: 100000, months: null,
    note: "무교환 설계 차량 많음 — 가혹조건 시 9만~10만km 점검 권고", source: SRC_HYUNDAI, checkedAt: CHECKED },
  { key: "wiper", name: "와이퍼 블레이드", km: null, months: 12,
    note: "닦임 상태 보고 6~12개월", source: SRC_KIA, checkedAt: CHECKED },
  { key: "battery", name: "배터리(12V)", km: null, months: 48,
    note: "통상 3~5년 — 시동 지연·전압 저하 시 점검", source: SRC_KIA, checkedAt: CHECKED },
];
