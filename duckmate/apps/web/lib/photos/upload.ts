/**
 * 사진 업로드 규칙 — 경로·용량·MIME (서버/클라이언트 공용 상수) + admin storage 헬퍼.
 *
 *  - 버킷 photos, 경로 {profile_id}/{photo_id}.{ext}  (DB check: path like '{profile_id}/%')
 *  - 원본은 jpg/png/webp 그대로 올리고, Edge Function photo-review 가 1080px webp 로 재인코딩 → path 를 .webp 로 갱신
 *  - 5MB 상한(D2 정책, 버킷 상한 10MB 보다 엄격)
 */
import type { AdminSupabase } from "@/lib/supabase/admin";

export const PHOTO_BUCKET = "photos";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_EXT: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const PHOTO_ALLOWED_MIME = Object.keys(PHOTO_MIME_EXT);

export function isAllowedPhotoMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(PHOTO_MIME_EXT, mime);
}

export function photoUploadPath(profileId: string, photoId: string, mime: string): string {
  const ext = PHOTO_MIME_EXT[mime] ?? "jpg";
  return `${profileId}/${photoId}.${ext}`;
}

/** 매직 바이트로 실제 이미지 형식 판별 (서버 프록시 업로드·Edge Function 공용 규칙) */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export type StoredObjectMeta = { name: string; size: number | null; mimetype: string | null };

/** 업로드 완료 확인: 폴더 목록에서 photoId 로 시작하는 객체 찾기 */
export async function findUploadedObject(admin: AdminSupabase, profileId: string, photoId: string): Promise<StoredObjectMeta | null> {
  const { data, error } = await admin.storage.from(PHOTO_BUCKET).list(profileId, { limit: 20, search: photoId });
  if (error) throw error;
  const obj = (data ?? []).find((o) => o.name.startsWith(`${photoId}.`));
  if (!obj) return null;
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  return { name: `${profileId}/${obj.name}`, size: typeof meta.size === "number" ? meta.size : null, mimetype: typeof meta.mimetype === "string" ? meta.mimetype : null };
}

/** 사진 1장의 모든 변형(.jpg/.png/.webp) 삭제 */
export async function removePhotoObjects(admin: AdminSupabase, profileId: string, photoId: string): Promise<void> {
  const paths = Object.values(PHOTO_MIME_EXT).map((ext) => `${profileId}/${photoId}.${ext}`);
  const { error } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw error;
}

/** 프로필 폴더 전체 삭제 (미성년 확정·탈퇴 purge) */
export async function removeProfilePhotoObjects(admin: AdminSupabase, profileId: string): Promise<number> {
  const { data, error } = await admin.storage.from(PHOTO_BUCKET).list(profileId, { limit: 100 });
  if (error) throw error;
  const names = (data ?? []).map((o) => `${profileId}/${o.name}`);
  if (names.length === 0) return 0;
  const { error: rmErr } = await admin.storage.from(PHOTO_BUCKET).remove(names);
  if (rmErr) throw rmErr;
  return names.length;
}
