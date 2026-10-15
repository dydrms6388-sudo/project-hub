// =============================================================================
// D4 · 자동 탐지 조치 결정 (A5 §5.1 패턴 + §5.2 조치 5단계)
//
// 이 모듈은 "판정"만 한다 — DB 조회(반복 히트 수·스크립트 복붙)는 index.ts 가
// 수행해 입력으로 넘기고, moderation_flags insert 도 index.ts 가 수행한다.
//
// A5 §5.2 조치 매핑 (표 그대로):
//   MASK       : PAT_CONTACT_EARLY, PAT_EXTERNAL_LINK(일반 URL)
//   WARN       : PAT_MONEY 1회, PAT_INVEST 1회
//   QUEUE      : PAT_MONEY/PAT_INVEST 반복(24h 내 기존 히트 존재), PAT_SCRIPT_DUP,
//                성매매 은어(PAT_SEXUAL), 고위험 링크(단축 URL·오픈채팅·송금)
//   BLOCK_SEND : 계좌번호(R5) + 금전 요구 키워드 결합 (최고 신뢰 히트)
//   LOG        : 저신뢰 히트 — R2 키워드 단독, PAT_OFFPLATFORM_PUSH
//
// 금칙어 사전: A5 는 "성적 금칙어 사전은 운영 DB 관리, 코드 하드코딩 금지"를
// 요구한다. 사전 테이블은 아직 없으므로(D5 소관) 여기는 A5 가 명시한 성매매
// 은어("조건만남"/"만남비")만 최소 구현 — 17_chat.md 미결 항목으로 에스컬레이션.
// =============================================================================

import type { MaskingResult } from "./masking.ts";

export type RuleCode =
  | "PAT_CONTACT_EARLY"
  | "PAT_MONEY"
  | "PAT_INVEST"
  | "PAT_EXTERNAL_LINK"
  | "PAT_SEXUAL"
  | "PAT_OFFPLATFORM_PUSH"
  | "PAT_SCRIPT_DUP";

export type FlagAction = "LOG" | "MASK" | "WARN" | "QUEUE" | "BLOCK_SEND";

export interface Flag {
  rule_code: RuleCode;
  action: FlagAction;
  meta: Record<string, unknown>;
}

export interface ModerationInput {
  body: string;
  masking: MaskingResult;
  /** 매칭 +72h && 양측 Lv≥2 (해제 후에는 연락처 교환이 정당 — PAT_CONTACT_EARLY 미기록) */
  contactUnlocked: boolean;
  /** 매칭 성립 후 24h 이내인가 (PAT_OFFPLATFORM_PUSH 가중 조건) */
  within24hOfMatch: boolean;
  /** 발신자의 24h 내 기존 PAT_MONEY/PAT_INVEST 히트 수 (index.ts 가 조회) */
  recentMoneyInvestHits: number;
  /** 동일 발신자가 24h 내 다른 매칭 2곳 이상에 동일/유사 본문을 보냈는가 */
  scriptDuplicated: boolean;
}

export interface ModerationDecision {
  flags: Flag[];
  /** true = 전송 자체 거부 (메시지 insert 금지, flags 만 기록) */
  blockSend: boolean;
  /** 수신자 안전 카드 종류 (WARN/QUEUE 시 Realtime safety_card 이벤트로 발송) */
  safetyCard: "money" | "invest" | "sexual" | null;
}

// ---------------------------------------------------------------------------
// 키워드 패턴 (A5 §5.1 예시 신호 기반 — factory: g 플래그 상태 방지)
// ---------------------------------------------------------------------------

/** PAT_MONEY: "돈 보내", "송금", "계좌번호", "급전", "빌려줘", 입금 요구 */
const reMoney = () =>
  /(돈\s*(?:좀)?\s*(?:보내|빌려)|송금|계좌\s*번호|계좌로|급전|빌려\s*줘|입금\s*(?:해|부탁|요청))/gu;

/** PAT_INVEST: "코인", "리딩방", "수익률", "재테크", "선물거래" */
const reInvest = () => /(코인|리딩방|수익률|재테크|선물\s*거래|리딩\s*(?:방|주식))/gu;

/** PAT_SEXUAL(성매매 은어 최소셋): "조건만남", "만남비" — 사전 테이블은 D5 후속 */
const reSexualSlang = () => /(조건\s*만남|만남\s*비|조\s*건\s*비)/gu;

/** PAT_OFFPLATFORM_PUSH: "여기 말고 ~에서 얘기하자" + 메신저명 */
const reOffPlatform = () =>
  /(여기\s*말고[\s\S]{0,20}(?:카톡|카카오|라인|텔레|디엠|인스타)|(?:카톡|라인|텔레(?:그램)?|인스타|디엠)\s*(?:으로|에서)\s*(?:얘기|이야기|대화|연락))/gu;

function hit(re: RegExp, text: string): boolean {
  return re.test(text);
}

// ---------------------------------------------------------------------------
// 판정
// ---------------------------------------------------------------------------

export function decideModeration(input: ModerationInput): ModerationDecision {
  const { body, masking, contactUnlocked } = input;
  const flags: Flag[] = [];
  let blockSend = false;
  let safetyCard: ModerationDecision["safetyCard"] = null;

  const moneyKeyword = hit(reMoney(), body);
  const investKeyword = hit(reInvest(), body);
  const sexualSlang = hit(reSexualSlang(), body);
  const offPlatform = hit(reOffPlatform(), body);

  // 1) BLOCK_SEND — 계좌번호(R5) + 금전 요구 결합 = 최고 신뢰 (A5 §5.2 단계 5)
  if (masking.hits.r5 && moneyKeyword) {
    blockSend = true;
    flags.push({
      rule_code: "PAT_MONEY",
      action: "BLOCK_SEND",
      meta: { signals: ["R5_ACCOUNT", "MONEY_KEYWORD"] },
    });
    safetyCard = "money";
    return { flags, blockSend, safetyCard };
  }

  // 2) PAT_CONTACT_EARLY — 해제 전 R1/R2/R3 히트 → MASK (R2 키워드 단독은 LOG)
  if (!contactUnlocked && (masking.hits.r1 || masking.hits.r2 || masking.hits.r3)) {
    flags.push({
      rule_code: "PAT_CONTACT_EARLY",
      action: "MASK",
      meta: {
        rules: [
          ...(masking.hits.r1 ? ["R1"] : []),
          ...(masking.hits.r2 ? ["R2"] : []),
          ...(masking.hits.r3 ? ["R3"] : []),
        ],
      },
    });
  } else if (!contactUnlocked && masking.hits.r2KeywordOnly) {
    flags.push({
      rule_code: "PAT_CONTACT_EARLY",
      action: "LOG",
      meta: { rules: ["R2_KEYWORD_ONLY"] },
    });
  }
  // 해제 후 R3(이메일)은 상시 마스킹되지만 "조기 교환" 위반은 아님 → LOG 만
  if (contactUnlocked && masking.hits.r3) {
    flags.push({ rule_code: "PAT_CONTACT_EARLY", action: "LOG", meta: { rules: ["R3_AFTER_UNLOCK"] } });
  }

  // 3) PAT_EXTERNAL_LINK — URL 상시 MASK, 고위험(단축·오픈채팅·송금)은 QUEUE 병행
  if (masking.hits.r4) {
    flags.push({
      rule_code: "PAT_EXTERNAL_LINK",
      action: masking.hits.r4HighRisk ? "QUEUE" : "MASK",
      meta: { highRisk: masking.hits.r4HighRisk },
    });
  }

  // 4) PAT_MONEY — 키워드 또는 계좌(R5). 1회 WARN → 반복 QUEUE
  if (moneyKeyword || masking.hits.r5) {
    const repeat = input.recentMoneyInvestHits > 0;
    flags.push({
      rule_code: "PAT_MONEY",
      action: repeat ? "QUEUE" : "WARN",
      meta: {
        signals: [
          ...(moneyKeyword ? ["MONEY_KEYWORD"] : []),
          ...(masking.hits.r5 ? ["R5_ACCOUNT"] : []),
        ],
        repeat,
      },
    });
    safetyCard = "money";
  }

  // 5) PAT_INVEST — 1회 WARN → 반복 QUEUE (외부 링크 동반 시 meta 가중)
  if (investKeyword) {
    const repeat = input.recentMoneyInvestHits > 0;
    flags.push({
      rule_code: "PAT_INVEST",
      action: repeat ? "QUEUE" : "WARN",
      meta: { withLink: masking.hits.r4, repeat },
    });
    safetyCard = safetyCard ?? "invest";
  }

  // 6) PAT_SEXUAL — 성매매 은어 = QUEUE (A5 §5.2 단계 4)
  if (sexualSlang) {
    flags.push({ rule_code: "PAT_SEXUAL", action: "QUEUE", meta: { signals: ["SLANG"] } });
    safetyCard = safetyCard ?? "sexual";
  }

  // 7) PAT_OFFPLATFORM_PUSH — 저신뢰 LOG (24h 내 반복 판정은 D5 집계 소관)
  if (offPlatform) {
    flags.push({
      rule_code: "PAT_OFFPLATFORM_PUSH",
      action: "LOG",
      meta: { within24hOfMatch: input.within24hOfMatch },
    });
  }

  // 8) PAT_SCRIPT_DUP — 서로 다른 매칭 3곳 이상 동일 본문 = QUEUE
  if (input.scriptDuplicated) {
    flags.push({ rule_code: "PAT_SCRIPT_DUP", action: "QUEUE", meta: {} });
  }

  return { flags, blockSend, safetyCard };
}

/** PAT_SCRIPT_DUP 비교용 본문 정규화 (해시 대신 정규화 문자열 동등 비교) */
export function normalizeForDupCheck(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/gu, " ");
}
