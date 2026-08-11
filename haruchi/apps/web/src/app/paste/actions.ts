'use server';

import { buildDedupeIndex, findDuplicate, type DedupeRecord } from '@haruchi/parser';
import { zParsedTransaction, type ParsedTransaction, type TransactionInsert } from '@haruchi/schema';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export interface SaveResult {
  ok: boolean;
  inserted: number;
  duplicates: number;
  /** 실패했을 때 사용자에게 보여줄 문장. 원인과 다음 행동을 담는다. */
  message: string;
}

/**
 * 파싱된 거래를 저장한다.
 *
 * 파서 출력을 그대로 믿지 않고 서버에서 스키마를 다시 통과시킨다.
 * 중복은 삽입 전에 걸러내고, DB 의 unique(ledger_id, dedupe_key) 가 마지막 방어선이다.
 */
export async function saveTransactions(
  ledgerId: string,
  candidates: unknown,
): Promise<SaveResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      inserted: 0,
      duplicates: 0,
      message: '아직 저장소가 연결되지 않았어요. 파싱 결과는 그대로 두고, 연결 후 다시 등록하면 됩니다.',
    };
  }

  const parsed = zParsedTransaction.array().safeParse(candidates);
  if (!parsed.success) {
    return {
      ok: false,
      inserted: 0,
      duplicates: 0,
      message: '읽어낸 거래 중 형식이 맞지 않는 것이 있어 등록을 멈췄어요. 화면을 새로고침한 뒤 다시 붙여넣어 주세요.',
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      ok: false,
      inserted: 0,
      duplicates: 0,
      message: '등록하려면 로그인이 필요해요. 파싱 결과는 로그인 후에도 그대로 남아 있습니다.',
    };
  }

  // 같은 날짜 범위의 기존 거래만 가져와 중복을 판정한다. 전체를 내려받지 않는다.
  const days = parsed.data.map((tx) => tx.occurredAt).sort();
  const from = days[0] ?? new Date().toISOString();
  const to = days[days.length - 1] ?? from;

  const { data: existingRows, error: fetchError } = await supabase
    .from('transactions')
    .select('dedupe_key, occurred_at, amount, merchant_normalized, is_cancellation')
    .eq('ledger_id', ledgerId)
    .gte('occurred_at', shiftDays(from, -2))
    .lte('occurred_at', shiftDays(to, 2));

  if (fetchError) {
    return {
      ok: false,
      inserted: 0,
      duplicates: 0,
      message: `기존 거래를 확인하지 못해 등록을 멈췄어요 (${fetchError.message}). 잠시 후 다시 시도해 주세요.`,
    };
  }

  const index = buildDedupeIndex((existingRows ?? []).map(toDedupeRecord));

  const toInsert: TransactionInsert[] = [];
  let duplicates = 0;
  for (const tx of parsed.data) {
    const duplicate = findDuplicate(
      {
        accountLast4: tx.accountLast4,
        occurredAt: tx.occurredAt,
        hasTime: tx.hasTime,
        amount: tx.amount,
        merchantNormalized: tx.merchantNormalized,
        isCancellation: tx.isCancellation,
      },
      index,
    );
    if (duplicate) {
      duplicates += 1;
      continue;
    }
    toInsert.push(toInsertRow(ledgerId, tx));
  }

  if (toInsert.length === 0) {
    return {
      ok: true,
      inserted: 0,
      duplicates,
      message: `이미 등록된 거래였어요. ${duplicates}건을 건너뛰었습니다.`,
    };
  }

  const { error: insertError } = await supabase.from('transactions').insert(toInsert);
  if (insertError) {
    return {
      ok: false,
      inserted: 0,
      duplicates,
      message: `등록 중 문제가 생겼어요 (${insertError.message}). 같은 내용을 다시 등록해도 중복으로 쌓이지 않으니 재시도해 주세요.`,
    };
  }

  return {
    ok: true,
    inserted: toInsert.length,
    duplicates,
    message:
      duplicates > 0
        ? `${toInsert.length}건 등록했어요. 이미 있던 ${duplicates}건은 건너뛰었습니다.`
        : `${toInsert.length}건 등록했어요.`,
  };
}

function toDedupeRecord(row: {
  dedupe_key: string;
  occurred_at: string;
  amount: number | string;
  merchant_normalized: string | null;
  is_cancellation: boolean;
}): DedupeRecord {
  return {
    dedupeKey: row.dedupe_key,
    // 느슨한 매칭은 일 단위로만 하므로 last4 는 키에 이미 반영되어 있다.
    accountLast4: null,
    occurredAt: row.occurred_at,
    hasTime: true,
    amount: Number(row.amount),
    merchantNormalized: row.merchant_normalized ?? '',
    isCancellation: row.is_cancellation,
  };
}

function toInsertRow(ledgerId: string, tx: ParsedTransaction): TransactionInsert {
  return {
    ledger_id: ledgerId,
    occurred_at: tx.occurredAt,
    amount: tx.amount,
    kind: tx.kind,
    merchant_raw: tx.merchantRaw,
    merchant_normalized: tx.merchantNormalized,
    installment_months: tx.installmentMonths,
    is_pending: tx.isPending,
    is_cancellation: tx.isCancellation,
    is_excluded: false,
    source: tx.source,
    dedupe_key: tx.dedupeKey,
    raw_payload: tx.rawPayload,
  };
}

function shiftDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}
