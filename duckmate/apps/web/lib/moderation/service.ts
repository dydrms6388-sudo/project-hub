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

/**
 * 신고 접수 코어 — Server Action(submitReport)과 POST /api/reports 가 동일 호출.
 * 레이트 리밋: 동일 신고자→동일 대상 24h 1회 (초과분은 병합 — 새 행을 만들지 않는다).
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
