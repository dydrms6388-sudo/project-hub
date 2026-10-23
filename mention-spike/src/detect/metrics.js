// 순수 함수: 코인 하나의 언급 목록 → 최근 구간 / 직전 동일 길이 구간 집계.
// 구간은 반열림 (now-W, now] 과 (now-2W, now-W]. 이벤트 시각은 원천 플랫폼의 작성 시각(createdAt).

export function windowMetrics(mentions, nowMs, windowSec) {
  const W = windowSec * 1000;
  const curStart = nowMs - W;
  const baseStart = nowMs - 2 * W;
  let cur = 0, base = 0;
  const curAuthors = new Set(), baseAuthors = new Set();
  for (const m of mentions) {
    if (m.ts > curStart && m.ts <= nowMs) { cur++; curAuthors.add(m.author); }
    else if (m.ts > baseStart && m.ts <= curStart) { base++; baseAuthors.add(m.author); }
  }
  return { cur, base, curAuthors: curAuthors.size, baseAuthors: baseAuthors.size };
}

// 증가율(%). 기준 0건이면 null — 무한대로 표기하지 않고 classify 에서 NEW_SURGE 로 분류.
export function growthPct(cur, base) {
  if (base === 0) return null;
  return Math.round(((cur - base) / base) * 1000) / 10;
}
