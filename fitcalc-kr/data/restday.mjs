// 휴식일 계산 참고 기준 — {value, source, checkedAt} 규율. 전부 "참고" 라벨 대상.
export const CHECKED_AT = "2026-08-19";

// 세션 부하 = 운동시간(분) × 자각 강도(RPE 0~10) — Foster의 session-RPE 방법
export const SESSION_RPE = {
  value: "부하 = 시간(분) × RPE(0~10)",
  source: "https://pubmed.ncbi.nlm.nih.gov/9662687/", // Foster 1998, Med Sci Sports Exerc
  checkedAt: CHECKED_AT,
};

// 단조로움(monotony) = 일 평균 부하 ÷ 표준편차, 스트레인 = 주간 부하 × 단조로움
// monotony 2.0 초과가 지속되면 과훈련 위험 신호로 보는 기준 (Foster 1998)
export const MONOTONY_WARN = {
  value: 2.0,
  source: "https://pubmed.ncbi.nlm.nih.gov/9662687/",
  checkedAt: CHECKED_AT,
};

// 같은 근육군 저항운동 사이 48~72시간 회복 권고 (ACSM 저항운동 진행 모델 포지션 스탠드)
export const MUSCLE_REST_H = {
  value: 48,
  source: "https://pubmed.ncbi.nlm.nih.gov/19204579/", // ACSM Position Stand 2009
  checkedAt: CHECKED_AT,
};

// 급성:만성 부하비(ACWR) 0.8~1.3 구간을 '스위트 스팟'으로 보는 참고 기준 (Gabbett 2016)
export const ACWR_SWEET = {
  value: [0.8, 1.3],
  source: "https://pubmed.ncbi.nlm.nih.gov/26758673/",
  checkedAt: CHECKED_AT,
};

// 주당 완전 휴식일 1~2일 권고 — 널리 통용되는 코칭 관행이지만 단일 공신력 출처 미확정.
// TODO: 확인 필요 — UI에 "확인 필요" 배지.
export const WEEKLY_REST_DAYS = {
  value: [1, 2],
  needsCheck: true,
  todo: "주당 완전 휴식일 1~2일 권고의 공신력 있는 단일 출처 확인 필요",
  source: "",
  checkedAt: CHECKED_AT,
};
