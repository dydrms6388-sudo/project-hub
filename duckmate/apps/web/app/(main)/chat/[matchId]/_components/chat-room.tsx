"use client";

// =============================================================================
// E3 · 대화방 클라이언트 오케스트레이터
//
// D4 규약 이행 지점 (전부 이 파일에 모여 있다):
//   ①(D4-10) 낙관적 말풍선은 로컬 원문을 렌더하지 않고, 응답 message.maskedBody 로
//            교체한다. draft 는 재전송용으로만 보관한다.
//   ②(D4 §4.3) subscribeToMatch 의 onResync → resyncMessagesAction(= getMessagesSince)
//            으로 끊긴 동안의 갭을 메운다. broadcast 는 at-most-once, DB 가 단일 진실.
//   ③(D4-4)  읽음은 markRead(match_id) RPC 만 — 방 진입 1회 + 포커스 복귀 1회.
//   ④(D4 §6.4-3) safety_card 는 for_profile_id 가 나일 때만 표시(발신자에게 금지).
//   ⑤(D4 §6.3) 에러 코드별 화면 분기. BLOCKED 는 차단 사실 비노출,
//            MESSAGE_BLOCKED 는 재전송 버튼 없음.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ChatErrorCode, ChatMessage } from "@/lib/chat/queries";
import type { SuggestionCard } from "@/lib/chat/suggestion";
import {
  subscribeToMatch,
  type ChatConnectionStatus,
  type MessageReadEvent,
  type NewMessageEvent,
  type SafetyCardEvent,
} from "@/lib/chat/realtime";
import { LinkButton } from "../../../_components/link-button";
import { TrackEvent } from "../../../_components/track-event";
import {
  loadOlderMessagesAction,
  markReadAction,
  resyncMessagesAction,
  sendImageMessageAction,
  sendMessageAction,
  sendSuggestionAction,
} from "../actions";
import { Composer } from "./composer";
import { MessageList, type PendingMessage } from "./message-list";
import { SafetyCard, type SafetyCardKind } from "./safety-card";
import { SuggestionCards } from "./suggestion-cards";
import { REPORT_EVENT } from "./room-actions";
import { SAFETY_CARD_PREFILL } from "./report-taxonomy";

export interface ChatRoomClientProps {
  matchId: string;
  myProfileId: string;
  partnerId: string | null;
  partnerNickname: string;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  initialCursor: number | null;
  suggestions: SuggestionCard[];
  suggestionsRemix: boolean;
  closed: boolean;
  canSendImage: boolean;
  imageBlockReason: string;
}

type Notice =
  | { kind: "warn"; message: string }
  | { kind: "info"; message: string }
  | { kind: "verify"; message: string };

function upsert(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return list;
  const byId = new Map<number, ChatMessage>();
  for (const m of list) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function fromEvent(e: NewMessageEvent, myProfileId: string): ChatMessage {
  return {
    id: e.id,
    matchId: e.match_id,
    senderId: e.sender_id,
    maskedBody: e.masked_body,
    imagePath: e.image_path,
    readAt: e.read_at,
    createdAt: e.created_at,
    mine: e.sender_id === myProfileId,
  };
}

function newTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatRoomClient({
  matchId,
  myProfileId,
  partnerId,
  partnerNickname,
  initialMessages,
  initialHasMore,
  initialCursor,
  suggestions,
  suggestionsRemix,
  closed,
  canSendImage,
  imageBlockReason,
}: ChatRoomClientProps) {
  const router = useRouter();

  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = React.useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [cursor, setCursor] = React.useState<number | null>(initialCursor);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [safety, setSafety] = React.useState<SafetyCardEvent | null>(null);
  const [connection, setConnection] = React.useState<ChatConnectionStatus>("connecting");
  const [roomClosed, setRoomClosed] = React.useState(closed);
  const [showSuggestions, setShowSuggestions] = React.useState(suggestions.length > 0);

  const messagesRef = React.useRef<ChatMessage[]>(initialMessages);
  const lastIdRef = React.useRef<number>(initialMessages.at(-1)?.id ?? 0);
  const endRef = React.useRef<HTMLDivElement>(null);

  // 구독 콜백(재구독 없이 최신 값을 봐야 한다)이 참조하는 미러
  React.useEffect(() => {
    messagesRef.current = messages;
    const last = messages.at(-1);
    if (last) lastIdRef.current = last.id;
  }, [messages]);

  // -------------------------------------------------------------------------
  // ③ 읽음 — mark_read RPC 만. 방 진입 1회 + 포커스 복귀 1회 (D4-4)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    // focus 와 visibilitychange 가 같은 복귀에서 함께 뜨므로 1회로 접는다
    let lastAt = 0;
    const mark = () => {
      const now = Date.now();
      if (now - lastAt < 1000) return;
      lastAt = now;
      void markReadAction(matchId);
    };

    mark();

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      mark();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [matchId]);

  // -------------------------------------------------------------------------
  // ② Realtime 구독 — 방에서는 subscribeToMatch 하나만 (목록의 다중 구독으로 좁힘)
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    const off = subscribeToMatch(matchId, {
      onMessage: (e: NewMessageEvent) => {
        setMessages((prev) => upsert(prev, [fromEvent(e, myProfileId)]));
      },
      onRead: (e: MessageReadEvent) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.mine && m.readAt === null && m.id <= e.up_to_id ? { ...m, readAt: e.read_at } : m,
          ),
        );
      },
      onSafetyCard: (e: SafetyCardEvent) => {
        // ④ 나에게 온 카드만 — 발신자에게 띄우면 탐지 로직이 드러난다
        if (e.for_profile_id !== myProfileId) return;
        setSafety(e);
      },
      onStatus: setConnection,
      onResync: () => {
        void (async () => {
          const res = await resyncMessagesAction(matchId, lastIdRef.current);
          if (res.ok && res.data.length > 0) setMessages((prev) => upsert(prev, res.data));
        })();
      },
    });
    return off;
  }, [matchId, myProfileId]);

  // 새 말풍선이 생기면 하단으로 (스크롤 애니메이션 없음 — 모션 최소)
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending.length]);

  // -------------------------------------------------------------------------
  // ⑤ 발신 결과 처리
  // -------------------------------------------------------------------------
  function dropPending(tempId: string) {
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  function markPending(tempId: string, patch: Partial<PendingMessage>) {
    setPending((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  }

  function handleSendError(tempId: string | null, code: ChatErrorCode, message: string) {
    switch (code) {
      case "AUTH_REQUIRED":
        router.replace("/login");
        return;
      case "MATCH_NOT_FOUND":
        // 차단/비참여를 구분해 노출하지 않는다
        router.replace("/chat?notice=match-not-found");
        return;
      case "MATCH_CLOSED":
      case "PARTNER_LEFT":
        setRoomClosed(true);
        setNotice({ kind: "info", message: "대화를 종료한 상대예요." });
        if (tempId) dropPending(tempId);
        return;
      case "VERIFY_LEVEL_REQUIRED":
        setNotice({ kind: "verify", message });
        if (tempId) dropPending(tempId);
        return;
      case "SANCTIONED":
        setNotice({ kind: "info", message });
        if (tempId) dropPending(tempId);
        return;
      case "MESSAGE_BLOCKED":
        // 내용 자체가 거부됨 → 재전송 버튼 없음
        if (tempId) {
          markPending(tempId, {
            status: "blocked",
            retryable: false,
            error: "커뮤니티 가이드라인에 맞지 않아 보내지 못했어요.",
          });
        }
        return;
      case "BLOCKED":
        // 차단 사실을 노출하지 않는다 — 일반 실패 문구만
        if (tempId) {
          markPending(tempId, {
            status: "failed",
            retryable: false,
            error: "지금은 메시지를 보낼 수 없어요.",
          });
        }
        return;
      case "IMAGE_NOT_FOUND":
        if (tempId) {
          markPending(tempId, {
            status: "failed",
            retryable: false,
            error: "사진을 다시 올려 주세요.",
          });
        }
        return;
      case "EDGE_UNAVAILABLE":
      case "DB_ERROR":
        // 로컬 큐 보존 + 탭 재전송 (12_flows §8.4)
        if (tempId) {
          markPending(tempId, { status: "failed", retryable: true, error: "보내지 못했어요." });
        } else {
          setNotice({ kind: "info", message });
        }
        return;
      default:
        if (tempId) {
          markPending(tempId, { status: "failed", retryable: false, error: message });
        } else {
          setNotice({ kind: "info", message });
        }
    }
  }

  async function dispatchSend(tempId: string, draft: string, imagePath: string | null) {
    setSending(true);
    const isFirst = messagesRef.current.length === 0;
    const res = imagePath
      ? await sendImageMessageAction(matchId, imagePath)
      : await sendMessageAction(matchId, draft, {
          isFirst,
          turnCount: messagesRef.current.length + 1,
        });
    setSending(false);

    if (!res.ok) {
      handleSendError(tempId, res.code, res.message);
      return;
    }
    dropPending(tempId);
    // ① 낙관적 말풍선을 서버가 마스킹한 본문으로 교체한다
    setMessages((prev) => upsert(prev, [res.data.message]));
    setShowSuggestions(false);
    setNotice(res.data.warn ? { kind: "warn", message: res.data.warn.message } : null);
  }

  function queueSend(draft: string, imagePath: string | null) {
    const tempId = newTempId();
    setPending((prev) => [
      ...prev,
      { tempId, draft, imagePath, status: "sending", error: null, retryable: true },
    ]);
    void dispatchSend(tempId, draft, imagePath);
  }

  function retry(tempId: string) {
    const item = pending.find((p) => p.tempId === tempId);
    if (!item) return;
    markPending(tempId, { status: "sending", error: null });
    void dispatchSend(tempId, item.draft, item.imagePath);
  }

  async function loadOlder() {
    if (cursor === null || loadingOlder) return;
    setLoadingOlder(true);
    const res = await loadOlderMessagesAction(matchId, cursor);
    setLoadingOlder(false);
    if (!res.ok) {
      setNotice({ kind: "info", message: "이전 대화를 불러오지 못했어요." });
      return;
    }
    setMessages((prev) => upsert(prev, res.data.messages));
    setHasMore(res.data.hasMore);
    setCursor(res.data.nextCursor);
  }

  function sendSuggestionCard(card: SuggestionCard) {
    setSending(true);
    void (async () => {
      const res = await sendSuggestionAction(matchId, card.index, {
        isFirst: messagesRef.current.length === 0,
        suggestionType: card.type,
      });
      setSending(false);
      if (!res.ok) {
        handleSendError(null, res.code, res.message);
        return;
      }
      setMessages((prev) => upsert(prev, [res.data.message]));
      setShowSuggestions(false);
      setNotice(res.data.warn ? { kind: "warn", message: res.data.warn.message } : null);
    })();
  }

  const safetyKind = (safety?.card ?? "money") as SafetyCardKind;

  return (
    <div className="flex flex-col gap-3">
      {showSuggestions && suggestions.length > 0 ? (
        <TrackEvent
          name="suggestion_shown"
          props={{ match_id: matchId, count: suggestions.length }}
        />
      ) : null}

      <div className="min-h-40">
        <MessageList
          messages={messages}
          pending={pending}
          partnerNickname={partnerNickname}
          hasMore={hasMore && cursor !== null}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          onRetry={retry}
          onDiscard={dropPending}
        />
        <div ref={endRef} />
      </div>

      {messages.length === 0 && pending.length === 0 && suggestions.length === 0 ? (
        <p className="text-body-sm text-ink-muted">
          아직 주고받은 메시지가 없어요. 편한 말부터 건네도 괜찮아요.
        </p>
      ) : null}

      {safety ? (
        <SafetyCard
          kind={safetyKind}
          onReport={() => {
            // 헤더의 신고 시트를 프리필 상태로 연다 (room-actions.tsx 주석 참조)
            window.dispatchEvent(
              new CustomEvent(REPORT_EVENT, {
                detail: { code: SAFETY_CARD_PREFILL[safetyKind] },
              }),
            );
          }}
          onDismiss={() => setSafety(null)}
        />
      ) : null}

      {showSuggestions ? (
        <SuggestionCards
          cards={suggestions}
          remix={suggestionsRemix}
          sending={sending}
          onSend={sendSuggestionCard}
        />
      ) : null}

      {connection === "reconnecting" ? (
        <p role="status" className="text-caption text-ink-muted" data-testid="chat-connection">
          연결이 불안정해요. 다시 연결하는 중이에요.
        </p>
      ) : null}

      {notice ? (
        <div
          role="status"
          data-testid="chat-notice"
          data-kind={notice.kind}
          className={
            notice.kind === "warn"
              ? "rounded-2xl bg-warning-tint px-4 py-3 text-body-sm text-warning"
              : "rounded-2xl bg-primary-tint px-4 py-3 text-body-sm text-primary-tint-fg"
          }
        >
          <p>{notice.message}</p>
          {notice.kind === "verify" ? (
            <div className="mt-2">
              <LinkButton href="/verify?required=2" variant="primary" size="sm">
                본인인증하러 가기
              </LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <Composer
        matchId={matchId}
        disabled={roomClosed}
        disabledReason="대화를 종료한 상대예요. 지난 대화는 그대로 볼 수 있어요."
        canSendImage={canSendImage && !roomClosed}
        imageBlockReason={imageBlockReason}
        sending={sending}
        onSendText={(text) => queueSend(text, null)}
        onSendImage={(imagePath) => queueSend("", imagePath)}
      />

      {partnerId === null ? (
        <p className="text-caption text-ink-muted">
          상대 프로필은 더 이상 볼 수 없어요. 지난 대화만 남아 있어요.
        </p>
      ) : null}
    </div>
  );
}
