// =============================================================================
// D4 · 연락처 마스킹 파이프라인 (A5 §5.3 R1~R5)
//
// 원칙:
// - 서버(Edge Function) 전용. 클라이언트는 결과물 masked_body 만 받는다.
// - mask_rules 의 offset 은 "원문 body" 기준 (어드민 원문 대조용 — A5 →D1).
// - R1(전화)·R2(메신저 ID) 는 해제 조건(매칭 +72h && 양측 Lv≥2) 충족 시 스킵.
//   R3(이메일)·R4(URL)·R5(계좌) 는 상시 마스킹.
// - 전처리: 한글 숫자 표기("공일공") 우회는 1글자↔1글자 치환 정규화로 대응
//   → 길이가 보존되므로 정규화 텍스트의 매치 offset 을 원문에 그대로 적용 가능.
//
// 스펙 대비 보강 4건 (오탐 방지 — 17_chat.md 에 근거 명시):
// - R1: 직전이 숫자(+구분자)면 매치 금지 lookbehind — 계좌번호("3333-01-…") 내부의
//       "01-…" 조각을 전화번호로 오인하는 것 차단
// - R2: 키워드 앞에 한글/영숫자 접두 금지 lookbehind (예: "온라인" 의 "라인" 오탐 차단)
//       + "카카오" 는 뱅크/페이 접미 제외 (카카오뱅크·카카오페이는 메신저 아님)
// - R5: ①전화번호(R1)로 이미 매치된 숫자열은 계좌로 재분류하지 않음
//       ②동음이의 은행명(우리/하나/기업/새마을)은 "은행" 접미 필수
// =============================================================================

export type MaskRuleId = "R1" | "R2" | "R3" | "R4" | "R5";

export interface MaskSpan {
  rule: MaskRuleId;
  start: number;
  end: number; // exclusive
}

export interface MaskingInput {
  body: string;
  /** 매칭 +72h && 양측 Lv≥2 → true 면 R1·R2 마스킹 해제 (R3~R5 는 무관) */
  contactUnlocked: boolean;
}

export interface MaskingResult {
  maskedBody: string;
  /** 원문 offset 기준. messages.mask_rules 에 그대로 저장 */
  maskRules: MaskSpan[];
  hits: {
    r1: boolean;
    r2: boolean;
    /** R2 키워드만 있고 식별자 결합이 없는 경우 (A5: LOG만) */
    r2KeywordOnly: boolean;
    r3: boolean;
    r4: boolean;
    /** 단축 URL·오픈채팅·송금 링크 (A5: QUEUE 병행) */
    r4HighRisk: boolean;
    r5: boolean;
  };
}

const MASK_TOKEN = "●●●●";

// ---------------------------------------------------------------------------
// 전처리: 한글 숫자·유사문자 → 숫자 (1:1, 길이 보존)
// ---------------------------------------------------------------------------
const DIGIT_MAP: Record<string, string> = {
  공: "0", 영: "0", 일: "1", 이: "2", 삼: "3", 사: "4",
  오: "5", 육: "6", 륙: "6", 칠: "7", 팔: "8", 구: "9",
  O: "0", o: "0",
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
};

/** 길이 보존 정규화 — 반환 문자열의 index === 원문 index */
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    out += DIGIT_MAP[ch] ?? ch;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 정규식 (A5 §5.3 원문 — factory 로 매 호출 새 인스턴스: g 플래그 lastIndex 상태 방지)
// ---------------------------------------------------------------------------

/** R1 전화번호 — 정규화 텍스트에 적용 (한글 숫자는 전처리에서 이미 숫자화).
 *  lookbehind: 직전이 숫자(+구분자)면 계좌번호 조각 → 매치 금지 (보강 ①) */
const reR1 = () =>
  /(?<!\d[-–.·]?)0[17]\s*[-–.·]?\s*[0-9O공영일이삼사오육칠팔구]{1,2}(?:\s*[-–.·]?\s*[0-9O공영일이삼사오육칠팔구]){6,8}/giu;

/** R2 메신저 ID — 키워드+식별자 결합일 때만 마스킹 (lookbehind = 오탐 방지 보강) */
const reR2 = () =>
  /(?<![가-힣A-Za-z0-9])(카톡|카카오(?:톡)?(?!뱅크|페이)|카까오|ㅋㅌ|kakao\s*(?:talk)?|라인|line|텔레(?:그램)?|telegram|인스타(?:그램)?|insta(?:gram)?|디엠|DM)\s*(?:아이디|ID|id|계정)?\s*[:：은는]?\s*@?[A-Za-z0-9._-]{3,30}/giu;

/** R2 키워드 단독 (LOG 용) */
const reR2Keyword = () =>
  /(?<![가-힣A-Za-z0-9])(카톡|카카오(?:톡)?(?!뱅크|페이)|카까오|ㅋㅌ|kakao|라인|line|텔레그램|telegram|인스타그램?|instagram|디엠|DM)(?![A-Za-z])/giu;

/** R3 이메일 (상시) */
const reR3 = () =>
  /[A-Za-z0-9._%+-]+\s*(?:@|＠|골뱅이)\s*[A-Za-z0-9.-]+\s*(?:\.|닷)\s*[A-Za-z]{2,}/giu;

/** R4 URL/외부 링크 (상시) */
const reR4 = () =>
  /(?:https?:\/\/|www\.)[^\s]+|(?:open\.kakao\.com|bit\.ly|t\.me|toss\.me|qr\.kakaopay\.com)[^\s]*/gi;

const R4_HIGH_RISK = () =>
  /(open\.kakao\.com|bit\.ly|t\.me|toss\.me|qr\.kakaopay\.com)/i;

/** R5 계좌번호 — 숫자열+은행명 (정규화 텍스트에 적용). 동음이의 은행명은 "은행" 필수 */
const BANK =
  "(?:국민|신한|농협|카카오뱅크|케이뱅크|토스뱅크|SC|씨티|우체국|(?:우리|하나|기업|새마을)\\s*은행)";
const reR5Forward = () =>
  new RegExp(`(\\d[\\d\\- ]{9,16}\\d)\\s*(?:\\(|\\s)*${BANK}`, "gu");
const reR5Reverse = () =>
  new RegExp(`${BANK}\\s*(?:은행)?\\s*[:：]?\\s*(\\d[\\d\\- ]{9,16}\\d)`, "gu");

// ---------------------------------------------------------------------------
// 스팬 수집·병합·치환
// ---------------------------------------------------------------------------

function collect(re: RegExp, text: string, rule: MaskRuleId): MaskSpan[] {
  const spans: MaskSpan[] = [];
  for (const m of text.matchAll(re)) {
    if (m.index === undefined || m[0].length === 0) continue;
    spans.push({ rule, start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

function overlaps(a: MaskSpan, b: MaskSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/** 겹치는 스팬 병합 — 먼저 온 룰 우선 (R1 > R5 재분류 방지용으로 입력 순서가 우선순위) */
function mergeSpans(spans: MaskSpan[]): MaskSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: MaskSpan[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && overlaps(last, s)) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function applyMask(body: string, spans: MaskSpan[]): string {
  let out = "";
  let cursor = 0;
  for (const s of spans) {
    out += body.slice(cursor, s.start) + MASK_TOKEN;
    cursor = s.end;
  }
  out += body.slice(cursor);
  return out;
}

// ---------------------------------------------------------------------------
// 메인 파이프라인
// ---------------------------------------------------------------------------

export function maskMessage(input: MaskingInput): MaskingResult {
  const { body, contactUnlocked } = input;
  const normalized = normalizeDigits(body);

  // R1 은 정규화 텍스트에서 탐지 (offset = 원문 offset, 길이 보존)
  const r1Spans = collect(reR1(), normalized, "R1");
  const r2Spans = collect(reR2(), body, "R2");
  const r3Spans = collect(reR3(), body, "R3");
  const r4Spans = collect(reR4(), body, "R4");

  // R5: 원문+정규화 양쪽에서 탐지해 합집합 — 은행명에 숫자 음절("카카오"의 오,
  // "우체국"의 구)이 있어 정규화 텍스트만으로는 은행명이 깨지고, 원문만으로는
  // 한글 숫자 계좌 우회를 놓친다. 전화번호(R1)로 이미 매치된 숫자열은 계좌로
  // 재분류하지 않음 (오탐 방지 보강 ①)
  const r5Raw = [
    ...collect(reR5Forward(), body, "R5"),
    ...collect(reR5Reverse(), body, "R5"),
    ...collect(reR5Forward(), normalized, "R5"),
    ...collect(reR5Reverse(), normalized, "R5"),
  ];
  const r5Spans = r5Raw.filter((s) => !r1Spans.some((p) => overlaps(p, s)));

  const r4HighRisk = r4Spans.some((s) => R4_HIGH_RISK().test(body.slice(s.start, s.end)));

  // 해제 조건: R1·R2 만 해제. R3·R4·R5 는 상시 (A5 §5.3)
  const maskable: MaskSpan[] = [
    ...(contactUnlocked ? [] : r1Spans),
    ...(contactUnlocked ? [] : r2Spans),
    ...r3Spans,
    ...r4Spans,
    ...r5Spans,
  ];
  const merged = mergeSpans(maskable);

  const r2KeywordOnly =
    r2Spans.length === 0 && collect(reR2Keyword(), body, "R2").length > 0;

  return {
    maskedBody: applyMask(body, merged),
    maskRules: merged,
    hits: {
      r1: r1Spans.length > 0,
      r2: r2Spans.length > 0,
      r2KeywordOnly,
      r3: r3Spans.length > 0,
      r4: r4Spans.length > 0,
      r4HighRisk,
      r5: r5Spans.length > 0,
    },
  };
}
