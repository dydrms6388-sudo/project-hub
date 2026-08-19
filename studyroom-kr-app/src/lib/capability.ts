export function detectWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
export function detectWasmThreads(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
}
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
/** 대략적인 메모리 힌트(GB). 지원 안 되면 null. */
export function memoryHint(): number | null {
  if (typeof navigator === "undefined") return null;
  const n = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return typeof n === "number" ? n : null;
}
