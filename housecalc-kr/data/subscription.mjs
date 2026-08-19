// 주택청약 가점제(84점) — 주택공급에 관한 규칙 [별표 1] 확정 산식.
const CHECKED = "2026-08-19";
const SRC = "https://www.law.go.kr/법령/주택공급에관한규칙";

export const subscription = {
  // 무주택기간(최대 32점): 1년 미만 2점, 이후 1년마다 +2점, 15년 이상 32점.
  // 기산일: 만 30세가 된 날(그 전에 혼인 시 혼인신고일). 유주택자 0점.
  noHousePeriod: {
    value: { maxPts: 32, under1yPts: 2, perYearPts: 2, maxYears: 15, baseAge: 30 },
    source: SRC,
    checkedAt: CHECKED,
  },
  // 부양가족(최대 35점): 0명 5점, 1명마다 +5점, 6명 이상 35점 (본인 제외)
  dependents: {
    value: { maxPts: 35, basePts: 5, perPersonPts: 5, maxPersons: 6 },
    source: SRC,
    checkedAt: CHECKED,
  },
  // 청약통장 가입기간(최대 17점): 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 +1점, 15년 이상 17점
  accountPeriod: {
    value: { maxPts: 17, under6mPts: 1, under1yPts: 2, perYearPts: 1, maxYears: 15 },
    source: SRC,
    checkedAt: CHECKED,
  },
  totalMax: {
    value: 84,
    source: SRC,
    checkedAt: CHECKED,
  },
};
