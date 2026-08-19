"use client";

// =============================================================================
// E2 · 마운트 시 1회 퍼널 이벤트 기록 (서버 컴포넌트에서 <TrackEvent .../> 로 삽입)
// 렌더 부작용 없음 — null 을 반환하는 계측 전용 컴포넌트.
// =============================================================================

import * as React from "react";
import { logAppEvent } from "./analytics";

export interface TrackEventProps {
  /** 03_core_loop §4.1 이벤트명 (app_open, reco_queue_open, reco_card_view …) */
  name: string;
  props?: Record<string, unknown>;
}

export function TrackEvent({ name, props }: TrackEventProps) {
  const fired = React.useRef(false);
  const payload = React.useRef(props);
  payload.current = props;

  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void logAppEvent(name, payload.current ?? {});
  }, [name]);

  return null;
}
