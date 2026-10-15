/**
 * 재인코딩 없이 파일의 메타데이터 세그먼트/청크만 잘라내는 유틸.
 * 픽셀 데이터(JPEG 의 SOS 이후, PNG 의 IDAT)는 한 바이트도 건드리지 않으므로
 * 화질 손실이 전혀 없다. DOM 을 쓰지 않아 워커/노드에서도 동작한다.
 */

export type StripResult = {
  out: Uint8Array;
  /** 제거한 항목 이름 (예: "EXIF(APP1)", "XMP", "tEXt") */
  removed: string[];
  /** 이 포맷을 처리할 수 있었는지 */
  handled: boolean;
};

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u32le = (b: Uint8Array, i: number) =>
  b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + b[i + 3] * 0x1000000;

const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, i + n));

export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
export const isPng = (b: Uint8Array) =>
  b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
export const isWebp = (b: Uint8Array) =>
  b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP";

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const APP_NAME: Record<number, string> = {
  0xe0: "JFIF(APP0)",
  0xe1: "EXIF/XMP(APP1)",
  0xe2: "ICC(APP2)",
  0xe3: "APP3",
  0xe4: "APP4",
  0xe5: "APP5",
  0xe6: "APP6",
  0xe7: "APP7",
  0xe8: "APP8",
  0xe9: "APP9",
  0xea: "APP10",
  0xeb: "APP11",
  0xec: "APP12",
  0xed: "IPTC/Photoshop(APP13)",
  0xee: "Adobe(APP14)",
  0xef: "APP15",
  0xfe: "주석(COM)",
};

/**
 * JPEG 에서 메타데이터 세그먼트만 제거한다.
 * - 항상 유지: SOI/DQT/SOF/DHT/SOS 이후 전부, APP14(Adobe 색변환 정보)
 * - 기본 유지: APP0(JFIF), APP2(ICC 컬러 프로파일)
 * - 제거: APP1(EXIF·XMP), APP3~APP13, APP15, COM
 */
export function stripJpeg(
  input: Uint8Array,
  opts: { keepIcc?: boolean; keepJfif?: boolean } = {},
): StripResult {
  const keepIcc = opts.keepIcc ?? true;
  const keepJfif = opts.keepJfif ?? true;
  if (!isJpeg(input)) return { out: input, removed: [], handled: false };

  const parts: Uint8Array[] = [input.subarray(0, 2)]; // SOI
  const removed: string[] = [];
  let i = 2;

  while (i < input.length) {
    if (input[i] !== 0xff) {
      // 정렬이 깨졌다 — 안전하게 남은 전부를 그대로 복사하고 종료
      parts.push(input.subarray(i));
      i = input.length;
      break;
    }
    let j = i;
    while (j < input.length && input[j] === 0xff) j++; // fill byte 0xFF 건너뛰기
    const marker = input[j];
    if (marker === undefined) {
      parts.push(input.subarray(i));
      break;
    }
    // 길이 필드가 없는 마커
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      parts.push(input.subarray(i, j + 1));
      i = j + 1;
      continue;
    }
    if (j + 2 >= input.length) {
      parts.push(input.subarray(i));
      break;
    }
    const len = u16(input, j + 1);
    const segEnd = j + 1 + len;
    if (len < 2 || segEnd > input.length) {
      parts.push(input.subarray(i));
      break;
    }

    if (marker === 0xda) {
      // SOS — 여기부터 파일 끝까지가 압축된 픽셀 데이터. 그대로 복사하고 종료.
      parts.push(input.subarray(i));
      i = input.length;
      break;
    }

    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isCom = marker === 0xfe;
    let drop = false;
    if (isCom) drop = true;
    else if (isApp) {
      if (marker === 0xe0) drop = !keepJfif;
      else if (marker === 0xe2) drop = !keepIcc;
      else if (marker === 0xee) drop = false; // Adobe 마커는 색 왜곡 방지를 위해 유지
      else drop = true;
    }

    if (drop) {
      removed.push(APP_NAME[marker] ?? `APP${marker - 0xe0}`);
    } else {
      parts.push(input.subarray(i, segEnd));
    }
    i = segEnd;
  }

  return { out: concat(parts), removed, handled: true };
}

/** JPEG 안에 EXIF(APP1) 세그먼트가 있는지 */
export function hasJpegExif(input: Uint8Array): boolean {
  if (!isJpeg(input)) return false;
  let i = 2;
  while (i + 4 < input.length && input[i] === 0xff) {
    const marker = input[i + 1];
    if (marker === 0xda || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const len = u16(input, i + 2);
    if (len < 2) return false;
    if (marker === 0xe1) return true;
    i += 2 + len;
  }
  return false;
}

const PNG_META_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/** PNG 에서 메타데이터 청크(eXIf/tEXt/zTXt/iTXt/tIME)만 제거 */
export function stripPng(input: Uint8Array): StripResult {
  if (!isPng(input)) return { out: input, removed: [], handled: false };
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  const removed: string[] = [];
  let i = 8;
  while (i + 8 <= input.length) {
    const len = u32be(input, i);
    const type = ascii(input, i + 4, 4);
    const end = i + 12 + len;
    if (len < 0 || end > input.length) {
      parts.push(input.subarray(i));
      i = input.length;
      break;
    }
    if (PNG_META_CHUNKS.has(type)) {
      removed.push(type);
    } else {
      parts.push(input.subarray(i, end));
    }
    i = end;
    if (type === "IEND") break;
  }
  return { out: concat(parts), removed, handled: true };
}

/** WebP(RIFF) 에서 EXIF/XMP 청크 제거 + VP8X 플래그 정리 */
export function stripWebp(input: Uint8Array): StripResult {
  if (!isWebp(input)) return { out: input, removed: [], handled: false };
  const removed: string[] = [];
  const body: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= input.length) {
    const type = ascii(input, i, 4);
    const size = u32le(input, i + 4);
    const padded = size + (size % 2);
    const end = i + 8 + padded;
    if (end > input.length) {
      body.push(input.subarray(i));
      i = input.length;
      break;
    }
    if (type === "EXIF" || type === "XMP ") {
      removed.push(type.trim());
    } else {
      const chunk = input.subarray(i, end).slice();
      if (type === "VP8X" && chunk.length >= 12) {
        // flags 바이트에서 EXIF(0x08), XMP(0x04) 비트를 끈다
        chunk[8] = chunk[8] & ~0x0c;
      }
      body.push(chunk);
    }
    i = end;
  }
  const joined = concat(body);
  const out = new Uint8Array(12 + joined.length);
  out.set(input.subarray(0, 12), 0);
  out.set(joined, 12);
  // RIFF 크기 갱신 (파일 크기 - 8)
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  return { out, removed, handled: true };
}

/** 확장자와 무관하게 시그니처를 보고 알맞은 스트리퍼를 고른다 */
export function stripMetadata(input: Uint8Array, opts?: { keepIcc?: boolean }): StripResult {
  if (isJpeg(input)) return stripJpeg(input, opts);
  if (isPng(input)) return stripPng(input);
  if (isWebp(input)) return stripWebp(input);
  return { out: input, removed: [], handled: false };
}
