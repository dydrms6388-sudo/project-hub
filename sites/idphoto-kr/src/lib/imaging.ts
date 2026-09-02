"use client";

/**
 * 캔버스 합성 유틸.
 * 규격(mm) → 300dpi 픽셀로 렌더링하고, 저장되는 JPEG 의 DPI 메타(JFIF APP0)까지 300 으로 맞춘다.
 * 브라우저 canvas.toBlob() 은 JFIF 밀도를 1(단위 없음)로 써 넣기 때문에,
 * 그대로 인화소에 넘기면 "해상도 정보 없음"으로 취급돼 배율이 틀어질 수 있다.
 */

export type Rect = { x: number; y: number; width: number; height: number };

/** 파일 → HTMLImageElement (EXIF 회전은 브라우저의 image-orientation:from-image 기본값에 맡긴다) */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.decoding = "async";
    img.src = src;
  });
}

function ctx2d(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
  return ctx;
}

/** 90도 단위 회전본을 새 dataURL 로 만든다 (크롭 전에 적용) */
export async function rotateImageUrl(src: string, deg: 90 | 180 | 270): Promise<string> {
  const img = await loadImage(src);
  const swap = deg === 90 || deg === 270;
  const w = swap ? img.naturalHeight : img.naturalWidth;
  const h = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = ctx2d(w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return ctx.canvas.toDataURL("image/png");
}

/**
 * 크롭 영역(원본 픽셀 좌표)을 목표 규격 픽셀로 렌더링.
 * 크롭 박스가 원본 밖으로 나가도 배경색으로 채워 규격 비율을 정확히 유지한다.
 */
export async function renderSpecCanvas(opts: {
  src: string;
  crop: Rect;
  outW: number;
  outH: number;
  bgColor: string;
  /** 밝기 보정 -100~100 */
  brightness?: number;
  /** 대비 보정 -100~100 */
  contrast?: number;
}): Promise<HTMLCanvasElement> {
  const { src, crop, outW, outH, bgColor } = opts;
  const img = await loadImage(src);
  const ctx = ctx2d(outW, outH);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const b = opts.brightness ?? 0;
  const c = opts.contrast ?? 0;
  if (b !== 0 || c !== 0) {
    ctx.filter = `brightness(${100 + b}%) contrast(${100 + c}%)`;
  }

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );
  ctx.filter = "none";
  return ctx.canvas;
}

/** 캔버스 → Blob */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했습니다."))),
      type,
      quality,
    );
  });
}

/**
 * JPEG 의 JFIF APP0 세그먼트를 고쳐 DPI 를 심는다.
 * APP0 구조: FFD8 | FFE0 | len(2) | "JFIF\0"(5) | ver(2) | units(1) | Xdens(2) | Ydens(2) | ...
 * → units=1(inch), Xdensity=Ydensity=dpi 로 덮어쓴다. APP0 가 없으면 18바이트짜리를 끼워 넣는다.
 */
export function setJpegDpi(buf: ArrayBuffer, dpi: number): ArrayBuffer {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return buf; // JPEG 아님

  const hasApp0 =
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    bytes[6] === 0x4a && // J
    bytes[7] === 0x46 && // F
    bytes[8] === 0x49 && // I
    bytes[9] === 0x46 && // F
    bytes[10] === 0x00;

  if (hasApp0) {
    const out = new Uint8Array(bytes); // 복사본에 기록
    const view = new DataView(out.buffer);
    out[13] = 1; // units = dots per inch
    view.setUint16(14, dpi, false);
    view.setUint16(16, dpi, false);
    return out.buffer;
  }

  // APP0 를 SOI 바로 뒤에 새로 삽입
  const app0 = new Uint8Array(18);
  const dv = new DataView(app0.buffer);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  dv.setUint16(2, 16, false); // length (자기 자신 제외 2바이트 길이 필드 포함)
  app0.set([0x4a, 0x46, 0x49, 0x46, 0x00], 4); // "JFIF\0"
  app0[9] = 1; // version major
  app0[10] = 1; // version minor
  app0[11] = 1; // units = inch
  dv.setUint16(12, dpi, false);
  dv.setUint16(14, dpi, false);
  app0[16] = 0; // thumbnail w
  app0[17] = 0; // thumbnail h

  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out.buffer;
}

/** 300dpi 메타가 박힌 JPEG Blob */
export async function canvasToJpeg300(
  canvas: HTMLCanvasElement,
  dpi = 300,
  quality = 0.92,
): Promise<Blob> {
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  const patched = setJpegDpi(await blob.arrayBuffer(), dpi);
  return new Blob([patched], { type: "image/jpeg" });
}

/**
 * 알파 마스크(0~255, 캔버스 크기와 동일 길이)를 적용해 배경을 단색으로 칠한다.
 * 배경 제거 모델이 실패해도 호출부에서 이 단계만 건너뛰면 되도록 순수 함수로 둔다.
 */
export function compositeOnColor(
  source: HTMLCanvasElement | HTMLImageElement,
  mask: Uint8Array | Uint8ClampedArray,
  maskW: number,
  maskH: number,
  bgColor: string,
): HTMLCanvasElement {
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;

  // 마스크를 원본 크기로 늘린다
  const mctx = ctx2d(maskW, maskH);
  const mimg = mctx.createImageData(maskW, maskH);
  for (let i = 0; i < maskW * maskH; i++) {
    mimg.data[i * 4] = 255;
    mimg.data[i * 4 + 1] = 255;
    mimg.data[i * 4 + 2] = 255;
    mimg.data[i * 4 + 3] = mask[i];
  }
  mctx.putImageData(mimg, 0, 0);

  const cut = ctx2d(w, h);
  cut.drawImage(source, 0, 0, w, h);
  cut.globalCompositeOperation = "destination-in";
  cut.drawImage(mctx.canvas, 0, 0, w, h);
  cut.globalCompositeOperation = "source-over";

  const out = ctx2d(w, h);
  out.fillStyle = bgColor;
  out.fillRect(0, 0, w, h);
  out.drawImage(cut.canvas, 0, 0);
  return out.canvas;
}
