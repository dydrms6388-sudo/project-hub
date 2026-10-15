"use client";

import { useEffect, useRef } from "react";
import { site } from "@/site.config";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 애드센스 승인 전에는 아무것도 렌더하지 않는다(빈 공간도 없음).
 * `slot` 은 애드센스에서 발급한 숫자 슬롯 ID 여야 한다 ("tool-top" 같은 라벨이 아님).
 */
export function AdSlot({ slot }: { slot: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!site.adsenseClient || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 스크립트 차단(광고차단기 등) — 무시 */
    }
  }, []);

  if (!site.adsenseClient) return null;
  return (
    <ins
      className="adsbygoogle block"
      style={{ display: "block" }}
      data-ad-client={site.adsenseClient}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
