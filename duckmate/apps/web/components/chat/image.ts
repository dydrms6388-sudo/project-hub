/**
 * 채팅 이미지 클라이언트 전처리: 긴 변 1080px 로 리사이즈 → WebP(q 0.85). EXIF 는 canvas 재인코딩으로 제거된다.
 * 서버 경로가 `.webp` 고정(D1 §0-12)이므로 항상 `image/webp` 로 올린다. 실패(webp 미지원 등) 시 원본 파일 그대로.
 */
import { CHAT_IMAGE_ALLOWED_MIME, CHAT_IMAGE_MAX_BYTES } from "@/lib/chat/types";

export const CHAT_IMAGE_MAX_EDGE = 1080;

export type PreparedImage = { blob: Blob; contentType: string; width: number; height: number };

export function isAllowedImageFile(file: File): boolean {
  return (CHAT_IMAGE_ALLOWED_MIME as readonly string[]).includes(file.type);
}

function loadBitmap(file: File): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).then((bmp) => ({
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
      release: () => bmp.close(),
    }));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        release: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

export async function prepareChatImage(file: File): Promise<PreparedImage> {
  try {
    const src = await loadBitmap(file);
    const scale = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    src.draw(ctx, w, h);
    src.release();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") throw new Error("webp encode failed");
    if (blob.size > CHAT_IMAGE_MAX_BYTES) throw new Error("too large");
    return { blob, contentType: "image/webp", width: w, height: h };
  } catch {
    // 폴백: 원본 그대로 (서버가 MIME·5MB 재검사)
    return { blob: file, contentType: file.type, width: 0, height: 0 };
  }
}
