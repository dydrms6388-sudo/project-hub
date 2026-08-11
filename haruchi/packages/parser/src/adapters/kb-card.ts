import { cardSingleLine, createCardAdapter } from '../lib/card-adapter.js';

const HEAD = '(?:KB)?국민카드\\s*(?:[(（]?(?<last4>\\d{4})[)）]?)?';

export const kbCard = createCardAdapter({
  id: 'kb-card',
  issuer: 'KB국민',
  priority: 11,
  detect: /(?:KB)?국민카드/,
  statusPattern: /(?:KB)?국민카드[^\n]{0,12}?(승인\s*취소|부분\s*취소|취소|승인)/,
  last4Anchor: /(?:KB)?국민카드\s*[(（]?/,
  singleLine: [cardSingleLine(HEAD, 'status-first')],
});
