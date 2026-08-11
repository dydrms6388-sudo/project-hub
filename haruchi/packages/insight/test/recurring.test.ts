import { describe, expect, it } from 'vitest';
import { detectRecurring, findDormantSubscriptions, isSimilarAmount } from '../src/index.js';
import type { InsightEntry } from '../src/types.js';

/** KST 날짜 + 시각 → UTC ISO */
function at(date: string, hour = 12): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`).toISOString();
}

function entry(overrides: Partial<InsightEntry> & { occurredAt: string }): InsightEntry {
  return {
    amount: 12_900,
    kind: 'expense',
    isCancellation: false,
    isExcluded: false,
    isFixed: false,
    categoryKey: 'leisure.subscription',
    merchantNormalized: '넷플릭스',
    ...overrides,
  };
}

describe('isSimilarAmount', () => {
  it('기준 금액의 ±5% 안이면 같은 금액으로 본다', () => {
    expect(isSimilarAmount(10_000, 10_500)).toBe(true);
    expect(isSimilarAmount(10_000, 9_500)).toBe(true);
  });

  it('±5% 를 넘으면 다른 금액이다', () => {
    expect(isSimilarAmount(10_000, 10_501)).toBe(false);
    expect(isSimilarAmount(10_000, 9_499)).toBe(false);
  });

  it('분모는 기준 금액이다 — 큰 쪽을 분모로 삼으면 위로 느슨해진다', () => {
    // 10,000 기준으로 10,501 은 밖이지만, 10,501 기준으로 10,000 은 안이다.
    expect(isSimilarAmount(10_000, 10_501)).toBe(false);
    expect(isSimilarAmount(10_501, 10_000)).toBe(true);
  });

  it('같은 금액은 당연히 같다', () => {
    expect(isSimilarAmount(12_900, 12_900)).toBe(true);
  });
});

describe('detectRecurring', () => {
  it('30일 간격 3회면 정기결제로 잡는다', () => {
    const found = detectRecurring([
      entry({ occurredAt: at('2026-06-05') }),
      entry({ occurredAt: at('2026-07-05') }),
      entry({ occurredAt: at('2026-08-04') }),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      merchantNormalized: '넷플릭스',
      amount: 12_900,
      intervalDays: 30,
      occurrences: 3,
      firstSeen: '2026-06-05',
      lastSeen: '2026-08-04',
      nextExpectedOn: '2026-09-03',
      categoryKey: 'leisure.subscription',
    });
  });

  it('2회만으로는 잡지 않는다 — 우연일 수 있다', () => {
    expect(
      detectRecurring([
        entry({ occurredAt: at('2026-07-05') }),
        entry({ occurredAt: at('2026-08-04') }),
      ]),
    ).toEqual([]);
  });

  it('간격이 25일 미만이면 정기결제가 아니다', () => {
    expect(
      detectRecurring([
        entry({ occurredAt: at('2026-08-01') }),
        entry({ occurredAt: at('2026-08-15') }),
        entry({ occurredAt: at('2026-08-29') }),
      ]),
    ).toEqual([]);
  });

  it('간격이 35일을 넘으면 정기결제가 아니다', () => {
    expect(
      detectRecurring([
        entry({ occurredAt: at('2026-05-01') }),
        entry({ occurredAt: at('2026-06-10') }),
        entry({ occurredAt: at('2026-07-20') }),
      ]),
    ).toEqual([]);
  });

  it('금액이 ±5% 를 벗어나면 같은 계열로 묶지 않는다', () => {
    // 매달 같은 카페에서 다른 금액을 쓴 경우 — 정기결제가 아니다
    expect(
      detectRecurring([
        entry({ merchantNormalized: '스타벅스', amount: 5_000, occurredAt: at('2026-06-05') }),
        entry({ merchantNormalized: '스타벅스', amount: 9_000, occurredAt: at('2026-07-05') }),
        entry({ merchantNormalized: '스타벅스', amount: 15_000, occurredAt: at('2026-08-04') }),
      ]),
    ).toEqual([]);
  });

  it('±5% 안에서 흔들리는 금액은 같은 정기결제로 본다', () => {
    const found = detectRecurring([
      entry({ amount: 12_900, occurredAt: at('2026-06-05') }),
      entry({ amount: 13_400, occurredAt: at('2026-07-05') }),
      entry({ amount: 13_000, occurredAt: at('2026-08-04') }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.amount).toBe(13_000); // 중앙값
  });

  it('상호가 다르면 섞지 않는다', () => {
    expect(
      detectRecurring([
        entry({ merchantNormalized: '넷플릭스', occurredAt: at('2026-06-05') }),
        entry({ merchantNormalized: '왓챠', occurredAt: at('2026-07-05') }),
        entry({ merchantNormalized: '티빙', occurredAt: at('2026-08-04') }),
      ]),
    ).toEqual([]);
  });

  it('취소된 결제는 근거로 쓰지 않는다', () => {
    expect(
      detectRecurring([
        entry({ occurredAt: at('2026-06-05') }),
        entry({ occurredAt: at('2026-07-05'), isCancellation: true }),
        entry({ occurredAt: at('2026-08-04') }),
      ]),
    ).toEqual([]);
  });

  it('통계 제외 거래와 수입은 세지 않는다', () => {
    expect(
      detectRecurring([
        entry({ occurredAt: at('2026-06-05'), isExcluded: true }),
        entry({ occurredAt: at('2026-07-05'), kind: 'income' }),
        entry({ occurredAt: at('2026-08-04') }),
      ]),
    ).toEqual([]);
  });

  it('관측이 많고 간격이 고를수록 신뢰도가 높다', () => {
    const steady = detectRecurring([
      entry({ occurredAt: at('2026-04-05') }),
      entry({ occurredAt: at('2026-05-05') }),
      entry({ occurredAt: at('2026-06-05') }),
      entry({ occurredAt: at('2026-07-05') }),
      entry({ occurredAt: at('2026-08-05') }),
    ]);
    const shaky = detectRecurring([
      entry({ occurredAt: at('2026-06-01') }),
      entry({ occurredAt: at('2026-06-28') }),
      entry({ occurredAt: at('2026-08-01') }),
    ]);

    expect(steady[0]!.confidence).toBeGreaterThan(shaky[0]!.confidence);
    expect(steady[0]!.confidence).toBeLessThanOrEqual(0.95);
  });

  it('신뢰도는 소수점 둘째 자리까지다 — DB 가 numeric(3,2) 다', () => {
    for (const candidate of detectRecurring([
      entry({ occurredAt: at('2026-06-05') }),
      entry({ occurredAt: at('2026-07-05') }),
      entry({ occurredAt: at('2026-08-04') }),
    ])) {
      expect(Math.round(candidate.confidence * 100)).toBe(candidate.confidence * 100);
      expect(candidate.confidence).toBeLessThanOrEqual(0.95);
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('KST 기준으로 날짜를 센다', () => {
    // UTC 2026-06-04 15:00 = KST 2026-06-05 00:00
    const found = detectRecurring([
      entry({ occurredAt: '2026-06-04T15:00:00.000Z' }),
      entry({ occurredAt: at('2026-07-05') }),
      entry({ occurredAt: at('2026-08-04') }),
    ]);
    expect(found[0]?.firstSeen).toBe('2026-06-05');
  });

  it('빈 입력에도 터지지 않는다', () => {
    expect(detectRecurring([])).toEqual([]);
  });
});

describe('findDormantSubscriptions', () => {
  const sixMonths = [
    entry({ occurredAt: at('2026-02-05') }),
    entry({ occurredAt: at('2026-03-07') }),
    entry({ occurredAt: at('2026-04-06') }),
    entry({ occurredAt: at('2026-05-06') }),
    entry({ occurredAt: at('2026-06-05') }),
    entry({ occurredAt: at('2026-07-05') }),
    entry({ occurredAt: at('2026-08-04') }),
  ];

  it('6개월 이상 결제 중이고 같은 카테고리에 다른 지출이 없으면 의심한다', () => {
    const dormant = findDormantSubscriptions(detectRecurring(sixMonths), sixMonths, '2026-08-11');
    expect(dormant.map((candidate) => candidate.merchantNormalized)).toEqual(['넷플릭스']);
  });

  it('같은 카테고리에 다른 지출이 있으면 의심하지 않는다 — 그 분야를 쓰고 있다', () => {
    const withSibling = [...sixMonths, entry({ merchantNormalized: 'CGV강남', occurredAt: at('2026-08-02') })];
    expect(findDormantSubscriptions(detectRecurring(withSibling), withSibling, '2026-08-11')).toEqual(
      [],
    );
  });

  it('6개월이 안 됐으면 의심하지 않는다', () => {
    const short = [
      entry({ occurredAt: at('2026-06-05') }),
      entry({ occurredAt: at('2026-07-05') }),
      entry({ occurredAt: at('2026-08-04') }),
    ];
    expect(findDormantSubscriptions(detectRecurring(short), short, '2026-08-11')).toEqual([]);
  });

  it('월세처럼 카테고리에 상호가 하나뿐인 고정비를 구독으로 오해하지 않는다', () => {
    // 월세를 6개월 냈다고 집에 안 사는 게 아니다.
    const rent = ['2026-02-05', '2026-03-07', '2026-04-06', '2026-05-06', '2026-06-05', '2026-07-05', '2026-08-04'].map(
      (date) =>
        entry({
          merchantNormalized: '행복빌라임대',
          amount: 700_000,
          categoryKey: 'home.rent',
          isFixed: true,
          occurredAt: at(date),
        }),
    );
    expect(findDormantSubscriptions(detectRecurring(rent), rent, '2026-08-11')).toEqual([]);
  });

  it('의심 대상 카테고리를 호출부가 정할 수 있다', () => {
    const rent = ['2026-02-05', '2026-03-07', '2026-04-06', '2026-05-06', '2026-06-05', '2026-07-05', '2026-08-04'].map(
      (date) =>
        entry({
          merchantNormalized: '행복빌라임대',
          amount: 700_000,
          categoryKey: 'home.rent',
          occurredAt: at(date),
        }),
    );
    expect(
      findDormantSubscriptions(detectRecurring(rent), rent, '2026-08-11', ['home.rent']),
    ).toHaveLength(1);
  });

  it('카테고리가 없는 정기결제는 의심하지 않는다', () => {
    const unknown = ['2026-02-05', '2026-03-07', '2026-04-06', '2026-05-06', '2026-06-05', '2026-07-05', '2026-08-04'].map(
      (date) => entry({ merchantNormalized: '알수없는가게', categoryKey: null, occurredAt: at(date) }),
    );
    expect(findDormantSubscriptions(detectRecurring(unknown), unknown, '2026-08-11')).toEqual([]);
  });

  it('이미 끊긴 구독은 미사용 구독이 아니다', () => {
    // 마지막 결제가 반년 전이면 그냥 해지된 것이다
    const ended = sixMonths.slice(0, 4);
    expect(findDormantSubscriptions(detectRecurring(ended), ended, '2026-12-31')).toEqual([]);
  });
});
