/**
 * 지표 계산 TS 미러 (0060 SQL 결과 → KPI 값). 순수 함수, 테스트 대상.
 * SQL 은 카운트만 돌려주고 비율·KPI 판정은 여기서 한다(정의 단일화: 21_admin.md 지표 정의표).
 */
import type { DailyMetricRow, FunnelRow, GenderRow, PhotoMetrics, SlaRow } from "./types";

export function ratio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

export function pct(v: number | null, digits = 1): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}

export function sum<T>(rows: readonly T[], pick: (r: T) => number): number {
  return rows.reduce((a, r) => a + (pick(r) || 0), 0);
}

/** 좋아요→매칭 전환 = match_created / like_sent (PRD §6, 목표 ≥ 8%) */
export function likeToMatchRate(rows: readonly DailyMetricRow[]): number | null {
  return ratio(sum(rows, (r) => r.matches), sum(rows, (r) => r.likes));
}

/** 추천→좋아요 = likes / reco_count */
export function recoToLikeRate(rows: readonly DailyMetricRow[]): number | null {
  return ratio(sum(rows, (r) => r.likes), sum(rows, (r) => r.reco_count));
}

/** 매칭→첫 메시지 = 그 기간 매칭 중 first_message_at 존재 비율 (목표 ≥ 70%) */
export function matchToFirstMessageRate(rows: readonly DailyMetricRow[]): number | null {
  return ratio(sum(rows, (r) => r.first_messages), sum(rows, (r) => r.matches));
}

/** 신고율(활성 유저 기준) = reports / Σ active_users(일별 DAU 합). analytics 미도입 시 null */
export function reportRatePerActive(rows: readonly DailyMetricRow[]): number | null {
  return ratio(sum(rows, (r) => r.reports), sum(rows, (r) => r.active_users));
}

/** 신고율(매칭 기준, PRD 정의) = reports / matches (목표 ≤ 3%) */
export function reportRatePerMatch(rows: readonly DailyMetricRow[]): number | null {
  return ratio(sum(rows, (r) => r.reports), sum(rows, (r) => r.matches));
}

/** SLA 준수율 = within_sla / (handled + overdue_open). 아직 기한 안 지난 미종결 건은 분모 제외 */
export function slaCompliance(row: Pick<SlaRow, "handled" | "within_sla" | "overdue_open">): number | null {
  return ratio(row.within_sla, row.handled + row.overdue_open);
}

export function slaComplianceAll(rows: readonly SlaRow[], priorities: readonly string[] = ["P0", "P1", "P2"]): number | null {
  const sel = rows.filter((r) => priorities.includes(r.priority));
  return ratio(sum(sel, (r) => r.within_sla), sum(sel, (r) => r.handled + r.overdue_open));
}

/** 데이팅 모드 여성 비율 (KPI ≥ 35%). unspecified 는 분모 포함, 분자 제외 */
export function datingFemaleRatio(rows: readonly GenderRow[]): { ratio: number | null; female: number; total: number } {
  const dating = rows.filter((r) => r.mode === "dating");
  const total = sum(dating, (r) => r.cnt);
  const female = sum(dating.filter((r) => r.gender === "female"), (r) => r.cnt);
  return { ratio: ratio(female, total), female, total };
}

export function genderByMode(rows: readonly GenderRow[]): Record<"friend" | "dating", { female: number; male: number; unspecified: number; total: number }> {
  const out = { friend: { female: 0, male: 0, unspecified: 0, total: 0 }, dating: { female: 0, male: 0, unspecified: 0, total: 0 } };
  for (const r of rows) {
    const bucket = out[r.mode];
    const g = r.gender === "female" || r.gender === "male" ? r.gender : "unspecified";
    bucket[g] += r.cnt;
    bucket.total += r.cnt;
  }
  return out;
}

/** 퍼널 단계별 전환율(직전 단계 대비) */
export function funnelWithRates(rows: readonly FunnelRow[]): Array<FunnelRow & { stepRate: number | null; fromStart: number | null }> {
  const sorted = [...rows].sort((a, b) => a.ord - b.ord);
  const start = sorted[0]?.cnt ?? 0;
  return sorted.map((r, i) => ({
    ...r,
    stepRate: i === 0 ? 1 : ratio(r.cnt, sorted[i - 1]?.cnt ?? 0),
    fromStart: ratio(r.cnt, start),
  }));
}

/** 사진 검수 24h 내 처리율 (목표 ≥ 95%) */
export function photoReview24hRate(m: Pick<PhotoMetrics, "reviewed" | "within_24h">): number | null {
  return ratio(m.within_24h, m.reviewed);
}

/** 남은 SLA 시간(초). 음수 = 초과 */
export function remainingSeconds(dueAtIso: string, now: Date = new Date()): number {
  return Math.round((new Date(dueAtIso).getTime() - now.getTime()) / 1000);
}
