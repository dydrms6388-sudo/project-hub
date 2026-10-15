/**
 * 맵리듀스 요약 오케스트레이션.
 * LLM 호출부는 콜백으로 주입받으므로 이 파일 자체는 브라우저 API 를 쓰지 않는다.
 * (scripts/verify-core.ts 에서 가짜 LLM 을 넣어 노드로 검산한다)
 */

/** 길이 예산 안에서 항목을 순서대로 묶는다. 한 항목이 예산을 넘어도 단독 그룹으로 살린다. */
export function groupByBudget<T>(items: T[], budget: number, len: (t: T) => number): T[][] {
  const groups: T[][] = [];
  let cur: T[] = [];
  let curLen = 0;
  for (const it of items) {
    const l = len(it);
    if (cur.length > 0 && curLen + l > budget) {
      groups.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(it);
    curLen += l;
  }
  if (cur.length > 0) groups.push(cur);
  return groups;
}

/** n개를 groupSize 씩 묶어 1개가 될 때까지 필요한 리듀스 라운드 수. */
export function countReduceRounds(n: number, groupSize: number): number {
  if (n <= 1) return 0;
  const g = Math.max(2, Math.floor(groupSize));
  let rounds = 0;
  let cur = n;
  while (cur > 1) {
    cur = Math.ceil(cur / g);
    rounds++;
  }
  return rounds;
}

export type MapReduceOptions<T> = {
  items: T[];
  /** 각 항목을 요약(map). 반환값은 중간 요약 텍스트. */
  map: (item: T, index: number, total: number) => Promise<string>;
  /**
   * 중간 요약들을 합친다(reduce).
   * isFinal 이 true 면 사용자에게 보여줄 최종 출력이다.
   */
  reduce: (parts: string[], round: number, isFinal: boolean) => Promise<string>;
  /** 한 번의 reduce 에 넣을 중간 요약 총 길이 예산(문자) */
  budget: number;
  onStep?: (done: number, total: number, label: string) => void;
  signal?: { aborted: boolean };
};

export type MapReduceResult = {
  /** 최종 요약 */
  result: string;
  /** map 단계 산출물 */
  mapped: string[];
  /** 수행된 리듀스 라운드 수 */
  rounds: number;
  /** 총 LLM 호출 횟수 */
  calls: number;
};

class AbortedError extends Error {
  constructor() {
    super("작업이 취소되었습니다.");
    this.name = "AbortedError";
  }
}

export function isAborted(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortedError";
}

/**
 * map → (reduce 트리) → 최종 요약.
 * - items 가 1개면 map 결과를 그대로 final reduce 에 통과시킨다(형식 통일).
 * - 그룹이 하나도 줄지 않는 상황(모든 항목이 예산 초과)에서는 2개씩 강제로 묶어
 *   무한 루프를 막는다.
 */
export async function mapReduce<T>(opts: MapReduceOptions<T>): Promise<MapReduceResult> {
  const { items, map, reduce, budget, onStep, signal } = opts;
  const check = () => {
    if (signal?.aborted) throw new AbortedError();
  };
  if (items.length === 0) return { result: "", mapped: [], rounds: 0, calls: 0 };

  // 진행률 총량 추정: map n회 + 리듀스 트리
  const estGroup = Math.max(2, Math.round(budget / 700));
  const totalSteps = items.length + Math.max(1, countReduceRounds(items.length, estGroup));
  let done = 0;
  let calls = 0;

  const mapped: string[] = [];
  for (let i = 0; i < items.length; i++) {
    check();
    const out = await map(items[i], i, items.length);
    calls++;
    mapped.push(out);
    done++;
    onStep?.(done, totalSteps, `부분 요약 ${i + 1}/${items.length}`);
  }

  let parts = mapped.filter((p) => p.trim().length > 0);
  if (parts.length === 0) parts = [""];

  let round = 0;
  // 최종 1개가 남을 때까지 병합
  while (parts.length > 1) {
    check();
    let groups = groupByBudget(parts, budget, (p) => p.length);
    if (groups.length >= parts.length) {
      // 예산이 너무 작아 축소가 안 되는 경우 → 2개씩 강제 병합
      groups = [];
      for (let i = 0; i < parts.length; i += 2) groups.push(parts.slice(i, i + 2));
    }
    const isFinal = groups.length === 1;
    const next: string[] = [];
    for (let g = 0; g < groups.length; g++) {
      check();
      const merged = await reduce(groups[g], round, isFinal);
      calls++;
      next.push(merged);
    }
    parts = next;
    round++;
    done = Math.min(totalSteps - 1, done + 1);
    onStep?.(done, totalSteps, isFinal ? "최종 요약 정리" : `중간 병합 ${round}단계`);
  }

  // 항목이 1개뿐이라 병합 라운드가 없었으면 마지막에 형식 정리를 한 번 돌린다
  let result = parts[0] ?? "";
  if (round === 0) {
    check();
    result = await reduce([result], 0, true);
    calls++;
    round = 1;
  }
  onStep?.(totalSteps, totalSteps, "완료");
  return { result, mapped, rounds: round, calls };
}
