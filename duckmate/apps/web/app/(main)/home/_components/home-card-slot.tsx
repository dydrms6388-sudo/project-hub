// =============================================================================
// E2 · 홈 최상단 "카드 슬롯" (A3 §결정-1 / M8 / 12_flows §3.1)
//
// ★ Phase 전환 지점 ★
//   Phase 1 = 여기 있는 "오늘의 추천 N명" 진입 배너.
//   Phase 2 = 이 컴포넌트를 오늘의 궁합 카드(F-GAM-01, 뒤집기 카드)로 **교체만**
//             한다. 홈 페이지·라우트·주변 카드 배치는 그대로 유지되도록 슬롯을
//             독립 컴포넌트로 분리해 뒀다. 부록 B-1 참조.
// =============================================================================

import { Card, CardDescription, CardTitle } from "@duckmate/ui";
import { LinkButton } from "../../_components/link-button";

export interface HomeCardSlotProps {
  /** 오늘 아직 보지 않은 추천 수 */
  unseenCount: number;
  /** 오늘 발행된 추천 수 */
  totalCount: number;
}

export function HomeCardSlot({ unseenCount, totalCount }: HomeCardSlotProps) {
  const hasQueue = unseenCount > 0;
  const seenAll = totalCount > 0 && unseenCount === 0;

  return (
    <Card>
      <CardTitle>
        {hasQueue
          ? `오늘의 추천 ${unseenCount}명이 기다리고 있어요`
          : seenAll
            ? "오늘의 추천을 모두 봤어요"
            : "취향이 겹치는 분을 찾고 있어요"}
      </CardTitle>
      <CardDescription className="mt-1">
        {hasQueue
          ? "덕질카드부터 보여드릴게요. 사진은 그다음이에요."
          : seenAll
            ? "새 추천은 내일 오전 6시에 도착해요."
            : "덕질카드를 채우면 더 정확하게 찾아드려요."}
      </CardDescription>
      <div className="mt-4">
        <LinkButton href="/discover" variant="primary" size="md">
          {hasQueue ? "추천 보러 가기" : "탐색으로 가기"}
        </LinkButton>
      </div>
    </Card>
  );
}
