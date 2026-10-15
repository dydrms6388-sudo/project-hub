/* 어린이집 입소 대기 우선순위 점수
 * 출처: 보건복지부 「보육사업안내」 · 임신육아종합포털 아이사랑
 *  - https://www.childcare.go.kr (입소대기 신청·점수 안내)
 *  - 보건복지부 https://www.mohw.go.kr
 * 구조: 1순위 항목은 각 100점으로 합산, 2순위 항목은 50점. 동점이면 신청일 순 등
 * 세부 기준 적용. ⚠ 연도별 「보육사업안내」 개정으로 항목·배점이 바뀔 수 있어
 * 아래 배점은 확인 필요(TODO) 상태로 제공한다 — 실제 입소는 아이사랑 포털 기준.
 */
export const SOURCE = {
  name: '보건복지부 보육사업안내 · 아이사랑 입소대기 점수 안내',
  url: 'https://www.childcare.go.kr',
  checkedAt: '2026-08-19',
  todo: true, // TODO(확인 필요): 최신연도 보육사업안내 배점표와 대조
};

export const PRIORITY_ITEMS = [
  { id: 'basic', rank: 1, points: 100, label: '국민기초생활수급자·차상위계층 등 법정 저소득층', checked: false },
  { id: 'single', rank: 1, points: 100, label: '한부모가족·조손가족의 영유아', checked: false },
  { id: 'dual', rank: 1, points: 100, label: '맞벌이 가구(부모 모두 취업·구직 등)', checked: false },
  { id: 'disab-child', rank: 1, points: 100, label: '장애아 또는 장애부모(정도가 심한 장애)의 자녀', checked: false },
  { id: 'multi', rank: 1, points: 100, label: '다자녀 가구(자녀 수 기준은 지자체·연도별 확인)', checked: false },
  { id: 'sibling', rank: 1, points: 100, label: '형제·자매가 같은 어린이집에 재원 중', checked: false },
  { id: 'multicultural', rank: 1, points: 100, label: '다문화가족의 영유아(요건 확인)', checked: false },
  { id: 'second-rank', rank: 2, points: 50, label: '기타 2순위 해당(한부모·조손 외 부양, 산업단지 입주기업 종사자 등 — 안내문 확인)', checked: false },
];

export const NOTES = [
  '1순위 항목은 중복 시 합산되는 것이 원칙이나, 연도별 보육사업안내의 예외 규정이 있다.',
  '국공립·직장·민간 등 어린이집 유형에 따라 별도 우선순위(직장어린이집의 종사자 자녀 등)가 있다.',
  '실제 대기 순번은 아이사랑 포털(childcare.go.kr)에서 신청·확인해야 한다.',
];
