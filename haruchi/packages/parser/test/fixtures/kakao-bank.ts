import type { AdapterFixture } from './types.js';

export const kakaoBankFixture: AdapterFixture = {
  adapterId: 'kakao-bank',
  cases: [
    {
      name: '출금',
      text: '[카카오뱅크] 08/11 12:30 스타벅스 출금 12,000원 잔액 1,000,000원',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        issuer: '카카오뱅크',
        merchantRaw: '스타벅스',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
      },
    },
    {
      name: '입금',
      text: '[카카오뱅크] 08/11 09:00 급여 입금 2,500,000원 잔액 3,700,000원',
      expect: 'parsed',
      tx: { amount: 2500000, kind: 'income', merchantRaw: '급여' },
    },
    {
      name: '예금주 표기가 붙은 변형',
      text: '[카카오뱅크] 홍길동님 08/11 12:30 12,000원 출금 스타벅스 잔액 1,000,000원',
      expect: 'parsed',
      tx: { amount: 12000, kind: 'expense', merchantRaw: '스타벅스' },
    },
    {
      name: '잔액 없는 형태',
      text: '[카카오뱅크] 08/11 12:30 편의점 출금 3,300원',
      expect: 'parsed',
      tx: { amount: 3300 },
    },
    {
      name: '괄호 없는 표기',
      text: '카카오뱅크 08/11 12:30 편의점 출금 3,300원',
      expect: 'parsed',
      tx: { amount: 3300 },
    },
    {
      name: '잔액을 금액으로 읽지 않는다',
      text: '[카카오뱅크] 08/11 12:30 편의점 출금 1,000원 잔액 8,888,888원',
      expect: 'parsed',
      tx: { amount: 1000 },
    },
    {
      name: '시각 없으면 읽지 않는다',
      text: '[카카오뱅크] 08/11 편의점 출금 3,300원',
      expect: 'unparsed',
    },
    {
      name: '방향 표기 없으면 읽지 않는다',
      text: '[카카오뱅크] 08/11 12:30 편의점 3,300원 잔액 1,000,000원',
      expect: 'unparsed',
    },
    {
      name: '금액이 0원이면 읽지 않는다',
      text: '[카카오뱅크] 08/11 12:30 편의점 출금 0원',
      expect: 'unparsed',
    },
  ],
};
