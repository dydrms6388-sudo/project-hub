import "server-only";

/**
 * D5 유저 측 조회 (서버 컴포넌트 · 라우트 핸들러). TanStack 키: ['blocks'] → getBlockList, ['sanctions'] → getMySanctions.
 */
import type { Enums } from "@duckmate/db";
import { getSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/errors";
import { moderationRpc } from "./rpc";
import type { ActiveSanction, AppealState, BlockListItem, MyModerationState } from "./types";

export async function getBlockList(): Promise<BlockListItem[]> {
  const { supabase, user } = await getSession();
  if (!user) throw new AuthError("NOT_AUTHENTICATED");
  const untyped = supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }> } } };
  const { data, error } = await untyped.from("v_my_blocks").select("blocked_id, blocked_nickname, blocked_verify_level, blocked_at").order("blocked_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{ blocked_id: string; blocked_nickname: string | null; blocked_verify_level: number; blocked_at: string }>).map((r) => ({
    blockedId: r.blocked_id,
    nickname: r.blocked_nickname,
    verifyLevel: r.blocked_verify_level,
    blockedAt: r.blocked_at,
  }));
}

type RawState = {
  profile_id: string;
  active_level: number;
  active: Array<{ id: string; level: number; reason_code: Enums["report_reason"] | null; is_auto: boolean; starts_at: string; ends_at: string | null; acknowledged_at: string | null; appeal_deadline: string; can_appeal: boolean }>;
  top: { id: string; level: number; reason_code: Enums["report_reason"] | null; starts_at: string; ends_at: string | null; is_auto: boolean } | null;
  pending_warning: { id: string; reason_code: Enums["report_reason"] | null; starts_at: string } | null;
  appeal: { id: string; sanction_id: string; status: Enums["appeal_status"]; created_at: string; decided_at: string | null; decision_note: string | null; decision_due_at: string } | null;
  status: Enums["profile_status"];
  appeal_window_days: number;
};

function screenOf(level: number, status: Enums["profile_status"], pendingWarning: boolean): MyModerationState["screen"] {
  if (status === "banned" || level >= 6) return "permanent";
  if (level >= 3) return "suspended";
  if (level === 2) return "banner";
  if (pendingWarning) return "modal";
  return "none";
}

/** 현재 제재·레벨·종료 시각·이의신청 상태 1회 조회 (정지 중에도 호출 가능 — 게이트 무관) */
export async function getMySanctions(): Promise<MyModerationState> {
  const { supabase, user } = await getSession();
  if (!user) throw new AuthError("NOT_AUTHENTICATED");
  const raw = (await moderationRpc(supabase, "get_my_moderation_state", {})) as unknown as RawState;
  const active: ActiveSanction[] = raw.active.map((s) => ({
    id: s.id,
    level: s.level as ActiveSanction["level"],
    reasonCode: s.reason_code,
    isAuto: s.is_auto,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    acknowledgedAt: s.acknowledged_at,
    appealDeadline: s.appeal_deadline,
    canAppeal: s.can_appeal,
  }));
  const appeal: AppealState | null = raw.appeal
    ? { id: raw.appeal.id, sanctionId: raw.appeal.sanction_id, status: raw.appeal.status, createdAt: raw.appeal.created_at, decidedAt: raw.appeal.decided_at, decisionNote: raw.appeal.decision_note, decisionDueAt: raw.appeal.decision_due_at }
    : null;
  return {
    profileId: raw.profile_id,
    activeLevel: raw.active_level,
    active,
    top: raw.top ? { id: raw.top.id, level: raw.top.level as ActiveSanction["level"], reasonCode: raw.top.reason_code, startsAt: raw.top.starts_at, endsAt: raw.top.ends_at, isAuto: raw.top.is_auto } : null,
    pendingWarning: raw.pending_warning ? { id: raw.pending_warning.id, reasonCode: raw.pending_warning.reason_code, startsAt: raw.pending_warning.starts_at } : null,
    appeal,
    status: raw.status,
    appealWindowDays: raw.appeal_window_days,
    screen: screenOf(raw.active_level, raw.status, raw.pending_warning !== null),
  };
}

export async function getAppeal(): Promise<AppealState | null> {
  return (await getMySanctions()).appeal;
}

/** 대화방 상단 스캠 배너 여부 (E3). 점수·시그널은 클라이언트에 노출하지 않는다 */
export async function partnerRiskBanner(matchId: string): Promise<boolean> {
  const { supabase, user } = await getSession();
  if (!user) return false;
  try {
    return Boolean(await moderationRpc(supabase, "partner_risk_banner", { p_match_id: matchId }));
  } catch {
    return false;
  }
}
