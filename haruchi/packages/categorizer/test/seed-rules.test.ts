import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES, SEED_RULES, isKnownCategory } from '../src/index.js';
import { toComparable } from '../src/match.js';

describe('시드 규칙 무결성', () => {
  it('스펙이 요구한 200개 이상이다', () => {
    expect(SEED_RULES.length).toBeGreaterThanOrEqual(200);
  });

  it('모든 규칙이 실재하는 카테고리를 가리킨다', () => {
    const dangling = SEED_RULES.filter((rule) => !isKnownCategory(rule.categoryKey));
    expect(dangling.map((rule) => `${rule.keyword} → ${rule.categoryKey}`)).toEqual([]);
  });

  it('같은 키워드가 서로 다른 카테고리로 중복 등록되어 있지 않다', () => {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];
    for (const rule of SEED_RULES) {
      const key = toComparable(rule.keyword);
      const existing = seen.get(key);
      if (existing && existing !== rule.categoryKey) {
        conflicts.push(`${rule.keyword}: ${existing} vs ${rule.categoryKey}`);
      }
      seen.set(key, rule.categoryKey);
    }
    expect(conflicts).toEqual([]);
  });

  it('빈 키워드가 없다', () => {
    expect(SEED_RULES.filter((rule) => toComparable(rule.keyword).length === 0)).toEqual([]);
  });

  it('한 글자짜리 키워드가 없다 — 아무 데나 걸린다', () => {
    const tooShort = SEED_RULES.filter((rule) => toComparable(rule.keyword).length < 2);
    expect(tooShort.map((rule) => rule.keyword)).toEqual([]);
  });

  it('짧은 영문 키워드는 prefix 로 잠겨 있다', () => {
    // 3자 이하 영문 전용 키워드를 contains 로 두면 다른 단어에 파묻힌다.
    const risky = SEED_RULES.filter(
      (rule) =>
        rule.mode === 'contains' &&
        /^[A-Za-z]{1,2}$/.test(rule.keyword),
    );
    expect(risky.map((rule) => rule.keyword)).toEqual([]);
  });
});

describe('카테고리 트리 무결성', () => {
  it('key 가 중복되지 않는다', () => {
    const keys = SEED_CATEGORIES.map((category) => category.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('parent 가 실재하는 카테고리를 가리킨다', () => {
    const keys = new Set(SEED_CATEGORIES.map((category) => category.key));
    const dangling = SEED_CATEGORIES.filter(
      (category) => category.parent !== null && !keys.has(category.parent),
    );
    expect(dangling.map((category) => category.key)).toEqual([]);
  });

  it('하위 카테고리는 상위와 같은 거래 종류다', () => {
    const byKey = new Map(SEED_CATEGORIES.map((category) => [category.key, category]));
    const mismatched = SEED_CATEGORIES.filter((category) => {
      if (category.parent === null) return false;
      return byKey.get(category.parent)?.kind !== category.kind;
    });
    expect(mismatched.map((category) => category.key)).toEqual([]);
  });

  it('고정비 카테고리가 정의되어 있다 — burn rate 계산이 이걸 쓴다', () => {
    const fixed = SEED_CATEGORIES.filter((category) => category.isFixed).map((c) => c.key);
    expect(fixed).toContain('home.rent');
    expect(fixed).toContain('home.telecom');
    expect(fixed).toContain('finance.insurance');
    expect(fixed).toContain('leisure.subscription');
  });

  it('수입과 이체 카테고리가 있다', () => {
    expect(SEED_CATEGORIES.some((c) => c.kind === 'income')).toBe(true);
    expect(SEED_CATEGORIES.some((c) => c.kind === 'transfer')).toBe(true);
  });
});
