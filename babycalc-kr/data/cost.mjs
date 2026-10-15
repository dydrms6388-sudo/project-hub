/* 육아 비용 항목 + 정부 지원금
 * 지원금 출처: 복지로 https://www.bokjiro.go.kr (부모급여·아동수당·첫만남이용권)
 * ⚠ 금액은 2025년 기준 확인값이며, 2026년 개정 여부는 확인 필요(TODO).
 *   예산·법 개정으로 바뀔 수 있으므로 신청 전 복지로에서 반드시 확인.
 */
export const SOURCE = {
  name: '복지로(보건복지부) — 부모급여·아동수당·첫만남이용권',
  url: 'https://www.bokjiro.go.kr',
  checkedAt: '2026-08-19',
};

export const SUPPORTS = [
  { id: 'parent-benefit-0', name: '부모급여 (0~11개월)', monthly: 1000000,
    note: '2025년 기준 월 100만원(0세). 어린이집 이용 시 보육료 바우처로 차감 지급.',
    checked: false, todo: '2026년 금액 확인 필요' },
  { id: 'parent-benefit-1', name: '부모급여 (12~23개월)', monthly: 500000,
    note: '2025년 기준 월 50만원(1세).',
    checked: false, todo: '2026년 금액 확인 필요' },
  { id: 'child-allowance', name: '아동수당 (만 8세 미만)', monthly: 100000,
    note: '월 10만원. 부모급여와 중복 수급 가능.',
    checked: false, todo: '2026년 지급 연령·금액 확인 필요' },
  { id: 'first-meeting', name: '첫만남이용권 (일시금)', once: 2000000,
    note: '첫째 200만원, 둘째 이상 300만원 바우처(2025년 기준).',
    checked: false, todo: '2026년 금액 확인 필요' },
];

/* 월 지출 항목 프리셋 — 참고용 기본값(가정별 편차 매우 큼, 통계 아님) */
export const COST_ITEMS = [
  { id: 'formula', name: '분유·수유용품', hint: '분유 월 2~4캔 등' },
  { id: 'diaper', name: '기저귀·물티슈', hint: '' },
  { id: 'weaning', name: '이유식 재료·용품', hint: '' },
  { id: 'clothes', name: '의류·잡화', hint: '계절별 편차 큼' },
  { id: 'medical', name: '병원·약·영양제', hint: '' },
  { id: 'toys', name: '장난감·도서', hint: '' },
  { id: 'care', name: '돌봄·기관 비용', hint: '어린이집 특별활동비 등' },
  { id: 'insurance', name: '태아·어린이보험', hint: '' },
  { id: 'etc', name: '기타', hint: '사진·외출 등' },
];
