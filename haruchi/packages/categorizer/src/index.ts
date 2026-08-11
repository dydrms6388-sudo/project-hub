/**
 * @haruchi/categorizer — 자동 분류 3단 파이프라인 (스펙 4-3).
 *
 * 위에서 아래로, 먼저 맞는 게 이긴다.
 *   1) 사용자 규칙   신뢰도 1.0
 *   2) 전역 사전     신뢰도 0.8
 *   3) 시드 휴리스틱 신뢰도 0.5
 *   4) 전부 실패     categoryId = null, "분류 필요" 배지
 *
 * 순수 TypeScript. React/Next/Supabase 에 의존하지 않고 I/O 도 하지 않는다.
 */
import type { TransactionKind } from '@haruchi/schema';
import { findCategory, isKnownCategory } from './categories.js';
import { matchesRegex, toComparable } from './match.js';
import { SEED_RULES } from './seed-rules.js';
import type {
  CategorizeContext,
  CategorizeInput,
  CategoryAssignment,
  DictionaryEntry,
  SeedRule,
  UserRule,
} from './types.js';

export const CONFIDENCE = {
  userRule: 1.0,
  dictionary: 0.8,
  seed: 0.5,
  none: 0,
} as const;

const UNCLASSIFIED: CategoryAssignment = {
  categoryId: null,
  categoryKey: null,
  confidence: CONFIDENCE.none,
  source: 'none',
  matchedBy: null,
  needsReview: true,
};

/* ── 준비 단계 ────────────────────────────────────────────────────────────
 * 규칙 정렬은 거래마다 다시 할 일이 아니다. 배열 정체성 기준으로 캐시해서
 * 거래 10,000건을 분류해도 정렬이 한 번만 일어나게 한다.
 * ────────────────────────────────────────────────────────────────────────── */

interface PreparedSeed {
  rule: SeedRule;
  keyword: string;
}

interface PreparedDictionary {
  entry: DictionaryEntry;
  pattern: string;
}

/** 긴 키워드가 먼저 온다. "동물병원"이 "병원"을 이기게 하는 유일한 장치. */
function prepareSeed(rules: readonly SeedRule[]): PreparedSeed[] {
  return rules
    .map((rule) => ({ rule, keyword: toComparable(rule.keyword) }))
    .filter((prepared) => prepared.keyword.length > 0)
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

const seedCache = new WeakMap<readonly SeedRule[], PreparedSeed[]>();
const DEFAULT_SEED = prepareSeed(SEED_RULES);

function getSeed(rules: readonly SeedRule[] | undefined): PreparedSeed[] {
  if (!rules) return DEFAULT_SEED;
  let prepared = seedCache.get(rules);
  if (!prepared) {
    prepared = prepareSeed(rules);
    seedCache.set(rules, prepared);
  }
  return prepared;
}

const dictionaryCache = new WeakMap<readonly DictionaryEntry[], PreparedDictionary[]>();

function getDictionary(entries: readonly DictionaryEntry[] | undefined): PreparedDictionary[] {
  if (!entries || entries.length === 0) return [];
  let prepared = dictionaryCache.get(entries);
  if (!prepared) {
    prepared = entries
      .map((entry) => ({ entry, pattern: toComparable(entry.pattern) }))
      .filter((prepared) => prepared.pattern.length > 0)
      .sort((a, b) => b.pattern.length - a.pattern.length);
    dictionaryCache.set(entries, prepared);
  }
  return prepared;
}

const userRuleCache = new WeakMap<readonly UserRule[], UserRule[]>();

/** priority 오름차순(낮을수록 우선), 같으면 더 구체적인(긴) 패턴이 먼저. */
function getUserRules(rules: readonly UserRule[] | undefined): UserRule[] {
  if (!rules || rules.length === 0) return [];
  let prepared = userRuleCache.get(rules);
  if (!prepared) {
    prepared = rules
      .slice()
      .sort((a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length);
    userRuleCache.set(rules, prepared);
  }
  return prepared;
}

/* ── 파이프라인 ───────────────────────────────────────────────────────────── */

/**
 * 이 카테고리를 이 거래 종류에 붙여도 되는지.
 *
 * 지출 거래에 '급여'가 붙는 사고를 막는다. 다만 '이체'는 예외다 —
 * 계좌 이체는 은행 알림에서 출금/입금으로 오기 때문에 kind 는 expense/income 이다.
 */
function isCompatible(categoryKey: string, kind: TransactionKind): boolean {
  const category = findCategory(categoryKey);
  if (!category) return false;
  return category.kind === kind || category.kind === 'transfer';
}

export function categorize(
  input: CategorizeInput,
  context: CategorizeContext = {},
): CategoryAssignment {
  const merchant = input.merchantNormalized.trim();
  if (merchant.length === 0) return UNCLASSIFIED;
  const comparable = toComparable(merchant);

  // 1) 사용자 규칙 — 사용자가 직접 정한 것이므로 무조건 이긴다.
  for (const rule of getUserRules(context.userRules)) {
    if (matchesUserRule(rule, merchant, comparable)) {
      return {
        categoryId: rule.categoryId,
        categoryKey: null,
        confidence: CONFIDENCE.userRule,
        source: 'user_rule',
        matchedBy: rule.pattern,
        needsReview: false,
      };
    }
  }

  // 2) 전역 사전
  for (const { entry, pattern } of getDictionary(context.dictionary)) {
    if (!comparable.includes(pattern)) continue;
    const categoryKey = entry.categoryKey ?? null;
    // 사전이 시스템 카테고리를 가리키는데 그 키가 없으면 손상된 항목이다. 건너뛴다.
    if (categoryKey !== null && !isKnownCategory(categoryKey)) continue;
    if (categoryKey !== null && !isCompatible(categoryKey, input.kind)) continue;
    if (entry.categoryId == null && categoryKey === null) continue;
    return {
      categoryId: entry.categoryId ?? null,
      categoryKey,
      confidence: entry.confidence ?? CONFIDENCE.dictionary,
      source: 'dictionary',
      matchedBy: entry.pattern,
      needsReview: false,
    };
  }

  // 3) 시드 휴리스틱
  for (const { rule, keyword } of getSeed(context.seedRules)) {
    const hit = rule.mode === 'prefix' ? comparable.startsWith(keyword) : comparable.includes(keyword);
    if (!hit) continue;
    if (!isCompatible(rule.categoryKey, input.kind)) continue;
    return {
      categoryId: null,
      categoryKey: rule.categoryKey,
      confidence: CONFIDENCE.seed,
      source: 'seed',
      matchedBy: rule.keyword,
      needsReview: false,
    };
  }

  // 4) 전부 실패
  return UNCLASSIFIED;
}

function matchesUserRule(rule: UserRule, merchant: string, comparable: string): boolean {
  if (rule.pattern.length === 0) return false;
  switch (rule.matchType) {
    case 'exact':
      return comparable === toComparable(rule.pattern);
    case 'contains':
      return comparable.includes(toComparable(rule.pattern));
    case 'regex':
      // 위험하거나 깨진 정규식은 matchesRegex 가 false 를 돌려준다.
      // 규칙 하나 때문에 분류 전체가 멈추지 않는다.
      return matchesRegex(rule.pattern, merchant);
  }
}

export function categorizeAll(
  inputs: readonly CategorizeInput[],
  context: CategorizeContext = {},
): CategoryAssignment[] {
  return inputs.map((input) => categorize(input, context));
}

/* ── 운영 지표 (스펙 11장 주간 유지보수 루프) ─────────────────────────────── */

export interface ClassificationStats {
  total: number;
  classified: number;
  unclassified: number;
  /** 미분류 비율. 15% 를 넘으면 시드 규칙 보강 신호다. */
  unclassifiedRate: number;
  bySource: Record<string, number>;
}

export function summarize(assignments: readonly CategoryAssignment[]): ClassificationStats {
  const bySource: Record<string, number> = { user_rule: 0, dictionary: 0, seed: 0, none: 0 };
  for (const assignment of assignments) {
    bySource[assignment.source] = (bySource[assignment.source] ?? 0) + 1;
  }
  const total = assignments.length;
  const unclassified = bySource['none'] ?? 0;
  return {
    total,
    classified: total - unclassified,
    unclassified,
    unclassifiedRate: total === 0 ? 0 : unclassified / total,
    bySource,
  };
}

/**
 * 분류 실패가 쌓이면 LLM 에 넘길 후보를 모은다 (스펙 4-3, LLM 사용처는 여기 하나뿐).
 *
 * **상호명 문자열만 반환한다.** 금액·날짜·계좌·사용자 식별자는 이 함수를 통과할 수
 * 없다 — 타입이 아니라 구현이 그것을 보장한다. 개인 식별 정보가 외부 모델로
 * 나가는 경로를 코드 수준에서 막는다.
 */
export function collectDictionaryCandidates(
  merchants: readonly string[],
  minimumCount = 20,
): string[] {
  const counts = new Map<string, number>();
  for (const merchant of merchants) {
    const trimmed = merchant.trim();
    if (trimmed.length === 0) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  if (counts.size < minimumCount) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([merchant]) => merchant);
}

export { SEED_CATEGORIES, findCategory, isKnownCategory } from './categories.js';
export type { SeedCategory } from './categories.js';
export { SEED_RULES } from './seed-rules.js';
export { toComparable, compileSafeRegex, matchesRegex } from './match.js';
export {
  CORRECTION_PRIORITY,
  buildCorrectionRule,
  findSameMerchant,
  suggestBroaderPattern,
} from './learn.js';
export type * from './types.js';
