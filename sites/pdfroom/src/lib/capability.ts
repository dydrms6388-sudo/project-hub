"use client";

export function detectWebGPU(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator;
}

export function detectWasmThreads(): boolean {
  if (typeof window === "undefined") return false;
  return typeof SharedArrayBuffer !== "undefined" && self.crossOriginIsolated === true;
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 대략적인 메모리 힌트(GB). 알 수 없으면 null */
export function memoryHint(): number | null {
  if (typeof navigator === "undefined") return null;
  const m = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof m === "number" ? m : null;
}

/** 무거운 도구에서 "PC 권장" 뱃지를 띄울지 판단 */
export function shouldWarnHeavy(): boolean {
  const mem = memoryHint();
  return isMobile() || (mem !== null && mem <= 4);
}
