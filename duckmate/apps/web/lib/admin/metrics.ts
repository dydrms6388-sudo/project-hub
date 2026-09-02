// =============================================================================
// D8 · 대시보드 지표 (F-ADM-04)
//
// 설계 원칙: 전부 count(head:true) 단건 집계 — 행 페치 없이 스케일된다.
//   - DAU: profiles.last_active_at >= KST 오늘 00:00 (앱 진입 시 클라이언트가
//     갱신하는 컬럼 — E그룹 화이트리스트 소속). analytics_events distinct 는
//     Postgrest 로 스케일 집계가 불가해 근사치로 이 방식을 채택 (21_admin.md).
//   - 30일 이동평균 DAU 는 일별 롤업 테이블이 없어 미구현 — 오늘 DAU 로
//     임계 감시를 대신한다 (후속: D7 일별 롤업 cron, 21_admin.md §미결).
//   - 청소년보호책임자 임계 (B1 L5): DAU 10만 도달 시 지정 의무 → 80% 부터
//     경고, 100% 도달 시 알림 배지. L8(불법촬영물 기술적 조치) 재판정도 동시.
//   - 퍼널: analytics_events name 별 오늘 건수 (A3 §4.1 이벤트명 고정).
// =============================================================================

import { adminDb, adminFail, kstDayStartIso, requireAdminActor, type AdminResult } from "./service";
import { OPEN_REPORT_STATUSES } from "./reports";

/** 정보통신망법 §42의3 — 청소년보호책임자 지정 규모 요건 (일평균 이용자) */
export const YOUTH_PROTECTION_DAU_THRESHOLD = 100_000;
const YOUTH_WARNING_RATIO = 0.8;

/** A3 §4.1 퍼널 이벤트 (이름 고정 — 임의 개명 금지) */
export const FUNNEL_EVENT_NAMES = [
  "signup_start",
  "onboarding_complete",
  "reco_queue_open",
  "like_sent",
  "match_created",
  "first_message_sent",
] as const;

export interface DashboardMetrics {
  generatedAt: string;
  /** KST 오늘 00:00 이후 활동 프로필 수 (근사 DAU) */
  dauToday: number;
  signupsToday: number;
  likesToday: number;
  matchesToday: number;
  /** matchesToday / likesToday (%) — likes 0 이면 null */
  matchRatePct: number | null;
  reportsToday: number;
  /** reportsToday / dauToday (%) — DAU 0 이면 null. A3 §4.3 "신고율 교차 배치" */
  reportRatePct: number | null;
  reportsOpen: number;
  reportsOpenP0: number;
  /** 미종결 && sla_due_at 경과 (A5 §6 에스컬레이션 대상) */
  slaBreached: number;
  /** 미종결 && 기한 4시간 이내 (A5 §6-③ –4h 에스컬레이션) */
  slaImminent: number;
  photosPending: number;
  appealsPending: number;
  /** PENDING && 접수 +7일 경과 */
  appealsOverdue: number;
  youth: {
    dau: number;
    threshold: number;
    ratioPct: number;
    /** 80% 도달 — 지정 준비 경고 */
    nearing: boolean;
    /** 100% 도달 — 청소년보호책임자 지정 의무 + L8 재판정 트리거 */
    reached: boolean;
  };
  /** 오늘 퍼널 이벤트 건수 (name → count) */
  funnelToday: Record<string, number>;
}

export async function getDashboardMetrics(): Promise<AdminResult<DashboardMetrics>> {
  await requireAdminActor();
  const db = adminDb();

  const todayStart = kstDayStartIso();
  const nowIso = new Date().toISOString();
  const in4hIso = new Date(Date.now() + 4 * 3_600_000).toISOString();
  const appealDueCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // count 쿼리 빌더 — 실패 시 -1 로 표시하지 않고 즉시 에러 전파를 위해 순차 검사
  const counts = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).gte("last_active_at", todayStart), // 0 dau
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart), // 1 signups
    db.from("likes").select("from_id", { count: "exact", head: true }).gte("created_at", todayStart), // 2 likes
    db.from("matches").select("id", { count: "exact", head: true }).gte("matched_at", todayStart), // 3 matches
    db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", todayStart), // 4 reports today
    db.from("reports").select("id", { count: "exact", head: true }).in("status", [...OPEN_REPORT_STATUSES]), // 5 open
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REPORT_STATUSES])
      .eq("priority", "P0"), // 6 open P0
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REPORT_STATUSES])
      .lt("sla_due_at", nowIso), // 7 breached
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REPORT_STATUSES])
      .gte("sla_due_at", nowIso)
      .lt("sla_due_at", in4hIso), // 8 imminent
    db.from("photos").select("id", { count: "exact", head: true }).eq("review_status", "pending"), // 9 photos
    db.from("appeals").select("id", { count: "exact", head: true }).eq("status", "PENDING"), // 10 appeals
    db
      .from("appeals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .lt("created_at", appealDueCutoff), // 11 appeals overdue
  ]);

  for (const { error } of counts) {
    if (error) return adminFail("DB_ERROR", error.message);
  }
  const n = counts.map((c) => c.count ?? 0);

  // 퍼널 이벤트 (이벤트명별 오늘 건수)
  const funnelCounts = await Promise.all(
    FUNNEL_EVENT_NAMES.map((name) =>
      db
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("name", name)
        .gte("created_at", todayStart)
    )
  );
  const funnelToday: Record<string, number> = {};
  FUNNEL_EVENT_NAMES.forEach((name, i) => {
    funnelToday[name] = funnelCounts[i]?.count ?? 0;
  });

  const dauToday = n[0] ?? 0;
  const likesToday = n[2] ?? 0;
  const matchesToday = n[3] ?? 0;
  const reportsToday = n[4] ?? 0;
  const ratio = dauToday / YOUTH_PROTECTION_DAU_THRESHOLD;

  return {
    ok: true,
    data: {
      generatedAt: nowIso,
      dauToday,
      signupsToday: n[1] ?? 0,
      likesToday,
      matchesToday,
      matchRatePct: likesToday > 0 ? Math.round((matchesToday / likesToday) * 1000) / 10 : null,
      reportsToday,
      reportRatePct: dauToday > 0 ? Math.round((reportsToday / dauToday) * 1000) / 10 : null,
      reportsOpen: n[5] ?? 0,
      reportsOpenP0: n[6] ?? 0,
      slaBreached: n[7] ?? 0,
      slaImminent: n[8] ?? 0,
      photosPending: n[9] ?? 0,
      appealsPending: n[10] ?? 0,
      appealsOverdue: n[11] ?? 0,
      youth: {
        dau: dauToday,
        threshold: YOUTH_PROTECTION_DAU_THRESHOLD,
        ratioPct: Math.round(ratio * 1000) / 10,
        nearing: ratio >= YOUTH_WARNING_RATIO,
        reached: ratio >= 1,
      },
      funnelToday,
    },
  };
}
