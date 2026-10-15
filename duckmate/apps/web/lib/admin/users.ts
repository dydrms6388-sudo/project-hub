// =============================================================================
// D8 · 유저 관리 — 검색(닉네임/이메일) / 상세(프로필·제재·신고 이력) / 수동 제재
//
// - 이메일은 profiles 에 없다(auth.users 소관) → service role 의
//   auth.admin API 로만 조회. 이메일 검색은 GoTrue listUsers 페이징 스캔
//   (필터 API 부재)이라 초기 규모 전제 — 21_admin.md §미결에 한계 명시.
// - 수동 제재: resolveReport 와 동일 규칙(레벨 5 = 4-eyes + banned + CI 블랙리스트).
// - 제재 해제(REVOKE): 레벨 5 였다면 계정 복구 + 블랙리스트 회수.
// =============================================================================

import type { AuditLog, Photo, Profile, Report, Sanction, SanctionLevel } from "@duckmate/db";
import {
  adminAudit,
  adminDb,
  adminFail,
  applyPermanentBan,
  requireAdminActor,
  revertPermanentBan,
  sanctionEndsAt,
  verifyCoApprover,
  type AdminResult,
} from "./service";

export interface UserSearchRow {
  profileId: string;
  nickname: string;
  email: string | null;
  verifyLevel: Profile["verify_level"];
  status: Profile["status"];
  mode: Profile["mode"];
  role: Profile["role"];
  createdAt: string;
}

const EMAIL_SCAN_MAX_PAGES = 5; // 200명/페이지 — 초기 규모 전제 (21_admin.md 미결)

/** 유저 검색 — "@" 포함 시 이메일 검색, 그 외 닉네임 부분일치 */
export async function searchUsers(query: string): Promise<AdminResult<UserSearchRow[]>> {
  await requireAdminActor();
  const db = adminDb();

  const q = query.trim();
  if (q.length < 2) return adminFail("INVALID_INPUT", "검색어는 2자 이상 입력해 주세요.");

  if (q.includes("@")) {
    // 이메일 검색 — GoTrue listUsers 스캔
    const needle = q.toLowerCase();
    const matchedUserIds = new Map<string, string>(); // user_id → email
    for (let page = 1; page <= EMAIL_SCAN_MAX_PAGES; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return adminFail("DB_ERROR", error.message);
      for (const u of data.users) {
        if (u.email && u.email.toLowerCase().includes(needle)) {
          matchedUserIds.set(u.id, u.email);
        }
      }
      if (data.users.length < 200) break;
    }
    if (matchedUserIds.size === 0) return { ok: true, data: [] };

    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, user_id, nickname, verify_level, status, mode, role, created_at")
      .in("user_id", [...matchedUserIds.keys()])
      .limit(20);
    if (error) return adminFail("DB_ERROR", error.message);

    return {
      ok: true,
      data: ((profiles ?? []) as Profile[]).map((p) => ({
        profileId: p.id,
        nickname: p.nickname,
        email: matchedUserIds.get(p.user_id) ?? null,
        verifyLevel: p.verify_level,
        status: p.status,
        mode: p.mode,
        role: p.role,
        createdAt: p.created_at,
      })),
    };
  }

  // 닉네임 부분일치
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, user_id, nickname, verify_level, status, mode, role, created_at")
    .ilike("nickname", `%${q}%`)
    .limit(20);
  if (error) return adminFail("DB_ERROR", error.message);

  return {
    ok: true,
    data: ((profiles ?? []) as Profile[]).map((p) => ({
      profileId: p.id,
      nickname: p.nickname,
      email: null, // 목록에서는 미조회 (상세에서 노출) — 개인정보 최소 노출
      verifyLevel: p.verify_level,
      status: p.status,
      mode: p.mode,
      role: p.role,
      createdAt: p.created_at,
    })),
  };
}

export interface UserDetail {
  profile: Profile;
  email: string | null;
  sanctions: Sanction[];
  /** 이 유저를 대상으로 한 신고 (evidence 제외 컬럼) */
  reportsAgainst: Pick<Report, "id" | "reason_code" | "status" | "priority" | "created_at">[];
  /** 이 유저가 제기한 신고 수 (무고성 신고 감시 참고치) */
  reportsFiledCount: number;
  photos: Photo[];
  recentAuditLogs: AuditLog[];
}

/** 유저 상세 — profileId 기준 (라우트 [userId] 파라미터 = profiles.id) */
export async function getUserDetail(profileId: string): Promise<AdminResult<UserDetail>> {
  await requireAdminActor();
  const db = adminDb();

  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!profile) return adminFail("NOT_FOUND", "유저를 찾을 수 없어요.");
  const p = profile as Profile;

  let email: string | null = null;
  const { data: authUser } = await db.auth.admin.getUserById(p.user_id);
  if (authUser?.user?.email) email = authUser.user.email;

  const [{ data: sanctions }, { data: reportsAgainst }, { count: filedCount }, { data: photos }, { data: logs }] =
    await Promise.all([
      db.from("sanctions").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(30),
      db
        .from("reports")
        .select("id, reason_code, status, priority, created_at")
        .eq("target_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30),
      db.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", profileId),
      db.from("photos").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
      db
        .from("audit_logs")
        .select("*")
        .eq("target", `profile:${profileId}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return {
    ok: true,
    data: {
      profile: p,
      email,
      sanctions: (sanctions ?? []) as Sanction[],
      reportsAgainst: (reportsAgainst ?? []) as UserDetail["reportsAgainst"],
      reportsFiledCount: filedCount ?? 0,
      photos: (photos ?? []) as Photo[],
      recentAuditLogs: (logs ?? []) as AuditLog[],
    },
  };
}

export interface ImposeSanctionInput {
  profileId: string;
  level: SanctionLevel;
  reason: string;
  /** 레벨 5 필수 — 부승인 어드민 닉네임 (4-eyes) */
  coApproverNickname?: string;
}

/** 수동 제재 부과 (신고 없이 — report_id null). 규칙은 resolveReport 와 동일 */
export async function imposeSanction(
  input: ImposeSanctionInput
): Promise<AdminResult<{ sanctionId: string }>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const reason = input.reason.trim();
  if (reason.length < 2) return adminFail("INVALID_INPUT", "제재 사유를 입력해 주세요.");
  if (!input.level || input.level < 1 || input.level > 5) {
    return adminFail("INVALID_INPUT", "제재 레벨(1~5)을 선택해 주세요.");
  }

  const { data: target } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", input.profileId)
    .maybeSingle();
  if (!target) return adminFail("NOT_FOUND", "대상 유저를 찾을 수 없어요.");

  let coApproverId: string | null = null;
  if (input.level === 5) {
    if (!input.coApproverNickname?.trim()) {
      return adminFail("FOUR_EYES_REQUIRED", "영구정지는 부승인 어드민 닉네임이 필요해요 (2인 승인).");
    }
    const co = await verifyCoApprover(ctx.profile.id, input.coApproverNickname);
    if (!co.ok) return co;
    coApproverId = co.data.coApproverId;
  }

  const now = new Date().toISOString();
  const { data: sanction, error: sErr } = await db
    .from("sanctions")
    .insert({
      profile_id: input.profileId,
      level: input.level,
      reason,
      report_id: null,
      status: "ACTIVE",
      appeal_status: "NONE",
      starts_at: now,
      ends_at: sanctionEndsAt(input.level),
      created_by: ctx.profile.id,
    })
    .select("id")
    .single();
  if (sErr) return adminFail("DB_ERROR", sErr.message);
  const sanctionId = (sanction as { id: string }).id;

  if (input.level === 5) {
    await applyPermanentBan(input.profileId, sanctionId);
  }

  await adminAudit(ctx.profile.id, "admin.sanction.impose", `profile:${input.profileId}`, {
    sanction_id: sanctionId,
    level: input.level,
    reason,
    co_approver_id: coApproverId,
  });

  return { ok: true, data: { sanctionId } };
}

/** 제재 수동 해제 (REVOKED). 레벨 5 였다면 계정 복구 + 블랙리스트 회수 */
export async function revokeSanction(
  sanctionId: string,
  reason: string
): Promise<AdminResult<undefined>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const trimmed = reason.trim();
  if (trimmed.length < 2) return adminFail("INVALID_INPUT", "해제 사유를 입력해 주세요.");

  const { data: sanction, error } = await db
    .from("sanctions")
    .select("id, profile_id, level, status")
    .eq("id", sanctionId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!sanction) return adminFail("NOT_FOUND", "제재를 찾을 수 없어요.");
  if (sanction.status !== "ACTIVE") return adminFail("ALREADY_HANDLED", "활성 상태의 제재만 해제할 수 있어요.");

  const { error: upErr } = await db
    .from("sanctions")
    .update({ status: "REVOKED" })
    .eq("id", sanctionId);
  if (upErr) return adminFail("DB_ERROR", upErr.message);

  if (sanction.level === 5 && sanction.profile_id) {
    await revertPermanentBan(sanction.profile_id as string, sanctionId);
  }

  await adminAudit(ctx.profile.id, "admin.sanction.revoke", `sanction:${sanctionId}`, {
    profile_id: sanction.profile_id,
    level: sanction.level,
    reason: trimmed,
  });

  return { ok: true, data: undefined };
}
