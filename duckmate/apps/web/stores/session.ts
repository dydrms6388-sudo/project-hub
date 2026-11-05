"use client";

/**
 * `session` 슬라이스 (12_flows §0-15·16, 15_auth §0-16) — 서버 layout 이 hydrate 하는 GateState 사본.
 *
 *   const step = useSessionStore((s) => s.state?.onboardingStep);
 *   <SessionHydrator state={state} />   // (onboarding)/(app) layout 에서 1회
 *
 * 규칙: verify_level·mode·status 는 클라이언트가 바꾸지 않는다. 서버 액션 응답 후 router.refresh() 또는
 * invalidateQueries(['me']) → layout 재검증으로만 갱신된다. 이 스토어는 UX 분기(배너·탭 노출) 용도.
 */
import { create } from "zustand";
import type { GateState } from "@duckmate/db";

export type SessionSlice = {
  /** null = 세션 없음(또는 아직 hydrate 전) */
  state: GateState | null;
  hydrated: boolean;
  hydrate: (state: GateState | null) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionSlice>()((set) => ({
  state: null,
  hydrated: false,
  hydrate: (state) => set({ state, hydrated: true }),
  clear: () => set({ state: null, hydrated: true }),
}));

/** 편의 셀렉터 */
export const selectVerifyLevel = (s: SessionSlice): number => s.state?.verifyLevel ?? 0;
export const selectOnboardingStep = (s: SessionSlice): GateState["onboardingStep"] | null => s.state?.onboardingStep ?? null;
export const selectSanctionLevel = (s: SessionSlice): number => s.state?.sanctionLevel ?? 0;
