// =============================================================================
// E2 · /likes — 나를 좋아한 사람 [F-DIS-07] (12_flows §3.5)
//
// 티어 규약(TIER_LIMITS.seeLikers):
//   free  = "blur" → 실카운트만. 상대를 식별할 수 있는 데이터는 서버가 아예
//                    내려주지 않는다(getLikers 가 count 만 반환) — 블러는 CSS 가
//                    아니라 데이터 레벨에서 막는다.
//   plus/pro = "open" → 목록 공개 + 답하기 버튼.
// Phase 1 은 결제 버튼 없음 — 안내 1줄(PaywallNotice, source=likers_blur)만.
// 0명이면 배지·그리드 대신 다음 행동 CTA 가 있는 빈 화면 (§8.1 3원칙).
// 탭이 아니라 홈·탐색 엔트리에서 진입하는 화면이다(§결정-1).
// =============================================================================

import type { Metadata } from "next";
import { Badge, Card, CardDescription, CardTitle, DuckCard } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getLikers } from "@/lib/matching/queries";
import { LinkButton } from "../_components/link-button";
import { PaywallNotice } from "../_components/paywall-notice";
import { RetryCard } from "../_components/retry-card";
import { LikeBackButton } from "./_components/like-back-button";

export const metadata: Metadata = {
  title: "받은 관심",
  robots: { index: false, follow: false },
};

const MAX_BLUR_TILES = 9;

export default async function LikesPage() {
  const { profile } = await requireOnboardingDone();
  const res = await getLikers(profile.id, "free");

  if (!res.ok) {
    return (
      <RetryCard
        title="받은 관심을 불러오지 못했어요"
        description="연결이 불안정할 수 있어요. 잠시 후 다시 시도해 주세요."
      />
    );
  }

  const data = res.data;

  if (data.count === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">받은 관심</h1>
        <Card>
          <CardTitle>아직 조용하네요</CardTitle>
          <CardDescription className="mt-1">
            오늘의 추천에서 먼저 관심을 보내면 대화가 시작될 확률이 올라가요.
          </CardDescription>
          <div className="mt-4">
            <LinkButton href="/discover" variant="primary" size="md">
              오늘의 추천 보기
            </LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  if (data.mode === "blur") {
    const tiles = Math.min(MAX_BLUR_TILES, data.count);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-h1">받은 관심</h1>
          <Badge variant="brand">{`${data.count}명`}</Badge>
        </div>

        <ul aria-label={`아직 공개되지 않은 프로필 ${data.count}개`} className="grid grid-cols-3 gap-3">
          {Array.from({ length: tiles }, (_, i) => (
            <li
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-2xl bg-primary-tint blur-sm"
            />
          ))}
        </ul>

        <Card>
          <CardTitle>누가 보냈는지는 아직 가려져 있어요</CardTitle>
          <CardDescription className="mt-1">
            오늘의 추천에서 그분을 다시 만날 수도 있어요. 서로 관심을 보내면 바로 매칭돼요.
          </CardDescription>
          <div className="mt-4">
            <LinkButton href="/discover" variant="primary" size="md">
              오늘의 추천 보기
            </LinkButton>
          </div>
          <PaywallNotice source="likers_blur" className="mt-3" />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-h1">받은 관심</h1>
        <Badge variant="brand">{`${data.count}명`}</Badge>
      </div>

      <ul className="flex flex-col gap-4">
        {data.likers.map((liker) => (
          <li key={liker.profileId} className="flex flex-col gap-3">
            <DuckCard
              nickname={liker.nickname}
              topHobbies={liker.topHobbies}
              bias={liker.favNote ?? undefined}
              verifyLevel={liker.verifyLevel}
              footer={
                liker.type === "super" ? (
                  <Badge variant="accent">슈퍼라이크</Badge>
                ) : undefined
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <LikeBackButton
                targetId={liker.profileId}
                nickname={liker.nickname}
                topHobbies={liker.topHobbies}
              />
              <LinkButton
                href={`/discover/${liker.profileId}`}
                variant="ghost"
                size="md"
              >
                프로필 보기
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
