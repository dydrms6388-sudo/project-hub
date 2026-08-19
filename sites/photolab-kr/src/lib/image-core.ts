/**
 * DOM 에 의존하지 않는 이미지 계산 유틸.
 * 메인 스레드와 Web Worker 양쪽에서 그대로 import 한다.
 */

export type ResizeOp =
  | { kind: "none" }
  /** 긴 변을 value 픽셀 이하로 (확대하지 않음) */
  | { kind: "maxSide"; value: number }
  /** 원본의 percent% */
  | { kind: "scale"; percent: number }
  /** 고정 픽셀 박스 */
  | { kind: "fixed"; width: number; height: number; fit: "contain" | "cover" | "stretch" };

export type OutFormat = "image/jpeg" | "image/png" | "image/webp";

export type EncodeOpts = {
  resize: ResizeOp;
  format: OutFormat;
  /** 0~1. png 는 무시됨 */
  quality: number;
  /** 투명 배경을 채울 색 (jpeg 로 나갈 때 필수) */
  background: string;
};

export type DrawRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dw: number;
  dh: number;
};

const clampInt = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(n)));

/** 원본 w×h 와 리사이즈 옵션으로 실제 draw 파라미터를 계산한다. */
export function computeDraw(w: number, h: number, op: ResizeOp): DrawRect {
  const base: DrawRect = { sx: 0, sy: 0, sw: w, sh: h, dw: w, dh: h };
  if (w <= 0 || h <= 0) return base;

  if (op.kind === "none") return base;

  if (op.kind === "maxSide") {
    const target = Math.max(1, op.value);
    const longest = Math.max(w, h);
    if (longest <= target) return base;
    const r = target / longest;
    return { ...base, dw: clampInt(w * r, 1, 100000), dh: clampInt(h * r, 1, 100000) };
  }

  if (op.kind === "scale") {
    const r = Math.max(0.01, op.percent / 100);
    return { ...base, dw: clampInt(w * r, 1, 100000), dh: clampInt(h * r, 1, 100000) };
  }

  // fixed
  const bw = Math.max(1, Math.round(op.width));
  const bh = Math.max(1, Math.round(op.height));
  if (op.fit === "stretch") return { ...base, dw: bw, dh: bh };
  if (op.fit === "cover") {
    // 박스를 가득 채우고 남는 부분은 원본에서 잘라낸다
    const r = Math.max(bw / w, bh / h);
    const sw = clampInt(bw / r, 1, w);
    const sh = clampInt(bh / r, 1, h);
    return {
      sx: Math.round((w - sw) / 2),
      sy: Math.round((h - sh) / 2),
      sw,
      sh,
      dw: bw,
      dh: bh,
    };
  }
  // contain: 박스 안에 들어가도록 (여백 없이 결과 크기 자체를 줄임)
  const r = Math.min(bw / w, bh / h);
  return { ...base, dw: clampInt(w * r, 1, 100000), dh: clampInt(h * r, 1, 100000) };
}

export const extFor = (format: OutFormat) =>
  format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";

/** "IMG_0001.HEIC" + "jpg" → "IMG_0001.jpg" */
export function replaceExt(name: string, ext: string) {
  const i = name.lastIndexOf(".");
  const stem = i > 0 ? name.slice(0, i) : name;
  return `${stem}.${ext}`;
}

export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 이벤트 루프 양보 — 파일 사이에 호출해 UI 가 얼지 않게 한다 */
export const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

const HEIC_EXT = ["heic", "heif", "hif"];
export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export const isHeicName = (name: string) => HEIC_EXT.includes(extOf(name));

/** 100장 이상이면 경고 */
export const MANY_FILES = 100;

/** 같은 이름이 겹치면 "-1", "-2" 를 붙여 유일하게 만든다 */
export function uniqueName(taken: Set<string>, name: string): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const i = name.lastIndexOf(".");
  const stem = i > 0 ? name.slice(0, i) : name;
  const ext = i > 0 ? name.slice(i) : "";
  let n = 1;
  let candidate = `${stem}-${n}${ext}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  taken.add(candidate);
  return candidate;
}
