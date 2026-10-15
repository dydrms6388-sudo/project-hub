// =============================================================================
// D8 · 사진 검수 큐 — pending 오래된 순 조회 / 승인 / 반려(사유 코드)
//
// Lv3 승급·강등 규칙 (A5 §1.1 — D2 verify.ts 주석이 D8 소관으로 위임):
//   - 승인: 승인 사진 ≥ 1장 && 현재 verify_level == 2 → verify_level = 3.
//     (Lv1 이하 상태에서 승인된 사진은 즉시 승급하지 않는다 — Lv2 도달 시점의
//      회수는 미결, 21_admin.md §미결 참조.)
//   - 반려/삭제로 승인 사진이 0장이 되면 3 → 2 강등.
// 모든 확정은 service role + audit_logs. 검수 상태는 pending 에서만 확정 가능
// (승인↔반려 번복은 새 업로드로만 — 검수 우회 방지, D2 §5 파일명 규약과 정합).
// =============================================================================

import type { Photo, Profile } from "@duckmate/db";
import {
  adminAudit,
  adminDb,
  adminFail,
  requireAdminActor,
  type AdminResult,
} from "./service";

/** 반려 사유 코드 → 유저에게 노출되는 문구 (12_flows §5.2 "반려 사유" 렌더 원천) */
export const PHOTO_REJECT_REASONS = {
  FACE_UNCLEAR: "얼굴 확인 불가",
  IMPERSONATION: "타인 사진 도용 의심",
  AI_GENERATED: "AI 생성 사진 의심",
  INAPPROPRIATE: "부적절한 콘텐츠",
  CONTACT_INFO: "연락처·개인정보 노출",
  LOW_QUALITY: "화질 불량·식별 불가",
} as const;

export type PhotoRejectReasonCode = keyof typeof PHOTO_REJECT_REASONS;

export interface PhotoReviewRow {
  photo: Photo;
  nickname: string | null;
  verifyLevel: number | null;
  /** service role 서명 URL (짧은 만료) — 클라이언트에 원본 경로를 노출하지 않는다 */
  signedUrl: string | null;
  /** 해당 프로필의 승인 사진 수 (첫 승인 = Lv3 승급 예고 배지용) */
  approvedCount: number;
}

const SIGNED_URL_TTL_SEC = 600;

/** photos.path 는 "photos/{profile_id}/{uuid}.webp" (D2-4) — 객체 키는 접두 제거 */
function toObjectKey(path: string): string {
  return path.replace(/^photos\//, "");
}

/** 검수 큐 — pending 오래된 순 (idx_photos_review_queue) */
export async function listPendingPhotos(limit = 50): Promise<AdminResult<PhotoReviewRow[]>> {
  await requireAdminActor();
  const db = adminDb();

  const { data, error } = await db
    .from("photos")
    .select("*")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return adminFail("DB_ERROR", error.message);
  const photos = (data ?? []) as Photo[];
  if (photos.length === 0) return { ok: true, data: [] };

  const profileIds = [...new Set(photos.map((p) => p.profile_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select("id, nickname, verify_level")
    .in("id", profileIds);
  const profileMap = new Map(
    ((profiles ?? []) as Pick<Profile, "id" | "nickname" | "verify_level">[]).map((p) => [p.id, p])
  );

  const { data: approvedRows } = await db
    .from("photos")
    .select("profile_id")
    .in("profile_id", profileIds)
    .eq("review_status", "approved");
  const approvedCount = new Map<string, number>();
  for (const row of (approvedRows ?? []) as { profile_id: string }[]) {
    approvedCount.set(row.profile_id, (approvedCount.get(row.profile_id) ?? 0) + 1);
  }

  // 서명 URL 일괄 발급 (비공개 버킷 — 어드민 검수 화면 전용, 짧은 만료)
  const keys = photos.map((p) => toObjectKey(p.path));
  const { data: signed } = await db.storage.from("photos").createSignedUrls(keys, SIGNED_URL_TTL_SEC);
  const urlByKey = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) urlByKey.set(s.path, s.signedUrl);
  }

  return {
    ok: true,
    data: photos.map((photo) => {
      const prof = profileMap.get(photo.profile_id);
      return {
        photo,
        nickname: prof?.nickname ?? null,
        verifyLevel: prof?.verify_level ?? null,
        signedUrl: urlByKey.get(toObjectKey(photo.path)) ?? null,
        approvedCount: approvedCount.get(photo.profile_id) ?? 0,
      };
    }),
  };
}

/** 승인 — 승인 후 Lv2 → Lv3 승급 판정 포함 */
export async function approvePhoto(
  photoId: string
): Promise<AdminResult<{ promotedToLv3: boolean }>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const { data: photo, error } = await db
    .from("photos")
    .select("id, profile_id, review_status, path")
    .eq("id", photoId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!photo) return adminFail("NOT_FOUND", "사진을 찾을 수 없어요.");
  if (photo.review_status !== "pending") return adminFail("ALREADY_HANDLED", "이미 검수된 사진이에요.");

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("photos")
    .update({ review_status: "approved", reject_reason: null, reviewed_by: ctx.profile.id, reviewed_at: now })
    .eq("id", photoId);
  if (upErr) return adminFail("DB_ERROR", upErr.message);

  await adminAudit(ctx.profile.id, "admin.photo.approve", `photo:${photoId}`, {
    profile_id: photo.profile_id,
  });

  // Lv3 승급 판정: 승인 사진 ≥ 1 (방금 승인 포함) && 현재 Lv == 2
  let promotedToLv3 = false;
  const { data: profile } = await db
    .from("profiles")
    .select("id, verify_level, status")
    .eq("id", photo.profile_id)
    .maybeSingle();
  if (profile && profile.verify_level === 2 && profile.status === "active") {
    const { error: lvErr } = await db
      .from("profiles")
      .update({ verify_level: 3 })
      .eq("id", photo.profile_id);
    if (!lvErr) {
      promotedToLv3 = true;
      await adminAudit(ctx.profile.id, "admin.photo.level3_promote", `profile:${photo.profile_id}`, {
        trigger_photo_id: photoId,
      });
    }
  }

  return { ok: true, data: { promotedToLv3 } };
}

/** 반려 — 사유 코드 필수. 승인 사진 0장이 되면 Lv3 → Lv2 강등 (A5 §1.1) */
export async function rejectPhoto(
  photoId: string,
  reasonCode: PhotoRejectReasonCode
): Promise<AdminResult<{ demotedToLv2: boolean }>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const reasonLabel = PHOTO_REJECT_REASONS[reasonCode];
  if (!reasonLabel) return adminFail("INVALID_INPUT", "반려 사유 코드를 선택해 주세요.");

  const { data: photo, error } = await db
    .from("photos")
    .select("id, profile_id, review_status")
    .eq("id", photoId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!photo) return adminFail("NOT_FOUND", "사진을 찾을 수 없어요.");
  if (photo.review_status !== "pending") return adminFail("ALREADY_HANDLED", "이미 검수된 사진이에요.");

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("photos")
    .update({
      review_status: "rejected",
      reject_reason: reasonLabel, // 유저 화면(/me/photos)에 그대로 노출되는 문구
      reviewed_by: ctx.profile.id,
      reviewed_at: now,
    })
    .eq("id", photoId);
  if (upErr) return adminFail("DB_ERROR", upErr.message);

  await adminAudit(ctx.profile.id, "admin.photo.reject", `photo:${photoId}`, {
    profile_id: photo.profile_id,
    reason_code: reasonCode,
  });

  // 강등 판정: Lv3 인데 승인 사진이 더 이상 없으면 3 → 2
  let demotedToLv2 = false;
  const { data: profile } = await db
    .from("profiles")
    .select("id, verify_level")
    .eq("id", photo.profile_id)
    .maybeSingle();
  if (profile && profile.verify_level === 3) {
    const { count } = await db
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", photo.profile_id)
      .eq("review_status", "approved");
    if ((count ?? 0) === 0) {
      const { error: lvErr } = await db
        .from("profiles")
        .update({ verify_level: 2 })
        .eq("id", photo.profile_id);
      if (!lvErr) {
        demotedToLv2 = true;
        await adminAudit(ctx.profile.id, "admin.photo.level2_demote", `profile:${photo.profile_id}`, {
          trigger_photo_id: photoId,
          reason: "승인 사진 0장 (A5 §1.1 강등)",
        });
      }
    }
  }

  return { ok: true, data: { demotedToLv2 } };
}
