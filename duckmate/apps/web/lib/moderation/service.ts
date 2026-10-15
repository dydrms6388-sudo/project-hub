// =============================================================================
// D5 · 신고 접수 공용 로직 — ⚠ 서버 전용 (Server Action 과 /api/reports 가 공유)
//
// 구조 (D1 규약 — 14_schema →D5):
//   reports 는 클라이언트 INSERT 권한 자체가 없다(00003 revoke). 접수는 반드시
//   service role 로 insert 하고, insert 시점에 DB 가 자동으로:
//     · triage_report()        (BEFORE) : priority + sla_due_at
//     · apply_auto_sanctions() (AFTER)  : AUTO_3REPORTS / AUTO_P0_FREEZE (00010)
//   를 수행한다. 접수 직후 create_report_snapshot(report_id) 를 동기 호출해
//   72h·200개 evidence 를 기록한다(match 신고 시). 이미지 원본의 evidence/ 버킷
//   복사는 Storage API 가 필요한 후처리 — D7/파기잡 계열 Edge 소관(18_moderation).
//
// 신고자 보호: 이 경로의 어떤 산출물도 피신고자에게 노출되지 않는다 —
//   reports 행은 admin/본인(my_reports)만 조회 가능, 자동 제재 reason 은 일반화 문구.
// =============================================================================

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { submitReportSchema, modFail, type ModerationResult } from "./schemas";

export interface SubmitReportData {
  reportId: string;
  /** 트리거가 확정한 SLA (P0 +1h, 그 외 +24h) — "24시간 내 처리" 안내용 */
  slaDueAt: string | null;
}

/** 서버 실행 컨텍스트 강제 — 클라이언트 번들 유입 시 즉시 실패 (verify.ts 와 동일 규약) */
function assertServiceContext(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/moderation/service.ts 는 서버 전용이다 — 클라이언트에서 import 금지");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정 — service role 서버 환경에서만 호출 가능");
  }
}

/** 현재 세션의 profile id (없으면 null) */
async function getOwnProfileId(): Promise<{ userId: string; profileId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { userId: user.id, profileId: (profile as { id: string }).id };
}

// ---------------------------------------------------------------------------
// [G2-04] 신고자 단위 남용 방지 상한
//
// 기존에는 (신고자, 대상) 24h 1회 제한밖에 없어, 계정 1개로 임의 다수를 각각
// P0 로 신고해 대상마다 AUTO_P0_FREEZE(72h 발신 정지)를 유발할 수 있었다.
//
// 정책 근거(05_trust_safety §2 "무고성 신고 방지"):
//   · "동일 신고자→동일 대상 중복 신고는 병합"        → 기존 24h 1회 유지
//   · "신고 남용(30일 내 기각 5건)은 신고 기능 30일 제한" → 아래 ②로 신규 집행
//   · 24h 총량 상한은 A5 에 수치 규정이 없어 신설한다(①). 정상 이용자가 하루에
//     10명 넘게 신고할 상황은 실질적으로 없고(A5 §2 는 "대화·프로필 단위 신고"),
//     넘더라도 고객센터 경로가 남으므로 안전 상한으로 충분하다.
//
// 자동 제재까지 유발할 수 있는 대상 수(24h 3명)는 DB 트리거
// apply_auto_sanctions()(00014)가 별도로 제한한다 — 앱 경로를 우회해도 유효하도록.
// ---------------------------------------------------------------------------

/** 신고자 1인이 24시간에 신고할 수 있는 서로 다른 대상 수 상한 */
export const REPORTER_MAX_TARGETS_24H = 10;
/** 30일 내 기각(DISMISSED) 이 이 수를 넘으면 신고 접수를 30일간 제한 (A5 §2) */
export const REPORTER_MAX_DISMISSED_30D = 5;

/**
 * 신고 접수 코어 — Server Action(submitReport)과 POST /api/reports 가 동일 호출.
 * 레이트 리밋:
 *   1) 동일 신고자→동일 대상 24h 1회 (초과분은 병합 — 새 행을 만들지 않는다)
 *   2) 신고자당 24h 서로 다른 대상 REPORTER_MAX_TARGETS_24H 건 (G2-04)
 *   3) 30일 내 기각 REPORTER_MAX_DISMISSED_30D 건 이상 → 30일 신고 제한 (A5 §2)
 */
export async function submitReportCore(input: unknown): Promise<ModerationResult<SubmitReportData>> {
  assertServiceContext();

  const parsed = submitReportSchema.safeParse(input);
  if (!parsed.success) {
    return modFail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "신고 내용을 확인해 주세요.");
  }
  const { targetId, matchId, reasonCode, detail } = parsed.data;

  const me = await getOwnProfileId();
  if (!me) return modFail("AUTH_REQUIRED", "로그인이 필요해요.");
  if (targetId === me.profileId) return modFail("SELF_ACTION", "자기 자신은 신고할 수 없어요.");

  const service = createServiceClient();

  // 대상 프로필 존재 확인 (탈퇴자는 profiles 행이 없다 — 신고 불가, 큐는 기존 신고로)
  const { data: target } = await service
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return modFail("TARGET_NOT_FOUND", "대상을 찾을 수 없어요.");

  // match_id 검증: 내가 참여자이고, 피신고자가 그 매칭의 상대여야 한다
  //   (제3자 대화 스냅샷 금지 — A5 §4.1 최소 수집 원칙)
  if (matchId) {
    const { data: match } = await service
      .from("matches")
      .select("id, a_id, b_id")
      .eq("id", matchId)
      .maybeSingle();
    const m = match as { id: string; a_id: string | null; b_id: string | null } | null;
    const pair = m ? [m.a_id, m.b_id] : [];
    if (!m || !pair.includes(me.profileId) || !pair.includes(targetId)) {
      return modFail("MATCH_NOT_FOUND", "해당 대화방을 확인할 수 없어요.");
    }
  }

  // 레이트 리밋: 동일 대상 중복 신고 24h 1회 (A5 §2 무고성 신고 방지 — 병합)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", me.profileId)
    .eq("target_id", targetId)
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    return modFail("RATE_LIMITED", "이미 접수된 신고가 있어요. 기존 신고에 병합해 처리 중이에요.");
  }

  // [G2-04] ① 신고자 단위 24h 총량 — 서로 다른 대상 기준 (대상당 1행이므로 행 수 = 대상 수)
  {
    const { data: recent, error: recentError } = await service
      .from("reports")
      .select("target_id")
      .eq("reporter_id", me.profileId)
      .gte("created_at", since)
      .limit(200);
    if (recentError) return modFail("DB_ERROR", recentError.message);
    const distinctTargets = new Set(
      (recent ?? [])
        .map((r) => (r as { target_id: string | null }).target_id)
        .filter((v): v is string => !!v),
    );
    if (distinctTargets.size >= REPORTER_MAX_TARGETS_24H) {
      return modFail(
        "RATE_LIMITED",
        "하루에 접수할 수 있는 신고 수를 넘었어요. 급한 안전 문제는 고객센터로 알려 주세요.",
      );
    }
  }

  // [G2-04] ② 남용 이력 — 30일 내 기각 5건 이상이면 30일간 접수 제한 (A5 §2)
  {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: dismissed, error: dismissError } = await service
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", me.profileId)
      .eq("status", "DISMISSED")
      .gte("handled_at", since30d);
    if (dismissError) return modFail("DB_ERROR", dismissError.message);
    if ((dismissed ?? 0) >= REPORTER_MAX_DISMISSED_30D) {
      return modFail(
        "RATE_LIMITED",
        "최근 신고가 반복해서 기각되어 신고 기능이 일시적으로 제한됐어요. 고객센터로 문의해 주세요.",
      );
    }
  }

  // 접수 (service role — triage/auto_sanctions 트리거가 insert 시점에 동작)
  const { data: report, error } = await service
    .from("reports")
    .insert({
      reporter_id: me.profileId,
      target_id: targetId,
      match_id: matchId,
      reason_code: reasonCode,
      detail,
    })
    .select("id, sla_due_at")
    .single();
  if (error || !report) {
    return modFail("DB_ERROR", error?.message ?? "신고 접수에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
  const row = report as { id: string; sla_due_at: string | null };

  // 증거 스냅샷 동기 생성 (D1 규약: 접수 직후 — 가해자 삭제·탈퇴 전에 복사)
  //   실패해도 접수 자체는 유효 — audit 로 남겨 어드민이 수동 재생성한다.
  if (matchId) {
    const { error: snapError } = await service.rpc("create_report_snapshot", {
      p_report_id: row.id,
    });
    if (snapError) {
      await service.from("audit_logs").insert({
        actor_id: null,
        action: "moderation.snapshot_failed",
        target: `reports:${row.id}`,
        meta: { message: snapError.message },
      });
    }
  }

  return { ok: true, data: { reportId: row.id, slaDueAt: row.sla_due_at } };
}
