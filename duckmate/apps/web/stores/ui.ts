"use client";

/**
 * `ui` 슬라이스 (12_flows 결정 15): 모달 스택·오프라인·reduced-motion. 서버 데이터는 넣지 않는다.
 * 토스트는 @duckmate/ui ToastProvider 가 소유하므로 여기서는 다루지 않는다.
 */
import { create } from "zustand";

export type UiState = {
  modalStack: string[];
  isOffline: boolean;
  reducedMotion: boolean;
  pushModal: (id: string) => void;
  popModal: (id?: string) => void;
  setOffline: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  modalStack: [],
  isOffline: false,
  reducedMotion: false,
  pushModal: (id) => set((s) => (s.modalStack.includes(id) ? s : { modalStack: [...s.modalStack, id] })),
  popModal: (id) => set((s) => ({ modalStack: id ? s.modalStack.filter((m) => m !== id) : s.modalStack.slice(0, -1) })),
  setOffline: (isOffline) => set({ isOffline }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
