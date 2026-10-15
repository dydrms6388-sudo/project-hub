"use client";

/**
 * `onboardingDraft` 슬라이스 (12_flows §0-10·13·15).
 *  - birthDate·phone(마스킹 없는 입력값은 저장하지 않음 → 번호는 세션 메모리만) : sessionStorage 영속 (S1 → S2 전달)
 *  - basic·hobbies·card : 뒤로가기 시 로컬 프리필용(메모리). 서버 저장은 "다음" 버튼(액션)에서만.
 *  - 저장 성공 후 해당 드래프트는 clearStep 으로 비운다.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Enums } from "@duckmate/db";

export type BasicDraft = {
  nickname: string;
  gender: Enums["gender"] | null;
  sidoCode: string | null;
  regionCode: string | null;
  availability: Array<{ weekday: number; slot: Enums["availability_slot"] }>;
};

export type HobbyDraftItem = { hobbyId: number; intensity: 1 | 2 | 3 | 4 | 5; favNote: string };

export type CardDraft = { nowInto: string; favNote: string };

export type OnboardingDraftSlice = {
  /** S1 결과 'YYYY-MM-DD' (sessionStorage) */
  birthDate: string | null;
  /** S1 완료 시각(ms) — 퍼널 소요 시간 계측 */
  ageGateAt: number | null;
  basic: BasicDraft | null;
  /** 선택 순서 = rank */
  hobbies: HobbyDraftItem[] | null;
  card: CardDraft | null;
  setBirthDate: (birthDate: string | null) => void;
  setBasic: (draft: BasicDraft | null) => void;
  setHobbies: (draft: HobbyDraftItem[] | null) => void;
  setCard: (draft: CardDraft | null) => void;
  clearAll: () => void;
};

const EMPTY = { birthDate: null, ageGateAt: null, basic: null, hobbies: null, card: null } as const;

export const useOnboardingDraft = create<OnboardingDraftSlice>()(
  persist(
    (set) => ({
      ...EMPTY,
      setBirthDate: (birthDate) => set({ birthDate, ageGateAt: birthDate ? Date.now() : null }),
      setBasic: (basic) => set({ basic }),
      setHobbies: (hobbies) => set({ hobbies }),
      setCard: (card) => set({ card }),
      clearAll: () => set({ ...EMPTY }),
    }),
    {
      name: "dm_onboarding_draft",
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.sessionStorage)),
      /** sessionStorage 에는 생년월일(+시각)만. 나머지는 메모리 */
      partialize: (s) => ({ birthDate: s.birthDate, ageGateAt: s.ageGateAt }),
    },
  ),
);

const noopStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};
