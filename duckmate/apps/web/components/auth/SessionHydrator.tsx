"use client";

/**
 * 서버 layout → 클라이언트 session 스토어 hydrate (12_flows §0-15). (onboarding)·/verify·(app) layout 에서 1회 렌더.
 */
import { useEffect } from "react";
import type { GateState } from "@duckmate/db";
import { useSessionStore } from "@/stores/session";

export function SessionHydrator({ state }: { state: GateState | null }) {
  const hydrate = useSessionStore((s) => s.hydrate);
  useEffect(() => {
    hydrate(state);
  }, [hydrate, state]);
  return null;
}
