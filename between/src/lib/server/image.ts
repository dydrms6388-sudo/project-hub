import "server-only";
import sharp, { type Metadata } from "sharp";

// 업로드 이미지 정화:
//  1) 크기 제한 + 매직바이트로 실제 형식 확인 (Content-Type/확장자 불신)
//  2) sharp 로 디코딩 가능한지 검증 (손상/폭탄 이미지 차단: limitInputPixels)
//  3) EXIF 방향 적용 후 WebP 로 재인코딩 → EXIF/GPS/XMP/ICC 등 메타데이터 전부 제거
//     (sharp 는 withMetadata/keepMetadata 를 호출하지 않으면 메타데이터를 쓰지 않는다)

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;

export class ImageError extends Error {}

export function sniffFormat(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "webp";
  return null;
}

export async function sanitizePhoto(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  if (input.length === 0) throw new ImageError("빈 파일이에요.");
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError("사진은 10MB 이하만 올릴 수 있어요.");
  const sniffed = sniffFormat(input);
  if (!sniffed) throw new ImageError("JPG, PNG, WEBP 사진만 올릴 수 있어요.");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new ImageError("사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.");
  }
  if (meta.format !== sniffed) throw new ImageError("파일 형식이 올바르지 않아요.");
  if ((meta.pages ?? 1) > 1) throw new ImageError("움직이는 이미지는 올릴 수 없어요.");
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) {
    throw new ImageError("사진이 너무 작아요. (최소 200×200)");
  }

  const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
