import type { TransactionKind } from '@haruchi/schema';

export type MatchSource = 'user_rule' | 'dictionary' | 'seed' | 'none';

/** DB category_rules.match_type 과 1:1 대응 */
export type UserMatchType = 'exact' | 'contains' | 'regex';

export interface UserRule {
  id: string;
  matchType: UserMatchType;
  pattern: string;
  /** 원장 카테고리 UUID */
  categoryId: string;
  /** 낮을수록 우선 */
  priority: number;
}

export interface DictionaryEntry {
  /** merchant_dictionary.pattern — contains 매칭 */
  pattern: string;
  /** 정규화된 대표 상호명 */
  normalized: string;
  categoryId?: string | null;
  /** 시스템 카테고리 슬러그 (categoryId 가 없을 때) */
  categoryKey?: string | null;
  confidence?: number;
}

export interface SeedRule {
  keyword: string;
  categoryKey: string;
  /** prefix 는 상호명이 그 토큰으로 시작할 때만 매칭한다. */
  mode: 'contains' | 'prefix';
}

export interface CategorizeInput {
  /** 파서가 정규화한 상호명 */
  merchantNormalized: string;
  kind: TransactionKind;
}

export interface CategorizeContext {
  /** 이 원장의 사용자 규칙 (category_rules where ledger_id = 이 원장) */
  userRules?: readonly UserRule[];
  /** 전역 상호명 사전 */
  dictionary?: readonly DictionaryEntry[];
  /** 기본 시드 규칙을 갈아끼울 때만 사용 (테스트용) */
  seedRules?: readonly SeedRule[];
}

export interface CategoryAssignment {
  /** 원장 카테고리 UUID. 시드 규칙으로 맞힌 경우 null 이고 categoryKey 만 채워진다. */
  categoryId: string | null;
  /** 시스템 카테고리 슬러그 */
  categoryKey: string | null;
  /** 1.0 사용자 규칙 / 0.8 전역 사전 / 0.5 시드 / 0 실패 */
  confidence: number;
  source: MatchSource;
  /** 어떤 패턴이 맞았는지. "왜 이 카테고리인가"를 UI 가 설명할 수 있어야 한다. */
  matchedBy: string | null;
  /** UI 의 "분류 필요" 배지 */
  needsReview: boolean;
}

/** 사용자 교정으로 새로 만들 규칙 (DB insert 전 형태) */
export interface NewUserRule {
  matchType: UserMatchType;
  pattern: string;
  categoryId: string;
  priority: number;
  createdFrom: 'user_correction';
}
