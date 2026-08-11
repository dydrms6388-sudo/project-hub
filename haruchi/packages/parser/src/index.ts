/**
 * @haruchi/parser — 문자·알림 텍스트 → 거래.
 *
 * 순수 TypeScript. React/Next/Supabase 에 의존하지 않고 I/O 도 하지 않는다.
 * 브라우저에서도 그대로 돌아간다 (/paste 화면의 실시간 미리보기).
 *
 * LLM 을 쓰지 않는다 — 느리고, 비결정적이고, 금융 데이터가 외부로 나간다 (스펙 4-1).
 * 규칙으로 읽고, 못 읽은 것은 unparsed 로 사용자에게 그대로 돌려준다.
 */
import {
  zParseResult,
  zParsedTransaction,
  type ParseResult,
  type ParsedTransaction,
  type TransactionSource,
} from '@haruchi/schema';
import { adapters } from './adapters/index.js';
import { makeDedupeKey } from './lib/dedupe.js';
import { maskCardNumbers, normalizeMerchant } from './lib/merchant.js';
import { normalizeText, splitBlocks, stripEnvelope } from './lib/text.js';
import type { Adapter, ParseContext, TransactionDraft } from './types.js';

export interface ParseOptions {
  /** "지금"(UTC). 연도 없는 날짜 추정 기준. 테스트에서 고정할 수 있도록 주입받는다. */
  now?: Date;
  source?: TransactionSource;
  /** 기본 어댑터 목록을 갈아끼울 때만 사용 (적대 테스트용). */
  adapters?: readonly Adapter[];
}

/**
 * 붙여넣은 텍스트를 거래 목록으로 변환한다.
 *
 * 읽어낸 것만 transactions 에 담고, 나머지는 전부 unparsed 에 원문 그대로 남긴다.
 * 조용히 버리는 경로는 이 함수에 존재하지 않는다.
 */
export function parse(rawText: string, options: ParseOptions = {}): ParseResult {
  const ctx: ParseContext = {
    now: options.now ?? new Date(),
    source: options.source ?? 'paste',
  };
  const pool = options.adapters ?? adapters;

  const blocks = splitBlocks(normalizeText(rawText));
  const transactions: ParsedTransaction[] = [];
  const unparsed: string[] = [];
  const matchedAdapters: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const block of blocks) {
    const body = stripEnvelope(block);
    const adapter = pool.find((a) => a.detect(body));
    if (!adapter) {
      unparsed.push(block);
      continue;
    }

    let drafts: TransactionDraft[] | null = null;
    try {
      drafts = adapter.parse(body, ctx);
    } catch {
      // 어댑터가 던지면 그 블록만 실패시킨다. 나머지 블록의 파싱은 계속되어야 한다.
      drafts = null;
    }
    if (!drafts || drafts.length === 0) {
      unparsed.push(block);
      continue;
    }

    const built = drafts.map((draft) => toTransaction(draft, adapter, body, ctx.source));
    const invalid = built.some((tx) => tx === null);
    if (invalid) {
      unparsed.push(block);
      continue;
    }

    if (!matchedAdapters.includes(adapter.id)) matchedAdapters.push(adapter.id);
    for (const tx of built as ParsedTransaction[]) {
      if (seen.has(tx.dedupeKey)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(tx.dedupeKey);
      transactions.push(tx);
    }
  }

  return zParseResult.parse({
    transactions,
    unparsed,
    matchedAdapter: matchedAdapters[0] ?? null,
    matchedAdapters,
    duplicateCount,
  });
}

/**
 * 어댑터 초안 → 검증된 거래.
 * 스키마 검증에 실패하면 null 을 돌려 블록 전체를 unparsed 로 보낸다.
 * 검증을 통과하지 못한 값이 DB 쪽으로 새어 나가는 경로는 없다.
 */
function toTransaction(
  draft: TransactionDraft,
  adapter: Adapter,
  body: string,
  source: TransactionSource,
): ParsedTransaction | null {
  const merchantNormalized = normalizeMerchant(draft.merchantRaw);
  if (merchantNormalized.length === 0) return null;

  const dedupeKey = makeDedupeKey({
    accountLast4: draft.accountLast4,
    occurredAt: draft.occurredAt,
    hasTime: draft.hasTime,
    amount: draft.amount,
    merchantNormalized,
    isCancellation: draft.isCancellation,
  });

  const candidate = {
    occurredAt: draft.occurredAt,
    hasTime: draft.hasTime,
    amount: draft.amount,
    kind: draft.kind,
    isCancellation: draft.isCancellation,
    merchantRaw: draft.merchantRaw,
    merchantNormalized,
    accountLast4: draft.accountLast4,
    issuer: draft.issuer,
    installmentMonths: draft.installmentMonths,
    isPending: draft.isPending,
    source,
    dedupeKey,
    rawPayload: {
      // 카드번호 전체가 문자에 노출된 경우 저장 전에 마스킹한다 (스펙 7장-2).
      text: maskCardNumbers(body),
      adapter: adapter.id,
      ...(draft.foreign ? { foreign: draft.foreign } : {}),
    },
  };

  const result = zParsedTransaction.safeParse(candidate);
  return result.success ? result.data : null;
}

export { adapters } from './adapters/index.js';
export type { Adapter, ParseContext, TransactionDraft } from './types.js';
export {
  buildDedupeIndex,
  findCancellationTarget,
  findDuplicate,
  looseKey,
  makeDedupeKey,
  type DedupeIndex,
  type DedupeInput,
  type DedupeRecord,
  type DuplicateMatch,
  type DuplicateReason,
} from './lib/dedupe.js';
export { normalizeMerchant, merchantHead8, maskCardNumbers } from './lib/merchant.js';
export { normalizeText, splitBlocks, stripEnvelope } from './lib/text.js';
export {
  daysInMonth,
  isRealDate,
  kstStampDay,
  kstStampMinute,
  resolveKstDate,
  toKstParts,
} from './lib/datetime.js';
export { sha256Hex } from './lib/sha256.js';
