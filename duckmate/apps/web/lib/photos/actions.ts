"use server";

/**
 * 사진 파이프라인 서버 액션 (E1 온보딩 사진 · E5 /me/photos 가 호출).
 *
 *   1. createPhotoUploadUrl({ contentType, sizeBytes })  → { photoId, path, token, signedUrl }
 *      클라이언트: supabase.storage.from("photos").uploadToSignedUrl(path, token, file, { contentType })
 *   2. confirmPhotoUpload({ photoId })                    → photos insert(pending, 첫 장이면 대표) + Edge Function photo-review 호출
 *   3. deletePhoto({ photoId })                           → 행 삭제(트리거 recompute) + 파일 삭제
 *   4. setPrimaryPhoto({ photoId })                       → 승인 사진만 대표 지정
 *
 * 규칙: 5MB · jpeg/png/webp · 최대 6장 · 제재 ≥3 업로드 불가(RLS 도 검사) · 자동 승인 없음(사람 검수 24h).
 */
import { z } from "zod";
import { PHOTO_MAX } from "@duckmate/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { firstIssue } from "@/lib/onboarding/schemas";
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  findUploadedObject,
  isAllowedPhotoMime,
  photoUploadPath,
  removePhotoObjects,
} from "@/lib/photos/upload";

const uploadUrlSchema = z.object({
  contentType: z.string().refine(isAllowedPhotoMime, "JPG/PNG/WebP 만 올릴 수 있어요"),
  sizeBytes: z.number().int().positive().max(PHOTO_MAX_BYTES, "5MB 이하 사진만 올릴 수 있어요"),
});
const photoIdSchema = z.object({ photoId: z.string().uuid() });

export type UploadTicket = { photoId: string; path: string; token: string; signedUrl: string; maxBytes: number; allowedMime: string[] };

export async function createPhotoUploadUrl(input: unknown): Promise<ActionResult<UploadTicket>> {
  try {
    const parsed = uploadUrlSchema.safeParse(input);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      return fail("INVALID_INPUT", message, { field });
    }
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    if (ctx.state.sanctionLevel >= 3) return fail("SANCTIONED");

    const { count, error: cErr } = await ctx.supabase.from("photos").select("id", { count: "exact", head: true }).eq("profile_id", ctx.profileId);
    if (cErr) throw cErr;
    if ((count ?? 0) >= PHOTO_MAX) return fail("NOT_ENTITLED", `사진은 최대 ${PHOTO_MAX}장까지 올릴 수 있어요`, { field: "photos" });

    const photoId = crypto.randomUUID();
    const path = photoUploadPath(ctx.profileId, photoId, parsed.data.contentType);
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("signed upload url missing");
    return ok({ photoId, path: data.path, token: data.token, signedUrl: data.signedUrl, maxBytes: PHOTO_MAX_BYTES, allowedMime: [...PHOTO_ALLOWED_MIME] });
  } catch (e) {
    return toActionFailure(e);
  }
}

export type ConfirmedPhoto = { photoId: string; path: string; isPrimary: boolean; reviewStatus: "pending"; reviewQueued: boolean };

export async function confirmPhotoUpload(input: unknown): Promise<ActionResult<ConfirmedPhoto>> {
  try {
    const parsed = photoIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", "사진 정보를 확인할 수 없어요", { field: "photoId" });
    const { photoId } = parsed.data;
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    if (ctx.state.sanctionLevel >= 3) return fail("SANCTIONED");
    const admin = createAdminClient();

    const obj = await findUploadedObject(admin, ctx.profileId, photoId);
    if (!obj) return fail("NOT_FOUND", "업로드된 파일을 찾을 수 없어요. 다시 올려 주세요");
    if ((obj.size !== null && obj.size > PHOTO_MAX_BYTES) || (obj.mimetype !== null && !isAllowedPhotoMime(obj.mimetype))) {
      await removePhotoObjects(admin, ctx.profileId, photoId);
      return fail("INVALID_INPUT", "이 파일은 올릴 수 없어요 (JPG/PNG/WebP, 5MB 이하)");
    }

    const { count } = await ctx.supabase.from("photos").select("id", { count: "exact", head: true }).eq("profile_id", ctx.profileId);
    const existing = count ?? 0;
    if (existing >= PHOTO_MAX) {
      await removePhotoObjects(admin, ctx.profileId, photoId);
      return fail("NOT_ENTITLED", `사진은 최대 ${PHOTO_MAX}장까지 올릴 수 있어요`);
    }
    const isPrimary = existing === 0;

    // 사용자 권한 insert: RLS 가 pending·본인·제재<3 을 강제(최종 방어선)
    const { error: insErr } = await ctx.supabase
      .from("photos")
      .insert({ id: photoId, profile_id: ctx.profileId, path: obj.name, is_primary: isPrimary, sort_order: existing, review_status: "pending" });
    if (insErr) {
      await removePhotoObjects(admin, ctx.profileId, photoId).catch(() => undefined);
      if (insErr.code === "23505") return fail("CONFLICT", "이미 등록된 사진이에요");
      throw insErr;
    }

    // 검수 파이프라인 트리거 (리사이즈·얼굴 검사 → pending 유지 + auto_flags). 실패해도 업로드는 성공(D8 큐에 pending 으로 존재)
    let reviewQueued = true;
    try {
      const { error: fnErr } = await admin.functions.invoke("photo-review", { body: { photo_id: photoId } });
      if (fnErr) {
        reviewQueued = false;
        console.error("[photos] photo-review invoke failed", fnErr.message);
      }
    } catch (e) {
      reviewQueued = false;
      console.error("[photos] photo-review invoke threw", e);
    }

    return ok({ photoId, path: obj.name, isPrimary, reviewStatus: "pending", reviewQueued });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function deletePhoto(input: unknown): Promise<ActionResult<{ photoId: string }>> {
  try {
    const parsed = photoIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "photoId" });
    const { photoId } = parsed.data;
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    const { data: row, error: selErr } = await ctx.supabase.from("photos").select("id, path").eq("id", photoId).eq("profile_id", ctx.profileId).maybeSingle();
    if (selErr) throw selErr;
    if (!row) return fail("NOT_FOUND");
    const { error: delErr } = await ctx.supabase.from("photos").delete().eq("id", photoId).eq("profile_id", ctx.profileId);
    if (delErr) throw delErr; // 트리거가 recompute_verify_level (L3→L2 강등·데이팅 모드 해제)
    await removePhotoObjects(createAdminClient(), ctx.profileId, photoId).catch((e: unknown) => console.error("[photos] object remove failed", e));
    return ok({ photoId });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function setPrimaryPhoto(input: unknown): Promise<ActionResult<{ photoId: string }>> {
  try {
    const parsed = photoIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "photoId" });
    const { photoId } = parsed.data;
    const ctx = await requireProfileForAction(1);
    const { data: row, error } = await ctx.supabase.from("photos").select("id, review_status").eq("id", photoId).eq("profile_id", ctx.profileId).maybeSingle();
    if (error) throw error;
    if (!row) return fail("NOT_FOUND");
    if (row.review_status !== "approved") return fail("NOT_ENTITLED", "승인된 사진만 대표로 지정할 수 있어요");
    const { error: clearErr } = await ctx.supabase.from("photos").update({ is_primary: false }).eq("profile_id", ctx.profileId).eq("is_primary", true);
    if (clearErr) throw clearErr;
    const { error: setErr } = await ctx.supabase.from("photos").update({ is_primary: true }).eq("id", photoId);
    if (setErr) throw setErr;
    return ok({ photoId });
  } catch (e) {
    return toActionFailure(e);
  }
}
