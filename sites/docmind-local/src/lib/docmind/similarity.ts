/**
 * 벡터 유사도 — 순수 함수. RAG 검색(top-k)에 쓴다.
 * 코사인 유사도 = (a·b) / (|a||b|). 동일 벡터면 1, 직교면 0, 반대면 -1.
 */

export type Vector = number[] | Float32Array;

export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error(`벡터 차원 불일치: ${a.length} vs ${b.length}`);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

/** 코사인 유사도. 영벡터가 끼면 0을 돌려준다(0으로 나누기 방지). */
export function cosine(a: Vector, b: Vector): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  const v = dot(a, b) / (na * nb);
  // 부동소수 오차로 |v| 가 1을 아주 살짝 넘는 것을 막는다
  return Math.max(-1, Math.min(1, v));
}

/** L2 정규화된 복사본. 정규화 후에는 내적 = 코사인 유사도. */
export function normalizeVector(a: Vector): number[] {
  const n = norm(a);
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = n === 0 ? 0 : a[i] / n;
  return out;
}

export type Scored<T> = T & { score: number };

/**
 * 코사인 유사도 상위 k개. 동점이면 원래 순서를 유지한다(안정 정렬).
 * @param minScore 이 값 미만은 버린다(기본 -Infinity)
 */
export function topK<T extends { vector: Vector }>(
  query: Vector,
  items: T[],
  k: number,
  minScore = Number.NEGATIVE_INFINITY,
): Scored<T>[] {
  if (k <= 0 || items.length === 0) return [];
  const scored = items.map((it, i) => ({ it, i, score: cosine(query, it.vector) }));
  scored.sort((a, b) => (b.score === a.score ? a.i - b.i : b.score - a.score));
  return scored
    .filter((s) => s.score >= minScore)
    .slice(0, k)
    .map((s) => ({ ...s.it, score: s.score }));
}

/**
 * MMR(Maximal Marginal Relevance) 로 중복이 적은 top-k 를 뽑는다.
 * lambda=1 이면 순수 유사도, 0 이면 순수 다양성.
 */
export function mmr<T extends { vector: Vector }>(
  query: Vector,
  items: T[],
  k: number,
  lambda = 0.7,
): Scored<T>[] {
  const pool = items.map((it, i) => ({ it, i, score: cosine(query, it.vector) }));
  const picked: { it: T; i: number; score: number }[] = [];
  while (picked.length < Math.min(k, pool.length)) {
    let best: (typeof pool)[number] | null = null;
    let bestVal = Number.NEGATIVE_INFINITY;
    for (const cand of pool) {
      if (picked.some((p) => p.i === cand.i)) continue;
      let maxSim = 0;
      for (const p of picked) {
        const s = cosine(cand.it.vector, p.it.vector);
        if (s > maxSim) maxSim = s;
      }
      const val = lambda * cand.score - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        best = cand;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked.map((p) => ({ ...p.it, score: p.score }));
}
