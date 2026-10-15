// =============================================================================
// D8 · 어드민 공용 유틸 — ⚠ 서버 전용 (service role)
//
// 규약 (docs/agents/21_admin.md):
// - lib/admin/** 의 모든 export 함수는 첫 줄에서 requireAdmin() 을 호출한다.
//   (redirect 기반 — admin 아니면 /home. Server Action 에서도 동작한다.)
// - 읽기든 조치든 DB 접근은 전부 service role — 클라이언트 컴포넌트에서 이
//   모듈(및 lib/admin/*)을 import 하면 assertAdminServerContext 가 즉시 던진다.
// - 모든 "조치"(상태 변경)는 audit_logs 에 기록한다. 액션 이름은 admin.* 접두.
// - Postgrest 다중 문장은 트랜잭션이 아니다 — 각 함수는 실패 시 남는 중간
//   상태를 audit 로 추적 가능하게 순서를 설계한다(제재 insert → 파생 갱신 순).
// =============================================================================

import { requireAdmin, type GuardContext } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/server";
import type { SanctionLevel } from "@duckmate/db";

// ---------------------------------------------------------------------------
// 결과 타입 — D2 의 ActionResult 패턴과 동형 (코드만 어드민 전용)
// ---------------------------------------------------------------------------
export type AdminResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: AdminErrorCode; message: string };

export type AdminErrorCode =
  | "NOT_FOUND"
  | "ALREADY_HANDLED" // 신고/이의제기/사진이 이미 종결 상태
  | "INVALID_INPUT"
  | "FOUR_EYES_REQUIRED" // 레벨 5 제재 — 2인 승인 미충족
  | "FOUR_EYES_SELF" // 이의제기 — 원 처리자가 본인
  | "TARGET_MISSING" // 신고 대상 프로필이 없음(탈퇴 등)
  | "DB_ERROR";

export function adminFail(code: AdminErrorCode, message: string): AdminResult<never> {
  return { ok: false, code, message };
}

// ---------------------------------------------------------------------------
// 서버 컨텍스트 강제 (D2 verify.ts 와 동일 수법 — server-only 패키지 금지 제약)
// ---------------------------------------------------------------------------
export function assertAdminServerContext(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/admin/* 는 서버 전용이다 — 클라이언트에서 import 금지");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정 — service role 서버 환경에서만 호출 가능");
  }
}

/** 어드민 액터 확보 — 모든 lib/admin 함수의 첫 줄. requireAdmin 미통과 시 redirect. */
export async function requireAdminActor(): Promise<GuardContext> {
  const ctx = await requireAdmin();
  assertAdminServerContext();
  return ctx;
}

/** service role 클라이언트 (어드민 데이터 접근 전용 — 클라이언트 번들 유입 금지) */
export function adminDb() {
  assertAdminServerContext();
  return createServiceClient();
}

// ---------------------------------------------------------------------------
// 감사로그 — 모든 조치 기록 (A5: audit_logs 3년 보존)
// ---------------------------------------------------------------------------
export async function adminAudit(
  actorProfileId: string,
  action: string,
  target: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const db = adminDb();
  await db.from("audit_logs").insert({
    actor_id: actorProfileId,
    action,
    target,
    meta,
  });
}

// ---------------------------------------------------------------------------
// 제재 레벨 상수 (A5 §3.1)
// ---------------------------------------------------------------------------
export const SANCTION_LEVEL_INFO: Record<
  SanctionLevel,
  { label: string; durationHours: number | null }
> = {
  1: { label: "경고", durationHours: 24 * 365 }, // 기능 제한 없음 · 기록 1년 유지
  2: { label: "기능 제한 (72시간)", durationHours: 72 },
  3: { label: "일시 정지 (7일)", durationHours: 24 * 7 },
  4: { label: "장기 정지 (30일)", durationHours: 24 * 30 },
  5: { label: "영구 정지", durationHours: null }, // ends_at null = 영구
};

export function sanctionEndsAt(level: SanctionLevel, from: Date = new Date()): string | null {
  const hours = SANCTION_LEVEL_INFO[level].durationHours;
  if (hours === null) return null;
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}

/**
 * 레벨 5(영구정지) 부과의 공통 후처리:
 *  - profiles.status = banned
 *  - identity_hashes 의 CI 해시를 blocked_hashes 로 이관 (재가입 차단, A5 §3.1)
 *    ※ 휴대폰 해시는 저장처가 없어 미이관 — 21_admin.md 미결 항목.
 */
export async function applyPermanentBan(
  targetProfileId: string,
  sanctionId: string
): Promise<void> {
  const db = adminDb();
  await db.from("profiles").update({ status: "banned" }).eq("id", targetProfileId);

  const { data: idHash } = await db
    .from("identity_hashes")
    .select("ci_hash")
    .eq("profile_id", targetProfileId)
    .maybeSingle();
  if (idHash?.ci_hash) {
    // (hash_type, hash) PK — 중복이면 무시 (이미 블랙리스트)
    await db.from("blocked_hashes").upsert(
      {
        hash_type: "ci",
        hash: idHash.ci_hash as string,
        reason: "level5 sanction",
        sanction_id: sanctionId,
      },
      { onConflict: "hash_type,hash", ignoreDuplicates: true }
    );
  }
}

/** 레벨 5 제재 해제(이의 인용/수동 해제) 후처리 — 계정 복구 + 블랙리스트 회수 */
export async function revertPermanentBan(
  targetProfileId: string,
  sanctionId: string
): Promise<void> {
  const db = adminDb();
  await db.from("blocked_hashes").delete().eq("sanction_id", sanctionId);
  await db.from("profiles").update({ status: "active" }).eq("id", targetProfileId);
}

/**
 * 레벨 5 4-eyes (A5 §6-④: 레벨 5 는 어드민 2인 승인):
 * 부승인자 닉네임으로 "본인 외 활성 admin" 임을 검증한다.
 * ※ 세션 기반 2단계 승인 워크플로가 아닌 선언식 4-eyes — 21_admin.md·G2 항목.
 */
export async function verifyCoApprover(
  actorProfileId: string,
  coApproverNickname: string
): Promise<AdminResult<{ coApproverId: string }>> {
  const db = adminDb();
  const { data } = await db
    .from("profiles")
    .select("id, role, status")
    .eq("nickname", coApproverNickname.trim())
    .maybeSingle();
  if (!data || data.role !== "admin" || data.status !== "active") {
    return adminFail("FOUR_EYES_REQUIRED", "부승인자는 활성 상태의 다른 어드민이어야 해요.");
  }
  if (data.id === actorProfileId) {
    return adminFail("FOUR_EYES_REQUIRED", "부승인자는 본인일 수 없어요 (2인 승인).");
  }
  return { ok: true, data: { coApproverId: data.id as string } };
}

// ---------------------------------------------------------------------------
// KST 시간 유틸 (D1 규약: KST 변환 책임은 호출자)
// ---------------------------------------------------------------------------
const KST_OFFSET_MS = 9 * 3_600_000;

/** KST 기준 오늘 00:00 을 UTC ISO 로 (daysAgo 일 전) */
export function kstDayStartIso(daysAgo = 0): string {
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - KST_OFFSET_MS - daysAgo * 86_400_000).toISOString();
}

/** 남은 시간 표시용 — 음수면 초과 */
export function formatRemaining(dueIso: string | null): string {
  if (!dueIso) return "—";
  const ms = new Date(dueIso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const body = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  return ms < 0 ? `${body} 초과` : `${body} 남음`;
}
