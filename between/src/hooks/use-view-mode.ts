"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

// 탐색 화면 보기 방식 (그리드/리스트) — UI 선호값만 저장. 인증/권한과 무관.
export type ViewMode = "grid" | "list";

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      // 사생활 보호 모드 등 저장 불가 — 무시
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};

export const useViewMode = create<{ mode: ViewMode; setMode: (m: ViewMode) => void }>()(
  persist((set) => ({ mode: "grid", setMode: (mode) => set({ mode }) }), {
    name: "between-view-mode",
    storage: createJSONStorage(() => safeStorage),
  }),
);
