import { cardSingleLine, createCardAdapter } from '../lib/card-adapter.js';

const HEAD = '삼성카드\\s*(?:[(（]?(?<last4>\\d{4})[)）]?)?';

export const samsungCard = createCardAdapter({
  id: 'samsung-card',
  issuer: '삼성',
  priority: 12,
  detect: /삼성카드/,
  statusPattern: /삼성카드[^\n]{0,12}?(승인\s*취소|부분\s*취소|취소|승인)/,
  last4Anchor: /삼성카드\s*[(（]?/,
  singleLine: [cardSingleLine(HEAD, 'status-first')],
});
