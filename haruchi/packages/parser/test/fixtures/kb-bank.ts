import type { AdapterFixture } from './types.js';

export const kbBankFixture: AdapterFixture = {
  adapterId: 'kb-bank',
  cases: [
    {
      name: '입금 (스펙 예시 6) — 원 표기 없음',
      text: '[Web발신]\n국민은행 08/11 12:30 입금 2,500,000 급여 잔액 3,700,000',
      expect: 'parsed',
      tx: {
        amount: 2500000,
        kind: 'income',
        issuer: 'KB국민은행',
        merchantRaw: '급여',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
        isPending: false,
      },
    },
    {
      name: '출금',
      text: '[Web발신]\n국민은행 08/11 12:30 출금 120,000 관리비 잔액 3,580,000',
      expect: 'parsed',
      tx: { amount: 120000, kind: 'expense', merchantRaw: '관리비' },
    },
    {
      name: 'KB 접두어 표기',
      text: 'KB국민은행 08/11 12:30 입금 500,000 이체 잔액 1,000,000',
      expect: 'parsed',
      tx: { amount: 500000, kind: 'income' },
    },
    {
      name: '적요가 방향 앞에 오는 변형',
      text: '국민은행 08/11 12:30 급여 입금 2,500,000 잔액 3,700,000',
      expect: 'parsed',
      tx: { amount: 2500000, kind: 'income', merchantRaw: '급여' },
    },
    {
      name: '원 표기가 있어도 읽는다',
      text: '국민은행 08/11 12:30 출금 12,000원 스타벅스 잔액 1,000,000원',
      expect: 'parsed',
      tx: { amount: 12000, merchantRaw: '스타벅스' },
    },
    {
      name: '계좌 뒤 4자리 표기',
      text: '국민은행(1234) 08/11 12:30 출금 12,000 스타벅스 잔액 1,000,000',
      expect: 'parsed',
      tx: { accountLast4: '1234' },
    },
    {
      name: '잔액만 있고 거래 금액이 없으면 읽지 않는다',
      text: '국민은행 08/11 12:30 잔액 3,700,000',
      expect: 'unparsed',
    },
    {
      name: '적요가 없으면 읽지 않는다',
      text: '국민은행 08/11 12:30 입금 2,500,000',
      expect: 'unparsed',
    },
    {
      name: '시각이 없으면 읽지 않는다',
      text: '국민은행 08/11 입금 2,500,000 급여',
      expect: 'unparsed',
    },
  ],
};
