"use server";

// D8 · 유저 조치 Server Action — 수동 제재 부과 / 제재 해제.
// lib/admin/users 가 첫 줄에서 requireAdmin 을 재검증하므로 이 래퍼는
// 파싱·리다이렉트만 한다. (reports/actions.ts 와 동일 패턴)
//
// 주의: 성공/실패 모두 유저 상세로 돌아간다 — 조치 직후 갱신된 제재 이력을
// 같은 화면에서 확인하게 하기 위함(큐가 아니라 케이스 화면이 작업 단위).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SanctionLevel } from "@duckmate/db";
import { imposeSanction, revokeSanction } from "@/lib/admin/users";
import { SANCTION_LEVEL_INFO } from "@/lib/admin/service";

function backTo(profileId: string, params: string): never {
  redirect(`/admin/users/${profileId}?${params}`);
}

export async function imposeSanctionAction(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const levelRaw = Number(formData.get("level") ?? 0);
  const reason = String(formData.get("reason") ?? "");
  const coApproverNickname = String(formData.get("coApproverNickname") ?? "");

  if (!profileId) redirect(`/admin/users?e=${encodeURIComponent("유저 ID가 없어요.")}`);
  if (!(levelRaw >= 1 && levelRaw <= 5)) {
    backTo(profileId, `e=${encodeURIComponent("제재 레벨(1~5)을 선택해 주세요.")}`);
  }
  const level = levelRaw as SanctionLevel;

  const res = await imposeSanction({
    profileId,
    level,
    reason,
    coApproverNickname: coApproverNickname || undefined,
  });

  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin");

  if (!res.ok) backTo(profileId, `e=${encodeURIComponent(res.message)}`);
  backTo(
    profileId,
    `m=${encodeURIComponent(`Lv${level} — ${SANCTION_LEVEL_INFO[level].label} 제재를 부과했어요.`)}`
  );
}

export async function revokeSanctionAction(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const sanctionId = String(formData.get("sanctionId") ?? "");
  const reason = String(formData.get("revokeReason") ?? "");

  if (!profileId) redirect(`/admin/users?e=${encodeURIComponent("유저 ID가 없어요.")}`);
  if (!sanctionId) backTo(profileId, `e=${encodeURIComponent("제재 ID가 없어요.")}`);

  const res = await revokeSanction(sanctionId, reason);

  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin");

  if (!res.ok) backTo(profileId, `e=${encodeURIComponent(res.message)}`);
  backTo(profileId, `m=${encodeURIComponent("제재를 해제했어요.")}`);
}
