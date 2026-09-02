"use client";

/**
 * Zustand `chat` 슬라이스 (12_flows §0-15). 서버 데이터(메시지·목록)는 TanStack Query — 여기는 UI·드래프트·로컬 읽음 상태만.
 *
 *   activeMatchId            현재 열려 있는 방 (inbox 이벤트가 이 방이면 목록 미읽음 배지 무시)
 *   realtimeStatus           connecting | connected | polling  (polling 이면 5초 폴링 + 상단 얇은 바)
 *   draftByMatch             입력 드래프트 (localStorage 보존 — 오프라인·재진입 시 복구)
 *   safetyBannerShownMatchIds 오프라인 만남 배너 매칭당 1회
 *   guideSeen                첫 매칭 안전 수칙 3줄 1회
 *   dismissedByMatch         방별 닫은 배너 종류
 *   revealedImageIds         블러 해제한 수신 이미지 (세션 내)
 *   readLocally              내가 마지막으로 markRead 한 시각 (목록 배지 즉시 0 처리용)
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RealtimeStatus } from "@/lib/chat/types";

type DismissKind = "mask" | "image" | "guide";

export type ChatState = {
  activeMatchId: string | null;
  realtimeStatus: RealtimeStatus;
  draftByMatch: Record<string, string>;
  safetyBannerShownMatchIds: string[];
  guideSeen: boolean;
  dismissedByMatch: Record<string, DismissKind[]>;
  revealedImageIds: string[];
  readLocally: Record<string, string>;

  setActiveMatchId: (id: string | null) => void;
  setRealtimeStatus: (s: RealtimeStatus) => void;
  setDraft: (matchId: string, text: string) => void;
  clearDraft: (matchId: string) => void;
  markSafetyBannerShown: (matchId: string) => void;
  markGuideSeen: () => void;
  dismissBanner: (matchId: string, kind: DismissKind) => void;
  revealImage: (messageId: string) => void;
  markReadLocally: (matchId: string, at?: string) => void;
};

const noopStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      activeMatchId: null,
      realtimeStatus: "connecting",
      draftByMatch: {},
      safetyBannerShownMatchIds: [],
      guideSeen: false,
      dismissedByMatch: {},
      revealedImageIds: [],
      readLocally: {},

      setActiveMatchId: (id) => set({ activeMatchId: id }),
      setRealtimeStatus: (s) => set({ realtimeStatus: s }),
      setDraft: (matchId, text) =>
        set((st) => {
          const next = { ...st.draftByMatch };
          if (text.length === 0) delete next[matchId];
          else next[matchId] = text;
          return { draftByMatch: next };
        }),
      clearDraft: (matchId) =>
        set((st) => {
          const next = { ...st.draftByMatch };
          delete next[matchId];
          return { draftByMatch: next };
        }),
      markSafetyBannerShown: (matchId) =>
        set((st) => (st.safetyBannerShownMatchIds.includes(matchId) ? st : { safetyBannerShownMatchIds: [...st.safetyBannerShownMatchIds, matchId] })),
      markGuideSeen: () => set({ guideSeen: true }),
      dismissBanner: (matchId, kind) =>
        set((st) => {
          const cur = st.dismissedByMatch[matchId] ?? [];
          if (cur.includes(kind)) return st;
          return { dismissedByMatch: { ...st.dismissedByMatch, [matchId]: [...cur, kind] } };
        }),
      revealImage: (messageId) => set((st) => (st.revealedImageIds.includes(messageId) ? st : { revealedImageIds: [...st.revealedImageIds, messageId] })),
      markReadLocally: (matchId, at) => set((st) => ({ readLocally: { ...st.readLocally, [matchId]: at ?? new Date().toISOString() } })),
    }),
    {
      name: "dm.chat",
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.localStorage)),
      partialize: (st) => ({
        draftByMatch: st.draftByMatch,
        safetyBannerShownMatchIds: st.safetyBannerShownMatchIds,
        guideSeen: st.guideSeen,
        dismissedByMatch: st.dismissedByMatch,
      }),
    },
  ),
);
