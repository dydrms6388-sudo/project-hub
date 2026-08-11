import { describe, expect, it } from 'vitest';
import {
  CORRECTION_PRIORITY,
  buildCorrectionRule,
  categorize,
  findSameMerchant,
  suggestBroaderPattern,
} from '../src/index.js';

describe('buildCorrectionRule', () => {
  it('교정 즉시 contains 규칙을 만든다', () => {
    expect(
      buildCorrectionRule({ merchantNormalized: '스타벅스강남2호점', categoryId: 'uuid-회식비' }),
    ).toEqual({
      matchType: 'contains',
      pattern: '스타벅스강남2호점',
      categoryId: 'uuid-회식비',
      priority: CORRECTION_PRIORITY,
      createdFrom: 'user_correction',
    });
  });

  it('만든 규칙이 다음 분류에서 시드를 이긴다', () => {
    const rule = buildCorrectionRule({
      merchantNormalized: '스타벅스강남2호점',
      categoryId: 'uuid-회식비',
    });
    expect(rule).not.toBeNull();

    const result = categorize(
      { merchantNormalized: '스타벅스강남2호점', kind: 'expense' },
      { userRules: [{ id: 'new', ...rule! }] },
    );
    expect(result).toMatchObject({ categoryId: 'uuid-회식비', source: 'user_rule' });
  });

  it('사용자가 더 넓은 패턴을 골랐으면 그것을 쓴다', () => {
    const rule = buildCorrectionRule({
      merchantNormalized: '스타벅스강남2호점',
      categoryId: 'uuid-회식비',
      pattern: '스타벅스',
    });
    expect(rule?.pattern).toBe('스타벅스');
  });

  it('상호명이 비어 있으면 규칙을 만들지 않는다', () => {
    expect(buildCorrectionRule({ merchantNormalized: '   ', categoryId: 'uuid-a' })).toBeNull();
  });
});

describe('suggestBroaderPattern', () => {
  it('지점 표기를 떼어낸 패턴을 제안한다', () => {
    expect(suggestBroaderPattern('스타벅스강남2호점')).toBe('스타벅스강남');
    expect(suggestBroaderPattern('올리브영강남본점')).toBe('올리브영강남');
  });

  it('뗄 것이 없으면 제안하지 않는다 — 없는 선택지를 만들지 않는다', () => {
    expect(suggestBroaderPattern('쿠팡')).toBeNull();
  });

  it('너무 짧아지면 제안하지 않는다', () => {
    expect(suggestBroaderPattern('본점')).toBeNull();
  });
});

describe('findSameMerchant', () => {
  const transactions = [
    { id: '1', merchantNormalized: '스타벅스강남2호점' },
    { id: '2', merchantNormalized: '스타벅스강남2호점' },
    { id: '3', merchantNormalized: '스타벅스역삼점' },
    { id: '4', merchantNormalized: null },
  ];

  it('정확히 같은 상호명만 고른다', () => {
    expect(findSameMerchant('스타벅스강남2호점', transactions).map((t) => t.id)).toEqual(['1', '2']);
  });

  it('비슷하기만 한 상호명은 건드리지 않는다 — 모르는 사이에 과거가 바뀌면 안 된다', () => {
    expect(findSameMerchant('스타벅스', transactions)).toEqual([]);
  });

  it('빈 상호명으로는 아무것도 고르지 않는다', () => {
    expect(findSameMerchant('', transactions)).toEqual([]);
  });
});
