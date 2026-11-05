"use client";

/**
 * `push` 슬라이스 (12_flows 결정 15): 브라우저 권한 상태·구독 여부·소프트 배너를 닫은 loop_date.
 * 값의 소스는 lib/push/client.ts (getPermissionState) 와 서버 PushPrefsView.subscribed 이며, 여기는 화면 간 공유용 캐시다.
 *
 * H2: `bannerDismissedLoopDate` 만 localStorage 에 보존한다(20_notifications §0-4 "거절 시 30일 재요청 금지").
 *  - 권한 상태·구독 여부는 매 진입 시 브라우저/서버가 다시 알려주므로 보존하지 않는다(비영속).
 *  - 홈 배너(E2)와 매칭 화면 소프트 프롬프트(H2)가 같은 스토어를 읽어 설정 화면과도 상태가 맞는다.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PermissionState } from "@/lib/push/client";

/** 소프트 프롬프트를 닫은 뒤 다시 묻지 않는 기간(일) — 20_notifications §0-4 */
export const PUSH_PROMPT_COOLDOWN_DAYS = 30;

export type PushState = {
  permission: PermissionState | "unknown";
  subscribed: boolean;
  bannerDismissedLoopDate: string | null;
  setPermission: (p: PermissionState) => void;
  setSubscribed: (v: boolean) => void;
  dismissBanner: (loopDate: string) => void;
};

export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      permission: "unknown",
      subscribed: false,
      bannerDismissedLoopDate: null,
      setPermission: (permission) => set({ permission }),
      setSubscribed: (subscribed) => set({ subscribed }),
      dismissBanner: (bannerDismissedLoopDate) => set({ bannerDismissedLoopDate }),
    }),
    {
      name: "dm.push",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ bannerDismissedLoopDate: s.bannerDismissedLoopDate }),
    },
  ),
);

/** 마지막으로 닫은 loop_date 로부터 30일이 지났는지 (둘 다 `YYYY-MM-DD`). 닫은 적 없으면 true */
export function pushPromptCooledDown(dismissedLoopDate: string | null, todayLoopDate: string, days: number = PUSH_PROMPT_COOLDOWN_DAYS): boolean {
  if (!dismissedLoopDate) return true;
  const from = Date.parse(`${dismissedLoopDate}T00:00:00Z`);
  const to = Date.parse(`${todayLoopDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return to - from >= days * 86_400_000;
}
