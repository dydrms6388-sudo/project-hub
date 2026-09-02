/**
 * `reco` Zustand 슬라이스 (E2) — 현재 카드 인덱스·마지막 액션·되돌리기 타이머만.
 * 서버 데이터(카드 목록·요약)는 TanStack Query 가 소유한다. 리듀서는 순수 함수(vitest).
 */
import { create } from "zustand";

export const UNDO_WINDOW_SEC = 300;

export type RecoAction = "like" | "super" | "pass";

export type LastAction = { recoId: string; targetId: string; action: RecoAction; at: number; matched: boolean };

export type RecoState = {
  loopDate: string | null;
  index: number;
  lastAction: LastAction | null;
  /** epoch ms. null = 되돌리기 없음 */
  undoUntil: number | null;
};

export type RecoEvent =
  | { type: "reset"; loopDate: string }
  | { type: "setIndex"; index: number }
  | { type: "acted"; recoId: string; targetId: string; action: RecoAction; at: number; matched: boolean }
  | { type: "undone" }
  | { type: "expire"; now: number };

export const initialRecoState: RecoState = { loopDate: null, index: 0, lastAction: null, undoUntil: null };

export function recoReducer(state: RecoState, event: RecoEvent): RecoState {
  switch (event.type) {
    case "reset":
      if (state.loopDate === event.loopDate) return state;
      return { ...initialRecoState, loopDate: event.loopDate };
    case "setIndex":
      return state.index === event.index ? state : { ...state, index: Math.max(0, event.index) };
    case "acted": {
      const last: LastAction = { recoId: event.recoId, targetId: event.targetId, action: event.action, at: event.at, matched: event.matched };
      // 매칭까지 간 좋아요는 되돌릴 수 없다(16_matching §0-9) → 타이머 없음
      return { ...state, lastAction: last, undoUntil: event.matched ? null : event.at + UNDO_WINDOW_SEC * 1000 };
    }
    case "undone":
      return { ...state, lastAction: null, undoUntil: null };
    case "expire":
      if (state.undoUntil !== null && event.now >= state.undoUntil) return { ...state, undoUntil: null };
      return state;
    default:
      return state;
  }
}

/** 남은 되돌리기 초(0 이면 없음). 표시는 mm:ss */
export function undoRemainingSec(state: RecoState, now: number): number {
  if (state.undoUntil === null) return 0;
  return Math.max(0, Math.ceil((state.undoUntil - now) / 1000));
}

export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type RecoStore = RecoState & { dispatch: (e: RecoEvent) => void };

export const useRecoStore = create<RecoStore>((set) => ({
  ...initialRecoState,
  dispatch: (e) => set((s) => recoReducer(s, e)),
}));
