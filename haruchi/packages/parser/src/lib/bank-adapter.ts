/**
 * 은행 입출금 알림 어댑터 공장.
 *
 * 카드와 다른 점은 방향(입금/출금)이 문자에 명시된다는 것과, 잔액이 함께 온다는 것이다.
 * 잔액을 거래 금액으로 잘못 읽는 것이 이 포맷의 대표적인 오파싱이라
 * 앵커드 정규식으로만 읽고 자유 탐색은 하지 않는다.
 */
import { parseAmountToken } from './amount.js';
import { resolveTokens } from './fields.js';
import { isPlausibleMerchant } from './merchant.js';
import type { Adapter, ParseContext, TransactionDraft } from '../types.js';

export interface BankAdapterConfig {
  id: string;
  issuer: string;
  priority: number;
  detect: RegExp;
  /**
   * 이름 있는 캡처그룹: mon, day, hh?, mi?, dir(입금|출금), amount, merchant, last4?
   * 잔액은 캡처하지 않고 버린다.
   */
  singleLine: RegExp[];
}

export function createBankAdapter(config: BankAdapterConfig): Adapter {
  return {
    id: config.id,
    issuer: config.issuer,
    priority: config.priority,
    detect: (body) => config.detect.test(body),
    parse: (body, ctx) => {
      const line = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const draft = parseBankLine(config, line, ctx);
      return draft ? [draft] : null;
    },
  };
}

function parseBankLine(
  config: BankAdapterConfig,
  line: string,
  ctx: ParseContext,
): TransactionDraft | null {
  for (const pattern of config.singleLine) {
    const match = pattern.exec(line);
    if (!match?.groups) continue;
    const g = match.groups;

    const amount = parseAmountToken(g['amount'] ?? '');
    if (amount === null) return null;

    const date = resolveTokens(
      {
        month: g['mon'] as string,
        day: g['day'] as string,
        hour: g['hh'],
        minute: g['mi'],
      },
      ctx.now,
    );
    if (!date) return null;

    const merchantRaw = (g['merchant'] ?? '').trim();
    if (!isPlausibleMerchant(merchantRaw)) return null;

    const direction = g['dir'];
    if (direction !== '입금' && direction !== '출금') return null;

    return {
      occurredAt: date.occurredAt,
      hasTime: date.hasTime,
      amount,
      kind: direction === '입금' ? 'income' : 'expense',
      isCancellation: false,
      merchantRaw,
      accountLast4: g['last4'] ?? null,
      issuer: config.issuer,
      installmentMonths: null,
      // 계좌 입출금은 이미 확정된 거래다.
      isPending: false,
    };
  }
  return null;
}
