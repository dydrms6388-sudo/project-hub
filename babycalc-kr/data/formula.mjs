/* 분유 수유량 참고 범위
 * 출처: 질병관리청 국가건강정보포털 '영아 영양(인공수유)' https://health.kdca.go.kr
 * 일반적으로 안내되는 참고 범위이며, 아기마다 필요량 차이가 크다. 수유량·체중 증가가
 * 걱정되면 소아과 진료 시 상담할 것.
 */
export const SOURCE = {
  name: '국가건강정보포털(질병관리청) 영아 영양 안내',
  url: 'https://health.kdca.go.kr',
  checkedAt: '2026-08-19',
};

/* 하루 총 수유량 참고: 체중 1kg당 120~150mL, 하루 최대 약 1,000mL를 넘지 않게 —
 * 국내 육아 안내 자료에서 널리 쓰이는 일반 참고 범위. (개인차 큼) */
export const DAILY_PER_KG = {
  min: 120, max: 150, unit: 'mL/kg/일', dailyCap: 1000,
  note: '일반적 참고 범위. 아기의 성장 곡선과 배고픔 신호가 우선이다.',
  checked: false, // TODO(확인 필요): 국가건강정보포털 원문 문구·수치 대조
};

/* 월령별 1회 수유량·횟수 일반 참고 (분유 제조사·육아 안내서 공통 관행 수준)
 * TODO(확인 필요): 공식 출처 표와 대조 후 checked 갱신 */
export const BY_MONTH = [
  { range: '0~1개월', perFeed: '60~120mL', feeds: '하루 7~8회', checked: false },
  { range: '1~2개월', perFeed: '120~160mL', feeds: '하루 6~7회', checked: false },
  { range: '2~4개월', perFeed: '160~200mL', feeds: '하루 5~6회', checked: false },
  { range: '4~6개월', perFeed: '200~240mL', feeds: '하루 4~5회', checked: false },
  { range: '6개월~', perFeed: '이유식 병행, 200~240mL', feeds: '하루 3~4회', checked: false },
];
