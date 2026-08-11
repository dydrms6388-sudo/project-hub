import type { AdapterFixture } from './types.js';

export const shinhanCardFixture: AdapterFixture = {
  adapterId: 'shinhan-card',
  cases: [
    {
      name: '정상 승인 (스펙 예시 1)',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n08/11 12:30\n스타벅스강남2호점\n누적1,234,000원',
      expect: 'parsed',
      tx: {
        amount: 12000,
        kind: 'expense',
        isCancellation: false,
        accountLast4: '1234',
        issuer: '신한',
        installmentMonths: null,
        merchantRaw: '스타벅스강남2호점',
        merchantNormalized: '스타벅스강남2호점',
        occurredAt: '2026-08-11T03:30:00.000Z',
        hasTime: true,
        isPending: true,
      },
    },
    {
      name: '승인 취소는 isCancellation 으로 표시된다',
      text: '[Web발신]\n신한카드(1234)취소\n홍길동\n12,000원\n08/11 12:30\n스타벅스강남2호점',
      expect: 'parsed',
      tx: { amount: 12000, isCancellation: true, isPending: false },
    },
    {
      name: '할부 3개월',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n300,000원 3개월\n08/11 12:30\n하이마트',
      expect: 'parsed',
      tx: { amount: 300000, installmentMonths: 3 },
    },
    {
      name: '한 줄 포맷',
      text: '신한카드(1234)승인 12,000원 일시불 08/11 12:30 스타벅스',
      expect: 'parsed',
      tx: { amount: 12000, accountLast4: '1234', merchantRaw: '스타벅스' },
    },
    {
      name: '\\r\\n 줄바꿈과 공백 변형',
      text: '[Web발신]\r\n신한카드 (1234) 승인\r\n홍길동\r\n 12,000 원  일시불 \r\n08/11  12:30\r\n스타벅스',
      expect: 'parsed',
      tx: { amount: 12000, accountLast4: '1234' },
    },
    {
      name: '연도 없는 미래 날짜는 작년으로 보정',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n12/25 18:00\n스타벅스',
      expect: 'parsed',
      // KST 2025-12-25 18:00 → UTC 09:00
      tx: { occurredAt: '2025-12-25T09:00:00.000Z' },
    },
    {
      name: '해외 승인은 원화만 저장하고 외화는 raw_payload 로',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n13,500원 일시불\n08/11 12:30\nAMAZON.COM\nUSD 10.50',
      expect: 'parsed',
      tx: { amount: 13500, merchantRaw: 'AMAZON.COM' },
    },
    {
      name: '누적 금액을 거래 금액으로 읽지 않는다',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n3,000원 일시불\n08/11 12:30\n편의점\n누적9,999,999원',
      expect: 'parsed',
      tx: { amount: 3000 },
    },
    {
      name: '문자가 중간에 잘리면 읽지 않는다',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시',
      expect: 'unparsed',
    },
    {
      name: '가맹점명이 없으면 읽지 않는다',
      text: '[Web발신]\n신한카드(1234)승인\n홍길동\n12,000원 일시불\n08/11 12:30',
      expect: 'unparsed',
    },
  ],
};
