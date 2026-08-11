import type { ParsedTransaction } from '@haruchi/schema';
import { toKstParts } from '../../src/lib/datetime.js';

/**
 * 오파싱 탐지 불변식.
 *
 * "파싱 실패는 괜찮다. 틀린 금액을 자신 있게 등록하는 것이 최악이다" (스펙 패널 C).
 * 원문에 없는 값이 거래로 만들어졌다면 그것이 오파싱이다. 기대값을 일일이 적지 않고도
 * 임의의 변형 문자에 대해 이 조건들로 오파싱을 잡아낼 수 있다.
 */
export function findMisparses(text: string, tx: ParsedTransaction): string[] {
  const problems: string[] = [];
  const haystack = text.replace(/\s+/g, ' ');

  // 1. 금액은 원문에 실제로 등장해야 한다 — 지어내면 안 된다.
  const grouped = tx.amount.toLocaleString('en-US');
  const plain = String(tx.amount);
  if (!haystack.includes(grouped) && !haystack.includes(plain)) {
    problems.push(`금액 ${tx.amount} 이 원문에 없다`);
  }

  // 2. 금액이 잔액·누적 뒤의 숫자에서만 나온 것이면 오파싱이다.
  if (!hasNonBalanceOccurrence(haystack, grouped) && !hasNonBalanceOccurrence(haystack, plain)) {
    problems.push(`금액 ${tx.amount} 이 잔액/누적 값에서 온 것으로 보인다`);
  }

  // 3. 가맹점명은 원문의 부분 문자열이어야 한다.
  if (!haystack.includes(tx.merchantRaw)) {
    problems.push(`가맹점 "${tx.merchantRaw}" 가 원문에 없다`);
  }

  // 3b. 가맹점명이 다른 메시지를 통째로 삼킨 것은 아닌지.
  //     "원문의 부분 문자열"이라는 조건만으로는 이 오파싱을 못 잡는다.
  if (/\d{1,2}\/\d{1,2}/.test(tx.merchantRaw)) {
    problems.push(`가맹점 "${tx.merchantRaw}" 에 날짜가 들어 있다`);
  }
  if (/[\d,]+\s*원/.test(tx.merchantRaw)) {
    problems.push(`가맹점 "${tx.merchantRaw}" 에 금액이 들어 있다`);
  }
  if (/(카드|은행|뱅크)\s*\(?\d{4}/.test(tx.merchantRaw)) {
    problems.push(`가맹점 "${tx.merchantRaw}" 에 발신처 머리말이 들어 있다`);
  }
  if (tx.merchantRaw.length > 40) {
    problems.push(`가맹점 "${tx.merchantRaw}" 가 지나치게 길다`);
  }

  // 4. 날짜(KST 기준 월/일)가 원문에 있어야 한다.
  const kst = toKstParts(new Date(tx.occurredAt));
  const dateForms = [
    `${pad(kst.month)}/${pad(kst.day)}`,
    `${kst.month}/${kst.day}`,
    `${pad(kst.month)}/${kst.day}`,
    `${kst.month}/${pad(kst.day)}`,
  ];
  if (!dateForms.some((form) => haystack.includes(form))) {
    problems.push(`날짜 ${kst.month}/${kst.day} 가 원문에 없다`);
  }

  // 5. 시각이 있다고 표시했으면 원문에도 있어야 한다.
  if (tx.hasTime) {
    const timeForms = [`${pad(kst.hour)}:${pad(kst.minute)}`, `${kst.hour}:${pad(kst.minute)}`];
    if (!timeForms.some((form) => haystack.includes(form))) {
      problems.push(`시각 ${kst.hour}:${kst.minute} 가 원문에 없다`);
    }
  }

  // 6. 카드 뒤 4자리도 원문에서 온 값이어야 한다.
  if (tx.accountLast4 !== null && !haystack.includes(tx.accountLast4)) {
    problems.push(`카드 뒤 4자리 ${tx.accountLast4} 가 원문에 없다`);
  }

  // 7. 할부 개월도 마찬가지.
  if (tx.installmentMonths !== null && !haystack.includes(`${tx.installmentMonths}개월`)) {
    problems.push(`할부 ${tx.installmentMonths}개월 이 원문에 없다`);
  }

  // 8. 카드번호 전체가 원문에 남아 있으면 마스킹 실패다 (스펙 7장-2).
  if (/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/.test(tx.rawPayload.text)) {
    problems.push('rawPayload 에 카드번호 전체가 남아 있다');
  }

  return problems;
}

/** 잔액/누적 표기 직후가 아닌 위치에 그 금액이 등장하는지 */
function hasNonBalanceOccurrence(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const before = haystack.slice(Math.max(0, at - 8), at);
    if (!/(잔액|누적|누계|한도)\s*$/.test(before)) return true;
    from = at + 1;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
