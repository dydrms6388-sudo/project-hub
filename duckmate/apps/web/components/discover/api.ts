/**
 * 화면 → 서버 액션 바인딩(기본). 전부 "use server" 파일이라 클라이언트에서 import 가능.
 * 개발 라우트(/dev/discover)는 `mockApi` 를 주입한다.
 */
import { ok } from "@/lib/auth/errors";
import { sendMessage } from "@/lib/chat/actions";
import { actOnRecommendation, markRecommendationSeen, undo } from "@/lib/matching/actions";
import { blockProfile } from "@/lib/moderation/actions";
import { fetchHomeView, markSafetyModalSeen } from "@/app/(app)/home/actions";
import { fetchMatchView } from "@/app/(app)/match/actions";
import { fetchTodayRecommendations } from "@/app/(app)/reco/actions";
import type { DiscoverApi } from "./types";

export const serverApi: DiscoverApi = {
  fetchToday: () => fetchTodayRecommendations(),
  fetchHome: () => fetchHomeView(),
  act: (input) => actOnRecommendation(input),
  seen: (input) => markRecommendationSeen(input),
  undo: () => undo(),
  fetchMatch: (matchId) => fetchMatchView(matchId),
  sendFirst: async (input) => {
    const r = await sendMessage(input);
    return r.ok ? ok({ id: r.data.id }) : r;
  },
  block: (input) => blockProfile(input),
  markSafetySeen: () => markSafetyModalSeen(),
};

/** TanStack Query 키 (E3/E4 와 공유: ['matches'] 는 E3 채팅 목록 키와 동일) */
export const QK = {
  reco: (loopDate: string | null) => ["reco", loopDate] as const,
  home: ["home"] as const,
  match: (matchId: string) => ["match", matchId] as const,
  matches: ["matches"] as const,
};
