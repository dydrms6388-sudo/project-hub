"use client";

// =============================================================================
// E2 · 매칭 리빌 전역 큐 (12_flows §결정-2 ① — 라우트 아님, 전역 모달)
//
// 다른 E 에이전트 사용법 (클라이언트 컴포넌트에서):
//   import { useMatchRevealStore } from "@/app/(main)/_components/match-reveal-store";
//   useMatchRevealStore.getState().enqueue({ matchId, partnerNickname, ... });
// → (main)/layout.tsx 에 상주하는 <MatchRevealHost /> 가 즉시 모달을 띄운다.
// 여러 건이 겹치면 큐에 쌓여 순서대로 노출된다.
// =============================================================================

import { create } from "zustand";
import type { MatchRevealPayload } from "./match-reveal-types";

interface MatchRevealState {
  queue: MatchRevealPayload[];
  /** 리빌 1건 추가 (같은 matchId 중복 삽입 방지) */
  enqueue: (payload: MatchRevealPayload) => void;
  /** 현재(맨 앞) 리빌 닫기 */
  dismiss: () => void;
  clear: () => void;
}

export const useMatchRevealStore = create<MatchRevealState>((set) => ({
  queue: [],
  enqueue: (payload) =>
    set((state) =>
      state.queue.some((p) => p.matchId === payload.matchId)
        ? state
        : { queue: [...state.queue, payload] },
    ),
  dismiss: () => set((state) => ({ queue: state.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
