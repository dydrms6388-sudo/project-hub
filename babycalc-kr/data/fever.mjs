/* 소아 발열 기준·대처 안내 (진단 도구 아님)
 * 출처:
 *  - 질병관리청 국가건강정보포털 '소아 발열' https://health.kdca.go.kr
 *  - 응급의료포털 E-GEN https://www.e-gen.or.kr
 * 이 데이터는 참고용 안내이며 진단이 아니다. 판단이 어려우면 즉시 소아과 진료
 * 또는 119. 야간·휴일 진료기관은 응급의료포털에서 확인.
 */
export const SOURCE = {
  name: '국가건강정보포털(질병관리청) 소아 발열 · 응급의료포털 E-GEN',
  url: 'https://health.kdca.go.kr',
  urlEgen: 'https://www.e-gen.or.kr',
  checkedAt: '2026-08-19',
};

/* 발열의 일반적 정의: 체온 38.0℃ 이상 (측정 부위에 따라 차이 있음) */
export const FEVER_THRESHOLD = { value: 38.0, unit: '℃', checked: true };

/* 즉시(당일) 진료가 필요한 대표 상황 — 소아 발열 표준 안내에 공통으로 나오는 항목.
 * "기준을 넘지 않으면 안심"이라는 뜻이 아니다. 보호자가 보기에 아이 상태가
 * 평소와 다르게 처지면 체온과 무관하게 진료를 받아야 한다. */
export const URGENT_RULES = [
  { id: 'under90d', cond: '생후 3개월(90일) 미만 + 38.0℃ 이상',
    action: '즉시 진료(응급실 포함). 이 월령의 발열은 검사가 필요한 경우가 많다.', checked: true },
  { id: 'seizure', cond: '경련(열성경련 포함)을 하거나 의식이 처짐',
    action: '즉시 119 또는 응급실.', checked: true },
  { id: 'breathing', cond: '숨쉬기 힘들어함, 입술이 파래짐',
    action: '즉시 119 또는 응급실.', checked: true },
  { id: 'dehydration', cond: '소변량이 크게 줄고 입이 마르는 등 탈수 의심, 수유·수분 섭취 거부',
    action: '당일 진료.', checked: true },
  { id: 'rash', cond: '눌러도 사라지지 않는 발진·자반이 함께 나타남',
    action: '즉시 진료.', checked: true },
  { id: 'persistent', cond: '해열제에도 처지고 반응이 둔함, 심하게 보채고 달래지지 않음',
    action: '당일 진료.', checked: true },
  { id: 'long', cond: '발열이 48~72시간 이상 지속',
    action: '진료를 받아 원인 확인.', checked: false }, // 자료마다 24~72시간으로 상이 → 보수적으로 안내
];

/* 가정 대처 일반 안내 */
export const HOME_CARE = [
  '옷을 가볍게 입히고 실내 온도를 시원하게(과도한 이불·땀 빼기 금지).',
  '수분(모유·분유·물)을 자주 조금씩 보충.',
  '해열제는 소아과에서 안내받은 용법·용량대로만. 이 페이지는 용량을 계산해 주지 않는다.',
  '알코올 마사지·얼음물 목욕은 하지 않는다.',
  '체온과 함께 아이의 전반적인 상태(먹기·놀기·처짐)를 관찰한다.',
];
