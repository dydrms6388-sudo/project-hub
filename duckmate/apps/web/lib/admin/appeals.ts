// =============================================================================
// D8 · 이의제기 큐 — 조회 / 처리 (A5 §3.3)
//
// 규칙:
//   - 처리 기한 7일 (접수 created_at + 7d) — 큐에 due 표시, 초과분 상단.
//   - 4-eyes: 처리자는 원 제재 처리자(sanctions.created_by)와 달라야 한다.
//     이것은 세션 기반 실검증 — 현재 로그인 어드민 == 원 처리자면 거부.
//   - 처리 자체는 00010 resolve_appeal() RPC 위임 (원자성 + 부수효과 누락 방지).
//   - ACCEPTED: 제재 REVOKED + sanctions.appeal_status=ACCEPTED.
//     레벨 5 였다면 계정 복구 + CI 블랙리스트 회수.
//     (A5 "정지 기간만큼 구독 보상"은 Phase 3 결제 도입 후 D6 소관 — 미구현.)
//   - REJECTED: 사유 필수 (피신고자 통보 문안의 원천).
// =============================================================================

import type { Appeal, Profile, Sanction } from "@duckmate/db";
import {
  adminAudit,
  adminDb,
  adminFail,
  requireAdminActor,
  type AdminResult,
} from "./service";

export const APPEAL_SLA_DAYS = 7;

export interface AppealQueueRow {
  appeal: Appeal;
  sanction: Sanction | null;
  nickname: string | null;
  /** 처리 기한 (created_at + 7d) */
  dueAt: string;
  overdue: boolean;
  /** 원 제재 처리자와 현재 어드민이 동일 = 이 어드민은 처리 불가 (4-eyes) */
  fourEyesBlockedForMe: boolean;
}

/** 이의제기 큐 — PENDING 오래된 순 (기한 초과분이 자연히 최상단) */
export async function listAppeals(
  scope: "pending" | "all" = "pending"
): Promise<AdminResult<AppealQueueRow[]>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  let q = db.from("appeals").select("*").order("created_at", { ascending: true }).limit(100);
  if (scope === "pending") q = q.eq("status", "PENDING");

  const { data, error } = await q;
  if (error) return adminFail("DB_ERROR", error.message);
  const appeals = (data ?? []) as Appeal[];
  if (appeals.length === 0) return { ok: true, data: [] };

  const sanctionIds = [...new Set(appeals.map((a) => a.sanction_id))];
  const { data: sanctionRows } = await db.from("sanctions").select("*").in("id", sanctionIds);
  const sanctionMap = new Map(((sanctionRows ?? []) as Sanction[]).map((s) => [s.id, s]));

  const profileIds = [
    ...new Set(appeals.map((a) => a.profile_id).filter((v): v is string => !!v)),
  ];
  const nicknameMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, nickname").in("id", profileIds);
    for (const p of (profiles ?? []) as Pick<Profile, "id" | "nickname">[]) {
      nicknameMap.set(p.id, p.nickname);
    }
  }

  const now = Date.now();
  return {
    ok: true,
    data: appeals.map((appeal) => {
      const sanction = sanctionMap.get(appeal.sanction_id) ?? null;
      const dueAt = new Date(
        new Date(appeal.created_at).getTime() + APPEAL_SLA_DAYS * 86_400_000
      ).toISOString();
      return {
        appeal,
        sanction,
        nickname: appeal.profile_id ? nicknameMap.get(appeal.profile_id) ?? null : null,
        dueAt,
        overdue: appeal.status === "PENDING" && new Date(dueAt).getTime() < now,
        fourEyesBlockedForMe: sanction?.created_by === ctx.profile.id,
      };
    }),
  };
}

export interface DecideAppealInput {
  appealId: string;
  decision: "ACCEPTED" | "REJECTED";
  /** 결정 사유 — REJECTED 는 통보 문안의 원천이므로 필수, ACCEPTED 도 감사용 필수 */
  reason: string;
}

/**
 * 이의제기 처리 — 00010 `resolve_appeal()` RPC 위임 (G2-05 동반 조치).
 * RPC 안에 4-eyes(원 제재 처리자 배제)·제재 REVOKED·레벨 5 계정 복구 +
 * blocked_hashes 회수·처리기한(7일) 감사기록이 모두 들어 있다. 앱에서 다중
 * UPDATE 를 직접 수행하면 그 부수효과가 조용히 빠진다(신고 쪽 G2-05 와 동형 결함).
 */
export async function decideAppeal(input: DecideAppealInput): Promise<AdminResult<undefined>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const reason = input.reason.trim();
  if (reason.length < 2) return adminFail("INVALID_INPUT", "결정 사유를 입력해 주세요.");
  if (input.decision !== "ACCEPTED" && input.decision !== "REJECTED") {
    return adminFail("INVALID_INPUT", "결정은 인용(ACCEPTED) 또는 기각(REJECTED)이어야 해요.");
  }

  // 화면 메시지 품질을 위한 선검증 (실제 강제는 RPC 안에서도 반복된다)
  const { data: appeal, error } = await db
    .from("appeals")
    .select("id, sanction_id, profile_id, status")
    .eq("id", input.appealId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!appeal) return adminFail("NOT_FOUND", "이의제기를 찾을 수 없어요.");
  if (appeal.status !== "PENDING") return adminFail("ALREADY_HANDLED", "이미 처리된 이의제기예요.");

  const { data: sanction } = await db
    .from("sanctions")
    .select("id, profile_id, level, status, created_by")
    .eq("id", appeal.sanction_id)
    .maybeSingle();
  if (!sanction) return adminFail("NOT_FOUND", "연결된 제재를 찾을 수 없어요.");

  // 4-eyes: 원 제재 처리자는 이의제기를 처리할 수 없다 (A5 §3.3-4)
  if (sanction.created_by === ctx.profile.id) {
    return adminFail("FOUR_EYES_SELF", "원 제재 처리자는 이의제기를 처리할 수 없어요 (4-eyes). 다른 어드민에게 배정해 주세요.");
  }

  const { error: rpcError } = await db.rpc("resolve_appeal", {
    p_appeal_id: input.appealId,
    p_decision: input.decision,
    p_admin_id: ctx.profile.id,
    p_reason: reason,
  });
  if (rpcError) return mapResolveAppealError(rpcError.message);

  await adminAudit(
    ctx.profile.id,
    input.decision === "ACCEPTED" ? "admin.appeal.accept" : "admin.appeal.reject",
    `appeal:${input.appealId}`,
    {
      sanction_id: appeal.sanction_id,
      sanction_level: sanction.level,
      original_handler_id: sanction.created_by, // 4-eyes 증적
      reason,
      via: "resolve_appeal_rpc",
    }
  );

  return { ok: true, data: undefined };
}

/** resolve_appeal() 가 raise 하는 DUCKMATE_* 예외를 AdminResult 코드로 매핑 */
function mapResolveAppealError(message: string): AdminResult<never> {
  if (message.includes("DUCKMATE_APPEAL_NOT_FOUND")) {
    return adminFail("NOT_FOUND", "이의제기를 찾을 수 없어요.");
  }
  if (message.includes("DUCKMATE_APPEAL_SANCTION_GONE")) {
    return adminFail("NOT_FOUND", "연결된 제재를 찾을 수 없어요.");
  }
  if (message.includes("DUCKMATE_APPEAL_ALREADY_DECIDED")) {
    return adminFail("ALREADY_HANDLED", "이미 처리된 이의제기예요.");
  }
  if (message.includes("DUCKMATE_APPEAL_4EYES_VIOLATION")) {
    return adminFail(
      "FOUR_EYES_SELF",
      "원 제재 처리자는 이의제기를 처리할 수 없어요 (4-eyes). 다른 어드민에게 배정해 주세요."
    );
  }
  if (message.includes("DUCKMATE_APPEAL_NOT_ADMIN")) {
    return adminFail("INVALID_INPUT", "어드민 권한을 확인할 수 없어요.");
  }
  if (message.includes("DUCKMATE_APPEAL_INVALID_DECISION")) {
    return adminFail("INVALID_INPUT", "결정 값이 올바르지 않아요.");
  }
  return adminFail("DB_ERROR", message);
}
