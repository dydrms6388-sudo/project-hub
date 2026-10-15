/**
 * data/condolence.mjs — 경조사비 관행 범위 + 봉투 문구
 * ⚠ 금액은 "일반적 관행"을 폭넓게 정리한 참고 범위이며 정답이 아니다. 지역·관계·형편에 따라
 *   달라지는 것이 자연스럽다. (UI에 이 라벨을 고정 노출할 것)
 * 출처: 카드사·리서치사 설문 및 언론 보도(2023~2025)를 종합한 자체 정리 — 특정 조사값의
 *   인용이 아니므로 구체 수치의 공식 출처는 없음(관행 안내임을 명시). checkedAt: 2026-08-19
 * 봉투 문구(한자 표기): 국립국어원 표준국어대사전 표제어 기준. https://stdict.korean.go.kr
 */

export const CONDOLENCE_META = {
  label: "일반적 관행이며 정답이 아닙니다",
  source: "설문·보도 종합 자체 정리(관행 안내), 봉투 문구는 표준국어대사전",
  urls: ["https://stdict.korean.go.kr"],
  checkedAt: "2026-08-19",
};

// 관계 단계: acquaintance(아는 사이) < friend(친구·동료) < close(친한 친구·가까운 동료) < family(친척·가족급)
export const EVENTS = {
  wedding: {
    name: "결혼식 (축의금)",
    ranges: {
      acquaintance: [50000, 50000],
      friend: [50000, 100000],
      close: [100000, 200000],
      family: [200000, 500000],
    },
    tips: [
      "식대가 높은 호텔 예식에 참석해 식사한다면 10만 원 이상을 내는 흐름이 많다.",
      "참석하지 못하고 마음만 전할 때는 5만 원을 보내는 경우가 흔하다.",
      "홀수 단위(5·10·15…)로 맞추는 관습이 있으나 10·20처럼 꽉 찬 단위도 무방하다는 견해가 일반적.",
    ],
  },
  funeral: {
    name: "장례식 (부의금·조의금)",
    ranges: {
      acquaintance: [50000, 50000],
      friend: [50000, 100000],
      close: [100000, 200000],
      family: [200000, 500000],
    },
    tips: [
      "부의금은 홀수 단위(3·5·7·10만 원)로 내는 관습이 있다.",
      "새 지폐보다 쓰던 지폐를 넣는 것이 예의라는 관습이 전해진다(지역·가문마다 다름).",
    ],
  },
  doljanchi: {
    name: "돌잔치 (축하금)",
    ranges: {
      acquaintance: [30000, 50000],
      friend: [50000, 100000],
      close: [100000, 150000],
      family: [100000, 300000],
    },
    tips: ["돌잔치는 축하금 대신 아기 선물(금반지·용품)로 대신하는 경우도 많다."],
  },
};

export const CLOSENESS = [
  { key: "acquaintance", name: "아는 사이 (얼굴 아는 정도)" },
  { key: "friend", name: "친구·직장 동료" },
  { key: "close", name: "친한 친구·가까운 동료" },
  { key: "family", name: "친척·가족급" },
];

// 봉투 앞면 문구 (세로쓰기). hanja와 hangul 중 선택.
export const ENVELOPE = {
  wedding: [
    { hanja: "祝結婚", hangul: "축결혼", note: "가장 일반적" },
    { hanja: "祝華婚", hangul: "축화혼", note: "화혼: 결혼을 아름답게 이르는 말" },
    { hanja: "祝聖婚", hangul: "축성혼", note: "" },
  ],
  funeral: [
    { hanja: "賻儀", hangul: "부의", note: "가장 일반적" },
    { hanja: "謹弔", hangul: "근조", note: "삼가 조상함" },
    { hanja: "弔意", hangul: "조의", note: "" },
    { hanja: "追慕", hangul: "추모", note: "" },
  ],
  doljanchi: [
    { hanja: "祝 첫돌", hangul: "축 첫돌", note: "한글 표기가 자연스럽다" },
    { hanja: "祝 生日", hangul: "축 생일", note: "" },
  ],
};
