"use client";

// =============================================================================
// E2 · 오늘의 추천 카드 스택 (12_flows §3.2 / F-DIS-01~03)
//
// 화면 원칙:
//  - 첫 화면은 사진이 아니라 덕질카드다 (사진은 상세에서만 — §1 차별점).
//  - 궁합 %는 CompatGauge 로만 렌더 (재미용 고지 내장, 생략 불가 — C2 D-5-2).
//  - 궁합 근거 3줄은 daily_recommendations.reasons 를 그대로 노출.
//  - 좋아요(감정 피크) = accent lg / 패스·슈퍼라이크 = ghost md (70% 규칙).
//  - 되돌리기(F-DIS-08)는 Phase 3 까지 미노출 — actions.ts 주석 참조.
// =============================================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, CompatGauge, DuckCard } from "@duckmate/ui";
import type { RecommendationCard } from "@/lib/matching/queries";
import { logAppEvent } from "../../_components/analytics";
import { useMatchRevealStore } from "../../_components/match-reveal-store";
import { PaywallNotice, type PaywallSource } from "../../_components/paywall-notice";
import { LinkButton } from "../../_components/link-button";
import {
  markRecommendationSeen,
  passAction,
  sendLikeAction,
} from "../actions";

export interface RecommendationStackProps {
  /** 미열람 카드 (점수 내림차순) */
  cards: RecommendationCard[];
  /** 오늘 발행된 전체 카드 수 — "N/M 남음" 표기용 */
  totalToday: number;
}

type Notice =
  | { kind: "info"; message: string }
  | { kind: "verify"; message: string }
  | { kind: "paywall"; message: string; source: PaywallSource }
  | { kind: "pending"; message: string; showVerify: boolean };

export function RecommendationStack({ cards, totalToday }: RecommendationStackProps) {
  const router = useRouter();
  const enqueueReveal = useMatchRevealStore((s) => s.enqueue);
  const [index, setIndex] = React.useState(0);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [pending, startTransition] = React.useTransition();
  const viewed = React.useRef<Set<string>>(new Set());

  const card = cards[index];
  const remaining = cards.length - index;

  // 카드 노출 = 열람 기록(seen_at) + reco_card_view (position 은 오늘 큐 기준)
  React.useEffect(() => {
    if (!card || viewed.current.has(card.recommendationId)) return;
    viewed.current.add(card.recommendationId);
    void markRecommendationSeen(card.recommendationId);
    void logAppEvent("reco_card_view", {
      target_id: card.targetId,
      position: totalToday - cards.length + index + 1,
    });
  }, [card, cards.length, index, totalToday]);

  function advance() {
    setNotice(null);
    if (index + 1 >= cards.length) {
      // 큐 소진 → 서버가 소진 화면(§8.1)을 렌더하도록 새로고침
      startTransition(() => router.refresh());
      setIndex(index + 1);
      return;
    }
    setIndex(index + 1);
  }

  function handlePass() {
    if (!card) return;
    const targetId = card.targetId;
    startTransition(async () => {
      await passAction(targetId);
      advance();
    });
  }

  function handleLike(type: "like" | "super") {
    if (!card) return;
    const current = card;
    startTransition(async () => {
      const res = await sendLikeAction(current.targetId, type, "queue");

      if (!res.ok) {
        if (res.verifyRequired) {
          setNotice({ kind: "verify", message: res.message });
          return;
        }
        if (res.paywallSource) {
          setNotice({
            kind: "paywall",
            message: res.message,
            source: res.paywallSource,
          });
          return;
        }
        if (res.code === "ALREADY_LIKED" || res.code === "TARGET_NOT_AVAILABLE") {
          setNotice({ kind: "info", message: res.message });
          advance();
          return;
        }
        setNotice({ kind: "info", message: res.message });
        return;
      }

      if (res.data.status === "matched" && res.data.matchId) {
        enqueueReveal({
          matchId: res.data.matchId,
          partnerNickname: current.target.nickname,
          partnerTopHobbies: current.topHobbies.map((h) => h.name),
          compatPercent: Math.round(current.score * 100),
          suggestions: res.data.suggestions,
        });
        advance();
        return;
      }

      if (res.data.status === "pending") {
        setNotice({
          kind: "pending",
          message: "상대가 본인인증을 완료하면 매칭돼요.",
          showVerify: res.data.myVerifyLevel < 2,
        });
        return;
      }

      advance();
    });
  }

  if (!card) {
    // 마지막 카드 처리 직후의 짧은 전환 구간 — 소진 화면은 서버가 렌더한다
    return (
      <p role="status" className="py-10 text-center text-body-sm text-ink-muted">
        오늘의 추천을 모두 봤어요. 정리하는 중이에요…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h1">오늘의 추천</h1>
        <Badge variant="brand">{`${remaining}/${totalToday} 남음`}</Badge>
      </div>

      <DuckCard
        nickname={card.target.nickname}
        topHobbies={card.topHobbies.map((h) => h.name)}
        bias={card.target.favNote ?? undefined}
        obsession={card.target.currentObsession ?? undefined}
        verifyLevel={card.target.verifyLevel}
        footer={
          card.target.regionCode ? (
            <span className="text-body-sm text-ink-muted">{card.target.regionCode}</span>
          ) : undefined
        }
      />

      <section
        aria-label="궁합"
        className="rounded-2xl border border-line bg-surface-raised p-5"
      >
        <CompatGauge percent={card.score * 100} size="inline" reasons={card.reasons} />
      </section>

      <Link
        href={`/discover/${card.targetId}`}
        className="text-body-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        프로필 자세히 보기
      </Link>

      <div aria-live="polite" className="empty:hidden">
        {notice && (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-4">
            <p className="text-body-sm text-ink">{notice.message}</p>
            {notice.kind === "verify" && (
              <LinkButton href="/verify?required=2" variant="primary" size="sm">
                본인인증하러 가기
              </LinkButton>
            )}
            {notice.kind === "pending" && notice.showVerify && (
              <LinkButton href="/verify?required=2" variant="primary" size="sm">
                본인인증하러 가기
              </LinkButton>
            )}
            {notice.kind === "pending" && (
              <Button variant="ghost" size="sm" onClick={advance}>
                다음 추천 보기
              </Button>
            )}
            {notice.kind === "paywall" && <PaywallNotice source={notice.source} />}
            {notice.kind === "paywall" && (
              <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
                닫기
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          variant="ghost"
          size="md"
          onClick={handlePass}
          disabled={pending}
          aria-label={`${card.target.nickname}님 패스`}
        >
          패스
        </Button>
        <Button
          variant="accent"
          size="lg"
          onClick={() => handleLike("like")}
          loading={pending}
          aria-label={`${card.target.nickname}님에게 좋아요 보내기`}
        >
          좋아요
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => handleLike("super")}
          disabled={pending}
          aria-label={`${card.target.nickname}님에게 슈퍼라이크 보내기`}
        >
          슈퍼라이크
        </Button>
      </div>
    </div>
  );
}
