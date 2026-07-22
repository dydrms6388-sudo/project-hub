/**
 * 법무·모더레이션 스캐너 (L1~L3, 스팸) — 재사용 모듈.
 * insert 전에 반드시 통과시킨다. 원문에 PII가 있으면 마스킹본만 저장(원문 저장 금지, L1).
 *
 * 판정:
 *   reject  — 게시 불가 (연락처/계좌/주민번호/차량번호/URL/스팸, 또는 특정 개인 식별 L3)
 *   mask    — 상호/학교/실명을 ○○로 가린 뒤 게시
 *   accept  — 그대로 게시
 *
 * 완벽한 NLP가 아니라 "명백한 지뢰"를 높은 재현율로 막는 게 목표. 애매하면 보수적으로 반려.
 */

export type ScanResult =
  | { action: "accept"; text: string }
  | { action: "mask"; text: string; masked: string[] }
  | { action: "reject"; reason: string };

/** L2: 즉시 반려 패턴 (연락처·금융·식별번호·주소·URL·스팸성 연락 유도) */
const HARD_REJECT: { reason: string; re: RegExp }[] = [
  { reason: "휴대전화번호", re: /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  { reason: "유선전화번호", re: /(?:^|[^\d])0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}(?:[^\d]|$)/ },
  { reason: "주민등록번호", re: /\b\d{6}[-\s]?[1-4]\d{6}\b/ },
  { reason: "카드/계좌번호", re: /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,7}(?:[-\s]\d{1,7})?\b/ },
  { reason: "차량번호", re: /\b\d{2,3}\s?[가-힣]\s?\d{4}\b/ },
  { reason: "이메일주소", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { reason: "외부링크", re: /(https?:\/\/|www\.[a-z]|[a-z0-9-]+\.(?:com|net|kr|co\.kr|io|shop|link|me|gg))/i },
  {
    reason: "연락처유도",
    re: /(카톡|카카오톡|오픈\s?채팅|오픈톡|텔레그램|텔레|라인)\s*(아이디|id|주소|추가|문의|:|＠|@)/i,
  },
  {
    reason: "도로명/지번주소",
    re: /[가-힣]{1,10}(특별시|광역시|[가-힣]도)?\s?[가-힣]{1,10}(시|군|구)\s?[가-힣]{1,12}(로|길|동)\s?\d/,
  },
];

/** 스팸/광고/정책위반 키워드 → 반려 (D5, 정책 6) */
const SPAM_WORDS = [
  "광고문의",
  "홍보문의",
  "대출",
  "카지노",
  "토토",
  "배팅",
  "베팅",
  "먹튀",
  "리딩방",
  "주식리딩",
  "코인리딩",
  "선입금",
  "성인",
  "출장",
  "조건만남",
  "비아그라",
  "구매대행",
  "팔로우",
  "무료체험",
];

/** 상호·기관 접미사 (앞의 고유명사를 마스킹) */
const ORG_SUFFIX =
  /([가-힣A-Za-z0-9]{2,10})(주식회사|㈜|\(주\)|그룹|기업|은행|증권|카드|전자|건설|제약|병원|의원|치과|약국|대학교|대학|고등학교|중학교|초등학교|어린이집|유치원)/g;

/** 직함 (앞의 실명을 마스킹). 지시대명사는 이름이 아니므로 stoplist로 보호. */
const NAME_TITLE =
  /([가-힣]{2,4})\s?(씨|님|군|양|팀장|과장|대리|부장|차장|사원|주임|실장|본부장|이사|상무|전무|사장|대표|원장|교수|선생님|강사|점장)/g;
const NAME_STOP = new Set([
  "우리", "저희", "그때", "이번", "저번", "그분", "이분", "저분", "당신", "본인", "그쪽", "이쪽",
  "여기", "거기", "우리팀", "저희팀", "그리고", "그래서", "하지만",
]);

function hasOrgProperNoun(text: string): boolean {
  ORG_SUFFIX.lastIndex = 0;
  return ORG_SUFFIX.test(text);
}
function hasNamedPerson(text: string): boolean {
  NAME_TITLE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_TITLE.exec(text))) {
    if (!NAME_STOP.has(m[1])) return true;
  }
  return false;
}

export function scanUgc(raw: string): ScanResult {
  const text = raw.normalize("NFC").trim();
  if (!text) return { action: "reject", reason: "빈 내용" };

  for (const { reason, re } of HARD_REJECT) {
    if (re.test(text)) return { action: "reject", reason };
  }
  const lower = text.toLowerCase().replace(/\s/g, "");
  for (const w of SPAM_WORDS) {
    if (lower.includes(w)) return { action: "reject", reason: `스팸/광고성(${w})` };
  }

  // L3: 상호 고유명사 + 특정 인물 동시 등장 = 특정 개인 식별 가능 → 반려
  if (hasOrgProperNoun(text) && hasNamedPerson(text)) {
    return { action: "reject", reason: "특정 개인 식별 가능(상호+실명)" };
  }

  // L1: 상호/학교/실명 마스킹
  const masked: string[] = [];
  let out = text.replace(ORG_SUFFIX, (_full, name: string, suffix: string) => {
    masked.push(`${name}${suffix}`);
    return `○○${suffix}`;
  });
  out = out.replace(NAME_TITLE, (full, name: string, title: string) => {
    if (NAME_STOP.has(name)) return full;
    masked.push(name);
    return `○○${title}`;
  });

  if (masked.length) return { action: "mask", text: out, masked };
  return { action: "accept", text };
}
