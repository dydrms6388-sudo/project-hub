"use client";

import {
  computeDraw,
  extOf,
  isHeicName,
  replaceExt,
  type DrawRect,
  type EncodeOpts,
  type OutFormat,
} from "./image-core";

export class DecodeError extends Error {}
export class EncodeError extends Error {}

export type Decoded = {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  /** HEIC 를 heic2any 로 미리 풀었는지 */
  viaHeic2any: boolean;
  close: () => void;
};

const isBitmap = (x: unknown): x is ImageBitmap =>
  typeof ImageBitmap !== "undefined" && x instanceof ImageBitmap;

async function bitmapFrom(blob: Blob): Promise<ImageBitmap> {
  // imageOrientation: EXIF 회전을 픽셀에 반영해서 세로 사진이 눕지 않게 한다.
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(blob);
  }
}

function imgFrom(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new DecodeError("브라우저가 이 이미지를 열지 못했습니다."));
    };
    img.src = url;
  });
}

/** HEIC/HEIF 를 JPEG Blob 으로 변환. 브라우저가 지원하지 않으면 명확히 실패시킨다. */
export async function heicToBlob(
  blob: Blob,
  toType: OutFormat = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const mod = await import("heic2any");
  type Heic2Any = typeof import("heic2any").default;
  const heic2any: Heic2Any = mod.default ?? (mod as unknown as Heic2Any);
  let out: Blob | Blob[];
  try {
    out = await heic2any({ blob, toType, quality });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new DecodeError(
      `HEIC 디코딩에 실패했습니다. 이 파일이 HEIC 가 아니거나(확장자만 HEIC), 브라우저가 이 HEIC 변형(예: 10bit HDR·시퀀스)을 지원하지 않습니다. 원본 메시지: ${msg}`,
    );
  }
  const first = Array.isArray(out) ? out[0] : out;
  if (!first) throw new DecodeError("HEIC 안에서 이미지를 찾지 못했습니다.");
  return first;
}

/** 어떤 이미지 파일이든 그릴 수 있는 형태로 디코딩. HEIC 는 자동 폴백. */
export async function decodeImage(file: Blob, name = ""): Promise<Decoded> {
  const heic = isHeicName(name) || file.type === "image/heic" || file.type === "image/heif";

  const wrap = (b: ImageBitmap | HTMLImageElement, viaHeic2any: boolean): Decoded => ({
    bitmap: b,
    width: isBitmap(b) ? b.width : b.naturalWidth,
    height: isBitmap(b) ? b.height : b.naturalHeight,
    viaHeic2any,
    close: () => {
      if (isBitmap(b)) b.close();
    },
  });

  // 1) 브라우저 네이티브 디코딩 (사파리는 HEIC 도 여기서 통과)
  try {
    return wrap(await bitmapFrom(file), false);
  } catch {
    /* 다음 단계 */
  }

  // 2) HEIC 면 heic2any(wasm)
  if (heic) {
    const jpg = await heicToBlob(file);
    try {
      return wrap(await bitmapFrom(jpg), true);
    } catch {
      return wrap(await imgFrom(jpg), true);
    }
  }

  // 3) <img> 폴백
  try {
    return wrap(await imgFrom(file), false);
  } catch {
    throw new DecodeError(
      "이미지를 열지 못했습니다. 파일이 손상되었거나 브라우저가 지원하지 않는 형식입니다.",
    );
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new EncodeError("이미지 인코딩에 실패했습니다."));
          return;
        }
        if (format !== "image/png" && b.type !== format) {
          // 브라우저가 해당 포맷 인코딩을 지원하지 않으면 png 로 떨어진다
          reject(
            new EncodeError(
              `이 브라우저는 ${format} 저장을 지원하지 않습니다. 다른 출력 형식을 선택해 주세요.`,
            ),
          );
          return;
        }
        resolve(b);
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  });
}

/** 디코딩된 이미지를 옵션대로 그려서 Blob 으로 만든다 (메인 스레드 경로) */
export async function renderToBlob(dec: Decoded, opts: EncodeOpts): Promise<Blob> {
  const rect: DrawRect = computeDraw(dec.width, dec.height, opts.resize);
  const canvas = document.createElement("canvas");
  canvas.width = rect.dw;
  canvas.height = rect.dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new EncodeError("캔버스를 만들지 못했습니다.");
  // JPEG 는 알파를 못 담으므로 반드시 배경을 깔고, 그 외 포맷은 요청이 있을 때만 깐다.
  const bg =
    opts.background === "transparent"
      ? opts.format === "image/jpeg"
        ? "#ffffff"
        : null
      : opts.background;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.dw, rect.dh);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(dec.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.dw, rect.dh);
  return canvasToBlob(canvas, opts.format, opts.quality);
}

/** 파일 1개를 디코딩 → 리사이즈/인코딩 (메인 스레드 폴백 경로) */
export async function convertFile(file: File, opts: EncodeOpts): Promise<Blob> {
  const dec = await decodeImage(file, file.name);
  try {
    return await renderToBlob(dec, opts);
  } finally {
    dec.close();
  }
}

export { computeDraw, extOf, isHeicName, replaceExt };
