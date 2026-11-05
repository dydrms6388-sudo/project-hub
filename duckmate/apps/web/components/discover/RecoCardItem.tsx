"use client";

/**
 * 추천 스택의 카드 1장 = 덕질 카드 + 액션 3개(패스/좋아요/슈퍼라이크). 스와이프 없음(PRD §5.2, 버튼만).
 * 뷰포트 50%·1초 → onSeen 1회 (IntersectionObserver). 슈퍼라이크 실패 사유는 카드 안 인라인.
 */
import * as React from "react";
import { Heart, Star, X } from "lucide-react";
import { Button, cn } from "@duckmate/ui";
import { personOfRecoCard, reasonExtras, suggestionLine } from "./format";
import { PersonCard } from "./PersonCard";
import type { RecoCardView } from "./types";

export const SEEN_THRESHOLD = 0.5;
export const SEEN_DWELL_MS = 1000;

export type RecoCardItemProps = {
  card: RecoCardView;
  index: number;
  total: number;
  pending: boolean;
  superlikeRemaining: number | null;
  inlineError: { field: string; message: string } | null;
  onSeen: (card: RecoCardView) => void;
  onAct: (card: RecoCardView, action: "like" | "super" | "pass") => void;
  onOpenProfile: (card: RecoCardView) => void;
};

export function RecoCardItem({ card, index, total, pending, superlikeRemaining, inlineError, onSeen, onAct, onOpenProfile }: RecoCardItemProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const seenRef = React.useRef(Boolean(card.seenAt));
  const onSeenRef = React.useRef(onSeen);
  React.useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || seenRef.current || typeof IntersectionObserver === "undefined") return;
    let timer: number | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting && e.intersectionRatio >= SEEN_THRESHOLD) {
          if (timer === null) {
            timer = window.setTimeout(() => {
              if (seenRef.current) return;
              seenRef.current = true;
              onSeenRef.current(card);
              io.disconnect();
            }, SEEN_DWELL_MS);
          }
        } else if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, SEEN_THRESHOLD, 1] },
    );
    io.observe(el);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [card]);

  const person = personOfRecoCard(card);
  const { availabilityOverlap, sameRegion } = reasonExtras(card.reasons);
  const superDisabled = pending || superlikeRemaining === 0;

  return (
    <section
      ref={ref}
      className="snap-start scroll-mt-14 px-4 pb-6 pt-3"
      data-testid="reco-card"
      data-position={card.position}
      data-reco-id={card.recoId}
      aria-label={`추천 ${index + 1} / ${total}`}
    >
      <PersonCard
        person={person}
        compat={card.scorePercent}
        reasons={card.reasons.slice(0, 2).map((r) => r.label)}
        availabilityOverlap={availabilityOverlap}
        sameRegion={sameRegion}
        suggestion={suggestionLine(card.hobbies)}
        showPhotos
        onHeaderClick={() => onOpenProfile(card)}
        footer={
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onOpenProfile(card)} data-testid="reco-open-profile">
            {card.photoUrls.length > 0 ? `사진 ${card.photoUrls.length}장 · 전체 보기` : "전체 프로필 보기"}
          </Button>
        }
      />

      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="추천 액션">
        <Button variant="outline" onClick={() => onAct(card, "pass")} disabled={pending} data-testid="reco-pass" aria-label="패스">
          <X aria-hidden="true" />
          패스
        </Button>
        <Button variant="accent" onClick={() => onAct(card, "like")} disabled={pending} data-testid="reco-like" aria-label="좋아요">
          <Heart aria-hidden="true" />
          좋아요
        </Button>
        <Button
          variant="secondary"
          onClick={() => onAct(card, "super")}
          disabled={superDisabled}
          data-testid="reco-super"
          aria-label={superlikeRemaining === null ? "슈퍼라이크" : `슈퍼라이크, 남은 ${superlikeRemaining}개`}
          className={cn(superlikeRemaining !== null && superlikeRemaining > 0 && "[&_svg]:fill-primary [&_svg]:text-primary")}
        >
          <Star aria-hidden="true" />
          <span>
            슈퍼 {superlikeRemaining !== null ? <span className="tnum">{superlikeRemaining}</span> : null}
          </span>
        </Button>
      </div>
      {inlineError ? (
        <p className="mt-2 text-body-sm text-muted-foreground" role="status" data-testid={`reco-inline-${inlineError.field}`}>
          {inlineError.message}
        </p>
      ) : null}
    </section>
  );
}
