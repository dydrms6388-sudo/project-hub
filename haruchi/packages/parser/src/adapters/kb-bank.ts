import { createBankAdapter } from '../lib/bank-adapter.js';

const DATE = '(?<mon>\\d{1,2})/(?<day>\\d{1,2})\\s+(?<hh>\\d{1,2}):(?<mi>\\d{2})';
// 은행 알림은 금액에 '원'이 붙지 않는 경우가 흔하다. 잔액 꼬리는 통째로 버린다.
const TAIL = '(?:\\s*잔액\\s*[\\d,]+\\s*원?)?$';

export const kbBank = createBankAdapter({
  id: 'kb-bank',
  issuer: 'KB국민은행',
  priority: 22,
  detect: /(?:KB)?국민은행/,
  singleLine: [
    // 국민은행 08/11 12:30 입금 2,500,000 급여 잔액 3,700,000
    new RegExp(
      `^(?:KB)?국민은행\\s*(?:[(（]?(?<last4>\\d{4})[)）]?\\s*)?${DATE}\\s+(?<dir>입금|출금)\\s+(?<amount>[\\d,]+)\\s*원?\\s+(?<merchant>.+?)${TAIL}`,
    ),
    // 국민은행 08/11 12:30 급여 입금 2,500,000 잔액 3,700,000
    new RegExp(
      `^(?:KB)?국민은행\\s*(?:[(（]?(?<last4>\\d{4})[)）]?\\s*)?${DATE}\\s+(?<merchant>.+?)\\s+(?<dir>입금|출금)\\s+(?<amount>[\\d,]+)\\s*원?${TAIL}`,
    ),
  ],
});
