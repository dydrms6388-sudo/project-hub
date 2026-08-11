import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE,
  categorize,
  categorizeAll,
  collectDictionaryCandidates,
  summarize,
} from '../src/index.js';
import type { CategorizeContext, DictionaryEntry, UserRule } from '../src/types.js';

const expense = (merchantNormalized: string) => ({ merchantNormalized, kind: 'expense' as const });

describe('3단 파이프라인 우선순위', () => {
  const userRules: UserRule[] = [
    { id: 'r1', matchType: 'contains', pattern: '스타벅스', categoryId: 'uuid-회식비', priority: 50 },
  ];
  const dictionary: DictionaryEntry[] = [
    { pattern: '스타벅스', normalized: '스타벅스', categoryKey: 'shopping.online', confidence: 0.8 },
  ];

  it('사용자 규칙이 사전과 시드를 모두 이긴다', () => {
    const result = categorize(expense('스타벅스강남2호점'), { userRules, dictionary });
    expect(result).toMatchObject({
      categoryId: 'uuid-회식비',
      source: 'user_rule',
      confidence: CONFIDENCE.userRule,
      matchedBy: '스타벅스',
      needsReview: false,
    });
  });

  it('사용자 규칙이 없으면 사전이 시드를 이긴다', () => {
    const result = categorize(expense('스타벅스강남2호점'), { dictionary });
    expect(result).toMatchObject({
      categoryKey: 'shopping.online',
      source: 'dictionary',
      confidence: CONFIDENCE.dictionary,
    });
  });

  it('둘 다 없으면 시드 휴리스틱으로 떨어진다', () => {
    expect(categorize(expense('스타벅스강남2호점'))).toMatchObject({
      categoryKey: 'food.cafe',
      categoryId: null,
      source: 'seed',
      confidence: CONFIDENCE.seed,
    });
  });

  it('전부 실패하면 분류 필요로 남긴다', () => {
    expect(categorize(expense('미쓰윤의라면'))).toMatchObject({
      categoryId: null,
      categoryKey: null,
      source: 'none',
      confidence: 0,
      needsReview: true,
    });
  });

  it('빈 상호명은 분류하지 않는다', () => {
    expect(categorize(expense('   ')).source).toBe('none');
  });
});

describe('사용자 규칙 매칭', () => {
  const base = { categoryId: 'uuid-a', priority: 100 };

  it('priority 가 낮은 규칙이 먼저 적용된다', () => {
    const rules: UserRule[] = [
      { id: 'low', matchType: 'contains', pattern: '스타벅스', categoryId: 'uuid-나중', priority: 200 },
      { id: 'high', matchType: 'contains', pattern: '스타벅스', categoryId: 'uuid-먼저', priority: 10 },
    ];
    expect(categorize(expense('스타벅스'), { userRules: rules }).categoryId).toBe('uuid-먼저');
  });

  it('priority 가 같으면 더 구체적인(긴) 패턴이 이긴다', () => {
    const rules: UserRule[] = [
      { id: 'short', matchType: 'contains', pattern: '스타', categoryId: 'uuid-짧음', priority: 100 },
      { id: 'long', matchType: 'contains', pattern: '스타벅스강남', categoryId: 'uuid-긺', priority: 100 },
    ];
    expect(categorize(expense('스타벅스강남2호점'), { userRules: rules }).categoryId).toBe('uuid-긺');
  });

  it('exact 는 전체가 같아야 맞는다', () => {
    const rules: UserRule[] = [{ ...base, id: 'e', matchType: 'exact', pattern: '스타벅스' }];
    expect(categorize(expense('스타벅스'), { userRules: rules }).source).toBe('user_rule');
    expect(categorize(expense('스타벅스강남'), { userRules: rules }).source).toBe('seed');
  });

  it('대소문자와 띄어쓰기 차이를 흡수한다', () => {
    const rules: UserRule[] = [{ ...base, id: 'c', matchType: 'contains', pattern: 'gs 25' }];
    expect(categorize(expense('GS25강남점'), { userRules: rules }).source).toBe('user_rule');
  });

  it('regex 규칙을 지원한다', () => {
    const rules: UserRule[] = [{ ...base, id: 'x', matchType: 'regex', pattern: '^스타벅스.*점$' }];
    expect(categorize(expense('스타벅스강남2호점'), { userRules: rules }).source).toBe('user_rule');
  });

  it('깨진 regex 는 그 규칙만 건너뛰고 분류를 계속한다', () => {
    const rules: UserRule[] = [{ ...base, id: 'bad', matchType: 'regex', pattern: '([' }];
    expect(categorize(expense('스타벅스'), { userRules: rules }).source).toBe('seed');
  });

  it('파국적 백트래킹이 의심되는 regex 는 적용하지 않는다', () => {
    const rules: UserRule[] = [{ ...base, id: 'redos', matchType: 'regex', pattern: '(a+)+$' }];
    const started = Date.now();
    expect(categorize(expense('a'.repeat(60) + 'b'), { userRules: rules }).source).toBe('none');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('빈 패턴은 무시한다', () => {
    const rules: UserRule[] = [{ ...base, id: 'empty', matchType: 'contains', pattern: '' }];
    expect(categorize(expense('스타벅스'), { userRules: rules }).source).toBe('seed');
  });
});

describe('전역 사전', () => {
  it('긴 패턴이 먼저 매칭된다', () => {
    const dictionary: DictionaryEntry[] = [
      { pattern: '스타', normalized: '스타', categoryKey: 'etc' },
      { pattern: '스타벅스', normalized: '스타벅스', categoryKey: 'food.cafe' },
    ];
    expect(categorize(expense('스타벅스강남'), { dictionary }).categoryKey).toBe('food.cafe');
  });

  it('존재하지 않는 카테고리 키를 가진 손상된 항목은 건너뛴다', () => {
    const dictionary: DictionaryEntry[] = [
      { pattern: '스타벅스', normalized: '스타벅스', categoryKey: 'food.없는카테고리' },
    ];
    expect(categorize(expense('스타벅스'), { dictionary }).source).toBe('seed');
  });

  it('카테고리를 하나도 가리키지 않는 항목은 건너뛴다', () => {
    const dictionary: DictionaryEntry[] = [{ pattern: '스타벅스', normalized: '스타벅스' }];
    expect(categorize(expense('스타벅스'), { dictionary }).source).toBe('seed');
  });

  it('항목이 지정한 신뢰도를 그대로 쓴다', () => {
    const dictionary: DictionaryEntry[] = [
      { pattern: '스타벅스', normalized: '스타벅스', categoryKey: 'food.cafe', confidence: 0.95 },
    ];
    expect(categorize(expense('스타벅스'), { dictionary }).confidence).toBe(0.95);
  });
});

describe('거래 종류 호환성', () => {
  it('지출 거래에 수입 카테고리를 붙이지 않는다', () => {
    // "급여" 는 income.salary 시드 규칙에 걸리지만 지출 거래에는 쓸 수 없다.
    expect(categorize(expense('급여'), {}).source).toBe('none');
  });

  it('수입 거래는 수입 카테고리로 분류한다', () => {
    expect(categorize({ merchantNormalized: '급여', kind: 'income' }).categoryKey).toBe(
      'income.salary',
    );
  });

  it('이체 카테고리는 출금(지출)으로 들어와도 인정한다', () => {
    // 은행 알림의 자동이체는 kind 가 expense 로 오지만 실제로는 계좌 간 이동이다.
    expect(categorize(expense('자동이체')).categoryKey).toBe('transfer');
  });
});

describe('배치 처리와 지표', () => {
  it('categorizeAll 은 입력 순서를 유지한다', () => {
    const results = categorizeAll([expense('스타벅스'), expense('알수없는가게'), expense('쿠팡')]);
    expect(results.map((r) => r.categoryKey)).toEqual(['food.cafe', null, 'shopping.online']);
  });

  it('summarize 가 미분류 비율을 계산한다', () => {
    const stats = summarize(categorizeAll([expense('스타벅스'), expense('알수없는가게')]));
    expect(stats).toMatchObject({ total: 2, classified: 1, unclassified: 1, unclassifiedRate: 0.5 });
    expect(stats.bySource['seed']).toBe(1);
  });

  it('빈 입력에서 0으로 나누지 않는다', () => {
    expect(summarize([]).unclassifiedRate).toBe(0);
  });

  it('규칙 배열을 재사용하면 정렬을 다시 하지 않는다 (10,000건 선형)', () => {
    const context: CategorizeContext = {
      userRules: Array.from({ length: 200 }, (_, i) => ({
        id: `r${i}`,
        matchType: 'contains' as const,
        pattern: `없는가맹점${i}`,
        categoryId: `uuid-${i}`,
        priority: 100,
      })),
    };
    const inputs = Array.from({ length: 10000 }, (_, i) => expense(`스타벅스${i}호점`));
    const started = Date.now();
    const results = categorizeAll(inputs, context);
    expect(results).toHaveLength(10000);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe('collectDictionaryCandidates — LLM 에 넘길 후보', () => {
  const merchants = Array.from({ length: 25 }, (_, i) => `가맹점${i}`);

  it('실패 건이 기준치에 못 미치면 아무것도 내보내지 않는다', () => {
    expect(collectDictionaryCandidates(merchants.slice(0, 5))).toEqual([]);
  });

  it('기준치를 넘으면 상호명만 빈도순으로 돌려준다', () => {
    const candidates = collectDictionaryCandidates([...merchants, '가맹점0', '가맹점0']);
    expect(candidates[0]).toBe('가맹점0');
    expect(candidates).toHaveLength(25);
  });

  it('반환값은 문자열 배열뿐이다 — 금액·날짜가 실릴 자리가 없다', () => {
    const candidates = collectDictionaryCandidates(merchants);
    expect(candidates.every((entry) => typeof entry === 'string')).toBe(true);
  });

  it('빈 상호명은 후보에서 제외한다', () => {
    expect(collectDictionaryCandidates(['  ', ...merchants])).not.toContain('  ');
  });
});
