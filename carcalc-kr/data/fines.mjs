// 과태료·범칙금 표 (승용차 기준) — 근거: 도로교통법 시행령 [별표 6](과태료 부과기준),
// [별표 8](범칙행위 및 범칙금액), 도로교통법 시행규칙 [별표 28](벌점 기준).
// 확인된 대표 위반유형만 수록. 승합·이륜 등 다른 차종은 금액이 다르다.
// 과태료 = 무인단속(차 소유주에게 부과, 벌점 없음) / 범칙금 = 현장단속(운전자, 벌점 병과 가능)
const SRC_DECREE = "https://www.law.go.kr/법령/도로교통법시행령"; // 별표 6·8
const SRC_RULE = "https://www.law.go.kr/법령/도로교통법시행규칙"; // 별표 28 (벌점)
const SRC_EFINE = "https://www.efine.go.kr"; // 경찰청 교통민원24
const SRC_LAW = "https://www.law.go.kr/법령/도로교통법";
const CHECKED = "2026-08-19";

// 금액 단위: 원. null = 해당 처분 없음/직접단속 대상 아님.
export const FINES = [
  // ── 속도위반 (일반도로·고속도로 공통 기준) ──
  { slug: "speed-20", cat: "속도위반", name: "속도위반 20km/h 이하", fine: 40000, penalty: 30000, points: 0,
    note: "제한속도 초과 20km/h 이하. 무인단속 시 과태료 4만원." },
  { slug: "speed-20-40", cat: "속도위반", name: "속도위반 20~40km/h", fine: 70000, penalty: 60000, points: 15 },
  { slug: "speed-40-60", cat: "속도위반", name: "속도위반 40~60km/h", fine: 100000, penalty: 90000, points: 30 },
  { slug: "speed-60", cat: "속도위반", name: "속도위반 60km/h 초과", fine: 130000, penalty: 120000, points: 60,
    note: "제한속도 100km/h 초과 과속은 별도 형사처벌 조항(도로교통법 제151조의2)이 있다." },
  // ── 어린이보호구역 (오전 8시~오후 8시, 제재 2배 수준 가중) ──
  { slug: "school-speed-20", cat: "어린이보호구역", name: "스쿨존 속도위반 20km/h 이하", fine: 70000, penalty: 60000, points: 15 },
  { slug: "school-speed-20-40", cat: "어린이보호구역", name: "스쿨존 속도위반 20~40km/h", fine: 100000, penalty: 90000, points: 30 },
  { slug: "school-speed-40-60", cat: "어린이보호구역", name: "스쿨존 속도위반 40~60km/h", fine: 130000, penalty: 120000, points: 60 },
  { slug: "school-speed-60", cat: "어린이보호구역", name: "스쿨존 속도위반 60km/h 초과", fine: 160000, penalty: 150000, points: 120 },
  { slug: "school-signal", cat: "어린이보호구역", name: "스쿨존 신호·지시 위반", fine: 130000, penalty: 120000, points: 30 },
  { slug: "parking-school", cat: "어린이보호구역", name: "스쿨존 주정차 위반", fine: 120000, penalty: null, points: null,
    note: "승용차 기준 과태료 12만원." },
  // ── 신호·중앙선 ──
  { slug: "signal", cat: "신호·지시", name: "신호·지시 위반", fine: 70000, penalty: 60000, points: 15 },
  { slug: "center-line", cat: "신호·지시", name: "중앙선 침범", fine: 90000, penalty: 60000, points: 30 },
  { slug: "illegal-uturn", cat: "신호·지시", name: "불법 유턴(지시 위반)", fine: 70000, penalty: 60000, points: 15,
    note: "유턴 금지 구역·지시 위반은 신호·지시 위반으로 처리된다." },
  // ── 주정차 ──
  { slug: "parking", cat: "주정차", name: "주정차 위반 (일반)", fine: 40000, penalty: null, points: null,
    note: "같은 장소 2시간 이상이면 5만원. 의견진술 기한 내 자진납부 시 20% 감경(질서위반행위규제법 제18조)." },
  { slug: "parking-fire", cat: "주정차", name: "소방시설 5m 이내 주정차", fine: 80000, penalty: null, points: null,
    note: "소화전 등 소방시설 주변 절대 주정차 금지구역." },
  // ── 휴대전화·영상 ──
  { slug: "phone", cat: "운전 중 주의분산", name: "운전 중 휴대전화 사용", fine: null, penalty: 60000, points: 15 },
  { slug: "video", cat: "운전 중 주의분산", name: "운전 중 영상표시장치 시청·조작", fine: null, penalty: 60000, points: 15 },
  // ── 안전띠·보호장구 ──
  { slug: "seatbelt-driver", cat: "안전띠", name: "운전자 안전띠 미착용", fine: null, penalty: 30000, points: 0 },
  { slug: "seatbelt-passenger", cat: "안전띠", name: "동승자 안전띠 미착용", fine: 30000, penalty: null, points: null,
    note: "동승자가 13세 미만이면 과태료 6만원." },
  { slug: "child-seat", cat: "안전띠", name: "유아용 카시트 미사용", fine: 60000, penalty: null, points: null,
    note: "6세 미만 유아 보호장구 미착용 시 과태료 6만원." },
  // ── 차로·통행방법 ──
  { slug: "cut-in", cat: "차로·통행", name: "끼어들기 위반", fine: null, penalty: 30000, points: 0 },
  { slug: "lane", cat: "차로·통행", name: "지정차로 통행 위반", fine: null, penalty: 30000, points: 10 },
  { slug: "shoulder", cat: "차로·통행", name: "고속도로 갓길 통행", fine: 90000, penalty: 60000, points: 30 },
  { slug: "bus-lane-highway", cat: "차로·통행", name: "고속도로 버스전용차로 위반", fine: 90000, penalty: 60000, points: 30 },
  { slug: "bus-lane-city", cat: "차로·통행", name: "일반도로 버스전용차로 위반", fine: 50000, penalty: 40000, points: 10 },
  { slug: "intersection", cat: "차로·통행", name: "교차로 통행방법 위반(꼬리물기 등)", fine: null, penalty: 40000, points: 0 },
  { slug: "overtake", cat: "차로·통행", name: "앞지르기 방법·금지 위반", fine: null, penalty: 60000, points: 10,
    note: "앞지르기 금지 시기·장소 위반은 벌점 15점." },
  // ── 안전거리·신호기기 ──
  { slug: "distance", cat: "안전운전", name: "안전거리 미확보 (일반도로)", fine: null, penalty: 20000, points: 10 },
  { slug: "distance-highway", cat: "안전운전", name: "안전거리 미확보 (고속도로)", fine: null, penalty: 50000, points: 10 },
  { slug: "turn-signal", cat: "안전운전", name: "방향지시등(깜빡이) 미점등", fine: null, penalty: 30000, points: 0 },
  { slug: "headlight", cat: "안전운전", name: "야간 등화 점등 불이행", fine: null, penalty: 20000, points: 0 },
  { slug: "splash", cat: "안전운전", name: "고인 물 튀김 피해", fine: null, penalty: 20000, points: 0,
    note: "고인 물 등을 튀게 하여 다른 사람에게 피해를 준 경우." },
  // ── 보행자·어린이 보호 ──
  { slug: "crosswalk", cat: "보행자 보호", name: "횡단보도 보행자 보호의무 위반", fine: 70000, penalty: 60000, points: 10 },
  { slug: "school-bus", cat: "보행자 보호", name: "어린이통학버스 특별보호 위반", fine: null, penalty: 90000, points: 30 },
  // ── 형사처벌 대상 (범칙금 아님 — 안내용) ──
  { slug: "drunk", cat: "형사처벌", name: "음주운전", fine: null, penalty: null, points: null, criminal: true,
    note: "혈중알코올농도 0.03% 이상은 범칙금이 아니라 형사처벌 대상(도로교통법 제148조의2). 0.03~0.08% 면허정지, 0.08% 이상 면허취소." },
  { slug: "no-license", cat: "형사처벌", name: "무면허 운전", fine: null, penalty: null, points: null, criminal: true,
    note: "범칙금이 아니라 형사처벌 대상(도로교통법 제152조)." },
];

export const FINE_SOURCES = {
  decree: { label: "도로교통법 시행령 [별표 6]·[별표 8]", url: SRC_DECREE, checkedAt: CHECKED },
  rule: { label: "도로교통법 시행규칙 [별표 28] (벌점)", url: SRC_RULE, checkedAt: CHECKED },
  law: { label: "도로교통법", url: SRC_LAW, checkedAt: CHECKED },
  efine: { label: "경찰청 교통민원24(이파인) — 실제 단속·고지 조회", url: SRC_EFINE, checkedAt: CHECKED },
};

export const FINE_NOTES = [
  "이 표는 승용차 기준이다. 승합차·화물차·이륜차는 금액이 다르다.",
  "과태료는 무인단속 시 차량 소유주에게 부과되며 벌점이 없다. 범칙금은 현장단속 시 운전자에게 부과되며 벌점이 함께 매겨질 수 있다.",
  "실제 단속 내역과 납부액은 경찰청 교통민원24(efine.go.kr)에서 확인해야 한다. 본 표는 참고용.",
];
