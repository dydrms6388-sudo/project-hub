import { describe, expect, it } from 'vitest';
import { parse } from '../src/index.js';
import { normalizeText, splitBlocks } from '../src/lib/text.js';
import { NOW } from './fixtures/index.js';
import { findMisparses } from './helpers/invariants.js';

const KB = (last4: string, amount: string, day: string, time: string, merchant: string): string =>
  `KB국민카드 ${last4} 승인 홍길동 ${amount}원 일시불 08/${day} ${time} ${merchant}`;

describe('parse — 여러 건 붙여넣기', () => {
  it('봉투 헤더 하나에 문자 2건이 이어 붙어도 2건으로 읽는다', () => {
    const text = `[Web발신]\n${KB('1234', '12,000', '11', '12:30', '스타벅스')}\n${KB('5678', '3,000', '12', '13:00', '편의점')}`;
    const result = parse(text, { now: NOW });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((t) => t.merchantRaw)).toEqual(['스타벅스', '편의점']);
    expect(result.unparsed).toEqual([]);
  });

  it('멀티라인 문자 2건이 봉투 하나에 붙어도 2건으로 읽는다', () => {
    const text = [
      '[Web발신]',
      '신한카드(1234)승인',
      '홍길동',
      '12,000원 일시불',
      '08/11 12:30',
      '스타벅스',
      '신한카드(5678)승인',
      '홍길동',
      '3,000원 일시불',
      '08/12 13:00',
      '편의점',
    ].join('\n');
    const result = parse(text, { now: NOW });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((t) => t.accountLast4)).toEqual(['1234', '5678']);
  });

  it('한 번에 30건을 붙여넣어도 전부 읽는다', () => {
    const messages = Array.from({ length: 30 }, (_, i) =>
      KB('1234', `${i + 1},000`, '11', `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, `가맹점${i}`),
    );
    const result = parse(messages.join('\n\n'), { now: NOW });

    expect(result.transactions).toHaveLength(30);
    expect(result.unparsed).toEqual([]);
  });

  it('같은 문자를 두 번 붙여넣으면 1건만 남고 중복으로 센다', () => {
    const one = KB('1234', '12,000', '11', '12:30', '스타벅스');
    const result = parse(`${one}\n\n${one}`, { now: NOW });

    expect(result.transactions).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('여러 카드사 문자가 섞여도 각각의 어댑터로 읽는다', () => {
    const text = [
      '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n08/11 12:30\n스타벅스',
      KB('5678', '3,300', '11', '13:00', '편의점'),
      '[토스뱅크] 08/11 14:00 홍길동 출금 5,000원 잔액 1,000,000원',
    ].join('\n\n');
    const result = parse(text, { now: NOW });

    expect(result.transactions).toHaveLength(3);
    expect(result.matchedAdapters).toEqual(['shinhan-card', 'kb-card', 'toss-bank']);
    expect(result.matchedAdapter).toBe('shinhan-card');
  });
});

describe('parse — 실패 처리', () => {
  it('알 수 없는 문자는 원문 그대로 unparsed 에 남는다', () => {
    const junk = '[Web발신]\n무료 쿠폰이 도착했어요! 지금 확인하세요';
    const result = parse(junk, { now: NOW });

    expect(result.transactions).toEqual([]);
    expect(result.unparsed).toEqual([junk]);
    expect(result.matchedAdapter).toBeNull();
  });

  it('읽은 문자와 못 읽은 문자가 섞이면 둘 다 돌려준다', () => {
    const text = `${KB('1234', '12,000', '11', '12:30', '스타벅스')}\n\n광고입니다 무료체험 신청하세요`;
    const result = parse(text, { now: NOW });

    expect(result.transactions).toHaveLength(1);
    expect(result.unparsed).toHaveLength(1);
  });

  it('빈 입력은 조용히 빈 결과를 돌려준다', () => {
    expect(parse('', { now: NOW })).toMatchObject({
      transactions: [],
      unparsed: [],
      matchedAdapter: null,
      duplicateCount: 0,
    });
    expect(parse('   \n\n  ', { now: NOW }).unparsed).toEqual([]);
  });

  it('모든 블록은 거래·중복·실패 중 하나로 귀결된다 — 조용히 사라지는 블록은 없다', () => {
    const text = [
      KB('1234', '12,000', '11', '12:30', '스타벅스'),
      '광고 문자입니다',
      '[토스뱅크] 08/11 14:00 홍길동 출금 5,000원',
      '깨진 문자 조각',
    ].join('\n\n');
    const result = parse(text, { now: NOW });
    const blockCount = splitBlocks(normalizeText(text)).length;

    expect(result.transactions.length + result.duplicateCount + result.unparsed.length).toBe(
      blockCount,
    );
  });

  it('now 를 넘기지 않아도 동작한다', () => {
    expect(() => parse(KB('1234', '12,000', '11', '12:30', '스타벅스'))).not.toThrow();
  });
});

describe('parse — 개인정보 보호', () => {
  it('카드번호 전체가 원문에 있으면 raw_payload 에서 마스킹한다', () => {
    const text =
      '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n08/11 12:30\n스타벅스\n카드번호 1234-5678-9012-3456';
    const result = parse(text, { now: NOW });

    expect(result.transactions).toHaveLength(1);
    const payload = result.transactions[0]?.rawPayload.text ?? '';
    expect(payload).not.toContain('5678-9012');
    expect(payload).toContain('1234-****-****-3456');
    expect(findMisparses(text, result.transactions[0]!)).toEqual([]);
  });
});

describe('parse — 성능', () => {
  it('2,000건을 선형 시간에 처리한다 (O(n²) 없음)', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      KB('1234', `${(i % 900) + 100},000`, '11', `${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, `가맹점${i}`),
    ).join('\n\n');

    const started = Date.now();
    const result = parse(many, { now: NOW });
    const elapsed = Date.now() - started;

    expect(result.transactions.length + result.duplicateCount).toBe(2000);
    expect(elapsed).toBeLessThan(3000);
  });
});
