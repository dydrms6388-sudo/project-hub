import type { AdapterFixture } from './types.js';

export const kbCardFixture: AdapterFixture = {
  adapterId: 'kb-card',
  cases: [
    {
      name: '정상 승인 (스펙 예시 2)',
      text: 'KB국민카드 1234 승인 홍길동 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        accountLast4: '1234',
        issuer: 'KB국민',
        merchantRaw: '스타벅스',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
        installmentMonths: null,
      },
    },
    {
      name: '승인 취소',
      text: 'KB국민카드 1234 승인취소 홍길동 12,000원 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { isCancellation: true, amount: 12000 },
    },
    {
      name: '할부 6개월',
      text: 'KB국민카드 1234 승인 홍길동 600,000원 6개월 08/11 12:30 하이마트',
      expect: 'parsed',
      tx: { amount: 600000, installmentMonths: 6 },
    },
    {
      name: '괄호로 감싼 카드 뒤 4자리',
      text: 'KB국민카드(1234) 승인 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { accountLast4: '1234' },
    },
    {
      name: 'KB 접두어 없는 표기',
      text: '국민카드 1234 승인 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { accountLast4: '1234', amount: 12000 },
    },
    {
      name: '누적 꼬리가 붙어도 가맹점만 읽는다',
      text: 'KB국민카드 1234 승인 홍길동 12,000원 일시불 08/11 12:30 스타벅스 누적 1,234,000원',
      expect: 'parsed',
      tx: { merchantRaw: '스타벅스', amount: 12000 },
    },
    {
      name: '시각이 없으면 hasTime=false',
      text: 'KB국민카드 1234 승인 홍길동 12,000원 일시불 08/11 스타벅스',
      expect: 'parsed',
      // 시각 없음 → KST 00:00 → UTC 전날 15:00
      tx: { hasTime: false, occurredAt: '2026-08-10T15:00:00.000Z' },
    },
    {
      name: '콤마 그룹이 깨진 금액은 읽지 않는다',
      text: 'KB국민카드 1234 승인 홍길동 1,2,000원 일시불 08/11 12:30 스타벅스',
      expect: 'unparsed',
    },
    {
      name: '가맹점에 영문·숫자·괄호가 섞여도 읽는다',
      text: 'KB국민카드 1234 승인 홍길동 8,900원 일시불 08/11 12:30 CU강남(2호)점',
      expect: 'parsed',
      tx: { merchantRaw: 'CU강남(2호)점' },
    },
    {
      name: '금액 0원은 거래로 등록하지 않는다',
      text: 'KB국민카드 1234 승인 홍길동 0원 일시불 08/11 12:30 스타벅스',
      expect: 'unparsed',
    },
  ],
};
