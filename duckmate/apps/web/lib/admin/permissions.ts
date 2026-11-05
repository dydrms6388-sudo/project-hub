/**
 * 어드민 권한 매트릭스 — 순수 함수(테스트 대상). 서버 액션이 모든 쓰기 전에 호출한다.
 * moderator: 신고 처리·경고·채팅제한·3일 정지·사진 검수 / admin: 전부 (PRD §0-47, 05 §4.1).
 */
import type { SanctionLevel } from "@duckmate/db";
import { ACTION_MIN_ROLE, ROLE_MAX_SANCTION_LEVEL, type AdminActionKey, type AdminRole } from "./constants";

const RANK: Readonly<Record<AdminRole, number>> = { moderator: 1, admin: 2 };

export function isAdminRole(v: unknown): v is AdminRole {
  return v === "admin" || v === "moderator";
}

export function roleSatisfies(role: AdminRole | null | undefined, min: AdminRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export function canPerform(role: AdminRole | null | undefined, action: AdminActionKey): boolean {
  return roleSatisfies(role, ACTION_MIN_ROLE[action]);
}

export function maxSanctionLevel(role: AdminRole | null | undefined): SanctionLevel | 0 {
  if (!role) return 0;
  return ROLE_MAX_SANCTION_LEVEL[role];
}

/** 제재 레벨 발급 가능 여부 (0 = 제재 없이 확정만 → 항상 가능) */
export function canIssueSanctionLevel(role: AdminRole | null | undefined, level: SanctionLevel | 0): boolean {
  if (!canPerform(role, "sanction_issue")) return false;
  if (level === 0) return true;
  return level <= maxSanctionLevel(role);
}

/** 제재 해제: 발급과 같은 한도(moderator ≤ 3). 0043 admin_lift_sanction 과 동일 */
export function canLiftSanctionLevel(role: AdminRole | null | undefined, level: SanctionLevel): boolean {
  if (!canPerform(role, "sanction_lift")) return false;
  return level <= maxSanctionLevel(role);
}

/** 역할이 고를 수 있는 레벨 목록 (폼 select 용) */
export function allowedSanctionLevels(role: AdminRole | null | undefined): SanctionLevel[] {
  const max = maxSanctionLevel(role);
  const out: SanctionLevel[] = [];
  for (let l = 1; l <= max; l++) out.push(l as SanctionLevel);
  return out;
}

/** 신고 우선순위는 상향만 (05 §3: 하향 불가). P0 < P1 < P2 < P3 문자열 비교로 충분 */
export function isPriorityUpgrade(current: string, next: string): boolean {
  return next < current;
}
