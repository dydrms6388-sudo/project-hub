import { createBankAdapter } from '../lib/bank-adapter.js';

const DATE = '(?<mon>\\d{1,2})/(?<day>\\d{1,2})\\s+(?<hh>\\d{1,2}):(?<mi>\\d{2})';
const TAIL = '(?:\\s*잔액\\s*[\\d,]+\\s*원?)?$';

export const kakaoBank = createBankAdapter({
  id: 'kakao-bank',
  issuer: '카카오뱅크',
  priority: 21,
  detect: /\[?카카오뱅크\]?/,
  singleLine: [
    // [카카오뱅크] 08/11 12:30 스타벅스 출금 12,000원 잔액 1,000,000원
    new RegExp(
      `^\\[?카카오뱅크\\]?\\s*(?:\\S+님\\s*)?${DATE}\\s+(?<merchant>.+?)\\s+(?<dir>입금|출금)\\s+(?<amount>[\\d,]+)\\s*원${TAIL}`,
    ),
    // [카카오뱅크] 홍길동님 08/11 12:30 12,000원 출금 스타벅스 잔액 1,000,000원
    new RegExp(
      `^\\[?카카오뱅크\\]?\\s*(?:\\S+님\\s*)?${DATE}\\s+(?<amount>[\\d,]+)\\s*원\\s+(?<dir>입금|출금)\\s+(?<merchant>.+?)${TAIL}`,
    ),
  ],
});
