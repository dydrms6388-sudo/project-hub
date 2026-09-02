"use client";

/**
 * `push` 슬라이스 (12_flows 결정 15): 브라우저 권한 상태·구독 여부·소프트 배너 닫은 loop_date.
 * 값의 소스는 lib/push/client.ts (getPermissionState) 와 서버 PushPrefsView.subscribed 이며, 여기는 화면 간 공유용 캐시다.
 */
import { create } from "zustand";
import type { PermissionState } from "@/lib/push/client";

export type PushState = {
  permission: PermissionState | "unknown";
  subscribed: boolean;
  bannerDismissedLoopDate: string | null;
  setPermission: (p: PermissionState) => void;
  setSubscribed: (v: boolean) => void;
  dismissBanner: (loopDate: string) => void;
};

export const usePushStore = create<PushState>((set) => ({
  permission: "unknown",
  subscribed: false,
  bannerDismissedLoopDate: null,
  setPermission: (permission) => set({ permission }),
  setSubscribed: (subscribed) => set({ subscribed }),
  dismissBanner: (bannerDismissedLoopDate) => set({ bannerDismissedLoopDate }),
}));
