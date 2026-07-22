/**
 * Korean-first PII detection. 개인정보(실명+소속, 전화, 주소, 계좌, 주민번호)는
 * 무조건 차단 — 명예훼손·프라이버시 리스크의 핵심 방어선.
 *
 * These are deterministic rules (no LLM). They intentionally err toward
 * over-detection: a false positive routes content to the human queue, a false
 * negative can publish someone's phone number. Tune with the Phase-1 test set.
 */

export type PiiKind =
  | "rrn" // 주민등록번호
  | "phone"
  | "card" // 카드번호
  | "account" // 계좌번호(휴리스틱)
  | "email"
  | "address" // 상세주소(휴리스틱)
  | "name_affiliation"; // 실명+소속(휴리스틱)

export interface PiiFinding {
  kind: PiiKind;
  /** The matched substring (for logging/redaction — never surfaced publicly). */
  match: string;
  /** 0–1 rough confidence; heuristics score lower than exact patterns. */
  confidence: number;
}

// 주민등록번호: 6자리 생년월일 + 성별코드(1-4/5-8) + 6자리. 구분자 허용.
const RRN = /\b\d{6}[-\s]?[1-8]\d{6}\b/g;

// 휴대폰/유선 전화. 010-1234-5678, 02-123-4567, 0316234567 등.
const PHONE =
  /\b(?:01[016789]|0(?:2|[3-6][1-5]|70))[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;

// 카드번호: 4-4-4-4 (구분자 허용).
const CARD = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;

// 계좌번호(휴리스틱): 구분자로 나뉜 숫자 그룹이 3개 이상이고 총 10~16자리.
const ACCOUNT = /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,6}(?:[-\s]\d{2,6})?\b/g;

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// 상세주소(휴리스틱): 시/도·구/군 뒤에 도로명(로|길) 또는 동 + 번지 숫자.
const ADDRESS =
  /(?:[가-힣]+(?:시|도|군|구))\s*[가-힣]*(?:읍|면|동|로|길)\s*\d+(?:[-\s]?\d+)?(?:번지|번길|호)?/g;

// 실명+소속(휴리스틱): 조직/직함 키워드 + 근처 2~4자 한글 이름 + 성 뒤 호칭.
const AFFILIATION_HINT =
  /(?:주식회사|㈜|회사|팀|부서|과|대학교|고등학교|중학교|초등학교|병원|경찰서|법원|청|처|부|국)\s*[가-힣]{2,4}\s*(?:님|씨|대표|사장|부장|과장|팀장|교수|선생|기자|의원|판사|검사)?/g;

interface Detector {
  kind: PiiKind;
  re: RegExp;
  confidence: number;
}

const DETECTORS: Detector[] = [
  { kind: "rrn", re: RRN, confidence: 0.98 },
  { kind: "card", re: CARD, confidence: 0.9 },
  { kind: "phone", re: PHONE, confidence: 0.9 },
  { kind: "email", re: EMAIL, confidence: 0.95 },
  { kind: "account", re: ACCOUNT, confidence: 0.55 },
  { kind: "address", re: ADDRESS, confidence: 0.5 },
  { kind: "name_affiliation", re: AFFILIATION_HINT, confidence: 0.4 },
];

/** Detect PII in free text. Returns every finding (deduped by match+kind). */
export function detectPii(text: string): PiiFinding[] {
  if (!text) return [];
  const seen = new Set<string>();
  const findings: PiiFinding[] = [];
  for (const { kind, re, confidence } of DETECTORS) {
    // Card and account overlap; card wins, so skip account matches already
    // claimed as cards below via the seen-set keyed on the raw digits.
    for (const m of text.matchAll(re)) {
      const match = m[0];
      const digits = match.replace(/\D/g, "");
      const key = `${kind}:${match}`;
      if (seen.has(key)) continue;
      // A 16-digit card also satisfies the account pattern — don't double-report.
      if (kind === "account" && digits.length === 16 && seen.has(`card:${match}`)) {
        continue;
      }
      seen.add(key);
      findings.push({ kind, match, confidence });
    }
  }
  return findings;
}

/**
 * Hard gate: any finding at or above `minConfidence` means the content must be
 * blocked (not merely queued). Default 0.85 catches RRN/phone/card/email while
 * letting the fuzzy address/affiliation heuristics route to human review.
 */
export function hasBlockingPii(text: string, minConfidence = 0.85): boolean {
  return detectPii(text).some((f) => f.confidence >= minConfidence);
}
