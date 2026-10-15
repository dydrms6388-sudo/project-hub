// =============================================================================
// E2 · 추천 대체 화면 (12_flows §8.1 / F-DIS-05)
//
// 절대 규칙:
//  - "추천 0명" 원문 노출 금지, 빈 리스트 노출 금지 (PRD §1-9).
//  - 모든 빈 상태에 다음 행동 CTA 1개 이상.
//  - 죄책감·조바심 카피 금지, 카운트다운 타이머 컴포넌트 금지(C2 D-3)
//    → 다음 발행 시각을 "내일 오전 6시"(KST 06:00 리셋) 텍스트로만 안내한다.
//
// variant:
//  - "exhausted": 오늘 큐를 모두 확인함 → 내일 예고 + 받은 관심 티저(S5)
//  - "preparing": 발행분 자체가 없음 → 프로필 보완 유도(폴백)
// =============================================================================

import { Card, CardDescription, CardTitle } from "@duckmate/ui";
import { BlurredLikers } from "./blurred-likers";
import { LinkButton } from "./link-button";
import { PaywallNotice } from "./paywall-notice";

export interface EmptyRecommendationsProps {
  variant: "exhausted" | "preparing";
  /** 받은 관심 수 — 0이면 티저 자체를 노출하지 않는다(0명 배지 금지) */
  likersCount?: number;
}

export function EmptyRecommendations({
  variant,
  likersCount = 0,
}: EmptyRecommendationsProps) {
  const exhausted = variant === "exhausted";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>
          {exhausted ? "오늘의 추천을 모두 봤어요" : "취향이 겹치는 분을 찾고 있어요"}
        </CardTitle>
        <CardDescription className="mt-1">
          {exhausted
            ? "새 추천은 내일 오전 6시에 도착해요. 그동안 받은 관심을 살펴봐도 좋아요."
            : "덕질카드를 채우면 겹치는 취향을 더 정확하게 찾아드려요."}
        </CardDescription>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {exhausted ? (
            <>
              <LinkButton href="/likes" variant="primary" size="md">
                받은 관심 보기
              </LinkButton>
              <LinkButton href="/me/duckcard" variant="ghost" size="md">
                덕질카드 다듬기
              </LinkButton>
            </>
          ) : (
            <>
              <LinkButton href="/me/duckcard" variant="primary" size="md">
                덕질카드 채우러 가기
              </LinkButton>
              <LinkButton href="/home" variant="ghost" size="md">
                홈으로
              </LinkButton>
            </>
          )}
        </div>

        {exhausted && <PaywallNotice source="recs_exhausted" className="mt-3" />}
      </Card>

      {likersCount > 0 && (
        <Card>
          <CardTitle>{`나에게 관심을 보낸 ${likersCount}명`}</CardTitle>
          <CardDescription className="mt-1">
            서로 관심을 보내면 대화를 시작할 수 있어요.
          </CardDescription>
          <div className="mt-3">
            <BlurredLikers count={likersCount} />
          </div>
          <div className="mt-4">
            <LinkButton href="/likes" variant="ghost" size="md">
              보러 가기
            </LinkButton>
          </div>
        </Card>
      )}
    </div>
  );
}
