// cookcalc-kr — 소형 도구용 기준값 모음 (밥물·커피·염지·김치절임·청·팬 프리셋)
// 전부 "일반 관행값, 참고용" — 재료 상태·취향에 따라 조절 필요.

const SRC = "자체 정리 — 국내 요리 관행값(참고용)";
const CHECKED = "2026-08-19";

// ── 밥물 비율 (쌀 부피 1에 대한 물 부피 비율) ──────────────────
// 쌀 1컵(200ml) ≈ 165g. 전기밥솥(일반/압력)·냄비별 보정 포함.
export const RICE_RATIO = {
  types: [
    { key: "white",  name: "백미",   soaked: 1.0, unsoaked: 1.2, note: "불린 쌀은 쌀과 동량, 안 불린 쌀은 1.2배", source: SRC, checkedAt: CHECKED, value: 1.2 },
    { key: "brown",  name: "현미",   soaked: 1.2, unsoaked: 1.5, note: "최소 2시간 이상 불리기를 권장", source: SRC, checkedAt: CHECKED, value: 1.5 },
    { key: "mixed",  name: "잡곡밥", soaked: 1.1, unsoaked: 1.3, note: "잡곡 비율이 높을수록 물을 조금 더", source: SRC, checkedAt: CHECKED, value: 1.3 },
    { key: "sticky", name: "찹쌀",   soaked: 0.8, unsoaked: 0.9, note: "찹쌀은 물을 적게 — 백미보다 질어지기 쉬움", source: SRC, checkedAt: CHECKED, value: 0.9 },
  ],
  cookers: [
    { key: "pressure", name: "압력밥솥",     factor: 0.9,  note: "증발이 적어 물을 10% 줄임", source: SRC, checkedAt: CHECKED, value: 0.9 },
    { key: "electric", name: "일반 전기밥솥", factor: 1.0,  note: "기준", source: SRC, checkedAt: CHECKED, value: 1.0 },
    { key: "pot",      name: "냄비/솥",      factor: 1.15, note: "증발이 많아 물을 15% 늘림", source: SRC, checkedAt: CHECKED, value: 1.15 },
  ],
  cupMl: 200, riceGPerCup: 165,
};

// ── 커피 추출 비율 (원두 1g당 물 g/ml) ─────────────────────────
export const COFFEE_RATIO = [
  { key: "handdrip", name: "핸드드립(푸어오버)", ratio: 16, range: "1:15~1:17", note: "산미를 살리려면 1:16~17, 진하게는 1:15", source: SRC, checkedAt: CHECKED, value: 16 },
  { key: "frenchpress", name: "프렌치프레스", ratio: 15, range: "1:14~1:16", note: "4분 우린 뒤 천천히 프레스", source: SRC, checkedAt: CHECKED, value: 15 },
  { key: "aeropress", name: "에어로프레스", ratio: 14, range: "1:12~1:16", note: "레시피 폭이 넓은 방식", source: SRC, checkedAt: CHECKED, value: 14 },
  { key: "coldbrew", name: "콜드브루(원액)", ratio: 12, range: "1:10~1:14", note: "12~18시간 냉침, 원액은 물/우유에 희석", source: SRC, checkedAt: CHECKED, value: 12 },
  { key: "espresso", name: "에스프레소", ratio: 2, range: "1:1.5~1:2.5", note: "원두 18g → 추출액 약 36g(1:2)", source: SRC, checkedAt: CHECKED, value: 2 },
];

// ── 염지(브라인) 기준 ─────────────────────────────────────────
export const BRINE = {
  wet: {
    waterPerMeat: { value: 1.0, note: "물 = 고기 무게와 동량(잠길 만큼)", source: SRC, checkedAt: CHECKED },
    saltPct:  { value: 6, note: "소금 = 물 무게의 6% (5~7% 관행)", source: SRC, checkedAt: CHECKED },
    sugarPct: { value: 3, note: "설탕 = 물 무게의 3% (소금의 절반)", source: SRC, checkedAt: CHECKED },
  },
  dry: {
    saltPct:  { value: 1.2, note: "소금 = 고기 무게의 1~1.5%", source: SRC, checkedAt: CHECKED },
    sugarPct: { value: 0.6, note: "설탕 = 고기 무게의 0.5~0.8%(생략 가능)", source: SRC, checkedAt: CHECKED },
  },
  times: [
    { name: "닭가슴살·안심", time: "2~4시간", source: SRC, checkedAt: CHECKED, value: "2~4시간" },
    { name: "닭다리·닭날개", time: "4~6시간", source: SRC, checkedAt: CHECKED, value: "4~6시간" },
    { name: "통닭(1kg 내외)", time: "8~12시간", source: SRC, checkedAt: CHECKED, value: "8~12시간" },
    { name: "돼지 두툼한 구이용(3cm)", time: "4~8시간", source: SRC, checkedAt: CHECKED, value: "4~8시간" },
    { name: "돼지 통목살·통삼겹", time: "12~24시간", source: SRC, checkedAt: CHECKED, value: "12~24시간" },
  ],
};

// ── 김치(배추) 절임 기준 ──────────────────────────────────────
export const KIMCHI = {
  waterPerCabbage: { value: 0.5, note: "절임물 = 배추 무게의 약 50%(잠길 만큼)", source: SRC, checkedAt: CHECKED },
  brinePct: { value: 10, note: "절임물 소금 농도 8~10%", source: SRC, checkedAt: CHECKED },
  sprinklePct: { value: 2, note: "줄기 사이에 켜켜이 뿌리는 소금 = 배추 무게의 약 2%", source: SRC, checkedAt: CHECKED },
  time: { value: "여름 6~8시간 · 겨울 8~10시간(중간에 위아래 뒤집기)", source: SRC, checkedAt: CHECKED },
  saltType: "굵은소금(천일염) 기준. 꽃소금 사용 시 양을 약 20% 줄임",
};

// ── 과일청 비율 ───────────────────────────────────────────────
export const SYRUP = {
  standard: { value: 1.0, name: "기본(1:1)", note: "과일:설탕 = 1:1 — 실온 숙성 가능한 표준 비율", source: SRC, checkedAt: CHECKED },
  lowSugar: { value: 0.8, name: "저당(1:0.8)", note: "설탕을 줄인 만큼 곰팡이 위험 ↑ → 냉장 숙성·보관 필수", source: SRC, checkedAt: CHECKED },
  jarFactor: { value: 1.6, note: "용기 용량 ≈ (과일g+설탕g) × 1.6ml — 발효 가스 여유 포함", source: SRC, checkedAt: CHECKED },
};

// ── 베이킹 팬 프리셋 (국내 호수 관행 치수) ─────────────────────
export const PANS = [
  { key: "round1", name: "원형 1호 (지름 15cm)", shape: "round", d: 15, h: 7, source: SRC, checkedAt: CHECKED, value: 15 },
  { key: "round2", name: "원형 2호 (지름 18cm)", shape: "round", d: 18, h: 7, source: SRC, checkedAt: CHECKED, value: 18 },
  { key: "round3", name: "원형 3호 (지름 21cm)", shape: "round", d: 21, h: 7, source: SRC, checkedAt: CHECKED, value: 21 },
  { key: "square15", name: "정사각 15cm", shape: "rect", w: 15, l: 15, h: 7, source: SRC, checkedAt: CHECKED, value: 15 },
  { key: "square18", name: "정사각 18cm", shape: "rect", w: 18, l: 18, h: 7, source: SRC, checkedAt: CHECKED, value: 18 },
  { key: "pound", name: "파운드팬(중, 21×9×8cm)", shape: "rect", w: 21, l: 9, h: 8, source: SRC, checkedAt: CHECKED, value: 21 },
];
