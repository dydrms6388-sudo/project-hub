"use client";

// =============================================================================
// E2 · 매칭 리빌 모달 호스트 [F-DIS-04] — (main)/layout.tsx 에 1개만 상주.
//
// 12_flows §3.4 화면 사양:
//   ✨ 매칭! / 내 카드 ⇄ 상대 카드 / 궁합 % / 첫 대화 제안 3개 / 안전 안내 1줄 /
//   "나중에 할래요"
// 규약:
//  - 궁합 %는 반드시 CompatGauge (C2 D-5-2 "재미용" 고지 내장, 생략 불가).
//    딥 바이올렛 리빌 영역 안에 두면 ink-muted 고지가 대비 미달이라 게이지는
//    리빌 블록 "아래" surface-raised 위에 렌더한다.
//  - 제안 탭 = 첫 메시지 자동 발송은 채팅(E3) 소관 → /chat/{matchId}?suggestion=N
//    으로 넘긴다 (딥링크 규약).
//  - "나중에 할래요"(거절)는 수락 CTA 대비 70% 이상 — 동일 폭 md 버튼으로 노출.
//  - Phase 2 는 이 파일의 리빌 블록 내부만 스크래치 연출로 교체한다 (M8).
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CompatGauge,
  Dialog,
  HobbyChip,
  MatchReveal,
} from "@duckmate/ui";
import { logAppEvent } from "./analytics";
import { useMatchRevealStore } from "./match-reveal-store";

export function MatchRevealHost() {
  const current = useMatchRevealStore((s) => s.queue[0]);
  const dismiss = useMatchRevealStore((s) => s.dismiss);
  const router = useRouter();
  const shownFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!current || shownFor.current === current.matchId) return;
    shownFor.current = current.matchId;
    if (current.suggestions.length > 0) {
      void logAppEvent("suggestion_shown", {
        match_id: current.matchId,
        suggestion_type: current.suggestions[0]?.type ?? "hobby",
      });
    }
  }, [current]);

  if (!current) return null;

  function handleSuggestion(index: number) {
    if (!current) return;
    const suggestion = current.suggestions[index];
    void logAppEvent("suggestion_tap", {
      match_id: current.matchId,
      suggestion_type: suggestion?.type ?? "hobby",
    });
    const matchId = current.matchId;
    dismiss();
    // 첫 메시지 자동 발송은 대화방(E3)에서 처리 — 제안 인덱스를 딥링크로 전달
    router.push(`/chat/${matchId}?suggestion=${index}`);
  }

  return (
    <Dialog open onClose={dismiss} dismissOnBackdrop={false}>
      <div className="flex flex-col gap-5">
        <MatchReveal
          headline="취향이 통했어요!"
          subline={`${current.partnerNickname}님과 서로 관심을 보냈어요`}
        >
          <ul aria-label="상대 덕질카드 Top 3" className="flex flex-wrap justify-center gap-2">
            {current.partnerTopHobbies.slice(0, 3).map((hobby) => (
              <li key={hobby}>
                <HobbyChip label={hobby} selectable={false} />
              </li>
            ))}
          </ul>
        </MatchReveal>

        {current.compatPercent !== null && (
          <CompatGauge percent={current.compatPercent} size="inline" />
        )}

        {current.suggestions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-h3 text-ink">이런 얘기로 시작해보세요</h3>
            <ul className="flex flex-col gap-2">
              {current.suggestions.map((suggestion, index) => (
                <li key={suggestion.text}>
                  <button
                    type="button"
                    onClick={() => handleSuggestion(index)}
                    className={[
                      "w-full rounded-2xl border border-line bg-surface-raised px-4 py-3 text-left text-body text-ink",
                      "hover:border-primary hover:bg-primary/10",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    ].join(" ")}
                  >
                    {suggestion.text}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-caption text-ink-muted">
          금전 요구·외부 링크 유도는 신고해 주세요. 첫 만남은 공공장소를 권해요.
        </p>

        <Button variant="ghost" size="md" onClick={dismiss} className="w-full">
          나중에 할래요
        </Button>
      </div>
    </Dialog>
  );
}
