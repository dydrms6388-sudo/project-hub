"use client";

/** 계측 이벤트 전송 (K값 추적). 사용자 흐름을 절대 막지 않는다 — 실패는 조용히 무시. */
export function track(
  name: string,
  opts?: { slug?: string; meta?: Record<string, unknown> },
): void {
  try {
    const payload = JSON.stringify({ name, ...opts });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* noop */
  }
}
