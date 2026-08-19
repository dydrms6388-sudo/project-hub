// =============================================================================
// E2 · 프로필 보완 퀘스트 (12_flows §3.1 / §결정-5 — 온보딩 스킵분 회수)
//
// 노출 조건: 덕질카드 미완성(최애·요즘 빠진 것) · 사진 없음 · 취미 3~4개.
// 카피 규칙: 죄책감·재촉 금지. "채우면 ~해져요"(이득 서술)만 쓴다.
// 완료 항목은 아예 렌더하지 않는다 — 미완 항목이 0개면 카드 자체가 사라진다.
// =============================================================================

import { Card, CardDescription, CardTitle } from "@duckmate/ui";
import { LinkButton } from "../../_components/link-button";

export interface ProfileQuestProps {
  missingFavNote: boolean;
  missingObsession: boolean;
  missingPhotos: boolean;
  hobbyCount: number;
  /** 목표 취미 개수 (12_flows §결정-5: 최소 3, 목표 5) */
  hobbyGoal?: number;
}

interface QuestItem {
  key: string;
  message: string;
  href: string;
  label: string;
}

export function ProfileQuest({
  missingFavNote,
  missingObsession,
  missingPhotos,
  hobbyCount,
  hobbyGoal = 5,
}: ProfileQuestProps) {
  const items: QuestItem[] = [];

  if (missingFavNote || missingObsession) {
    items.push({
      key: "duckcard",
      message: missingFavNote
        ? "최애를 채우면 궁합 이유가 더 풍부해져요."
        : "요즘 빠진 것을 채우면 첫 대화가 쉬워져요.",
      href: "/me/duckcard",
      label: "채우러 가기",
    });
  }

  if (hobbyCount > 0 && hobbyCount < hobbyGoal) {
    items.push({
      key: "hobbies",
      message: `취미를 ${hobbyGoal}개까지 고르면 추천이 더 정확해져요. (지금 ${hobbyCount}개)`,
      href: "/me/duckcard",
      label: "취미 추가하기",
    });
  }

  if (missingPhotos) {
    items.push({
      key: "photos",
      message: "사진을 올리면 인증 뱃지를 받을 수 있어요. 없어도 전 기능은 그대로 이용할 수 있어요.",
      href: "/me/photos",
      label: "사진 올리기",
    });
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardTitle>프로필 보완</CardTitle>
      <CardDescription className="mt-1">
        조금만 더 채우면 추천이 정확해져요.
      </CardDescription>
      <ul className="mt-3 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-2">
            <p className="text-body-sm text-ink">{item.message}</p>
            <div>
              <LinkButton href={item.href} variant="ghost" size="sm">
                {item.label}
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
