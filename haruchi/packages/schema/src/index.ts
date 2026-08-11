/**
 * @haruchi/schema — zod 스키마 + 타입 단일 소스.
 *
 * 이 패키지는 React / Next / Supabase 에 의존하지 않는다. 순수 TypeScript.
 * 모든 경계(파서 출력, DB→앱, 앱→DB)에서 여기 정의된 스키마로 검증한다.
 */
import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * 금액
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 금액은 언제나 "원 단위 정수"다. float 금지 (스펙 14장).
 * 상한 1e13(10조)은 오파싱 방어용 sanity 한계다. 100억(1e10)은 정상 통과한다.
 */
export const MAX_AMOUNT = 1e13;

export const zMoney = z
  .number()
  .int('금액은 원 단위 정수여야 합니다')
  .min(1, '금액은 1원 이상이어야 합니다')
  .max(MAX_AMOUNT, '금액이 비현실적으로 큽니다');

/** 부호를 가질 수 있는 금액(집계 결과 등). 정수 제약은 동일. */
export const zSignedMoney = z.number().int().min(-MAX_AMOUNT).max(MAX_AMOUNT);

/* ────────────────────────────────────────────────────────────────────────────
 * 열거형 — DB check 제약과 1:1로 대응한다
 * ──────────────────────────────────────────────────────────────────────────── */

export const zTransactionKind = z.enum(['expense', 'income', 'transfer']);
export type TransactionKind = z.infer<typeof zTransactionKind>;

export const zTransactionSource = z.enum([
  'manual',
  'paste',
  'notification',
  'import',
  'recurring',
]);
export type TransactionSource = z.infer<typeof zTransactionSource>;

export const zAccountKind = z.enum(['credit', 'check', 'bank', 'cash', 'prepaid']);
export type AccountKind = z.infer<typeof zAccountKind>;

export const zMemberRole = z.enum(['owner', 'editor', 'viewer']);
export type MemberRole = z.infer<typeof zMemberRole>;

export const zRuleMatchType = z.enum(['exact', 'contains', 'regex']);
export type RuleMatchType = z.infer<typeof zRuleMatchType>;

export const zRuleOrigin = z.enum(['seed', 'user_correction', 'llm']);
export type RuleOrigin = z.infer<typeof zRuleOrigin>;

/* ────────────────────────────────────────────────────────────────────────────
 * 공용 원시 타입
 * ──────────────────────────────────────────────────────────────────────────── */

export const zUuid = z.string().uuid();

/** ISO-8601 UTC 문자열. 앱 내부 시각 표현은 전부 이 형태로 통일한다. */
export const zIsoInstant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'ISO-8601 UTC 문자열이어야 합니다');

/** 카드 뒤 4자리. 전체 번호는 어떤 경우에도 저장하지 않는다 (스펙 7장-2). */
export const zLast4 = z.string().regex(/^\d{4}$/, '카드 뒤 4자리만 저장합니다');

/** yyyy-MM-dd (KST 기준 달력 날짜) */
export const zPlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ────────────────────────────────────────────────────────────────────────────
 * 파서 출력
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 해외 승인 원문. 원화 환산액만 amount 로 저장하고 원통화 정보는 여기 남긴다.
 * (스펙 4-1 엣지케이스: "원화만 저장, 원문은 raw_payload")
 */
export const zForeignOrigin = z.object({
  currency: z.string().min(1).max(8),
  /** 소수점이 있을 수 있는 외화 원문 금액. 표시 전용이며 계산에 쓰지 않는다. */
  amountText: z.string().min(1).max(32),
});
export type ForeignOrigin = z.infer<typeof zForeignOrigin>;

export const zRawPayload = z.object({
  /** 파싱에 쓰인 메시지 블록 원문 */
  text: z.string(),
  /** 매칭된 어댑터 id */
  adapter: z.string(),
  foreign: zForeignOrigin.optional(),
});
export type RawPayload = z.infer<typeof zRawPayload>;

export const zParsedTransaction = z.object({
  /** 거래 시각(UTC ISO). 시각 정보가 없으면 KST 00:00 을 UTC 로 변환한 값. */
  occurredAt: zIsoInstant,
  /**
   * 원문에 "시:분"이 있었는지. dedupe_key 생성 규칙이 갈린다 (스펙 4-1).
   * 명세서 업로드처럼 시각이 없는 소스는 false.
   */
  hasTime: z.boolean(),
  /** 항상 양의 정수. 방향은 kind, 취소 여부는 isCancellation 이 나타낸다. */
  amount: zMoney,
  kind: zTransactionKind,
  /**
   * 승인취소/부분취소 여부. true 면 통계에서 동일 kind 의 금액을 차감한다.
   * (스펙 4-1 "취소 = 음수 처리" 를 amount 양수 불변 제약과 양립시키는 표현)
   */
  isCancellation: z.boolean(),
  /** 원문 그대로의 가맹점/적요 */
  merchantRaw: z.string().min(1).max(120),
  /** 정규화된 상호명. dedupe 와 분류의 입력. */
  merchantNormalized: z.string().min(1).max(120),
  accountLast4: zLast4.nullable(),
  /** '신한','KB국민','토스뱅크' 등 표시용 문자열일 뿐. 연동을 의미하지 않는다. */
  issuer: z.string().min(1).max(32).nullable(),
  /** 할부 개월. 일시불이면 null. */
  installmentMonths: z.number().int().min(2).max(60).nullable(),
  /** 승인만 되고 매입 전 */
  isPending: z.boolean(),
  source: zTransactionSource,
  dedupeKey: z.string().regex(/^[0-9a-f]{64}$/, 'dedupe_key 는 sha256 hex 여야 합니다'),
  rawPayload: zRawPayload,
});
export type ParsedTransaction = z.infer<typeof zParsedTransaction>;

export const zParseResult = z.object({
  transactions: z.array(zParsedTransaction),
  /** 읽지 못한 블록. 절대 조용히 버리지 않는다 (스펙 14장). */
  unparsed: z.array(z.string()),
  /** 첫 번째로 매칭된 어댑터 id. 아무것도 매칭되지 않으면 null. */
  matchedAdapter: z.string().nullable(),
  /** 이번 입력에서 실제로 사용된 어댑터 id 목록 (혼합 붙여넣기 대응) */
  matchedAdapters: z.array(z.string()),
  /** 이번 입력 안에서 서로 중복이라 접힌 건수. UI 가 "중복 N건"으로 보여준다. */
  duplicateCount: z.number().int().min(0),
});
export type ParseResult = z.infer<typeof zParseResult>;

/* ────────────────────────────────────────────────────────────────────────────
 * DB 행 스키마 — Supabase 응답은 반드시 이걸 통과시킨 뒤에 사용한다
 * ──────────────────────────────────────────────────────────────────────────── */

export const zTransactionRow = z.object({
  id: zUuid,
  ledger_id: zUuid,
  account_id: zUuid.nullable(),
  category_id: zUuid.nullable(),
  occurred_at: z.string(),
  /** Postgres bigint 는 문자열로 내려올 수 있다. 정수로 좁혀서 받는다. */
  amount: z.union([z.number(), z.string()]).transform(toIntegerAmount),
  kind: zTransactionKind,
  merchant_raw: z.string().nullable(),
  merchant_normalized: z.string().nullable(),
  memo: z.string().nullable(),
  installment_months: z.number().int().nullable(),
  is_pending: z.boolean(),
  is_cancellation: z.boolean(),
  is_excluded: z.boolean(),
  source: zTransactionSource,
  dedupe_key: z.string(),
  created_at: z.string(),
});
export type TransactionRow = z.infer<typeof zTransactionRow>;

export const zCategoryRow = z.object({
  id: zUuid,
  ledger_id: zUuid.nullable(),
  parent_id: zUuid.nullable(),
  name: z.string(),
  kind: zTransactionKind,
  is_fixed: z.boolean(),
  icon: z.string().nullable(),
  sort_order: z.number().int(),
});
export type CategoryRow = z.infer<typeof zCategoryRow>;

export const zAccountRow = z.object({
  id: zUuid,
  ledger_id: zUuid,
  kind: zAccountKind,
  issuer: z.string().nullable(),
  nickname: z.string(),
  last4: zLast4.nullable(),
  color: z.string().nullable(),
  archived: z.boolean(),
});
export type AccountRow = z.infer<typeof zAccountRow>;

export const zLedgerRow = z.object({
  id: zUuid,
  name: z.string(),
  owner_id: zUuid,
  currency: z.string(),
  /** 회계월 시작일. 25 면 "8월" 은 7/25~8/24 다. */
  month_start_day: z.number().int().min(1).max(28),
  created_at: z.string(),
});
export type LedgerRow = z.infer<typeof zLedgerRow>;

/**
 * bigint 컬럼을 안전한 정수로 좁힌다.
 * float 로 흘러드는 경로를 여기서 끊는다 — 소수점이 붙어 오면 즉시 실패한다.
 */
function toIntegerAmount(value: number | string, ctx: z.RefinementCtx): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(n)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `금액이 안전한 정수가 아닙니다: ${String(value)}`,
    });
    return z.NEVER;
  }
  return n;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 삽입 페이로드 — 앱 → DB 경계
 * ──────────────────────────────────────────────────────────────────────────── */

export const zTransactionInsert = z.object({
  ledger_id: zUuid,
  account_id: zUuid.nullable().optional(),
  category_id: zUuid.nullable().optional(),
  occurred_at: zIsoInstant,
  amount: zMoney,
  kind: zTransactionKind,
  merchant_raw: z.string().max(120).nullable(),
  merchant_normalized: z.string().max(120).nullable(),
  memo: z.string().max(500).nullable().optional(),
  installment_months: z.number().int().min(2).max(60).nullable(),
  is_pending: z.boolean(),
  is_cancellation: z.boolean(),
  is_excluded: z.boolean(),
  source: zTransactionSource,
  dedupe_key: z.string().regex(/^[0-9a-f]{64}$/),
  raw_payload: zRawPayload.nullable(),
});
export type TransactionInsert = z.infer<typeof zTransactionInsert>;

/**
 * 통계에 반영되는 부호 있는 금액.
 * 지출은 음수, 수입은 양수, 취소는 부호를 뒤집는다. 이체는 0 (내부 이동).
 */
export function signedAmount(tx: {
  amount: number;
  kind: TransactionKind;
  isCancellation: boolean;
}): number {
  if (tx.kind === 'transfer') return 0;
  const direction = tx.kind === 'expense' ? -1 : 1;
  const cancel = tx.isCancellation ? -1 : 1;
  return direction * cancel * tx.amount;
}
