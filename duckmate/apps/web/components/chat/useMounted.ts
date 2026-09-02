"use client";

import { useEffect, useState } from "react";

/**
 * 시각 라벨(오늘/어제·오후 3:24·"12분 전")은 브라우저 타임존으로만 계산해야 하므로, 서버 렌더와 어긋나는 첫 페인트는
 * 스켈레톤으로 두고 hydration 직후 실제 화면을 그린다(hydration mismatch 방지, 12_flows §8 300ms 규칙 안).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
