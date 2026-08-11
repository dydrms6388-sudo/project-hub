import { createBankAdapter } from '../lib/bank-adapter.js';

const DATE = '(?<mon>\\d{1,2})/(?<day>\\d{1,2})\\s+(?<hh>\\d{1,2}):(?<mi>\\d{2})';
const TAIL = '(?:\\s*잔액\\s*[\\d,]+\\s*원?)?$';

export const tossBank = createBankAdapter({
  id: 'toss-bank',
  issuer: '토스뱅크',
  priority: 20,
  detect: /\[?토스뱅크\]?/,
  singleLine: [
    // [토스뱅크] 08/11 12:30 홍길동 출금 12,000원 잔액 1,000,000원
    new RegExp(
      `^\\[?토스뱅크\\]?\\s*${DATE}\\s+(?<merchant>.+?)\\s+(?<dir>입금|출금)\\s+(?<amount>[\\d,]+)\\s*원${TAIL}`,
    ),
    // [토스뱅크] 홍길동님 08/11 12:30 출금 12,000원 스타벅스 잔액 1,000,000원
    new RegExp(
      `^\\[?토스뱅크\\]?\\s*(?:\\S+님\\s*)?${DATE}\\s+(?<dir>입금|출금)\\s+(?<amount>[\\d,]+)\\s*원\\s+(?<merchant>.+?)${TAIL}`,
    ),
  ],
});
