import type { AdapterFixture } from './types.js';

export const hyundaiCardFixture: AdapterFixture = {
  adapterId: 'hyundai-card',
  cases: [
    {
      name: '멀티라인 + 할부 3개월 (스펙 예시 3)',
      text: '[Web발신]\n현대카드 12,000원 승인\n08/11 12:30\n(주)스타벅스코리아\n할부 3개월',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        issuer: '현대',
        installmentMonths: 3,
        merchantRaw: '(주)스타벅스코리아',
        // 법인격 표기는 정규화 단계에서 제거된다
        merchantNormalized: '스타벅스코리아',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
      },
    },
    {
      name: '한 줄 포맷',
      text: '현대카드 12,000원 승인 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { amount: 12000, merchantRaw: '스타벅스' },
    },
    {
      name: '승인 취소',
      text: '[Web발신]\n현대카드 12,000원 승인취소\n08/11 12:30\n스타벅스',
      expect: 'parsed',
      tx: { isCancellation: true, isPending: false },
    },
    {
      name: '시각 없는 멀티라인',
      text: '[Web발신]\n현대카드 12,000원 승인\n08/11\n스타벅스',
      expect: 'parsed',
      tx: { hasTime: false, occurredAt: '2026-08-10T15:00:00.000Z' },
    },
    {
      name: '가맹점 줄이 없으면 할부 줄을 가맹점으로 쓰지 않는다',
      text: '[Web발신]\n현대카드 12,000원 승인\n08/11 12:30\n할부 3개월',
      expect: 'unparsed',
    },
    {
      name: '㈜ 기호도 정규화한다',
      text: '[Web발신]\n현대카드 45,000원 승인\n08/11 12:30\n㈜배달의민족',
      expect: 'parsed',
      tx: { merchantNormalized: '배달의민족' },
    },
    {
      name: '61개월 할부처럼 존재하지 않는 값은 읽지 않는다',
      text: '[Web발신]\n현대카드 12,000원 승인\n08/11 12:30\n스타벅스\n할부 61개월',
      expect: 'unparsed',
    },
    {
      name: '이모지가 섞여도 금액을 정확히 읽는다',
      text: '[Web발신]\n현대카드 12,000원 승인 🎉\n08/11 12:30\n스타벅스',
      expect: 'parsed',
      tx: { amount: 12000 },
    },
    {
      name: '잔액 줄을 금액으로 읽지 않는다',
      text: '[Web발신]\n현대카드 7,700원 승인\n08/11 12:30\n스타벅스\n잔액 1,000,000원',
      expect: 'parsed',
      tx: { amount: 7700, merchantRaw: '스타벅스' },
    },
  ],
};
