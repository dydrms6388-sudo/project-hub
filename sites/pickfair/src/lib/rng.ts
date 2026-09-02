/**
 * 픽페어 난수 코어 — 외부 의존성 없이 직접 구현한 결정론적 PRNG.
 *
 * seed 문자열 → xmur3 해시(32bit) → mulberry32 수열.
 * 같은 seed 와 같은 salt 를 주면 어떤 기기·어떤 브라우저에서도 완전히 같은 수열이 나온다.
 * 이 성질이 "링크만 있으면 결과를 재현할 수 있다" 는 공정성 증명의 근거다.
 */

/** 문자열 → 32비트 정수 시드 (xmur3) */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — 32비트 상태 PRNG. [0,1) 실수를 돌려준다. */
export function mulberry32(a: number): () => number {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/**
 * seed 문자열과 용도(salt)로부터 난수 생성기를 만든다.
 * salt 를 나누면 같은 seed 안에서도 도구별·단계별로 독립적인 수열을 쓸 수 있다.
 */
export function rngFromSeed(seed: string, salt = ""): Rng {
  return mulberry32(xmur3(`${seed}|${salt}`)());
}

/** min 이상 max 이하 정수 */
export function randInt(rnd: Rng, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** Fisher-Yates — 원본을 건드리지 않는다 */
export function shuffle<T>(arr: readonly T[], rnd: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 가중치 배열에서 인덱스 하나를 고른다 (가중치 합이 0이면 균등) */
export function weightedIndex(weights: readonly number[], rnd: Rng): number {
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rnd() * weights.length);
  let x = rnd() * total;
  for (let i = 0; i < safe.length; i++) {
    x -= safe[i];
    if (x < 0) return i;
  }
  return safe.length - 1;
}

/** 배열에서 하나 고르기 */
export function pick<T>(arr: readonly T[], rnd: Rng): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** 8자리 16진수 seed 생성 (crypto 우선) */
export function newSeed(): string {
  const buf = new Uint8Array(4);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 사용자가 직접 입력한 seed 를 안전한 형태로 정리 */
export function normalizeSeed(raw: string): string {
  const s = raw.trim().replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 32);
  return s || newSeed();
}
