/* 소아 성장도표 LMS 값 (백분위·z점수 계산용)
 *
 * 근거: 질병관리청·대한소아과학회 「2017 소아청소년 성장도표」는 0~35개월 구간에
 * WHO Child Growth Standards(2006)를 그대로 채택했다. 따라서 0~35개월 LMS 값은
 * WHO 표준 성장도표의 LMS 값과 동일하다.
 * 출처(원표 확인):
 *  - 질병관리청 2017 소아청소년 성장도표: https://knhanes.kdca.go.kr
 *  - WHO Child Growth Standards (LMS 표): https://www.who.int/tools/child-growth-standards/standards
 *
 * 데이터 규율: 아래 표에는 "원표와 대조해 확실한 값"만 checked:true 로 기입했다.
 * checked:false(TODO) 월령은 L·S 미기입 → UI에서 백분위 계산 대신 "확인 필요" 배지를
 * 표시하고, 기입된 중앙값(M)이 있으면 참고 비교만 제공한다. 값을 추정하여 채우지 말 것.
 * TODO: 4~35개월 전체 월령의 LMS 값을 질병관리청 원표(엑셀)에서 옮겨 채우기.
 */
export const SOURCE = {
  name: '질병관리청 2017 소아청소년 성장도표 (0~35개월: WHO Child Growth Standards)',
  url: 'https://knhanes.kdca.go.kr',
  urlWho: 'https://www.who.int/tools/child-growth-standards/standards',
  checkedAt: '2026-08-19',
};

/* 구조: GROWTH[measure][sex] = [{m(개월), L, M, S, checked}] — m 오름차순.
 * measure: weight(kg) | length(cm, 누운키) | head(cm, 머리둘레)
 * sex: boy | girl
 */
export const GROWTH = {
  weight: {
    boy: [
      { m: 0, L: 0.3487, M: 3.3464, S: 0.14602, checked: true },
      { m: 1, L: 0.2297, M: 4.4709, S: 0.13395, checked: true },
      { m: 2, L: 0.1970, M: 5.5675, S: 0.12385, checked: true },
      { m: 3, L: 0.1738, M: 6.3762, S: 0.11727, checked: true },
      // TODO(확인 필요): 4~35개월 L·S — 원표 대조 후 기입. M(중앙값)만 참고 표기.
      { m: 6, M: 7.9340, checked: false },
      { m: 12, M: 9.6479, checked: false },
      { m: 24, M: 12.1515, checked: false },
    ],
    girl: [
      { m: 0, L: 0.3809, M: 3.2322, S: 0.14171, checked: true },
      { m: 1, L: 0.1714, M: 4.1873, S: 0.13724, checked: true },
      { m: 2, L: 0.0962, M: 5.1282, S: 0.13000, checked: true },
      { m: 3, L: 0.0402, M: 5.8458, S: 0.12619, checked: true },
      // TODO(확인 필요): 4~35개월 L·S — 원표 대조 후 기입.
      { m: 6, M: 7.2970, checked: false },
      { m: 12, M: 8.9481, checked: false },
      { m: 24, M: 11.4775, checked: false },
    ],
  },
  length: {
    /* WHO 신장(누운키)-연령 LMS: 전 월령 L=1 */
    boy: [
      { m: 0, L: 1, M: 49.8842, S: 0.03795, checked: true },
      { m: 1, L: 1, M: 54.7244, S: 0.03557, checked: true },
      { m: 2, L: 1, M: 58.4249, S: 0.03424, checked: true },
      { m: 3, L: 1, M: 61.4292, S: 0.03328, checked: true },
      // TODO(확인 필요): 4~35개월 M·S — 원표 대조 후 기입.
    ],
    girl: [
      { m: 0, L: 1, M: 49.1477, S: 0.03790, checked: true },
      { m: 1, L: 1, M: 53.6872, S: 0.03640, checked: true },
      { m: 2, L: 1, M: 57.0673, S: 0.03568, checked: true },
      { m: 3, L: 1, M: 59.8029, S: 0.03520, checked: true },
      // TODO(확인 필요): 4~35개월 M·S — 원표 대조 후 기입.
    ],
  },
  head: {
    boy: [
      { m: 0, L: 1, M: 34.4618, S: 0.03686, checked: true },
      // TODO(확인 필요): 1~35개월 — 원표 대조 후 기입.
    ],
    girl: [
      { m: 0, L: 1, M: 33.8787, S: 0.03496, checked: true },
      // TODO(확인 필요): 1~35개월 — 원표 대조 후 기입.
    ],
  },
};

export const MEASURE_LABEL = { weight: '몸무게(kg)', length: '키/누운키(cm)', head: '머리둘레(cm)' };

/** 해당 월령에 사용할 수 있는 checked 행 반환(정확 일치만, 보간 없음) */
export function findRow(measure, sex, month) {
  const rows = (GROWTH[measure] && GROWTH[measure][sex]) || [];
  return rows.find((r) => r.m === month) || null;
}

/** checked(정밀 계산 가능) 월령 목록 */
export function checkedMonths(measure, sex) {
  return ((GROWTH[measure] && GROWTH[measure][sex]) || []).filter((r) => r.checked).map((r) => r.m);
}
