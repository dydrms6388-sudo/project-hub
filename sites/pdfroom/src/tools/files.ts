"use client";

/** FileDrop 이 넘겨주는 File[] 과, 도구가 따로 관리하는 "순서/옵션" 목록을 동기화한다. */

export function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

let seq = 0;
/** React key 용 고유 id (같은 파일을 두 번 담아도 충돌하지 않도록) */
export function nextId(): string {
  seq += 1;
  return `f${seq}`;
}

export type WithFile = { id: string; key: string; file: File };

/**
 * FileDrop 은 항상 전체 목록을 통째로 넘겨준다.
 * 기존 항목의 **순서와 옵션은 유지**하고, 새로 들어온 파일만 뒤에 붙이며,
 * 목록에서 빠진 파일은 제거한다. (같은 파일을 여러 번 담은 경우도 개수로 맞춘다)
 */
export function syncOrdered<T extends WithFile>(
  prev: T[],
  incoming: File[],
  make: (f: File, key: string) => T,
): T[] {
  const budget = new Map<string, number>();
  for (const f of incoming) {
    const k = fileKey(f);
    budget.set(k, (budget.get(k) ?? 0) + 1);
  }

  const out: T[] = [];
  for (const p of prev) {
    const left = budget.get(p.key) ?? 0;
    if (left > 0) {
      budget.set(p.key, left - 1);
      out.push(p);
    }
  }
  for (const f of incoming) {
    const k = fileKey(f);
    const left = budget.get(k) ?? 0;
    if (left > 0) {
      budget.set(k, left - 1);
      out.push(make(f, k));
    }
  }
  return out;
}
