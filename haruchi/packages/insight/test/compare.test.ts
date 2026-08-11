import type { CategoryTotal } from '@haruchi/budget';
import { describe, expect, it } from 'vitest';
import { compareCategories } from '../src/index.js';

const total = (categoryKey: string | null, amount: number): CategoryTotal => ({
  categoryKey,
  amount,
  isFixed: false,
});

describe('compareCategories', () => {
  it('5만원 이상 & 20% 이상 늘어난 것만 말한다', () => {
    const changes = compareCategories(
      [total('food.dining', 500_000)],
      [total('food.dining', 400_000)],
    );
    expect(changes).toEqual([
      { categoryKey: 'food.dining', current: 500_000, previous: 400_000, change: 100_000, changeRatio: 0.25 },
    ]);
  });

  it('금액이 작으면 비율이 커도 말하지 않는다', () => {
    // 10,000 → 30,000: 200% 늘었지만 2만원이라 노이즈다
    expect(compareCategories([total('food.cafe', 30_000)], [total('food.cafe', 10_000)])).toEqual([]);
  });

  it('비율이 작으면 금액이 커도 말하지 않는다', () => {
    // 1,000,000 → 1,060,000: 6만원 늘었지만 6% 라 흔한 변동이다
    expect(
      compareCategories([total('shopping.online', 1_060_000)], [total('shopping.online', 1_000_000)]),
    ).toEqual([]);
  });

  it('줄어든 것도 잡는다', () => {
    const changes = compareCategories(
      [total('shopping.online', 200_000)],
      [total('shopping.online', 400_000)],
    );
    expect(changes[0]).toMatchObject({ change: -200_000, changeRatio: -0.5 });
  });

  it('이전 기간에 없던 카테고리는 비율을 말하지 않는다', () => {
    const changes = compareCategories([total('leisure.travel', 800_000)], []);
    expect(changes[0]).toMatchObject({
      categoryKey: 'leisure.travel',
      previous: 0,
      change: 800_000,
      changeRatio: null,
    });
  });

  it('이번 달 사라진 카테고리도 감소로 잡는다', () => {
    const changes = compareCategories([], [total('leisure.travel', 800_000)]);
    expect(changes[0]).toMatchObject({ current: 0, change: -800_000, changeRatio: -1 });
  });

  it('상위 3개까지만 준다', () => {
    const current = [
      total('a', 1_000_000),
      total('b', 900_000),
      total('c', 800_000),
      total('d', 700_000),
    ];
    expect(compareCategories(current, [])).toHaveLength(3);
  });

  it('증감액이 큰 순으로 정렬한다', () => {
    const changes = compareCategories(
      [total('a', 100_000), total('b', 500_000)],
      [total('a', 400_000), total('b', 100_000)],
    );
    expect(changes.map((change) => change.categoryKey)).toEqual(['b', 'a']);
  });

  it('미분류도 하나의 카테고리로 다룬다', () => {
    const changes = compareCategories([total(null, 300_000)], [total(null, 100_000)]);
    expect(changes[0]?.categoryKey).toBeNull();
  });

  it('임계값을 조절할 수 있다', () => {
    const changes = compareCategories(
      [total('food.cafe', 30_000)],
      [total('food.cafe', 10_000)],
      { minAmount: 10_000 },
    );
    expect(changes).toHaveLength(1);
  });

  it('변화가 없으면 아무것도 말하지 않는다', () => {
    expect(compareCategories([total('a', 500_000)], [total('a', 500_000)])).toEqual([]);
  });

  it('빈 입력에도 터지지 않는다', () => {
    expect(compareCategories([], [])).toEqual([]);
  });
});
