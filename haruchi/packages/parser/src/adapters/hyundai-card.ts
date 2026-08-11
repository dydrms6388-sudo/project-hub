import { cardSingleLine, createCardAdapter } from '../lib/card-adapter.js';

const HEAD = '현대카드\\s*(?:[(（]?(?<last4>\\d{4})[)）]?)?';

export const hyundaiCard = createCardAdapter({
  id: 'hyundai-card',
  issuer: '현대',
  priority: 13,
  detect: /현대카드/,
  // 현대는 금액이 상태 토큰보다 앞에 온다: "현대카드 12,000원 승인"
  statusPattern: /현대카드[^\n]{0,20}?(승인\s*취소|부분\s*취소|취소|승인)/,
  last4Anchor: /현대카드\s*[(（]?/,
  singleLine: [cardSingleLine(HEAD, 'amount-first'), cardSingleLine(HEAD, 'status-first')],
});
