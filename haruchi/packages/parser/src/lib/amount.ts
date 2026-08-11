/**
 * 금액 토큰 → 원 단위 정수.
 *
 * float 를 절대 만들지 않는다. 소수점이 붙은 원화 토큰은 파싱 실패로 처리한다.
 */
import { MAX_AMOUNT } from '@haruchi/schema';

/** 콤마 그룹이 규칙적인 정수만 통과시킨다. "1,2,3" 같은 깨진 토큰은 거부. */
const STRICT_AMOUNT = /^(?:\d{1,3}(?:,\d{3})+|\d+)$/;

/**
 * "12,000" → 12000. 파싱할 수 없으면 null.
 *
 * 0원은 거부한다. 0원 승인 문자를 거래로 등록하면 통계만 오염되고,
 * 실패로 남기면 사용자가 직접 판단할 수 있다 (스펙 패널 C: 실패 > 오파싱).
 */
export function parseAmountToken(token: string): number | null {
  const trimmed = token.trim();
  if (!STRICT_AMOUNT.test(trimmed)) return null;
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isSafeInteger(n)) return null;
  if (n < 1 || n > MAX_AMOUNT) return null;
  return n;
}

/** 금액으로 오인하면 안 되는 줄 — 누적/잔액/한도 등은 거래 금액이 아니다. */
const NON_AMOUNT_LINE = /누적|잔액|누계|한도|포인트|적립|합계|총\s*이용/;

export function isAmountBearingLine(line: string): boolean {
  return !NON_AMOUNT_LINE.test(line);
}

export interface AmountLine {
  index: number;
  amount: number;
}

/**
 * 줄 목록에서 거래 금액이 적힌 줄을 찾는다.
 * 누적/잔액 줄은 건너뛰고, 첫 번째로 나오는 "N원" 토큰을 쓴다.
 * 토큰은 있는데 값이 이상하면(0원, 콤마 깨짐) 다음 줄로 넘어가지 않고 실패시킨다 —
 * 뒤에 있는 엉뚱한 숫자를 대신 집어오는 것이 오파싱의 지름길이기 때문이다.
 */
export function findAmountLine(lines: readonly string[]): AmountLine | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (!isAmountBearingLine(line)) continue;
    const match = /([\d,]+)\s*원/.exec(line);
    if (!match) continue;
    const amount = parseAmountToken(match[1] as string);
    return amount === null ? null : { index: i, amount };
  }
  return null;
}
