import type { AdapterFixture } from './types.js';

export const tossBankFixture: AdapterFixture = {
  adapterId: 'toss-bank',
  cases: [
    {
      name: '출금 (스펙 예시 4)',
      text: '[토스뱅크] 08/11 12:30 홍길동 출금 12,000원 잔액 1,000,000원',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        issuer: '토스뱅크',
        merchantRaw: '홍길동',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
        isPending: false,
        isCancellation: false,
      },
    },
    {
      name: '입금은 income 으로',
      text: '[토스뱅크] 08/11 12:30 회사 입금 2,500,000원 잔액 3,700,000원',
      expect: 'parsed',
      tx: { amount: 2500000, kind: 'income', merchantRaw: '회사' },
    },
    {
      name: '잔액 꼬리가 없어도 읽는다',
      text: '[토스뱅크] 08/11 12:30 스타벅스 출금 4,500원',
      expect: 'parsed',
      tx: { amount: 4500, merchantRaw: '스타벅스' },
    },
    {
      name: '방향이 금액 앞에 오는 변형',
      text: '[토스뱅크] 홍길동님 08/11 12:30 출금 12,000원 스타벅스 잔액 1,000,000원',
      expect: 'parsed',
      tx: { amount: 12000, kind: 'expense', merchantRaw: '스타벅스' },
    },
    {
      name: '잔액을 거래 금액으로 읽지 않는다',
      text: '[토스뱅크] 08/11 12:30 편의점 출금 3,000원 잔액 9,999,999원',
      expect: 'parsed',
      tx: { amount: 3000 },
    },
    {
      name: '금액에 원 표기가 없으면 읽지 않는다',
      text: '[토스뱅크] 08/11 12:30 홍길동 출금 12,000 잔액 1,000,000원',
      expect: 'unparsed',
    },
    {
      name: '시각이 없으면 읽지 않는다',
      text: '[토스뱅크] 08/11 홍길동 출금 12,000원 잔액 1,000,000원',
      expect: 'unparsed',
    },
    {
      name: '방향 표기가 없으면 읽지 않는다',
      text: '[토스뱅크] 08/11 12:30 홍길동 12,000원 잔액 1,000,000원',
      expect: 'unparsed',
    },
    {
      name: '적요가 숫자뿐이면 읽지 않는다',
      text: '[토스뱅크] 08/11 12:30 123456 출금 12,000원 잔액 1,000,000원',
      expect: 'unparsed',
    },
  ],
};
