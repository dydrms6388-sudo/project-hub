/**
 * 중복 제거 — 제품 신뢰의 전부 (스펙 4-1).
 *
 * 같은 결제가 두 건으로 보이는 순간 사용자는 앱을 지운다. 반대로 서로 다른
 * 결제를 하나로 합쳐버리면 되돌릴 수 없다. 그래서 규칙을 좁게 잡고,
 * 애매한 경우는 "합치지 않는다"가 아니라 "삽입을 건너뛴다"로 처리한다.
 */
import { kstStampDay, kstStampMinute } from './datetime.js';
import { merchantHead8 } from './merchant.js';
import { sha256Hex } from './sha256.js';

export interface DedupeInput {
  accountLast4: string | null;
  occurredAt: string;
  /** 원문에 시:분이 있었는지. 명세서 업로드는 대개 false. */
  hasTime: boolean;
  amount: number;
  merchantNormalized: string;
  /**
   * 승인취소는 원거래와 날짜·금액·상호가 같을 수 있다.
   * 플래그를 키에 넣지 않으면 취소 건이 원거래로 오인되어 삼켜진다.
   */
  isCancellation: boolean;
}

/**
 * dedupe_key = sha256(`${last4}|${stamp}|${amount}|${head8}|${cancel}`)
 *
 * - 시각이 있으면 분 단위(yyyyMMddHHmm)까지, 없으면 일 단위(yyyyMMdd)까지 쓴다.
 *   초는 소스마다 달라서 신뢰할 수 없다.
 * - head8 = 정규화 상호명 앞 8자
 */
export function makeDedupeKey(input: DedupeInput): string {
  const stamp = input.hasTime ? kstStampMinute(input.occurredAt) : kstStampDay(input.occurredAt);
  const last4 = input.accountLast4 ?? '';
  const head8 = merchantHead8(input.merchantNormalized);
  const cancel = input.isCancellation ? 'C' : 'N';
  return sha256Hex(`${last4}|${stamp}|${input.amount}|${head8}|${cancel}`);
}

/** 일 단위 느슨한 매칭 키. 시각 유무가 다른 두 소스를 잇는 다리. */
export function looseKey(input: DedupeInput): string {
  const last4 = input.accountLast4 ?? '';
  const head8 = merchantHead8(input.merchantNormalized);
  const cancel = input.isCancellation ? 'C' : 'N';
  return `${last4}|${kstStampDay(input.occurredAt)}|${input.amount}|${head8}|${cancel}`;
}

export interface DedupeRecord extends DedupeInput {
  dedupeKey: string;
}

export interface DedupeIndex<T extends DedupeRecord> {
  byKey: Map<string, T>;
  byLoose: Map<string, T[]>;
}

/**
 * 기존 거래로 조회 인덱스를 만든다.
 * 거래 10,000건에서도 후보당 O(1)이 되도록 미리 해시해 둔다 (스펙 10장 성능 감사관).
 */
export function buildDedupeIndex<T extends DedupeRecord>(records: readonly T[]): DedupeIndex<T> {
  const byKey = new Map<string, T>();
  const byLoose = new Map<string, T[]>();
  for (const record of records) {
    if (!byKey.has(record.dedupeKey)) byKey.set(record.dedupeKey, record);
    const lk = looseKey(record);
    const bucket = byLoose.get(lk);
    if (bucket) bucket.push(record);
    else byLoose.set(lk, [record]);
  }
  return { byKey, byLoose };
}

export type DuplicateReason = 'exact' | 'same_day';

export interface DuplicateMatch<T> {
  existing: T;
  reason: DuplicateReason;
}

/**
 * 후보가 기존 거래와 중복인지 판정한다.
 *
 * 1. dedupe_key 완전 일치 → 같은 거래. (같은 문자를 두 번 붙여넣은 경우)
 * 2. 같은 날짜·금액·상호·카드 → 같은 거래로 본다. 승인문자(시각 있음)와
 *    명세서 업로드(시각 없음)가 겹치는 경우가 여기 걸린다.
 *    양방향으로 적용한다. 어느 쪽이 먼저 들어왔든 두 번 세면 안 되기 때문이다.
 *
 * 시각이 둘 다 있는데 분이 다르면 서로 다른 결제로 본다.
 * 같은 가맹점에서 같은 금액을 연달아 두 번 긁는 일은 실제로 일어난다.
 */
export function findDuplicate<T extends DedupeRecord>(
  candidate: DedupeInput,
  index: DedupeIndex<T>,
): DuplicateMatch<T> | null {
  const key = makeDedupeKey(candidate);
  const exact = index.byKey.get(key);
  if (exact) return { existing: exact, reason: 'exact' };

  const bucket = index.byLoose.get(looseKey(candidate));
  if (!bucket) return null;

  for (const existing of bucket) {
    // 둘 다 시각을 가지고 있는데 분이 다르면 별개의 결제다.
    if (candidate.hasTime && existing.hasTime) continue;
    return { existing, reason: 'same_day' };
  }
  return null;
}

/**
 * 승인취소 건에 대응하는 원거래를 찾는다 (스펙 4-1: "원거래 dedupe_key 매칭해서 상계").
 *
 * 취소 문자는 원결제보다 늦게 오고 날짜가 다를 수 있으므로 날짜 대신
 * 카드·금액·상호로 맞추고, 창(window) 안에서 가장 최근 원거래를 고른다.
 * 부분취소는 금액이 다르므로 여기서 매칭되지 않는다 — 별도 거래로 남고
 * 합계는 signedAmount 로 자연히 상계된다.
 */
export function findCancellationTarget<T extends DedupeRecord>(
  cancellation: DedupeInput,
  records: readonly T[],
  windowDays = 90,
): T | null {
  if (!cancellation.isCancellation) return null;
  const head8 = merchantHead8(cancellation.merchantNormalized);
  const cancelledAt = new Date(cancellation.occurredAt).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  let best: T | null = null;
  let bestTime = -Infinity;
  for (const record of records) {
    if (record.isCancellation) continue;
    if (record.amount !== cancellation.amount) continue;
    if ((record.accountLast4 ?? '') !== (cancellation.accountLast4 ?? '')) continue;
    if (merchantHead8(record.merchantNormalized) !== head8) continue;
    const t = new Date(record.occurredAt).getTime();
    if (t > cancelledAt) continue;
    if (cancelledAt - t > windowMs) continue;
    if (t > bestTime) {
      best = record;
      bestTime = t;
    }
  }
  return best;
}
