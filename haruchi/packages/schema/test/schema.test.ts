import { describe, expect, it } from 'vitest';
import { signedAmount, zMoney, zTransactionRow } from '../src/index.js';

describe('zMoney', () => {
  it('원 단위 정수를 받는다', () => {
    expect(zMoney.parse(12000)).toBe(12000);
  });

  it('소수점은 거부한다 — 금액에 float 를 허용하지 않는다', () => {
    expect(zMoney.safeParse(12000.5).success).toBe(false);
  });

  it('0원과 음수는 거부한다', () => {
    expect(zMoney.safeParse(0).success).toBe(false);
    expect(zMoney.safeParse(-1).success).toBe(false);
  });

  it('비현실적으로 큰 금액은 거부한다', () => {
    expect(zMoney.safeParse(1e14).success).toBe(false);
    // 100억은 정상 범위다
    expect(zMoney.safeParse(1e10).success).toBe(true);
  });
});

describe('zTransactionRow', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    ledger_id: '22222222-2222-4222-8222-222222222222',
    account_id: null,
    category_id: null,
    occurred_at: '2026-08-11T03:30:00Z',
    amount: 12000,
    kind: 'expense',
    merchant_raw: '스타벅스',
    merchant_normalized: '스타벅스',
    memo: null,
    installment_months: null,
    is_pending: true,
    is_cancellation: false,
    is_excluded: false,
    source: 'paste',
    dedupe_key: 'a'.repeat(64),
    created_at: '2026-08-11T03:31:00Z',
  };

  it('bigint 가 문자열로 내려와도 정수로 좁힌다', () => {
    const parsed = zTransactionRow.parse({ ...base, amount: '12000' });
    expect(parsed.amount).toBe(12000);
  });

  it('소수점이 섞인 금액은 경계에서 막는다', () => {
    expect(zTransactionRow.safeParse({ ...base, amount: '12000.5' }).success).toBe(false);
  });

  it('안전한 정수 범위를 넘는 금액은 막는다', () => {
    expect(zTransactionRow.safeParse({ ...base, amount: '99999999999999999999' }).success).toBe(
      false,
    );
  });

  it('스키마에 없는 kind 는 거부한다', () => {
    expect(zTransactionRow.safeParse({ ...base, kind: 'refund' }).success).toBe(false);
  });
});

describe('signedAmount', () => {
  it('지출은 음수다', () => {
    expect(signedAmount({ amount: 12000, kind: 'expense', isCancellation: false })).toBe(-12000);
  });

  it('수입은 양수다', () => {
    expect(signedAmount({ amount: 2500000, kind: 'income', isCancellation: false })).toBe(2500000);
  });

  it('지출 취소는 부호가 뒤집혀 상계된다', () => {
    expect(signedAmount({ amount: 12000, kind: 'expense', isCancellation: true })).toBe(12000);
  });

  it('수입 취소도 부호가 뒤집힌다', () => {
    expect(signedAmount({ amount: 5000, kind: 'income', isCancellation: true })).toBe(-5000);
  });

  it('이체는 통계에 영향을 주지 않는다', () => {
    expect(signedAmount({ amount: 100000, kind: 'transfer', isCancellation: false })).toBe(0);
  });

  it('승인과 취소의 합은 0 이다', () => {
    const approve = signedAmount({ amount: 12000, kind: 'expense', isCancellation: false });
    const cancel = signedAmount({ amount: 12000, kind: 'expense', isCancellation: true });
    expect(approve + cancel).toBe(0);
  });
});
