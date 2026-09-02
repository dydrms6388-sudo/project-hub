/**
 * 유저 상세 액션 묶음 (서버 컴포넌트: 역할별로 노출만 결정, 실제 권한 검증은 서버 액션이 다시 한다).
 * 전부 ConfirmActionDialog(사유 필수) → audit_logs.
 */
import { SANCTION_LEVELS } from "@duckmate/db";
import type { Enums, SanctionLevel } from "@duckmate/db";
import { decideAppeal, forceLogout, issueSanction, liftSanction, scheduleAccountDelete, toggleProfileHidden } from "@/lib/admin/actions";
import { FORCE_LOGOUT_ALLOWED_DURATIONS, FORCE_LOGOUT_DEFAULT_DURATION, type AdminRole } from "@/lib/admin/constants";
import { allowedSanctionLevels, canLiftSanctionLevel, canPerform } from "@/lib/admin/permissions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

export function IssueSanctionButton({ role, profileId, isSelf }: { role: AdminRole; profileId: string; isSelf: boolean }) {
  const levels = allowedSanctionLevels(role);
  return (
    <ConfirmActionDialog
      triggerLabel="제재 발행"
      destructive
      disabled={isSelf}
      title="제재 발행"
      description={`역할 ${role}: 레벨 ${levels[0] ?? "-"}~${levels[levels.length - 1] ?? "-"} 발급 가능. level 5 = 매칭 paused, 6 = banned + CI 블록(트리거).`}
      action={issueSanction}
      payload={{ profileId }}
      fields={[
        { name: "level", label: "레벨", type: "select", required: true, coerce: "number", options: levels.map((l) => ({ value: String(l), label: `${l} · ${SANCTION_LEVELS[l].label}` })) },
        { name: "durationHours", label: "기간(시간)", type: "number", min: 1, hint: "비우면 레벨 기본값 · level 6 은 무시" },
      ]}
      confirmLabel="발행"
    />
  );
}

export function LiftSanctionButton({ role, sanctionId, level }: { role: AdminRole; sanctionId: string; level: SanctionLevel }) {
  if (!canLiftSanctionLevel(role, level)) return <span className="text-caption text-muted-foreground">admin 해제</span>;
  return (
    <ConfirmActionDialog
      triggerLabel="해제"
      triggerVariant="ghost"
      title={`제재 해제 (L${level})`}
      description={level === 6 ? "영구정지 해제: profiles.status 를 active 로 복구. blocked_ci_hashes 는 유지되므로 재가입 차단은 별도 검토." : "revoked_at 만 기록(행 삭제 없음)."}
      action={liftSanction}
      payload={{ sanctionId }}
      confirmLabel="해제"
    />
  );
}

export function DecideAppealButtons({ role, appealId }: { role: AdminRole; appealId: string }) {
  if (!canPerform(role, "appeal_decide")) return <span className="text-caption text-muted-foreground">admin 판정</span>;
  return (
    <span className="flex gap-1">
      <ConfirmActionDialog triggerLabel="인용" triggerVariant="secondary" title="이의신청 인용" description="제재를 해제하고(revoked_at) 강등 레벨은 트리거가 복구해요. 통보는 별도." action={decideAppeal} payload={{ appealId, decision: "accepted" }} reasonKey="note" reasonLabel="판정 사유(통보 문구)" confirmLabel="인용" />
      <ConfirmActionDialog triggerLabel="기각" destructive title="이의신청 기각" description="재신청 불가. 사유 한 줄이 사용자에게 통보돼요." action={decideAppeal} payload={{ appealId, decision: "rejected" }} reasonKey="note" reasonLabel="판정 사유(통보 문구)" confirmLabel="기각" />
    </span>
  );
}

export function HideToggleButton({ profileId, hidden }: { profileId: string; hidden: boolean }) {
  return (
    <ConfirmActionDialog
      triggerLabel={hidden ? "비노출 해제" : "프로필 비노출"}
      title={hidden ? "비노출 해제" : "프로필 비노출"}
      description={hidden ? "추천·좋아요 대상에 다시 포함돼요." : "추천 제외 + can_like 실패. 제재는 아니며 게이트에 영향 없음."}
      action={toggleProfileHidden}
      payload={{ profileId, hidden: !hidden }}
      confirmLabel={hidden ? "해제" : "비노출"}
    />
  );
}

export function ForceLogoutButton({ role, userId, isSelf }: { role: AdminRole; userId: string; isSelf: boolean }) {
  if (!canPerform(role, "force_logout")) return null;
  return (
    <ConfirmActionDialog
      triggerLabel="강제 로그아웃"
      destructive
      disabled={isSelf}
      title="강제 로그아웃 (Auth ban_duration)"
      description="선택한 기간 동안 세션 검증·리프레시·재로그인이 거부돼요. 기간 후 자동 해제."
      action={forceLogout}
      payload={{ userId }}
      fields={[{ name: "duration", label: "기간", type: "select", required: true, defaultValue: FORCE_LOGOUT_DEFAULT_DURATION, options: FORCE_LOGOUT_ALLOWED_DURATIONS.map((d) => ({ value: d, label: d })) }]}
      confirmLabel="로그아웃"
    />
  );
}

export function ScheduleDeleteButton({ role, profileId, status, isSelf }: { role: AdminRole; profileId: string; status: Enums["profile_status"]; isSelf: boolean }) {
  if (!canPerform(role, "account_delete_schedule")) return null;
  const cancel = status === "deleting";
  return (
    <ConfirmActionDialog
      triggerLabel={cancel ? "삭제 예약 취소" : "계정 삭제 예약"}
      destructive={!cancel}
      disabled={isSelf || status === "banned"}
      title={cancel ? "삭제 예약 취소" : "계정 삭제 예약 (7일 유예)"}
      description={cancel ? "status 를 active 로 되돌려요." : "status=deleting, delete_requested_at=now. D7 purge_daily 가 7일 후 삭제(사진·매칭 포함). 신고·제재 기록은 보존."}
      action={scheduleAccountDelete}
      payload={{ profileId, cancel }}
      confirmLabel={cancel ? "취소" : "예약"}
    />
  );
}
