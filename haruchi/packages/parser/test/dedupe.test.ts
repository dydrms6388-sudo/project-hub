import { describe, expect, it } from 'vitest';
import {
  buildDedupeIndex,
  findCancellationTarget,
  findDuplicate,
  makeDedupeKey,
  type DedupeInput,
  type DedupeRecord,
} from '../src/lib/dedupe.js';

/** KST 2026-08-11 12:30 */
const T1230 = '2026-08-11T03:30:00.000Z';
/** KST 2026-08-11 12:31 */
const T1231 = '2026-08-11T03:31:00.000Z';
/** KST 2026-08-11 00:00 (시각 없는 소스가 쓰는 값) */
const DAY_ONLY = '2026-08-10T15:00:00.000Z';

function input(overrides: Partial<DedupeInput> = {}): DedupeInput {
  return {
    accountLast4: '1234',
    occurredAt: T1230,
    hasTime: true,
    amount: 12000,
    merchantNormalized: '스타벅스강남2호점',
    isCancellation: false,
    ...overrides,
  };
}

function record(overrides: Partial<DedupeInput> = {}): DedupeRecord {
  const base = input(overrides);
  return { ...base, dedupeKey: makeDedupeKey(base) };
}

describe('makeDedupeKey', () => {
  it('같은 거래는 같은 키를 만든다', () => {
    expect(makeDedupeKey(input())).toBe(makeDedupeKey(input()));
  });

  it('sha256 hex 형식이다', () => {
    expect(makeDedupeKey(input())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('금액이 다르면 키가 다르다', () => {
    expect(makeDedupeKey(input())).not.toBe(makeDedupeKey(input({ amount: 12001 })));
  });

  it('카드 뒤 4자리가 다르면 키가 다르다', () => {
    expect(makeDedupeKey(input())).not.toBe(makeDedupeKey(input({ accountLast4: '9999' })));
  });

  it('카드 뒤 4자리가 없으면 빈 문자열로 취급한다', () => {
    expect(makeDedupeKey(input({ accountLast4: null }))).toBe(
      makeDedupeKey(input({ accountLast4: null })),
    );
    expect(makeDedupeKey(input({ accountLast4: null }))).not.toBe(makeDedupeKey(input()));
  });

  it('상호명 앞 8자가 같으면 뒤가 달라도 같은 키다', () => {
    expect(makeDedupeKey(input({ merchantNormalized: '스타벅스강남2호점' }))).toBe(
      makeDedupeKey(input({ merchantNormalized: '스타벅스강남2호점역삼지점' })),
    );
  });

  it('상호명 앞 8자가 다르면 다른 키다', () => {
    expect(makeDedupeKey(input())).not.toBe(
      makeDedupeKey(input({ merchantNormalized: '투썸플레이스강남' })),
    );
  });

  it('분이 다르면 다른 키다', () => {
    expect(makeDedupeKey(input())).not.toBe(makeDedupeKey(input({ occurredAt: T1231 })));
  });

  it('초 단위 차이는 무시한다', () => {
    expect(makeDedupeKey(input({ occurredAt: '2026-08-11T03:30:59.000Z' }))).toBe(
      makeDedupeKey(input({ occurredAt: T1230 })),
    );
  });

  it('시각 없는 소스는 일 단위 키를 쓴다', () => {
    const a = makeDedupeKey(input({ hasTime: false, occurredAt: DAY_ONLY }));
    const b = makeDedupeKey(input({ hasTime: false, occurredAt: '2026-08-10T20:00:00.000Z' }));
    expect(a).toBe(b);
  });

  it('취소 건은 원거래와 키가 다르다 — 취소가 원거래에 삼켜지면 안 된다', () => {
    expect(makeDedupeKey(input())).not.toBe(makeDedupeKey(input({ isCancellation: true })));
  });

  it('KST 기준으로 날짜가 갈린다 (UTC 15:00 = 다음날 00:00 KST)', () => {
    const kstAug11 = makeDedupeKey(input({ hasTime: false, occurredAt: '2026-08-10T15:00:00.000Z' }));
    const kstAug10 = makeDedupeKey(input({ hasTime: false, occurredAt: '2026-08-10T14:59:00.000Z' }));
    expect(kstAug11).not.toBe(kstAug10);
  });
});

describe('findDuplicate', () => {
  it('같은 문자를 두 번 붙여넣으면 exact 중복이다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input(), index)).toMatchObject({ reason: 'exact' });
  });

  it('처음 보는 거래는 중복이 아니다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input({ amount: 5000 }), index)).toBeNull();
  });

  it('명세서(시각 없음)가 나중에 들어오면 승인문자와 같은 건으로 본다', () => {
    const index = buildDedupeIndex([record()]);
    const fromImport = input({ hasTime: false, occurredAt: DAY_ONLY });
    expect(findDuplicate(fromImport, index)).toMatchObject({ reason: 'same_day' });
  });

  it('명세서가 먼저 들어와 있어도 승인문자를 중복으로 잡는다', () => {
    const index = buildDedupeIndex([record({ hasTime: false, occurredAt: DAY_ONLY })]);
    expect(findDuplicate(input(), index)).toMatchObject({ reason: 'same_day' });
  });

  it('둘 다 시각이 있고 분이 다르면 별개의 결제다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input({ occurredAt: T1231 }), index)).toBeNull();
  });

  it('같은 가맹점에서 같은 금액을 연달아 두 번 긁은 경우를 합치지 않는다', () => {
    const index = buildDedupeIndex([record(), record({ occurredAt: T1231 })]);
    expect(index.byKey.size).toBe(2);
  });

  it('카드가 다르면 중복이 아니다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input({ accountLast4: '9999' }), index)).toBeNull();
  });

  it('날짜가 다르면 중복이 아니다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input({ occurredAt: '2026-08-12T03:30:00.000Z' }), index)).toBeNull();
  });

  it('취소 건은 원거래와 중복으로 잡히지 않는다', () => {
    const index = buildDedupeIndex([record()]);
    expect(findDuplicate(input({ isCancellation: true }), index)).toBeNull();
  });

  it('상호명 앞 8자가 같으면 같은 건으로 본다', () => {
    const index = buildDedupeIndex([record()]);
    const variant = input({ merchantNormalized: '스타벅스강남2호점본점' });
    expect(findDuplicate(variant, index)).toMatchObject({ reason: 'exact' });
  });

  it('빈 인덱스에서는 항상 null 이다', () => {
    expect(findDuplicate(input(), buildDedupeIndex([]))).toBeNull();
  });

  it('같은 키가 여러 번 들어와도 인덱스는 첫 항목을 유지한다', () => {
    const first = { ...record(), tag: 'first' };
    const second = { ...record(), tag: 'second' };
    const index = buildDedupeIndex([first, second]);
    expect(findDuplicate(input(), index)?.existing).toMatchObject({ tag: 'first' });
  });
});

describe('findCancellationTarget', () => {
  const original = record({ occurredAt: '2026-08-11T03:30:00.000Z' });

  it('같은 카드·금액·상호의 원거래를 찾는다', () => {
    const cancel = input({ isCancellation: true, occurredAt: '2026-08-12T05:00:00.000Z' });
    expect(findCancellationTarget(cancel, [original])).toBe(original);
  });

  it('부분취소(금액이 다름)는 원거래로 매칭하지 않는다', () => {
    const partial = input({
      isCancellation: true,
      amount: 5000,
      occurredAt: '2026-08-12T05:00:00.000Z',
    });
    expect(findCancellationTarget(partial, [original])).toBeNull();
  });

  it('취소가 아닌 입력에는 null 을 돌려준다', () => {
    expect(findCancellationTarget(input(), [original])).toBeNull();
  });

  it('원거래가 취소보다 미래면 매칭하지 않는다', () => {
    const cancel = input({ isCancellation: true, occurredAt: '2026-08-10T05:00:00.000Z' });
    expect(findCancellationTarget(cancel, [original])).toBeNull();
  });

  it('창(window) 밖의 원거래는 매칭하지 않는다', () => {
    const cancel = input({ isCancellation: true, occurredAt: '2027-08-12T05:00:00.000Z' });
    expect(findCancellationTarget(cancel, [original])).toBeNull();
  });

  it('후보가 여러 건이면 가장 최근 원거래를 고른다', () => {
    const older = record({ occurredAt: '2026-07-01T03:30:00.000Z' });
    const cancel = input({ isCancellation: true, occurredAt: '2026-08-12T05:00:00.000Z' });
    expect(findCancellationTarget(cancel, [older, original])).toBe(original);
  });

  it('다른 취소 건을 원거래로 오인하지 않는다', () => {
    const anotherCancel = record({ isCancellation: true });
    const cancel = input({ isCancellation: true, occurredAt: '2026-08-12T05:00:00.000Z' });
    expect(findCancellationTarget(cancel, [anotherCancel])).toBeNull();
  });

  it('카드가 다르면 매칭하지 않는다', () => {
    const cancel = input({
      isCancellation: true,
      accountLast4: '9999',
      occurredAt: '2026-08-12T05:00:00.000Z',
    });
    expect(findCancellationTarget(cancel, [original])).toBeNull();
  });
});
