"use client";

/**
 * 사진 클라이언트 전처리 — 긴 변 1600px 이하·JPEG 0.85 로 재인코딩(용량 5MB 규칙 대응). 서버(Edge Function)가 최종 1080 WebP + EXIF 제거.
 * canvas 재인코딩은 EXIF 를 자연히 버린다. 실패하면 원본 그대로 반환.
 */
import { PHOTO_ALLOWED_MIME, PHOTO_MAX_BYTES, isAllowedPhotoMime } from "@/lib/photos/upload";

export const PHOTO_MAX_EDGE = 1600;

export function photoFileError(file: File): string | null {
  if (!isAllowedPhotoMime(file.type)) return "이 파일은 올릴 수 없어요 (JPG/PNG/WebP, 5MB 이하)";
  return null;
}

export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  // 이미 작고 허용 형식이면 그대로
  if (file.size <= 1_000_000 && isAllowedPhotoMime(file.type)) return file;
  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fallthrough */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

export const PHOTO_ACCEPT = PHOTO_ALLOWED_MIME.join(",");
export { PHOTO_MAX_BYTES };
