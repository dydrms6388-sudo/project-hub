import type { Sound } from "./sounds";

/**
 * 파라미터 값 배열 ↔ URL 쿼리(?p=v1_v2_...) 인코딩.
 * 값은 항목의 params 순서를 따르며, step 단위로 반올림해 범위를 벗어나지 않게 한다.
 */
export function clampValue(v: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(v)) return min;
  const snapped = Math.round((v - min) / step) * step + min;
  const fixed = Number(snapped.toFixed(6));
  return Math.min(max, Math.max(min, fixed));
}

export function encodeValues(values: number[]): string {
  return values.map((v) => String(Number(v.toFixed(6)))).join("_");
}

export function decodeValues(sound: Sound, q: string | null): number[] | null {
  if (!q) return null;
  const parts = q.split("_");
  if (parts.length !== sound.params.length) return null;
  return sound.params.map((p, i) =>
    clampValue(parseFloat(parts[i]), p.min, p.max, p.step)
  );
}

export function readValuesFromLocation(sound: Sound): number[] | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("p");
  return decodeValues(sound, q);
}

export function writeValuesToLocation(values: number[]): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("p", encodeValues(values));
  window.history.replaceState(null, "", url.toString());
}
