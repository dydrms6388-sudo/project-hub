// =============================================================================
// E2 · /discover — 오늘의 추천 큐 [F-DIS-01~03, 05] (12_flows §3.2)
//
// 서버에서 큐를 읽고, 상호작용(좋아요/패스/슈퍼라이크)만 클라이언트 스택에 넘긴다.
// 재개 규칙(S2): seen_at 이 null 인 카드부터 이어서 본다.
// 빈 상태는 절대 빈 리스트로 두지 않는다 → EmptyRecommendations (§8.1).
// =============================================================================

import type { Metadata } from "next";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getLikers, getTodayRecommendations } from "@/lib/matching/queries";
import { EmptyRecommendations } from "../_components/empty-recommendations";
import { RetryCard } from "../_components/retry-card";
import { TrackEvent } from "../_components/track-event";
import { RecommendationStack } from "./_components/recommendation-stack";

export const metadata: Metadata = {
  title: "오늘의 추천",
  robots: { index: false, follow: false },
};

export default async function DiscoverPage() {
  const { profile } = await requireOnboardingDone();
  const res = await getTodayRecommendations(profile.id);

  if (!res.ok) {
    return (
      <RetryCard
        title="추천을 불러오지 못했어요"
        description="연결이 불안정할 수 있어요. 잠시 후 다시 시도해 주세요."
      />
    );
  }

  const cards = res.data.cards;
  const queue = cards.filter((card) => card.seenAt === null);

  if (queue.length === 0) {
    // 받은 관심 티저는 실카운트만 사용한다(0이면 티저 미노출 — A4 §4-4)
    const likersRes = await getLikers(profile.id, "free");
    const likersCount = likersRes.ok ? likersRes.data.count : 0;

    return (
      <>
        <TrackEvent
          name="reco_queue_open"
          props={{ queue_size: 0, resumed: cards.length > 0 }}
        />
        <EmptyRecommendations
          variant={cards.length > 0 ? "exhausted" : "preparing"}
          likersCount={likersCount}
        />
      </>
    );
  }

  return (
    <>
      <TrackEvent
        name="reco_queue_open"
        props={{ queue_size: queue.length, resumed: queue.length !== cards.length }}
      />
      <RecommendationStack cards={queue} totalToday={cards.length} />
    </>
  );
}
