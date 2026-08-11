/**
 * 상호명 정규화 + 타당성 검사.
 *
 * 정규화 결과는 dedupe_key 와 자동분류의 입력이 되므로 결정적이어야 한다.
 * 원문(merchantRaw)은 절대 훼손하지 않고 별도로 보관한다.
 */

/** 법인격 표기 — 같은 가맹점이 표기만 다르게 오는 주된 원인 */
const CORPORATE_FORMS = /\(주\)|\(유\)|㈜|㈜|주식회사|유한회사|주\)/g;

/** 카드사가 붙이는 매입/승인 접미사 */
const TRAILING_NOISE = /(승인|취소|매입|정상|일시불)$/;

/**
 * 표시용/대조용 정규화.
 * - 법인격 표기 제거
 * - 공백 전부 제거 (카드사마다 띄어쓰기가 다르다)
 * - 유니코드 정규화(NFC)로 자모 분리 입력 흡수
 *
 * 지점명(강남2호점)은 남긴다. 지점이 다르면 다른 가맹점으로 보는 편이
 * 사용자 기대에 가깝고, 잘못 합치면 되돌릴 방법이 없다.
 */
export function normalizeMerchant(raw: string): string {
  let s = raw.normalize('NFC');
  s = s.replace(CORPORATE_FORMS, '');
  s = s.replace(/[\s ​]+/g, '');
  s = s.replace(/^[.,\-/*·]+|[.,\-/*·]+$/g, '');
  s = s.replace(TRAILING_NOISE, '');
  return s;
}

/** dedupe_key 에 쓰는 정규화 상호명 앞 8자 (스펙 4-1) */
export function merchantHead8(normalized: string): string {
  return [...normalized].slice(0, 8).join('');
}

/** 금액/잔액/날짜 조각을 상호명으로 잘못 집어오는 것을 막는다. */
const MERCHANT_BLOCKLIST = /누적|잔액|누계|한도|포인트|적립|^\d[\d,:/\s]*$/;

/**
 * 상호명으로 인정할 만한 문자열인지.
 * 여기서 false 면 어댑터는 파싱 실패를 반환한다 — 빈 상호명으로 등록하지 않는다.
 */
export function isPlausibleMerchant(raw: string): boolean {
  const t = raw.trim();
  if (t.length === 0 || t.length > 60) return false;
  if (MERCHANT_BLOCKLIST.test(t)) return false;
  // 최소한 글자(한글/영문)가 하나는 있어야 한다.
  return /[가-힣ㄱ-ㅎa-zA-Z]/.test(t);
}

/**
 * 카드번호 전체가 원문에 노출된 경우 마스킹한다 (스펙 7장-2).
 * 원문 저장 전에 반드시 통과시킨다.
 */
export function maskCardNumbers(text: string): string {
  return text.replace(/\b(\d{4})[- ]?\d{4}[- ]?\d{2}\d{2}[- ]?(\d{4})\b/g, '$1-****-****-$2');
}
