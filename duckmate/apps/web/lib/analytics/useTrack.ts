"use client";

/**
 * 클라이언트 훅 2종 (E1~E5 공용).
 *   useTrackView("verify_gate_viewed", props)  — *Screen 마운트 시 뷰 이벤트 1회(12_flows §0-30)
 *   useStepTimer()                             — duration_ms 측정 (온보딩 각 화면)
 */
import { useEffect, useRef } from "react";
import { stepTimer, track, type AnalyticsEvent, type AnalyticsProps } from "./track";

export function useTrackView(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
    // 마운트 1회만 — props 변경으로 재발화하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useStepTimer(): { elapsed: () => number; reset: () => void } {
  const ref = useRef<ReturnType<typeof stepTimer> | null>(null);
  if (ref.current === null) ref.current = stepTimer();
  return ref.current;
}
