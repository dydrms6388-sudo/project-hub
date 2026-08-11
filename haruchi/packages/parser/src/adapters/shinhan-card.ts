import { cardSingleLine, createCardAdapter } from '../lib/card-adapter.js';

const HEAD = '신한카드\\s*[(（]?(?<last4>\\d{4})?[)）]?';

export const shinhanCard = createCardAdapter({
  id: 'shinhan-card',
  issuer: '신한',
  priority: 10,
  detect: /신한카드/,
  statusPattern: /신한카드\s*[(（]?\d{0,4}[)）]?\s*(승인\s*취소|부분\s*취소|취소|승인)/,
  last4Anchor: /신한카드\s*[(（]?/,
  singleLine: [cardSingleLine(HEAD, 'status-first')],
});
