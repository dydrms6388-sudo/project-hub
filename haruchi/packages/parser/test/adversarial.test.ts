/**
 * 패널 C — 파서 적대 테스트.
 *
 * 목적은 파서를 통과시키는 것이 아니라 깨뜨리는 것이다.
 * 각 어댑터에 대해 변형 문자를 생성하고, 결과를 [정상/오파싱/unparsed] 로 분류한다.
 * 오파싱이 1건이라도 있으면 P0 다 — 파싱 실패는 허용하고 틀린 값만 잡아낸다.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/index.js';
import { NOW, fixtures } from './fixtures/index.js';
import { findMisparses } from './helpers/invariants.js';

interface Canonical {
  adapterId: string;
  text: string;
  amountToken: string;
  merchant: string;
}

/** 각 어댑터의 대표 문자. 여기서 변형을 파생시킨다. */
const CANONICALS: Canonical[] = [
  {
    adapterId: 'shinhan-card',
    text: '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n08/11 12:30\n스타벅스강남2호점\n누적1,234,000원',
    amountToken: '12,000',
    merchant: '스타벅스강남2호점',
  },
  {
    adapterId: 'kb-card',
    text: 'KB국민카드 1234 승인 홍길동 12,000원 일시불 08/11 12:30 스타벅스',
    amountToken: '12,000',
    merchant: '스타벅스',
  },
  {
    adapterId: 'samsung-card',
    text: '[Web발신]\n삼성카드 승인 12,000원 일시불 08/11 12:30 스타벅스',
    amountToken: '12,000',
    merchant: '스타벅스',
  },
  {
    adapterId: 'hyundai-card',
    text: '[Web발신]\n현대카드 12,000원 승인\n08/11 12:30\n(주)스타벅스코리아\n할부 3개월',
    amountToken: '12,000',
    merchant: '(주)스타벅스코리아',
  },
  {
    adapterId: 'toss-bank',
    text: '[토스뱅크] 08/11 12:30 홍길동 출금 12,000원 잔액 1,000,000원',
    amountToken: '12,000',
    merchant: '홍길동',
  },
  {
    adapterId: 'kakao-bank',
    text: '[카카오뱅크] 08/11 12:30 스타벅스 출금 12,000원 잔액 1,000,000원',
    amountToken: '12,000',
    merchant: '스타벅스',
  },
  {
    adapterId: 'kb-bank',
    text: '국민은행 08/11 12:30 입금 2,500,000 급여 잔액 3,700,000',
    amountToken: '2,500,000',
    merchant: '급여',
  },
];

/** 변형 생성기 — 카드사 문자에서 실제로 관찰되는 흔들림 + 의도적 파괴 */
function mutate(base: Canonical): Array<{ label: string; text: string }> {
  const { text, amountToken, merchant } = base;
  const other = '[Web발신]\n삼성카드 승인 3,300원 일시불 07/02 09:15 편의점';
  return [
    { label: '띄어쓰기 제거', text: text.replace(/ /g, '') },
    { label: '띄어쓰기 과다', text: text.replace(/ /g, '   ') },
    { label: '전각 공백 삽입', text: text.replace(/ /g, '　') },
    { label: 'CRLF 줄바꿈', text: text.replace(/\n/g, '\r\n') },
    { label: '끝에 이모지', text: `${text} 🎉` },
    { label: '중간에 이모지', text: text.replace(merchant, `${merchant}🍀`) },
    { label: '앞부분만 남기고 잘림', text: text.slice(0, Math.floor(text.length * 0.5)) },
    { label: '거의 다 남기고 잘림', text: text.slice(0, Math.floor(text.length * 0.85)) },
    { label: '금액 0원', text: text.replace(amountToken, '0') },
    { label: '금액 100억원', text: text.replace(amountToken, '10,000,000,000') },
    { label: '금액 콤마 깨짐', text: text.replace(amountToken, '1,2,000') },
    { label: '자정 00:00', text: text.replace('12:30', '00:00') },
    { label: '평년 2월 29일', text: text.replace('08/11', '02/29') },
    { label: '13월', text: text.replace('08/11', '13/11') },
    { label: '가맹점에 숫자·괄호·영문', text: text.replace(merchant, `${merchant}(2호)B1 CU`) },
    { label: '가맹점이 숫자뿐', text: text.replace(merchant, '99887766') },
    { label: '다른 카드사 문자 혼합', text: `${text}\n\n${other}` },
    { label: '같은 문자 두 번', text: `${text}\n\n${text}` },
    // 봉투 헤더 하나에 두 건이 이어 붙는 경우. 블록 분리가 어긋나면
    // 두 번째 메시지가 첫 번째의 가맹점명으로 빨려 들어간다 (실제로 발견된 P0).
    { label: '봉투 하나에 두 건 (빈 줄 없음)', text: `${text}\n${other.replace('[Web발신]\n', '')}` },
    { label: '잔액 꼬리 추가', text: `${text} 잔액 9,999,999원` },
    { label: '한글 자모 분리', text: text.normalize('NFD') },
  ];
}

describe('패널 C — 적대 변형', () => {
  const tally = { parsed: 0, unparsed: 0, misparsed: 0 };

  for (const base of CANONICALS) {
    describe(base.adapterId, () => {
      const variants = mutate(base);

      it('변형을 10개 이상 만든다', () => {
        expect(variants.length).toBeGreaterThanOrEqual(10);
      });

      for (const variant of variants) {
        it(`오파싱 없음: ${variant.label}`, () => {
          const result = parse(variant.text, { now: NOW });

          const violations: string[] = [];
          for (const tx of result.transactions) {
            violations.push(...findMisparses(variant.text, tx));
          }

          if (violations.length > 0) tally.misparsed += 1;
          else if (result.transactions.length > 0) tally.parsed += 1;
          else tally.unparsed += 1;

          // 오파싱은 P0. 파싱 실패(unparsed)는 허용한다.
          expect(violations).toEqual([]);

          // 읽지 못한 것은 반드시 사용자에게 돌려줘야 한다.
          if (result.transactions.length === 0) {
            expect(result.unparsed.length).toBeGreaterThan(0);
          }
        });
      }
    });
  }

  it('테스트가 공허하지 않다 — 상당수 변형이 실제로 파싱된다', () => {
    expect(tally.parsed).toBeGreaterThan(CANONICALS.length * 5);
    expect(tally.misparsed).toBe(0);
  });
});

describe('패널 C — 픽스처 전체에 불변식 적용', () => {
  for (const fixture of fixtures) {
    for (const testCase of fixture.cases) {
      if (testCase.expect !== 'parsed') continue;
      it(`${fixture.adapterId}: ${testCase.name}`, () => {
        const result = parse(testCase.text, { now: testCase.now ?? NOW });
        for (const tx of result.transactions) {
          expect(findMisparses(testCase.text, tx)).toEqual([]);
        }
      });
    }
  }
});
