/**
 * compute_scam_score(SQL, 0041) 의 TS 미러 — 어드민 표시·테스트용. 판정 원본은 SQL.
 * 입력은 이미 집계된 시그널(rule_id 별 hit 수 + 개별 score) 이며, 파생 시그널(SC_MASS_LIKE/SC_OFFAPP) 도 호출자가 넣는다.
 */
import { MODERATION_RULES, SCAM_SIGNAL_WEIGHTS, type ScamRuleId } from "./constants";

export type ScamSignalInput = { ruleId: string; count: number; /** message_flags.score 합(0 이면 가중치표 사용) */ score?: number };
export type ScamSignal = { rule_id: string; count: number; points: number };
export type ScamScoreResult = { score: number; signals: ScamSignal[]; level: "none" | "banner" | "restrict" };

export function isScamRule(ruleId: string): ruleId is ScamRuleId {
  return Object.prototype.hasOwnProperty.call(SCAM_SIGNAL_WEIGHTS, ruleId);
}

export function computeScamScore(inputs: ReadonlyArray<ScamSignalInput>, warnOnly: ReadonlyArray<string> = []): ScamScoreResult {
  const signals: ScamSignal[] = [];
  let score = 0;
  for (const s of inputs) {
    if (!s.ruleId.startsWith("SC_") || warnOnly.includes(s.ruleId) || s.count <= 0) continue;
    const weight = isScamRule(s.ruleId) ? SCAM_SIGNAL_WEIGHTS[s.ruleId] : 0;
    const points = s.score && s.score > 0 ? s.score : weight * s.count;
    signals.push({ rule_id: s.ruleId, count: s.count, points });
    score += points;
  }
  const level = score >= MODERATION_RULES.scamScoreRestrict ? "restrict" : score >= MODERATION_RULES.scamScoreBanner ? "banner" : "none";
  return { score, signals, level };
}

/** SC_MASS_LIKE 파생: 가입 24h 내 좋아요 수 */
export function massLikeSignal(likesWithin24h: number): ScamSignalInput | null {
  return likesWithin24h >= MODERATION_RULES.massLike24h ? { ruleId: "SC_MASS_LIKE", count: likesWithin24h, score: SCAM_SIGNAL_WEIGHTS.SC_MASS_LIKE } : null;
}
/** SC_OFFAPP 파생: 매칭 24h 내 CT_* hit 이 임계 이상인 매칭 수 */
export function offAppSignal(matchesWithEarlyContactHits: number): ScamSignalInput | null {
  return matchesWithEarlyContactHits > 0 ? { ruleId: "SC_OFFAPP", count: matchesWithEarlyContactHits } : null;
}
