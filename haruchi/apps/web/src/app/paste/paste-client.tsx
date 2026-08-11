'use client';

import { categorize, findCategory } from '@haruchi/categorizer';
import { parse } from '@haruchi/parser';
import type { ParsedTransaction } from '@haruchi/schema';
import { useMemo, useState } from 'react';
import { formatKind, formatKstDateTime, formatWon } from '@/lib/format';

/**
 * 붙여넣기 등록 화면.
 *
 * 파싱은 전부 브라우저에서 한다. 로그인 전에도 결과를 볼 수 있어야 하고,
 * 문자 원문을 서버로 보내지 않는 편이 개인정보 측면에서도 낫다 (스펙 5장 / 7장).
 */

const SAMPLE = [
  '[Web발신]',
  '신한카드(1234)승인',
  '홍길동',
  '12,000원 일시불',
  '08/11 12:30',
  '스타벅스강남2호점',
  '누적1,234,000원',
].join('\n');

export function PasteClient({ canSave }: { canSave: boolean }) {
  const [text, setText] = useState('');

  // 입력이 바뀔 때마다 다시 읽는다. 순수 함수라 디바운스 없이도 즉각적이다.
  const result = useMemo(() => parse(text, { source: 'paste' }), [text]);
  // 로그인 전이라 사용자 규칙도 전역 사전도 없다. 내장 시드 규칙만으로 분류한다.
  const rows = useMemo(
    () =>
      result.transactions.map((tx) => ({
        tx,
        assignment: categorize({ merchantNormalized: tx.merchantNormalized, kind: tx.kind }),
      })),
    [result],
  );
  const needsReviewCount = rows.filter((row) => row.assignment.needsReview).length;
  const hasInput = text.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">문자 붙여넣기</h1>
        <p className="mt-1 text-sm text-muted">
          카드 승인 문자를 그대로 붙여넣으세요. 여러 건을 한 번에 넣어도 됩니다.
        </p>
      </div>

      <div>
        <label htmlFor="paste-input" className="sr-only">
          카드 승인 문자
        </label>
        <textarea
          id="paste-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder="여기에 문자를 붙여넣으세요"
          className="w-full resize-y rounded-lg border border-line bg-surface p-4 font-sans text-sm leading-relaxed outline-none focus:border-safe"
        />
        {!hasInput && (
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="mt-2 text-sm text-safe underline underline-offset-4"
          >
            예시 문자로 먼저 해보기
          </button>
        )}
      </div>

      {hasInput && (
        <section aria-live="polite" className="space-y-4">
          <Summary
            parsed={result.transactions.length}
            duplicates={result.duplicateCount}
            failed={result.unparsed.length}
            needsReview={needsReviewCount}
          />

          {rows.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {rows.map(({ tx, assignment }) => (
                <TransactionPreview key={tx.dedupeKey} tx={tx} categoryKey={assignment.categoryKey} />
              ))}
            </ul>
          )}

          {result.unparsed.length > 0 && <Unreadable blocks={result.unparsed} />}

          {result.transactions.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              {canSave ? (
                <button
                  type="button"
                  className="rounded-md bg-safe px-4 py-2 text-sm font-medium text-white"
                >
                  {result.transactions.length}건 등록
                </button>
              ) : (
                <p className="text-sm text-muted">
                  읽은 내용은 여기까지예요. 등록하려면 로그인이 필요합니다 — 로그인해도 이
                  결과는 그대로 남습니다.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Summary({
  parsed,
  duplicates,
  failed,
  needsReview,
}: {
  parsed: number;
  duplicates: number;
  failed: number;
  needsReview: number;
}) {
  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-ink">{parsed}건</span>을 읽었어요
      {duplicates > 0 && <> · 같은 거래 {duplicates}건은 하나로 합쳤습니다</>}
      {needsReview > 0 && <> · {needsReview}건은 카테고리를 정해 주세요</>}
      {failed > 0 && <> · {failed}건은 읽지 못했습니다</>}
    </p>
  );
}

function TransactionPreview({
  tx,
  categoryKey,
}: {
  tx: ParsedTransaction;
  categoryKey: string | null;
}) {
  const isCancel = tx.isCancellation;
  const category = categoryKey ? findCategory(categoryKey) : undefined;
  return (
    <li className="flex items-baseline justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{tx.merchantRaw}</p>
          {category ? (
            <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
              {category.name}
            </span>
          ) : (
            // 분류 실패를 감추지 않는다. 사용자가 고칠 수 있게 드러낸다.
            <span className="shrink-0 rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">
              분류 필요
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {formatKstDateTime(tx.occurredAt, tx.hasTime)}
          {tx.issuer && <> · {tx.issuer}</>}
          {tx.accountLast4 && <> {tx.accountLast4}</>}
          {tx.installmentMonths && <> · {tx.installmentMonths}개월 할부</>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`tnum text-sm font-semibold ${isCancel ? 'text-warn' : ''}`}>
          {isCancel && '−'}
          {formatWon(tx.amount)}
        </p>
        <p className="mt-0.5 text-xs text-muted">{formatKind(tx.kind, isCancel)}</p>
      </div>
    </li>
  );
}

/**
 * 읽지 못한 블록. 조용히 버리지 않고 원문 그대로 보여준다 (스펙 14장).
 * 사용자가 여기서 바로 다음 행동을 고를 수 있어야 한다.
 */
function Unreadable({ blocks }: { blocks: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-warn-soft p-4">
      <p className="text-sm font-medium">이건 못 읽었어요</p>
      <p className="mt-1 text-xs text-muted">
        아직 모르는 형식이라 건너뛰었습니다. 직접 입력하면 바로 등록할 수 있어요.
      </p>
      <ul className="mt-3 space-y-2">
        {blocks.map((block, index) => (
          <li
            key={`${index}-${block.slice(0, 16)}`}
            className="whitespace-pre-wrap rounded border border-line bg-surface p-2 text-xs leading-relaxed text-muted"
          >
            {block}
          </li>
        ))}
      </ul>
    </div>
  );
}
