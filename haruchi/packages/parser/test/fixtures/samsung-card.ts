import type { AdapterFixture } from './types.js';

export const samsungCardFixture: AdapterFixture = {
  adapterId: 'samsung-card',
  cases: [
    {
      name: '승인 취소, 시각 없음 (스펙 예시 5)',
      text: '[Web발신]\n삼성카드 승인 취소 12,000원 08/11 스타벅스',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        isCancellation: true,
        hasTime: false,
        issuer: '삼성',
        accountLast4: null,
        merchantRaw: '스타벅스',
        occurredAt: '2026-08-10T15:00:00.000Z',
        isPending: false,
      },
    },
    {
      name: '정상 승인',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { amount: 12000, isCancellation: false, hasTime: true },
    },
    {
      name: '할부 12개월',
      text: '[Web발신]\n삼성카드 승인 1,200,000원 12개월 08/11 12:30 애플스토어',
      expect: 'parsed',
      tx: { amount: 1200000, installmentMonths: 12 },
    },
    {
      name: '카드 뒤 4자리 표기가 있는 변형',
      text: '[Web발신]\n삼성카드(9876) 승인 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { accountLast4: '9876' },
    },
    {
      name: '100억원도 정확히 읽는다',
      text: '[Web발신]\n삼성카드 승인 10,000,000,000원 일시불 08/11 12:30 부동산',
      expect: 'parsed',
      tx: { amount: 10000000000 },
    },
    {
      name: '자정 00:00',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 08/11 00:00 편의점',
      expect: 'parsed',
      // KST 2026-08-11 00:00 → UTC 2026-08-10 15:00
      tx: { occurredAt: '2026-08-10T15:00:00.000Z', hasTime: true },
    },
    {
      name: '평년 2월 29일은 읽지 않는다',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 02/29 12:30 스타벅스',
      expect: 'unparsed',
    },
    {
      name: '25시 같은 불가능한 시각은 읽지 않는다',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 08/11 25:30 스타벅스',
      expect: 'unparsed',
    },
    {
      name: '13월은 읽지 않는다',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 13/11 12:30 스타벅스',
      expect: 'unparsed',
    },
    {
      name: '가맹점이 숫자뿐이면 읽지 않는다',
      text: '[Web발신]\n삼성카드 승인 12,000원 일시불 08/11 12:30 123456',
      expect: 'unparsed',
    },
  ],
};
