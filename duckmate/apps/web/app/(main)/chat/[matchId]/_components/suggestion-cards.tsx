"use client";

// =============================================================================
// E3 · 첫 대화 제안 카드 3개 [F-CHT-05] (12_flows §3.4·§4.2)
//
// - 대화가 비어 있을 때만 노출한다(방 페이지가 판정). ?remix=1 은 7일 무응답 방의
//   "제안 카드 다시 보내기" 맥락 재노출.
// - 발신은 **카드 인덱스**로 한다(D4-9). 본문을 클라이언트가 만들어 보내지 않으므로
//   문구 위조가 불가능하고, 오프라인 제안의 공공장소 권장 문구는 서버가 붙인다.
// - 카피 규칙(C1 §4.2 원칙 2): "대화를 시작해보세요" 같은 숙제형 문구 금지 —
//   구체적 행동 1개를 대신 들고 간다.
// =============================================================================

import * as React from "react";
import type { SuggestionCard } from "@/lib/chat/suggestion";

export interface SuggestionCardsProps {
  cards: SuggestionCard[];
  /** true = 이미 대화가 있었던 방에서 다시 제안하는 맥락 */
  remix: boolean;
  sending: boolean;
  onSend: (card: SuggestionCard) => void;
}

export function SuggestionCards({ cards, remix, sending, onSend }: SuggestionCardsProps) {
  if (cards.length === 0) return null;

  return (
    <section
      aria-labelledby="suggestion-heading"
      className="flex flex-col gap-2"
      data-testid="chat-suggestions"
    >
      <h2 id="suggestion-heading" className="text-h3">
        {remix ? "이 얘기로 다시 말 걸어볼까요" : "이런 얘기로 시작해보세요"}
      </h2>
      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <li key={card.index}>
            <button
              type="button"
              disabled={sending}
              onClick={() => onSend(card)}
              data-testid="chat-suggestion-card"
              data-index={card.index}
              className="w-full rounded-2xl border border-line bg-surface-raised px-4 py-3 text-left text-body text-ink hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="block">{card.text}</span>
              {card.offline ? (
                <span className="mt-1 block text-caption text-ink-muted">
                  보낼 때 공공장소 권장 문구가 함께 붙어요.
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">
        금전 요구·외부 링크 유도는 신고해 주세요.
      </p>
    </section>
  );
}
