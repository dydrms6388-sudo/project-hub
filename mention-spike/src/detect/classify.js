import { growthPct } from "./metrics.js";

export const KIND = { SPIKE: "SPIKE", NEW_SURGE: "NEW_SURGE" };

// 순수 함수: 구간 집계 + 임계치 → 후보 분류.
// 반환 { kind: "SPIKE" | "NEW_SURGE" | null, growthPct, reason }
// reason 은 후보가 아닐 때 "어느 조건에서 탈락했는지" (UI/감사 로그용).
export function classify(m, th, { fresh = true, warm = true } = {}) {
  const g = growthPct(m.cur, m.base);
  if (!fresh) return { kind: null, growthPct: g, reason: "stale_data" };
  if (!warm) return { kind: null, growthPct: g, reason: "warming_up" };
  if (m.cur < th.minCount) return { kind: null, growthPct: g, reason: "below_min_count" };
  if (m.curAuthors < th.minUniqueAuthors) return { kind: null, growthPct: g, reason: "below_min_authors" };
  if (m.base === 0) return { kind: KIND.NEW_SURGE, growthPct: null, reason: "baseline_zero" };
  if (g >= th.minGrowthPct) return { kind: KIND.SPIKE, growthPct: g, reason: "growth_threshold" };
  return { kind: null, growthPct: g, reason: "below_min_growth" };
}

// 사용자 설정 기준으로 "알림 대상 매칭"인지
export function isAlertMatch(result, th) {
  if (result.kind === KIND.SPIKE) return true;
  if (result.kind === KIND.NEW_SURGE) return th.alertOnNewSurge !== false;
  return false;
}
