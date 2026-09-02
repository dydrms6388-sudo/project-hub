"use server";

// D8 · 사진 검수 Server Action — 폼(FormData) → lib/admin/photos (service role).
// lib 함수가 첫 줄에서 requireAdmin 을 재검증하므로 이 래퍼는 파싱·리다이렉트만 한다.
// (reports/actions.ts 와 동일 패턴: 실패 → ?e=, 성공 → ?m= 로 큐에 복귀)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PHOTO_REJECT_REASONS,
  approvePhoto,
  rejectPhoto,
  type PhotoRejectReasonCode,
} from "@/lib/admin/photos";

const QUEUE = "/admin/photos";

function back(params: string): never {
  redirect(`${QUEUE}?${params}`);
}

export async function approvePhotoAction(formData: FormData): Promise<void> {
  const photoId = String(formData.get("photoId") ?? "");
  if (!photoId) back(`e=${encodeURIComponent("사진 ID가 없어요.")}`);

  const res = await approvePhoto(photoId);

  revalidatePath(QUEUE);
  revalidatePath("/admin");

  if (!res.ok) back(`e=${encodeURIComponent(res.message)}`);
  back(
    `m=${encodeURIComponent(
      res.data.promotedToLv3
        ? "사진을 승인했어요. 인증 레벨 3(사진 인증)으로 승급했습니다."
        : "사진을 승인했어요."
    )}`
  );
}

export async function rejectPhotoAction(formData: FormData): Promise<void> {
  const photoId = String(formData.get("photoId") ?? "");
  const reasonCode = String(formData.get("reasonCode") ?? "");
  if (!photoId) back(`e=${encodeURIComponent("사진 ID가 없어요.")}`);
  if (!(reasonCode in PHOTO_REJECT_REASONS)) {
    back(`e=${encodeURIComponent("반려 사유를 선택해 주세요.")}`);
  }

  const res = await rejectPhoto(photoId, reasonCode as PhotoRejectReasonCode);

  revalidatePath(QUEUE);
  revalidatePath("/admin");

  if (!res.ok) back(`e=${encodeURIComponent(res.message)}`);
  back(
    `m=${encodeURIComponent(
      res.data.demotedToLv2
        ? "사진을 반려했어요. 승인 사진이 없어 인증 레벨 2로 강등했습니다."
        : "사진을 반려했어요."
    )}`
  );
}
