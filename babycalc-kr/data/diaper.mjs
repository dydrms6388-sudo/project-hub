/* 기저귀 사이즈 참고표
 * 일반적으로 통용되는 체중 구간(브랜드 공통 관행). 브랜드·라인별 실제 구간은
 * 제조사 공식 표가 우선이며 서로 다르다 → 구매 전 공식 사이즈표 확인 필수.
 * TODO(확인 필요): 브랜드별(하기스·팸퍼스·군·마미포코 등) 공식 사이즈표 URL 대조 후
 * 브랜드 표 추가. 아래 표는 "일반 참고 구간"이다.
 */
export const SOURCE = {
  name: '브랜드 공통 관행 기준 일반 참고 구간 (브랜드 공식표 확인 필요)',
  url: 'https://www.huggies.co.kr',
  checkedAt: '2026-08-19',
};

export const GENERIC_SIZES = [
  { size: '신생아(NB)', min: 0, max: 4.5, note: '약 4.5kg까지', checked: false },
  { size: '소형(S)', min: 3, max: 7, note: '약 3~7kg', checked: false },
  { size: '중형(M)', min: 6, max: 11, note: '약 6~11kg', checked: false },
  { size: '대형(L)', min: 9, max: 14, note: '약 9~14kg', checked: false },
  { size: '특대형(XL)', min: 12, max: 17, note: '약 12~17kg', checked: false },
  { size: '점보(XXL)', min: 15, max: 30, note: '약 15kg 이상', checked: false },
];

export const FIT_TIPS = [
  '허벅지·허리에 붉은 자국이 남으면 한 단계 올릴 때가 됐다는 신호.',
  '체중이 구간에 걸치면 활동량이 많은 아기는 큰 사이즈가 새는 일이 적은 편.',
  '밤 기저귀는 흡수량 기준으로 한 단계 크게 쓰는 경우가 많다.',
  '같은 표기 사이즈라도 브랜드마다 실제 크기가 달라 샘플로 먼저 테스트 권장.',
];
