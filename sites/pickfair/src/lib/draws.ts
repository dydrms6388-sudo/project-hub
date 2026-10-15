/**
 * 도구별 추첨 로직 — 전부 (seed, 입력) 의 순수 함수.
 * UI 와 분리해 두어야 "같은 링크 = 같은 결과" 를 코드 수준에서 검증할 수 있다.
 * (scripts/verify-repro.mjs 가 이 모듈을 그대로 돌려 재현성을 확인한다)
 */
import { randInt, rngFromSeed, shuffle, weightedIndex } from "./rng";

/* ── 사다리타기 ─────────────────────────────────────────────── */

export function buildLadder(seed: string, cols: number) {
  const rnd = rngFromSeed(seed, "ladder");
  const rows = Math.min(30, Math.max(9, cols * 2 + 1));
  const rungs: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = new Array(Math.max(0, cols - 1)).fill(false);
    for (let i = 0; i < cols - 1; i++) {
      if (i > 0 && row[i - 1]) continue; // 같은 행에서 가로줄이 붙지 않게
      if (rnd() < 0.45) row[i] = true;
    }
    rungs.push(row);
  }
  return { rows, rungs };
}

export function traceLadder(rungs: boolean[][], start: number) {
  const steps: { row: number; from: number; to: number }[] = [];
  let c = start;
  for (let r = 0; r < rungs.length; r++) {
    const row = rungs[r];
    if (c > 0 && row[c - 1]) {
      steps.push({ row: r, from: c, to: c - 1 });
      c -= 1;
    } else if (c < row.length && row[c]) {
      steps.push({ row: r, from: c, to: c + 1 });
      c += 1;
    }
  }
  return { end: c, steps };
}

/* ── 팀 나누기 ─────────────────────────────────────────────── */

export type TeamInput = { n: string[]; k: number; sz: number[] | null; fb: [string, string][] };

export function teamCapacities(d: TeamInput, seed: string): number[] {
  if (d.sz) {
    const total = d.sz.reduce((a, b) => a + b, 0);
    if (total >= d.n.length) return d.sz.slice();
  }
  const base = Math.floor(d.n.length / d.k);
  const rest = d.n.length - base * d.k;
  const caps: number[] = new Array(d.k).fill(base);
  const order = shuffle(
    Array.from({ length: d.k }, (_, i) => i),
    rngFromSeed(seed, "team-caps"),
  );
  for (let i = 0; i < rest; i++) caps[order[i]] += 1;
  return caps;
}

export function splitTeams(d: TeamInput, seed: string) {
  const caps = teamCapacities(d, seed);
  const rnd = rngFromSeed(seed, "team-split");
  const forbid = new Map<string, Set<string>>();
  for (const [a, b] of d.fb) {
    if (a === b) continue;
    if (!forbid.has(a)) forbid.set(a, new Set());
    if (!forbid.has(b)) forbid.set(b, new Set());
    forbid.get(a)!.add(b);
    forbid.get(b)!.add(a);
  }

  const MAX_TRY = 400;
  for (let t = 0; t < MAX_TRY; t++) {
    const order = shuffle(d.n, rnd);
    const teams: string[][] = Array.from({ length: d.k }, () => []);
    let ok = true;
    for (const person of order) {
      const enemies = forbid.get(person);
      const cand = teams
        .map((tm, i) => ({ i, room: caps[i] - tm.length, tm }))
        .filter((c) => c.room > 0 && (!enemies || !c.tm.some((m) => enemies.has(m))))
        .sort((a, b) => b.room - a.room);
      if (cand.length === 0) {
        ok = false;
        break;
      }
      const best = cand.filter((c) => c.room === cand[0].room);
      teams[best[Math.floor(rnd() * best.length)].i].push(person);
    }
    if (ok) return { teams, constrained: true, tries: t + 1 };
  }

  const order = shuffle(d.n, rngFromSeed(seed, "team-fallback"));
  const teams: string[][] = Array.from({ length: d.k }, () => []);
  let idx = 0;
  for (let i = 0; i < d.k; i++) {
    for (let j = 0; j < caps[i] && idx < order.length; j++) teams[i].push(order[idx++]);
  }
  while (idx < order.length) teams[idx % d.k].push(order[idx++]);
  return { teams, constrained: false, tries: MAX_TRY };
}

/* ── 자리 배치 ─────────────────────────────────────────────── */

export type SeatInput = { r: number; c: number; n: string[]; b: number[] };

export function seatLayout(d: SeatInput, seed: string): (string | null)[] {
  const total = d.r * d.c;
  const blocked = new Set(d.b);
  const open: number[] = [];
  for (let i = 0; i < total; i++) if (!blocked.has(i)) open.push(i);
  const picked = shuffle(open, rngFromSeed(seed, "seat")).slice(0, d.n.length);
  const grid: (string | null)[] = new Array(total).fill(null);
  picked.forEach((cell, i) => {
    grid[cell] = d.n[i];
  });
  return grid;
}

/* ── 숫자 뽑기 ─────────────────────────────────────────────── */

export type NumberInputSpec = { lo: number; hi: number; c: number; dup: boolean; sort: boolean };

export function drawNumbers(d: NumberInputSpec, seed: string): number[] {
  const rnd = rngFromSeed(seed, "number-pick");
  const out: number[] = [];
  if (d.dup) {
    for (let i = 0; i < d.c; i++) out.push(randInt(rnd, d.lo, d.hi));
  } else {
    const size = d.hi - d.lo + 1;
    if (size <= 20000) {
      const pool = Array.from({ length: size }, (_, i) => d.lo + i);
      for (let i = 0; i < d.c; i++) {
        const j = i + Math.floor(rnd() * (size - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
        out.push(pool[i]);
      }
    } else {
      const seen = new Set<number>();
      while (out.length < d.c) {
        const v = randInt(rnd, d.lo, d.hi);
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
      }
    }
  }
  return d.sort ? out.slice().sort((a, b) => a - b) : out;
}

/* ── 주사위 / 순서 / 제비 / 벌칙 / 룰렛 ─────────────────────── */

export function rollDice(seed: string, count: number, faces: number): number[] {
  const rnd = rngFromSeed(seed, "dice");
  return Array.from({ length: count }, () => randInt(rnd, 1, faces));
}

export function makeOrder(seed: string, names: string[]): string[] {
  return shuffle(names, rngFromSeed(seed, "order"));
}

export function drawNames(seed: string, names: string[], count: number): string[] {
  return shuffle(names, rngFromSeed(seed, "name-draw")).slice(0, count);
}

export function drawPenalties(seed: string, items: string[], count: number): string[] {
  return shuffle(items, rngFromSeed(seed, "penalty")).slice(0, count);
}

export function decideYesNo(seed: string, percent: number): boolean {
  return rngFromSeed(seed, "yes-no")() * 100 < percent;
}

export function spinRoulette(seed: string, weights: number[]): number {
  return weightedIndex(weights, rngFromSeed(seed, "roulette"));
}
