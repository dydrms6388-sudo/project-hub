/**
 * safety-rules — 채팅·프로필 텍스트 탐지 룰 단일 소스 (A5 §7, PRD §0-42). **런타임 의존성 0.**
 *
 *   import { maskContacts, detectBanned, scoreMessage, normalizeText } from "@duckmate/db/safety-rules";
 *
 *  - CT_*  연락처 패턴  → 마스킹(`[연락처 숨김]` / `[링크 숨김]` / `[계좌 숨김]`). 정규식 문자열은 Postgres ARE 와
 *          **동일 문자열** 로 `mask_contacts()`(SQL, 0030) 에 복사된다. 그러므로 패턴은 JS·ARE 공통 부분집합만 쓴다:
 *          lookbehind ✗, `\b` ✗(대신 `(^|[^…])` 접두 그룹), `\w` ✗(명시 클래스), 비탐욕 `?` ✗(ARE 는 첫 수량자의 탐욕성이
 *          전체 매치에 적용됨), `.` 대신 `[^\n]`. 각 패턴은 **첫 캡처 그룹 = 보존할 접두어**(없으면 `()`) 로 통일하고
 *          치환은 `$1<placeholder>` (SQL 은 `\1<placeholder>`).
 *  - BW_* / SC_* / MN_* / CT_LURE  금칙어·시그널 사전 → `normalizeText()`(NFKC·소문자·zero-width 제거·호환 자모→초성 자모·
 *          음절 NFD 분해·공백/기호 제거) 후 부분 문자열 매칭. 초성만 친 `ㅅㅂ` 은 초성 자모(U+1100~)로, 음절의 종성은
 *          종성 자모(U+11A8~)로 남으므로 "옷방"(ㅅ 종성 + ㅂ 초성) 이 `ㅅㅂ` 에 오탐되지 않는다.
 *  - 평가는 서버에서만 의미가 있다(클라이언트 프리체크는 UX 용, A5 §7.6). TS 가 1차, SQL 트리거가 최종 방어.
 */

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------
export type ContactRuleId = "CT_EMAIL" | "CT_URL" | "CT_PHONE" | "CT_ACCOUNT" | "CT_KAKAO" | "CT_INSTA" | "CT_TELEGRAM_LINE";
export type BannedRuleId =
  | "CT_LURE"
  | "BW_SEXUAL"
  | "BW_HATE"
  | "BW_VIOLENCE"
  | "BW_ILLEGAL"
  | "BW_ADULT_BIZ"
  | "SC_MONEY"
  | "SC_INVEST"
  | "SC_URGENT"
  | "SC_FAST_LOVE"
  | "MN_SCHOOL"
  | "MN_AGE";
export type SafetyRuleId = ContactRuleId | BannedRuleId;
export type SafetyCategory = "contact" | "lure" | "banned" | "scam" | "minor";
/** mask: 치환 / warn: 발신자 인라인 경고 / hold: 수신자 미전달(2회부터 hold 인 룰은 SQL 이 이력으로 판단) / report: 즉시 자동 신고 / score: 점수 합산 */
export type RuleAction = "mask" | "warn" | "hold" | "report" | "score";

export type SafetyHit = {
  ruleId: SafetyRuleId;
  category: SafetyCategory;
  /** 매칭된 원문 조각(증거용, message_flags.matched). 최대 120자 */
  matched: string;
  /** SC_* 점수(A5 §7.3). 그 외 0 */
  score: number;
};
export type ContactHit = SafetyHit & { ruleId: ContactRuleId; span: [number, number] };

export type MaskResult = {
  /** NFKC 정규화 + zero-width 제거 후 마스킹된 본문. 히트가 없어도 정규화된 문자열이다 */
  masked: string;
  hits: ContactHit[];
  changed: boolean;
};

export type Severity = "none" | "mask" | "warn" | "hold" | "report" | "critical";

export type ScoreResult = {
  flags: SafetyHit[];
  masked: string;
  severity: Severity;
  contactHits: number;
  /** 이 메시지 단독 SC_* 점수 합(7일 누적은 SQL) */
  scamScore: number;
  scamBanner: boolean;
  minorSignal: boolean;
  /** 이 메시지 단독으로 hold 확정(BW_ILLEGAL·BW_ADULT_BIZ). BW_SEXUAL/BW_HATE 2회 hold 는 SQL 이력 판정 */
  shouldHold: boolean;
  /** 이 메시지 단독으로 즉시 자동 신고 대상 사유(A5 §7.2·7.5). 누적형(2회·점수)은 SQL */
  autoReport: "THREAT_VIOLENCE" | "OTHER" | "COMMERCIAL_SPAM" | "MINOR_SUSPECT" | null;
  /** A5 §10.2 오프라인 만남 배너 트리거(UX 용) */
  offlineMeeting: boolean;
};

// ---------------------------------------------------------------------------
// 공통 상수
// ---------------------------------------------------------------------------
export const SAFETY_RULES_VERSION = 1;
export const PLACEHOLDER = { contact: "[연락처 숨김]", link: "[링크 숨김]", account: "[계좌 숨김]" } as const;
export const MATCHED_SNIPPET_MAX = 120;
/** SC_* 점수표 (A5 §7.3). SQL 쪽 행동형(SC_OFFAPP·SC_MASS_LIKE·SC_TEMPLATE) 포함 */
export const SCAM_SCORES = {
  SC_MONEY: 3,
  SC_INVEST: 3,
  SC_URGENT: 2,
  SC_OFFAPP: 2,
  SC_MASS_LIKE: 2,
  SC_FAST_LOVE: 1,
  SC_TEMPLATE: 3,
} as const;

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060]/g;

/** NFKC + zero-width 제거. 마스킹·사전 매칭의 공통 전처리(SQL: normalize(t, NFKC) + regexp_replace) */
export function preprocess(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH_RE, "");
}

// ---------------------------------------------------------------------------
// CT_* 연락처 패턴 — 문자열 그대로 SQL mask_contacts() 에 복사됨 (0030 마이그레이션과 1:1)
// ---------------------------------------------------------------------------
export type ContactRule = {
  id: ContactRuleId;
  /** JS `new RegExp(pattern, "gi")` / SQL `regexp_replace(t, pattern, '\1' || placeholder, 'gi')` */
  pattern: string;
  placeholder: (typeof PLACEHOLDER)[keyof typeof PLACEHOLDER];
  /** CT_ACCOUNT 는 SC_MONEY 동시 hit (A5 §7.1) */
  alsoScam?: "SC_MONEY";
};

const SEP = "[\\s._*·-]{0,3}";
const Z = "[0o공영]";
const ONE = "[1li일]";
const X = "[016789lio공영일육칠팔구]";
const D = "[0-9oli공영일이삼사오육칠팔구]";
const ID_HAS_LETTER = "(?=[A-Za-z0-9._-]{0,29}[A-Za-z])";
const TLD =
  "(?:com|net|kr|me|link|io|co|xyz|site|app|shop|gg|tv|org|info|cc|ly|us|life|club|store|top|online|page|space|zone|pro|biz|ai|kim|one)";

/** 평가 순서 = 배열 순서 (이메일 → URL → 전화 → 계좌 → 카톡 → 텔레/라인 → 인스타/@). 앞 룰의 placeholder 는 뒤 룰에 매칭되지 않는다 */
export const CONTACT_RULES: ReadonlyArray<ContactRule> = [
  {
    id: "CT_EMAIL",
    pattern:
      "()([A-Za-z0-9._%+-]{1,64}\\s*(?:@|골뱅이|\\(at\\)|\\[at\\])\\s*[A-Za-z0-9-]{1,63}(?:\\s*(?:\\.|닷|dot|\\(dot\\))\\s*[A-Za-z0-9-]{1,63}){1,3})",
    placeholder: PLACEHOLDER.contact,
  },
  {
    id: "CT_URL",
    pattern:
      "(^|[^A-Za-z0-9@./-])((?:https?://|www\\.)[^\\s]+|[A-Za-z0-9-]{1,63}(?:\\.[A-Za-z0-9-]{1,63}){0,3}\\." +
      TLD +
      "(?:\\.[A-Za-z]{2,3})?(?:/[^\\s]*)?(?![A-Za-z0-9]))",
    placeholder: PLACEHOLDER.link,
  },
  {
    id: "CT_PHONE",
    pattern:
      "(^|[^0-9+])(" +
      `${Z}${SEP}${ONE}${SEP}${X}(?:${SEP}${D}){7,8}` +
      "|\\+?82[\\s.-]{0,3}0?[\\s.-]{0,3}1[\\s.-]{0,3}[016789](?:[\\s.-]{0,3}[0-9]){7,8}" +
      ")",
    placeholder: PLACEHOLDER.contact,
  },
  {
    id: "CT_ACCOUNT",
    pattern:
      "()((?:은행|뱅크|bank|국민|신한|우리|하나|농협|기업|카뱅|토스|케이뱅크|케뱅|새마을|우체국|수협|씨티|제일|신협|저축|계좌)[^\\n0-9]{0,10}[0-9](?:[\\s-]{0,2}[0-9]){9,13})(?![0-9])",
    placeholder: PLACEHOLDER.account,
    alsoScam: "SC_MONEY",
  },
  {
    id: "CT_KAKAO",
    pattern:
      "()((?:카[\\s._-]{0,2}카[\\s._-]{0,2}오[\\s._-]{0,2}톡|카[\\s._-]{0,2}톡|카카오|kakao[\\s._-]{0,2}talk|kakao|katalk|kkt|ㅋㅌ|ᄏᄐ|open\\.kakao\\.com|오픈[\\s._-]{0,2}(?:채팅|톡)|옾[\\s._-]{0,2}(?:챗|톡))[^\\n]{0,12}" +
      ID_HAS_LETTER +
      "[A-Za-z0-9._-]{4,20})(?![A-Za-z0-9])",
    placeholder: PLACEHOLDER.contact,
  },
  {
    id: "CT_TELEGRAM_LINE",
    pattern:
      "(^|[^A-Za-z])((?:텔레그램|텔레|telegram|tg|t\\.me/|라인[\\s._:@-]{0,3}(?:아이디|id)|line[\\s._:@-]{0,3}id)[\\s._:@는은-]{0,4}" +
      ID_HAS_LETTER +
      "[A-Za-z0-9._]{3,32})(?![A-Za-z0-9])",
    placeholder: PLACEHOLDER.contact,
  },
  {
    id: "CT_INSTA",
    pattern:
      "(^|[^A-Za-z])((?:인스타그램|인스타|인별|instagram|insta|ig)[\\s._:@-]{0,3}(?:아이디|id)?[\\s._:@는은-]{0,4}" +
      ID_HAS_LETTER +
      "[A-Za-z0-9._]{3,30}|@" +
      ID_HAS_LETTER +
      "[A-Za-z0-9._]{3,30})(?![A-Za-z0-9])",
    placeholder: PLACEHOLDER.contact,
  },
];

const compiled = new Map<ContactRuleId, RegExp>();
function regexOf(rule: ContactRule): RegExp {
  let re = compiled.get(rule.id);
  if (!re) {
    re = new RegExp(rule.pattern, "gi");
    compiled.set(rule.id, re);
  }
  re.lastIndex = 0;
  return re;
}

function snippet(s: string): string {
  return s.length > MATCHED_SNIPPET_MAX ? s.slice(0, MATCHED_SNIPPET_MAX) : s;
}

/**
 * 연락처 마스킹. 입력은 NFKC 정규화되어 반환된다(SQL 도 동일). span 은 **마스킹 전 정규화 텍스트** 기준 오프셋.
 */
export function maskContacts(text: string): MaskResult {
  const source = preprocess(text ?? "");
  const hits: ContactHit[] = [];
  let current = source;
  for (const rule of CONTACT_RULES) {
    const re = regexOf(rule);
    let changed = false;
    current = current.replace(re, (whole: string, prefix: string, ...rest: unknown[]) => {
      const offset = rest[rest.length - 2] as number;
      const keep = prefix ?? "";
      const matchedText = whole.slice(keep.length);
      hits.push({
        ruleId: rule.id,
        category: "contact",
        matched: snippet(matchedText),
        score: 0,
        span: [offset + keep.length, offset + whole.length],
      });
      changed = true;
      return keep + rule.placeholder;
    });
    if (changed) re.lastIndex = 0;
  }
  return { masked: current, hits, changed: hits.length > 0 };
}

/** 마스킹 없이 연락처 히트만 (프로필 bio·닉네임 검사용) */
export function detectContacts(text: string): ContactHit[] {
  return maskContacts(text).hits;
}

// ---------------------------------------------------------------------------
// 정규화 (초성·자모 분리·특수문자 제거)
// ---------------------------------------------------------------------------
// 호환 자모(U+3131~U+3163, 사용자가 초성만 칠 때) → 첫가끝 자모. 겹자음 ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ 은 초성 없음 → 구성 자모 2개로 분해
const COMPAT_CONSONANT: Readonly<Record<string, string>> = {
  ㄱ: "ᄀ", ㄲ: "ᄁ", ㄳ: "ᄀᄉ", ㄴ: "ᄂ", ㄵ: "ᄂᄌ", ㄶ: "ᄂᄒ", ㄷ: "ᄃ", ㄸ: "ᄄ",
  ㄹ: "ᄅ", ㄺ: "ᄅᄀ", ㄻ: "ᄅᄆ", ㄼ: "ᄅᄇ", ㄽ: "ᄅᄉ", ㄾ: "ᄅᄐ", ㄿ: "ᄅᄑ",
  ㅀ: "ᄅᄒ", ㅁ: "ᄆ", ㅂ: "ᄇ", ㅃ: "ᄈ", ㅄ: "ᄇᄉ", ㅅ: "ᄉ", ㅆ: "ᄊ", ㅇ: "ᄋ",
  ㅈ: "ᄌ", ㅉ: "ᄍ", ㅊ: "ᄎ", ㅋ: "ᄏ", ㅌ: "ᄐ", ㅍ: "ᄑ", ㅎ: "ᄒ",
};
const COMPAT_VOWEL_BASE = 0x314f; // ㅏ
const JUNGSEONG_BASE = 0x1161; // ᅡ
const LEET: Readonly<Record<string, string>> = { $: "s", "€": "e", "£": "l" };

function mapCompatJamo(ch: string): string {
  const c = COMPAT_CONSONANT[ch];
  if (c) return c;
  const code = ch.charCodeAt(0);
  if (code >= COMPAT_VOWEL_BASE && code <= 0x3163) return String.fromCharCode(JUNGSEONG_BASE + (code - COMPAT_VOWEL_BASE));
  return ch;
}

/** 사전 매칭용 정규화. 결과는 [a-z0-9 + 첫가끝 자모] 만 남는다 */
export function normalizeText(text: string): string {
  const pre = preprocess(text ?? "").toLowerCase();
  let out = "";
  for (const ch of pre) {
    const leet = LEET[ch];
    if (leet) {
      out += leet;
      continue;
    }
    out += mapCompatJamo(ch);
  }
  // 음절 → 초성/중성/종성 자모 (NFD). 첫가끝 자모는 NFD 에서 그대로 유지
  out = out.normalize("NFD");
  return out.replace(/[^a-z0-9ᄀ-ᇿ]/g, "");
}

// ---------------------------------------------------------------------------
// 금칙어·시그널 사전
// ---------------------------------------------------------------------------
export type BannedRule = {
  id: BannedRuleId;
  category: SafetyCategory;
  action: RuleAction;
  score: number;
  words: ReadonlyArray<string>;
  /** 이 단어들이 본문에 있으면 룰 전체를 건너뛴다(교사·강사 맥락 등) */
  excludeIf?: ReadonlyArray<string>;
};

export const BANNED_RULES: ReadonlyArray<BannedRule> = [
  {
    id: "BW_SEXUAL",
    category: "banned",
    action: "warn", // 같은 매칭 2회부터 hold + 자동 신고 P1 (SQL)
    score: 0,
    words: [
      "섹스", "섹파", "야동", "야사", "자위", "딸딸이", "보지", "자지", "좆", "젖꼭지", "가슴만져", "만져줘", "빨아줘", "박아줘",
      "따먹", "떡치", "떡친", "원나잇", "원나이트", "몸매사진", "알몸", "나체", "야한사진", "속옷사진", "노출사진", "성관계",
      "관계할래", "자고갈래", "모텔갈래", "모텔가자", "야스", "성기", "페니스", "질싸", "오랄", "오럴", "sex", "porn", "ㅅㅅ", "ㅅㅍ",
    ],
  },
  {
    id: "BW_HATE",
    category: "banned",
    action: "warn", // 2회 자동 신고 P1 (SQL)
    score: 0,
    words: [
      "한남충", "김치녀", "김여사", "된장녀", "보슬아치", "보빨", "페미충", "맘충", "틀딱", "급식충", "흑형", "짱깨", "짱개", "쪽바리",
      "쪽발이", "똥남아", "외노자", "홍어", "전라디언", "개쌍도", "병신", "ㅂㅅ", "애자", "장애인새끼", "벙어리", "게이새끼", "똥꼬충",
      "레즈년", "트젠충", "씹년", "씹놈", "창녀", "걸레년", "김치년", "한녀충",
    ],
  },
  {
    id: "BW_VIOLENCE",
    category: "banned",
    action: "report", // 즉시 자동 신고 P0 + 채팅 제한 24h
    score: 0,
    words: [
      "죽여버린다", "죽여버릴", "죽일거야", "죽인다", "죽여줄까", "칼로찔러", "칼들고", "찔러버린", "패버린다", "패죽", "때려죽",
      "묻어버린", "목졸라", "불질러", "폭파시켜", "테러할", "살해", "살인예고", "죽고싶냐", "뒤지고싶", "뒤진다", "집주소알아",
      "신상털", "찾아가서죽", "가만안둬", "가만안두",
    ],
  },
  {
    id: "BW_ILLEGAL",
    category: "banned",
    action: "hold", // 즉시 자동 신고 P0 + hold
    score: 0,
    words: [
      "대마초", "대마", "떨판", "떨팝", "작대기", "필로폰", "히로뽕", "케타민", "엑스터시", "엘에스디", "lsd", "코카인", "마약",
      "몰카", "몰래카메라", "불법촬영", "리벤지포르노", "야동공유", "지인능욕", "딥페이크", "대포통장", "대포폰", "도박사이트",
      "토토사이트", "사설토토", "성착취", "아청법",
    ],
  },
  {
    id: "BW_ADULT_BIZ",
    category: "banned",
    action: "hold", // hold + 자동 신고 P1
    score: 0,
    words: [
      "조건만남", "조건녀", "조건남", "ㅈㄱㅁㄴ", "스폰", "스폰서", "업소녀", "업소", "출장마사지", "출장안마", "애인대행", "성매매",
      "만남비", "용돈만남", "용돈줄게", "용돈드림", "페이만남", "페이미팅", "텐프로", "룸싸롱", "룸살롱", "오피녀", "키스방",
      "안마방", "휴게텔", "립카페", "데이트비", "조건비", "화대",
    ],
  },
  {
    id: "SC_MONEY",
    category: "scam",
    action: "score",
    score: SCAM_SCORES.SC_MONEY,
    words: [
      "송금", "계좌번호", "계좌이체", "돈빌려", "돈좀빌려", "급전", "급하게돈", "상품권", "기프티콘코드", "기프티콘보내", "문상",
      "문화상품권", "구글기프트", "핀번호", "핀코드", "바코드보내", "페이송금", "토스송금", "카카오페이보내", "입금해", "입금좀",
      "이체해", "이체좀", "돈보내", "만원만", "십만원만", "백만원만", "빌려줄수있", "빌려주면", "대납", "비트코인보내", "돈필요",
    ],
  },
  {
    id: "SC_INVEST",
    category: "scam",
    action: "score",
    score: SCAM_SCORES.SC_INVEST,
    words: [
      "투자", "코인", "비트코인", "이더리움", "선물거래", "리딩방", "리딩", "수익률", "수익보장", "원금보장", "재테크", "주식추천",
      "종목추천", "단타", "알트코인", "거래소가입", "가입링크", "추천인코드", "레퍼럴", "부업", "고수익", "월수익", "수익인증",
      "자동매매", "채굴", "nft",
    ],
  },
  {
    id: "SC_URGENT",
    category: "scam",
    action: "score",
    score: SCAM_SCORES.SC_URGENT,
    words: [
      "병원비", "수술비", "사고났", "사고당했", "해외에있", "해외파병", "파병", "군인이라", "급한사정", "급한일이생겨", "갑자기돈",
      "당장돈", "세관에", "통관비", "관세를", "배송비만", "벌금을", "보증금이",
    ],
  },
  {
    id: "SC_FAST_LOVE",
    category: "scam",
    action: "score",
    score: SCAM_SCORES.SC_FAST_LOVE,
    words: ["사랑해", "결혼하자", "결혼할래", "운명이야", "운명같", "평생함께", "내여자야", "내남자야", "자기야", "여보"],
  },
  {
    id: "CT_LURE",
    category: "lure",
    action: "warn",
    score: 0,
    words: [
      "번호줘", "번호알려", "번호좀", "연락처줘", "연락처알려", "연락처좀", "전화번호", "폰번호", "폰번", "핸드폰번호", "휴대폰번호",
      "카톡으로", "카톡해", "카톡하자", "카톡추가", "톡으로하자", "톡해", "디엠", "dm줘", "dm으로", "dm보내", "인스타로", "인스타알려",
      "텔레로", "텔레그램으로", "라인으로", "다른앱", "다른앱으로", "여기말고", "옮기자", "옮길래", "넘어가자", "앱깔아", "앱설치",
      "링크보낼", "오픈톡으로", "오픈채팅으로", "전번",
    ],
  },
  {
    id: "MN_SCHOOL",
    category: "minor",
    action: "report", // 2개 이상 MN 동시 hit 시 (SQL). 단독은 warn 취급
    score: 0,
    words: [
      "고등학교", "고딩", "고등학생", "야자", "야간자율", "수능준비", "수능공부", "중학교", "중딩", "중학생", "학원다녀", "학원끝나",
      "급식먹", "등교", "하교", "담임", "기말고사", "중간고사", "교복", "고1", "고2", "고3", "중1", "중2", "중3", "수행평가",
    ],
    excludeIf: ["선생", "강사", "근무", "교사", "졸업", "학부모", "아들", "딸이", "조카"],
  },
  {
    id: "MN_AGE",
    category: "minor",
    action: "report", // 단독 → 비노출·재인증·자동 신고 P0
    score: 0,
    words: ["미성년", "미자", "열여덟", "열일곱", "열여섯", "열다섯", "열네살", "열세살"],
  },
];

const normalizedWords = new Map<BannedRuleId, ReadonlyArray<{ raw: string; norm: string }>>();
function wordsOf(rule: BannedRule): ReadonlyArray<{ raw: string; norm: string }> {
  let ws = normalizedWords.get(rule.id);
  if (!ws) {
    ws = rule.words.map((w) => ({ raw: w, norm: normalizeText(w) })).filter((w) => w.norm.length > 0);
    normalizedWords.set(rule.id, ws);
  }
  return ws;
}

/** MN_AGE 숫자 패턴: `1[0-8]살|세`, 미성년 출생연도(`0X년생|1X년생|2X년생`, 기준일로 계산), `중고딩` 류는 사전 */
export function minorAgeRegex(now: Date = new Date()): RegExp {
  const year = now.getFullYear();
  // 만 19세 미만이 가능한 출생연도 = year-19(생일 전) … year. 두 자리 접미(예: 07 … 26)
  const suffixes: string[] = [];
  for (let y = year - 19; y <= year; y++) suffixes.push(String(y % 100).padStart(2, "0"));
  return new RegExp(`(?:^|[^0-9])(?:1[0-8]\\s*(?:살|세)(?![0-9])|(?:${suffixes.join("|")})\\s*년생)`, "g");
}

/** 오프라인 만남 배너 트리거 (A5 §10.2). 서버 저장 안 함, UX 용 */
export const OFFLINE_MEETING_RE = /만나(?:자|요|볼|ㄹ|실)|보자|오프(?:로|에서|라인|\s|$)|약속\s*잡|어디서\s*볼|만날래|만날까/;
/** A5 §7.4 거절·불쾌 표현 (직전 3개 메시지에 있으면 BW_SEXUAL hit 시 즉시 신고). SQL 도 같은 목록 */
export const REFUSAL_WORDS: ReadonlyArray<string> = ["싫어", "하지마", "하지 마", "불편", "그만", "안할래", "싫다고", "부담스러"];

export type DetectOptions = { now?: Date };

/** 금칙어·시그널 히트 (룰당 최대 1건, 첫 매칭 단어를 matched 로) */
export function detectBanned(text: string, opts: DetectOptions = {}): SafetyHit[] {
  const norm = normalizeText(text ?? "");
  if (norm.length === 0) return [];
  const hits: SafetyHit[] = [];
  for (const rule of BANNED_RULES) {
    if (rule.excludeIf && rule.excludeIf.some((w) => norm.includes(normalizeText(w)))) continue;
    const found = wordsOf(rule).find((w) => norm.includes(w.norm));
    if (found) hits.push({ ruleId: rule.id, category: rule.category, matched: found.raw, score: rule.score });
  }
  if (!hits.some((h) => h.ruleId === "MN_AGE")) {
    const m = minorAgeRegex(opts.now).exec(preprocess(text ?? ""));
    if (m) hits.push({ ruleId: "MN_AGE", category: "minor", matched: snippet(m[0].trim()), score: 0 });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 종합 평가
// ---------------------------------------------------------------------------
const SEVERITY_ORDER: Readonly<Record<Severity, number>> = { none: 0, mask: 1, warn: 2, hold: 3, report: 4, critical: 5 };
function worst(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

export function scoreMessage(text: string, opts: DetectOptions = {}): ScoreResult {
  const mask = maskContacts(text);
  const banned = detectBanned(text, opts);
  const flags: SafetyHit[] = [...mask.hits.map(({ span: _span, ...h }) => h), ...banned];
  if (mask.hits.some((h) => h.ruleId === "CT_ACCOUNT") && !banned.some((h) => h.ruleId === "SC_MONEY")) {
    flags.push({ ruleId: "SC_MONEY", category: "scam", matched: "CT_ACCOUNT", score: SCAM_SCORES.SC_MONEY });
  }

  let severity: Severity = "none";
  if (mask.hits.length > 0) severity = "mask";
  const ids = new Set(flags.map((f) => f.ruleId));
  const scamScore = flags.filter((f) => f.category === "scam").reduce((s, f) => s + f.score, 0);
  const scamBanner = ids.has("SC_MONEY") || ids.has("SC_INVEST");
  const minorRules = flags.filter((f) => f.category === "minor").length;
  const minorSignal = ids.has("MN_AGE") || minorRules >= 2;
  const shouldHold = ids.has("BW_ILLEGAL") || ids.has("BW_ADULT_BIZ");

  let autoReport: ScoreResult["autoReport"] = null;
  if (ids.has("BW_VIOLENCE")) autoReport = "THREAT_VIOLENCE";
  else if (ids.has("BW_ILLEGAL")) autoReport = "OTHER";
  else if (minorSignal) autoReport = "MINOR_SUSPECT";
  else if (ids.has("BW_ADULT_BIZ")) autoReport = "COMMERCIAL_SPAM";

  if (ids.has("CT_LURE") || ids.has("BW_SEXUAL") || ids.has("BW_HATE") || scamBanner || ids.has("MN_SCHOOL")) severity = worst(severity, "warn");
  if (shouldHold) severity = worst(severity, "hold");
  if (autoReport === "COMMERCIAL_SPAM" || autoReport === "MINOR_SUSPECT") severity = worst(severity, "report");
  if (autoReport === "THREAT_VIOLENCE" || autoReport === "OTHER") severity = worst(severity, "critical");

  return {
    flags,
    masked: mask.masked,
    severity,
    contactHits: mask.hits.length,
    scamScore,
    scamBanner,
    minorSignal,
    shouldHold,
    autoReport,
    offlineMeeting: OFFLINE_MEETING_RE.test(preprocess(text ?? "")),
  };
}

/** 프로필 텍스트(닉네임·bio·now_into·fav_note) 용: 연락처 또는 금칙어(BW_*)·성인업소·불법 hit 이면 거부 */
export function checkProfileText(text: string): { ok: true } | { ok: false; ruleId: SafetyRuleId; kind: "contact" | "banned" } {
  const ct = detectContacts(text);
  if (ct.length > 0) return { ok: false, ruleId: ct[0]!.ruleId, kind: "contact" };
  const bw = detectBanned(text).find((h) => h.category === "banned" || h.ruleId === "CT_LURE");
  if (bw) return { ok: false, ruleId: bw.ruleId, kind: "banned" };
  return { ok: true };
}

/** SQL 마이그레이션 생성/대조용: 룰 id → 패턴 (0030 의 mask_contacts 와 동일해야 한다) */
export function contactRulePatterns(): ReadonlyArray<{ id: ContactRuleId; pattern: string; placeholder: string }> {
  return CONTACT_RULES.map((r) => ({ id: r.id, pattern: r.pattern, placeholder: r.placeholder }));
}
