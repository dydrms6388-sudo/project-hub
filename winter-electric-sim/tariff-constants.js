/*
 * winter-electric-sim/tariff-constants.js — 한국전력 주택용(저압) 전기요금 단가 상수 (단일 소스)
 * ─────────────────────────────────────────────────────────────────────────────
 * 기준: 2026-09 편집 검토. 한국전력공사 전기요금표(주택용 전력, 저압) — 2024-07 개정 이후 동일 단가 유지 확인.
 *   출처: 한국전력 사이버지점 요금표 https://cyber.kepco.co.kr/ckepco/front/jsp/CY/E/E/CYEEHP00101.jsp
 *         공공데이터포털 「한국전력공사_주택용 전기요금표」 https://www.data.go.kr/data/15090700/fileData.do
 *   - 누진 구간: 기타계절(1~6월·9~12월) 200/400kWh, 하계(7~8월) 300/450kWh — 3단계
 *   - 슈퍼유저: 하계(7~8월)·동계(12~2월) 월 1,000kWh 초과분 736.2원/kWh
 *   - 기후환경요금 9.0원/kWh, 연료비조정요금 +5.0원/kWh(상한, 분기 고시 — 배포 전 당분기 값 확인)
 *   - 부가가치세 10%, 전력산업기반기금 3.2%(2025-07-01 이후; 2024-07~2025-06은 3.5%, 그 이전 3.7%)
 *   - TV수신료 2,500원은 2023-07부터 분리징수 가능 → 본 계산에서 제외(선택 항목으로 안내만)
 *   - 주택용 고압(아파트 단일계약 등)은 단가가 다르므로 미지원(안내 문구), 복지할인·필수사용공제(2021 폐지) 미반영
 * ⚠️ 배포 전 위 출처에서 단가·구간·기금요율을 재확인할 것. 모델 기억으로 임의 수정 금지.
 */
window.TARIFF_CONSTANTS = {
  reviewed: "2026-09",
  sources: [
    { label: "한국전력공사 전기요금표(주택용)", url: "https://cyber.kepco.co.kr/ckepco/front/jsp/CY/E/E/CYEEHP00101.jsp" },
    { label: "공공데이터포털 주택용 전기요금표", url: "https://www.data.go.kr/data/15090700/fileData.do" },
  ],
  residentialLow: {
    // 기타계절(동계 포함) 구간
    other: [
      { upTo: 200,      base: 910,  rate: 120.0 },
      { upTo: 400,      base: 1600, rate: 214.6 },
      { upTo: Infinity, base: 7300, rate: 307.3 },
    ],
    // 하계(7~8월) 구간
    summer: [
      { upTo: 300,      base: 910,  rate: 120.0 },
      { upTo: 450,      base: 1600, rate: 214.6 },
      { upTo: Infinity, base: 7300, rate: 307.3 },
    ],
    superUser: { threshold: 1000, rate: 736.2, months: [12, 1, 2, 7, 8] },
    climateFee: 9.0,      // 원/kWh
    fuelAdjustment: 5.0,  // 원/kWh (현행 상한 +5원)
    vat: 0.10,
    fund: 0.032,          // 전력산업기반기금
  },
  // 난방·겨울 가전 대표 소비전력(W) — 제품 라벨(정격소비전력) 기준 대표값. 실제는 제품·설정에 따라 다름.
  appliances: [
    { id: "pad1",    name: "전기장판 (1인용)",        watts: 150,  hours: 8,  note: "정격 100~200W, 온도 중 설정 시 실사용은 정격의 50~70%" },
    { id: "pad2",    name: "전기요·온수매트 (2인용)", watts: 250,  hours: 8,  note: "온수매트 보일러 240~300W(가열 시), 유지 시 낮음" },
    { id: "fanheat", name: "온풍기 (팬히터)",         watts: 1800, hours: 3,  note: "1,500~2,000W. 가장 전기를 많이 쓰는 난방기구" },
    { id: "radiant", name: "전기히터 (할로겐·석영관)", watts: 1000, hours: 3,  note: "800~1,200W. 국소 난방용" },
    { id: "oilrad",  name: "오일 라디에이터",         watts: 1500, hours: 5,  note: "1,200~2,000W. 서모스탯으로 실제 가동률 60~80%" },
    { id: "acheat",  name: "에어컨 난방 (히트펌프, 거실)", watts: 900, hours: 5, note: "정격 1.2~1.8kW, 인버터 평균 소비 약 0.7~1.0kW. 열효율 3~4배" },
    { id: "sysac",   name: "시스템에어컨 난방 (전실)", watts: 1600, hours: 5,  note: "실외기 1대 기준 평균 1.2~2.0kW" },
    { id: "dryer",   name: "의류건조기 (히트펌프, 회당)", watts: 1200, hours: 1, note: "1회 약 1.0~1.5kWh. '시간'을 회당 1시간으로 두고 주 사용 횟수를 반영", perUse: true },
    { id: "heaterw", name: "전기온수기 (저장식)",     watts: 1500, hours: 2,  note: "가열 시 1.5~2kW, 보온 손실 포함 일 2~3kWh" },
    { id: "humid",   name: "가열식 가습기",           watts: 300,  hours: 8,  note: "가열식 250~400W, 초음파식은 30W 내외" },
    { id: "induct",  name: "인덕션·전기레인지",      watts: 2000, hours: 1,  note: "최대 3kW, 조리 평균 1.5~2kW" },
    { id: "bidet",   name: "비데·전기포트 등 소형",   watts: 100,  hours: 24, note: "대기·보온 전력 합계 대표값" },
  ],
};
