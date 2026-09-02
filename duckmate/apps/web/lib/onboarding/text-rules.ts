/**
 * 닉네임·fav_note·now_into 서버 검사 — 연락처 패턴(CT_*) + 금칙어(BW_*) 최소 구현.
 *
 * TODO(D4): `@duckmate/db/safety-rules` 가 생기면 이 파일의 패턴을 그 파일 import 로 교체한다(단일 소스 원칙, PRD §0-42).
 * 여기 정의는 A5 §7.1 요지를 온보딩 텍스트(짧은 문자열)용으로 축약한 것이며, 채팅 파이프라인은 이 파일을 쓰지 않는다.
 */
export type TextRuleHit = { ruleId: string; category: "CT" | "BW" };

const CONTACT_RULES: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "CT_PHONE", re: /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  { id: "CT_PHONE_KO", re: /(공|영|0)\s*(일|1)\s*(공|영|0)[\s\-]*[\d일이삼사오육칠팔구공영]{7,}/ },
  { id: "CT_KAKAO", re: /(카톡|카카오|kakao|katalk|ㅋㅌ|open\.kakao\.com)\s*[:@]?\s*[a-zA-Z0-9_.]{3,}/i },
  { id: "CT_INSTA", re: /(인스타|insta|ig)\s*[:@]?\s*[\w.]{3,}|@[\w.]{3,30}/i },
  { id: "CT_TELEGRAM_LINE", re: /(텔레|telegram|t\.me\/|라인|line\s*id)\s*[:@]?\s*[\w.]{3,}/i },
  { id: "CT_URL", re: /https?:\/\/|www\.|[\w-]+\.(com|net|kr|me|link|io)(\/|$)/i },
  { id: "CT_EMAIL", re: /[\w.+-]+\s*(@|골뱅이|\(at\))\s*[\w-]+\.[\w.]+/i },
  { id: "CT_ACCOUNT", re: /(은행|뱅크|bank|카카오뱅크|토스)\s*[\d-]{10,}/i },
];

/** 최소 금칙어(예시). 실제 사전은 D4 safety-rules.ts (200~300개, 초성·자모 정규화) */
const BANNED_WORDS: ReadonlyArray<{ id: string; words: ReadonlyArray<string> }> = [
  { id: "BW_ADULT_BIZ", words: ["조건만남", "스폰", "업소", "출장", "애인대행"] },
  { id: "BW_SEXUAL", words: ["섹파", "야동", "섹스", "sex"] },
  { id: "BW_ILLEGAL", words: ["대마", "떨판", "작대기", "필로폰"] },
  { id: "BW_HATE", words: ["한남충", "김치녀", "틀딱", "흑형"] },
  { id: "BW_IMPERSONATION", words: ["운영자", "관리자", "admin", "duckmate", "덕메이트"] },
];

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s​‌‍._\-*·]/g, "");
}

export function checkText(text: string): TextRuleHit | null {
  for (const r of CONTACT_RULES) if (r.re.test(text)) return { ruleId: r.id, category: "CT" };
  const norm = normalize(text);
  for (const b of BANNED_WORDS) {
    for (const w of b.words) if (norm.includes(normalize(w))) return { ruleId: b.id, category: "BW" };
  }
  return null;
}

export function textRuleMessage(hit: TextRuleHit, what: "닉네임" | "최애" | "요즘 빠진 것"): string {
  return hit.category === "CT" ? `연락처처럼 보이는 ${what}은 쓸 수 없어요` : `사용할 수 없는 ${what}이에요`;
}
