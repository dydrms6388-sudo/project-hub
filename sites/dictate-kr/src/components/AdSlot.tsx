"use client";

import { useEffect, useRef } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * 애드센스 승인 전에는 아무것도 렌더하지 않는다(height 0).
 * NEXT_PUBLIC_ADSENSE_CLIENT 가 설정된 경우에만 광고 유닛을 삽입한다.
 * 정책: 결과 영역 아래 1개만. 입력 화면에는 넣지 않는다.
 */
export default function AdSlot({ slot }: { slot?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || pushed.current || !ref.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* 광고 차단기 등 — 무시 */
    }
  }, []);

  if (!CLIENT) return <div style={{ height: 0 }} aria-hidden="true" />;

  return (
    <ins
      ref={ref}
      className="adsbygoogle block"
      style={{ display: "block" }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
