"use client";

// =============================================================================
// E2 · 받은 관심에 답하기 버튼 (공개 티어 전용)
// 서로 좋아요 → 매칭 성립 시 전역 리빌 모달로 넘긴다.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@duckmate/ui";
import { useMatchRevealStore } from "../../_components/match-reveal-store";
import { LinkButton } from "../../_components/link-button";
import { PaywallNotice, type PaywallSource } from "../../_components/paywall-notice";
import { sendLikeAction } from "../../discover/actions";

export interface LikeBackButtonProps {
  targetId: string;
  nickname: string;
  topHobbies: string[];
}

type Notice =
  | { kind: "info"; message: string }
  | { kind: "verify"; message: string }
  | { kind: "paywall"; message: string; source: PaywallSource };

export function LikeBackButton({ targetId, nickname, topHobbies }: LikeBackButtonProps) {
  const router = useRouter();
  const enqueueReveal = useMatchRevealStore((s) => s.enqueue);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleLike() {
    startTransition(async () => {
      const res = await sendLikeAction(targetId, "like", "card");

      if (!res.ok) {
        if (res.verifyRequired) {
          setNotice({ kind: "verify", message: res.message });
          return;
        }
        if (res.paywallSource) {
          setNotice({ kind: "paywall", message: res.message, source: res.paywallSource });
          return;
        }
        setNotice({ kind: "info", message: res.message });
        return;
      }

      if (res.data.status === "matched" && res.data.matchId) {
        enqueueReveal({
          matchId: res.data.matchId,
          partnerNickname: nickname,
          partnerTopHobbies: topHobbies,
          compatPercent: null,
          suggestions: res.data.suggestions,
        });
      } else if (res.data.status === "pending") {
        setNotice({ kind: "info", message: "상대가 본인인증을 완료하면 매칭돼요." });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="primary"
          size="md"
          loading={pending}
          onClick={handleLike}
          aria-label={`${nickname}님에게 좋아요 보내기`}
        >
          좋아요
        </Button>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {notice && (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-ink">{notice.message}</p>
            {notice.kind === "verify" && (
              <LinkButton href="/verify?required=2" variant="primary" size="sm">
                본인인증하러 가기
              </LinkButton>
            )}
            {notice.kind === "paywall" && <PaywallNotice source={notice.source} />}
          </div>
        )}
      </div>
    </div>
  );
}
