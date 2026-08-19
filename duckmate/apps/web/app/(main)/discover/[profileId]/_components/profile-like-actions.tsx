"use client";

// =============================================================================
// E2 · 상대 프로필 상세의 좋아요/패스 액션 바 (12_flows §3.3)
// 좋아요는 Server Action(sendLikeAction, source="card") 경유.
// 코드 분기 규약은 discover/actions.ts 주석과 동일하다.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@duckmate/ui";
import { useMatchRevealStore } from "../../../_components/match-reveal-store";
import { LinkButton } from "../../../_components/link-button";
import { PaywallNotice, type PaywallSource } from "../../../_components/paywall-notice";
import { sendLikeAction } from "../../actions";

export interface ProfileLikeActionsProps {
  targetId: string;
  nickname: string;
  topHobbies: string[];
  /** 오늘 추천 큐에 있는 상대면 궁합 %, 아니면 null */
  compatPercent: number | null;
}

type Notice =
  | { kind: "info"; message: string }
  | { kind: "verify"; message: string }
  | { kind: "paywall"; message: string; source: PaywallSource };

export function ProfileLikeActions({
  targetId,
  nickname,
  topHobbies,
  compatPercent,
}: ProfileLikeActionsProps) {
  const router = useRouter();
  const enqueueReveal = useMatchRevealStore((s) => s.enqueue);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleLike(type: "like" | "super") {
    startTransition(async () => {
      const res = await sendLikeAction(targetId, type, "card");

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
          compatPercent,
          suggestions: res.data.suggestions,
        });
        router.push("/discover");
        return;
      }

      if (res.data.status === "pending") {
        setNotice({
          kind: "info",
          message: "상대가 본인인증을 완료하면 매칭돼요.",
        });
        return;
      }

      setNotice({ kind: "info", message: "관심을 보냈어요." });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" className="empty:hidden">
        {notice && (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-4">
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

      <div className="flex items-center justify-center gap-3">
        <LinkButton href="/discover" variant="ghost" size="md">
          목록으로
        </LinkButton>
        <Button
          variant="accent"
          size="lg"
          loading={pending}
          onClick={() => handleLike("like")}
          aria-label={`${nickname}님에게 좋아요 보내기`}
        >
          좋아요
        </Button>
        <Button
          variant="ghost"
          size="md"
          disabled={pending}
          onClick={() => handleLike("super")}
          aria-label={`${nickname}님에게 슈퍼라이크 보내기`}
        >
          슈퍼라이크
        </Button>
      </div>
    </div>
  );
}
