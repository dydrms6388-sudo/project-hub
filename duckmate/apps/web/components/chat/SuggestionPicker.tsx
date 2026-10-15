"use client";

/**
 * SuggestionPicker — 첫 대화 제안 카드 3장 (12_flows §4.1·§5.2). E2 매칭 화면(`/match/[id]`)과 E3 대화방이 같은 컴포넌트를 쓴다(H2 통합).
 *
 *   <SuggestionPicker matchId={id} cards={firstSuggestion} surface="match" onSent={() => router.push(`/chat/${id}`)} />
 *
 * 선택 → `sendMessage({ matchId, body: card.body })` (우선순위: `send` prop → ChatApiProvider 주입 api → 기본 서버 액션)
 *      → 성공 시 `suggestion_selected{template_id, kind, position, surface}` + onSent(sent, card, position)
 *      → 실패 시 onFailure(failure, card) (호출자가 mapSendFailure/mapFailure 로 처리; 여기서는 카드 아래 한 줄만 표시)
 * 마운트 시 `suggestion_picker_shown{surface, count}` 1회. `collapsible` 이면 헤더 토글로 접힘/펼침 (대화방 재노출용).
 * testid: 섹션 `suggestion-picker`, 카드 `suggestion-card-{1..3}`(G1 시나리오 `suggestion-card-3`) — 래퍼 `suggestion-card`.
 * Realtime/Supabase 브라우저 클라이언트를 끌어오지 않는다(`api-context.tsx` 만 import).
 */
import { useState } from "react";
import type { FirstSuggestion } from "@duckmate/db";
import { SuggestionCard, cn } from "@duckmate/ui";
import type { ActionFailure, ActionResult } from "@/lib/auth/errors";
import type { SentMessage } from "@/lib/chat/types";
import { useChatApi } from "./api";
import { ChevronDownIcon } from "./icons";
import { track } from "@/lib/analytics/track";

export type SuggestionPickerProps = {
  matchId: string;
  cards: ReadonlyArray<FirstSuggestion>;
  surface?: "match" | "chat";
  onSent?: (sent: SentMessage, card: FirstSuggestion, position: number) => void;
  onFailure?: (failure: ActionFailure, card: FirstSuggestion) => void;
  /** 기본 = useChatApi().sendMessage */
  send?: (input: { matchId: string; body: string }) => Promise<ActionResult<SentMessage>>;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
};

export function SuggestionPicker({ matchId, cards, surface = "chat", onSent, onFailure, send, collapsible = false, defaultCollapsed = false, disabled = false, title = "이렇게 시작해 볼까요?", className }: SuggestionPickerProps) {
  const api = useOptionalChatApi();
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doSend = send ?? api?.sendMessage ?? sendMessageAction;

  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current || cards.length === 0) return;
    shownRef.current = true;
    track("suggestion_picker_shown", { surface, count: Math.min(cards.length, 3) });
  }, [cards.length, surface]);

  if (cards.length === 0) return null;

  async function select(card: FirstSuggestion, position: number) {
    if (pendingId || disabled) return;
    setPendingId(card.id);
    setError(null);
    const res = await doSend({ matchId, body: card.body });
    setPendingId(null);
    if (res.ok) {
      track("suggestion_selected", { template_id: card.template_id, kind: card.kind, position, surface });
      onSent?.(res.data, card, position);
    } else {
      setError(res.message);
      onFailure?.(res, card);
    }
  }

  return (
    <section data-testid="suggestion-picker" aria-label="첫 대화 제안" className={cn("flex flex-col gap-2", className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex h-11 items-center justify-between rounded-md px-1 text-label text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span>{title}</span>
          <ChevronDownIcon size={18} className={cn("text-muted-foreground transition-transform duration-(--duration-fast)", collapsed ? "" : "rotate-180")} />
        </button>
      ) : (
        <h2 className="px-1 text-label text-foreground">{title}</h2>
      )}
      {collapsed ? null : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1" role="list">
          {cards.slice(0, 3).map((card, i) => (
            <div key={card.id} role="listitem" className="w-72 shrink-0 snap-start" data-testid="suggestion-card">
              <SuggestionCard
                title={card.title}
                body={card.body}
                kind={card.kind}
                position={i + 1}
                loading={pendingId === card.id}
                disabled={disabled || (pendingId !== null && pendingId !== card.id)}
                onSelect={() => void select(card, i + 1)}
                data-testid={`suggestion-card-${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="px-1 text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
