/**
 * 카드 승인 문자 어댑터 공장.
 *
 * 카드사마다 다른 것은 "발신처 표기와 줄 배치"뿐이고, 읽어내야 하는 필드는 같다.
 * 그래서 카드사별 파일에는 설정만 두고 해독 로직은 여기 한 곳에 모은다.
 * 새 카드사 추가 = 어댑터 설정 1개 + 픽스처 1개 (스펙 10장 유지보수 게이트).
 *
 * 설계 원칙: 확신이 없으면 null. 틀린 금액을 자신 있게 등록하는 것이 최악이다.
 */
import { findAmountLine, parseAmountToken } from './amount.js';
import {
  RE_MMDD_HHMM,
  RE_YMD_HHMM,
  extractForeign,
  extractInstallment,
  extractLast4,
  isCancelStatus,
  resolveTokens,
} from './fields.js';
import { isPlausibleMerchant } from './merchant.js';
import { looksLikeMessageStart } from './text.js';
import type { Adapter, ParseContext, TransactionDraft } from '../types.js';

export interface CardAdapterConfig {
  id: string;
  issuer: string;
  priority: number;
  /** 이 발신처의 문자인지 판별 */
  detect: RegExp;
  /** 승인/취소 상태 토큰을 잡는 패턴. 캡처그룹 1이 상태 토큰. */
  statusPattern: RegExp;
  /** 카드 뒤 4자리 앞에 오는 앵커. 없으면 last4 는 null. */
  last4Anchor?: RegExp;
  /**
   * 한 줄짜리 포맷들. 이름 있는 캡처그룹을 쓴다:
   * last4?, status, amount, year?, mon, day, hh?, mi?, merchant
   */
  singleLine: RegExp[];
}

/** 가맹점명으로 절대 채택하면 안 되는 줄 (메타 정보/숫자 덩어리) */
const META_LINE =
  /^(?:할부|일시불|누적|잔액|누계|한도|포인트|적립|승인|취소|매입|정상|결제|이용)|^[\d,]+\s*원|^[\d\s,.:/-]+$/;

/** 날짜/시각만 들어 있는 줄 */
const DATE_ONLY_LINE = /^\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?$/;

/* ── 한 줄 포맷 조립기 ───────────────────────────────────────────────────────
 * 카드사 문자는 토큰 순서만 다르고 구성은 같다. 조각을 공유해 두면
 * 새 카드사 어댑터가 "머리말 + 순서" 두 줄로 끝난다.
 * ────────────────────────────────────────────────────────────────────────── */
const P_STATUS = '(?<status>승인\\s*취소|취소\\s*승인|부분\\s*취소|매입\\s*취소|취소|승인)';
const P_AMOUNT = '(?<amount>[\\d,]+)\\s*원';
const P_PAY_TYPE = '(?:\\s*(?:일시불|할부\\s*\\d{1,3}\\s*개월|\\d{1,3}\\s*개월\\s*할부|\\d{1,3}\\s*개월))?';
const P_NAME = '(?:\\s*(?<name>[가-힣]{2,4}))?';
const P_DATE = '\\s*(?<mon>\\d{1,2})/(?<day>\\d{1,2})(?:\\s+(?<hh>\\d{1,2}):(?<mi>\\d{2}))?';
const P_MERCHANT = '\\s+(?<merchant>.+?)';
/** 누적/잔액 꼬리는 거래 정보가 아니므로 버린다. */
const P_TAIL = '(?:\\s*(?:누적|잔액|누계)[\\s\\d,원]*)?$';

export type CardLineOrder = 'status-first' | 'amount-first';

/**
 * @param head 발신처 머리말 정규식 소스. last4 를 캡처하려면 `(?<last4>\d{4})` 를 포함시킨다.
 */
export function cardSingleLine(head: string, order: CardLineOrder): RegExp {
  const core =
    order === 'status-first'
      ? `\\s*${P_STATUS}${P_NAME}\\s*${P_AMOUNT}${P_PAY_TYPE}`
      : `\\s*${P_AMOUNT}\\s*${P_STATUS}${P_PAY_TYPE}`;
  return new RegExp(`^${head}${core}${P_DATE}${P_MERCHANT}${P_TAIL}`);
}

export function createCardAdapter(config: CardAdapterConfig): Adapter {
  return {
    id: config.id,
    issuer: config.issuer,
    priority: config.priority,
    detect: (body) => config.detect.test(body),
    parse: (body, ctx) => {
      const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return null;
      const draft =
        lines.length === 1
          ? parseSingleLine(config, lines[0] as string, ctx)
          : parseMultiLine(config, lines, ctx);
      return draft ? [draft] : null;
    },
  };
}

function parseSingleLine(
  config: CardAdapterConfig,
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
        year: g['year'],
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

    const installment = extractInstallment(line);
    if (!installment.ok) return null;

    const isCancellation = isCancelStatus(g['status']);
    return buildDraft({
      config,
      ctx,
      body: line,
      amount,
      date,
      merchantRaw,
      last4: g['last4'] ?? extractLast4(line, config.last4Anchor ?? config.detect),
      installmentMonths: installment.months,
      isCancellation,
    });
  }
  return null;
}

function parseMultiLine(
  config: CardAdapterConfig,
  lines: readonly string[],
  ctx: ParseContext,
): TransactionDraft | null {
  const body = lines.join('\n');

  const statusMatch = config.statusPattern.exec(body);
  if (!statusMatch) return null;
  const isCancellation = isCancelStatus(statusMatch[1] ?? statusMatch[0]);

  const amountLine = findAmountLine(lines);
  if (!amountLine) return null;

  const dateIndex = lines.findIndex(
    (line) => RE_YMD_HHMM.test(line) || RE_MMDD_HHMM.test(line) || DATE_ONLY_LINE.test(line),
  );
  if (dateIndex < 0) return null;
  const date = readDateLine(lines[dateIndex] as string, ctx.now);
  if (!date) return null;

  const merchantRaw = findMerchantAfter(lines, dateIndex);
  if (merchantRaw === null) return null;

  const installment = extractInstallment(body);
  if (!installment.ok) return null;

  return buildDraft({
    config,
    ctx,
    body,
    amount: amountLine.amount,
    date,
    merchantRaw,
    last4: extractLast4(body, config.last4Anchor ?? config.detect),
    installmentMonths: installment.months,
    isCancellation,
  });
}

function readDateLine(line: string, now: Date) {
  const withYear = RE_YMD_HHMM.exec(line);
  if (withYear) {
    return resolveTokens(
      {
        year: withYear[1] as string,
        month: withYear[2] as string,
        day: withYear[3] as string,
        hour: withYear[4] as string,
        minute: withYear[5] as string,
      },
      now,
    );
  }
  const withTime = RE_MMDD_HHMM.exec(line);
  if (withTime) {
    return resolveTokens(
      {
        month: withTime[1] as string,
        day: withTime[2] as string,
        hour: withTime[3] as string,
        minute: withTime[4] as string,
      },
      now,
    );
  }
  const dateOnly = /^(\d{1,2})\/(\d{1,2})$/.exec(line);
  if (dateOnly) {
    return resolveTokens({ month: dateOnly[1] as string, day: dateOnly[2] as string }, now);
  }
  return null;
}

/**
 * 가맹점명은 "날짜 줄 다음에 오는 첫 번째 의미 있는 줄"이다.
 * 카드사 문자가 공유하는 몇 안 되는 안정적인 구조라서 이 규칙만 쓴다.
 * 후보가 없으면 추측하지 않고 실패시킨다.
 */
function findMerchantAfter(lines: readonly string[], dateIndex: number): string | null {
  for (let i = dateIndex + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (META_LINE.test(line)) continue;
    if (DATE_ONLY_LINE.test(line)) continue;
    if (!isPlausibleMerchant(line)) continue;
    // 블록 분리가 어긋나 다음 메시지가 흘러들어온 경우다. 가맹점으로 삼으면
    // 그 메시지 전체가 상호명이 되고 거래 한 건이 조용히 사라진다.
    if (looksLikeMessageStart(line)) return null;
    if (RE_MMDD_HHMM.test(line) || RE_YMD_HHMM.test(line)) return null;
    if (/[\d,]+\s*원/.test(line)) return null;
    return line;
  }
  return null;
}

interface BuildDraftInput {
  config: CardAdapterConfig;
  ctx: ParseContext;
  body: string;
  amount: number;
  date: { occurredAt: string; hasTime: boolean };
  merchantRaw: string;
  last4: string | null;
  installmentMonths: number | null;
  isCancellation: boolean;
}

function buildDraft(input: BuildDraftInput): TransactionDraft {
  const foreign = extractForeign(input.body);
  return {
    occurredAt: input.date.occurredAt,
    hasTime: input.date.hasTime,
    amount: input.amount,
    kind: 'expense',
    isCancellation: input.isCancellation,
    merchantRaw: input.merchantRaw,
    accountLast4: input.last4,
    issuer: input.config.issuer,
    installmentMonths: input.installmentMonths,
    // 카드 승인은 매입 전 상태다. 취소 건은 대기 상태가 아니다.
    isPending: !input.isCancellation,
    ...(foreign ? { foreign } : {}),
  };
}
