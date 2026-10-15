/* 영유아 수면 권장 시간
 * 확정 출처: 미국수면재단(National Sleep Foundation) 2015 연령별 권장 수면시간
 *  - Hirshkowitz M, et al. "National Sleep Foundation's sleep time duration
 *    recommendations". Sleep Health. 2015.
 *  - https://www.sleepfoundation.org/how-sleep-works/how-much-sleep-do-we-really-need
 * 낮잠 횟수·깨어있는 시간(wake window)은 공식 표준이 없는 일반적 육아 참고 범위 →
 * checked:false 로 표기.
 */
export const SOURCE = {
  name: '미국수면재단(NSF) 2015 연령별 권장 수면시간',
  url: 'https://www.sleepfoundation.org/how-sleep-works/how-much-sleep-do-we-really-need',
  checkedAt: '2026-08-19',
};

/* 하루 총 수면(낮잠 포함) 권장 범위 — NSF 2015 (checked) */
export const TOTAL_SLEEP = [
  { range: '0~3개월', fromM: 0, toM: 3, hours: '14~17시간', checked: true },
  { range: '4~11개월', fromM: 4, toM: 11, hours: '12~15시간', checked: true },
  { range: '1~2세', fromM: 12, toM: 35, hours: '11~14시간', checked: true },
  { range: '3~5세', fromM: 36, toM: 71, hours: '10~13시간', checked: true },
];

/* 낮잠 횟수·깨어있는 시간 — 일반적 육아 참고(공식 표준 아님, 개인차 큼) */
export const NAP_GUIDE = [
  { range: '0~2개월', fromM: 0, toM: 2, naps: '4회 이상(불규칙)', wake: '약 45~60분', checked: false },
  { range: '3~4개월', fromM: 3, toM: 4, naps: '3~4회', wake: '약 1~2시간', checked: false },
  { range: '5~8개월', fromM: 5, toM: 8, naps: '2~3회', wake: '약 2~3시간', checked: false },
  { range: '9~12개월', fromM: 9, toM: 12, naps: '2회', wake: '약 3~4시간', checked: false },
  { range: '13~17개월', fromM: 13, toM: 17, naps: '1~2회', wake: '약 4~5시간', checked: false },
  { range: '18~35개월', fromM: 18, toM: 35, naps: '1회', wake: '약 5~6시간', checked: false },
];
