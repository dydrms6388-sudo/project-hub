"use client";

// =============================================================================
// E3 · 메시지 리스트 + 말풍선
//
// 하드룰 (D4 §6.4-1 / D4-10):
//   렌더 대상은 **maskedBody 뿐**이다. 원문은 클라이언트에 존재하지 않으며,
//   전송 중 낙관적 말풍선도 로컬 원문을 그리지 않는다 — 서버 응답(maskedBody)으로
//   교체될 때까지 "보내는 중" 자리표시만 보여 준다. (내 화면엔 번호가 보이는데
//   상대 화면엔 가려지는 불일치 = 유출 오인 방지)
//
// 접근성:
//   컨테이너 role="log" + aria-live="polite" — 새 말풍선만 읽어 준다.
//   말풍선은 <li>, 발신자/시각은 sr-only 텍스트로 병행 제공(색·정렬 단독 전달 금지).
// =============================================================================

import * as React from "react";
import { Button } from "@duckmate/ui";
import type { ChatMessage } from "@/lib/chat/queries";
import { formatClock, formatDateLabel, sameDay } from "../../_components/format";
import { ChatImage } from "./chat-image";

export type PendingStatus = "sending" | "failed" | "blocked";

export interface PendingMessage {
  tempId: string;
  /** 재전송용으로만 보관하는 로컬 원문 — 절대 렌더하지 않는다 (D4-10) */
  draft: string;
  imagePath: string | null;
  status: PendingStatus;
  /** 실패 사유 문구 (차단 사실 등 민감 정보는 담지 않는다) */
  error: string | null;
  /** false = 재전송 버튼 없음 (MESSAGE_BLOCKED — 내용 자체가 거부됨) */
  retryable: boolean;
}

export interface MessageListProps {
  messages: ChatMessage[];
  pending: PendingMessage[];
  partnerNickname: string;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (tempId: string) => void;
  onDiscard: (tempId: string) => void;
}

function Bubble({
  mine,
  children,
  meta,
  testid,
  extraProps,
}: {
  mine: boolean;
  children: React.ReactNode;
  meta?: React.ReactNode;
  testid: string;
  extraProps?: Record<string, string>;
}) {
  return (
    <li
      className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
      data-testid={testid}
      data-mine={mine ? "true" : "false"}
      {...extraProps}
    >
      <div
        className={[
          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-body",
          mine
            ? "bg-primary text-primary-fg"
            : "border border-line bg-surface-raised text-ink",
        ].join(" ")}
      >
        {children}
      </div>
      {meta}
    </li>
  );
}

export function MessageList({
  messages,
  pending,
  partnerNickname,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onDiscard,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-2">
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" loading={loadingOlder} onClick={onLoadOlder} data-testid="chat-load-older">
            이전 대화 더 보기
          </Button>
        </div>
      ) : null}

      <ol
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`${partnerNickname}님과의 대화`}
        className="flex flex-col gap-3"
        data-testid="chat-messages"
      >
        {messages.map((m, i) => {
          const prev = i > 0 ? messages[i - 1] : undefined;
          const showDate = !prev || !sameDay(prev.createdAt, m.createdAt);
          const body = m.maskedBody.trim();
          return (
            <React.Fragment key={m.id}>
              {showDate ? (
                <li className="my-1 flex justify-center">
                  <span className="rounded-full bg-primary-tint px-3 py-1 text-caption text-primary-tint-fg">
                    {formatDateLabel(m.createdAt)}
                  </span>
                </li>
              ) : null}
              <Bubble
                mine={m.mine}
                testid="chat-message"
                extraProps={{ "data-message-id": String(m.id) }}
                meta={
                  <span className="text-caption text-ink-muted">
                    <span className="sr-only">{m.mine ? "내 메시지" : `${partnerNickname}님 메시지`} · </span>
                    {formatClock(m.createdAt)}
                    {m.mine && m.readAt ? " · 읽음" : ""}
                  </span>
                }
              >
                {m.imagePath ? (
                  <ChatImage
                    imagePath={m.imagePath}
                    alt={m.mine ? "내가 보낸 사진" : `${partnerNickname}님이 보낸 사진`}
                  />
                ) : null}
                {body.length > 0 ? <span>{body}</span> : null}
                {body.length === 0 && !m.imagePath ? (
                  <span className="text-ink-muted">내용이 없는 메시지예요.</span>
                ) : null}
              </Bubble>
            </React.Fragment>
          );
        })}

        {pending.map((p) => (
          <Bubble
            key={p.tempId}
            mine
            testid="chat-pending-message"
            extraProps={{ "data-status": p.status }}
            meta={
              <span className="flex items-center gap-2 text-caption">
                {p.status === "sending" ? (
                  <span className="text-ink-muted">보내는 중이에요…</span>
                ) : (
                  <>
                    <span className="text-danger">{p.error ?? "메시지를 보내지 못했어요."}</span>
                    {p.retryable ? (
                      <button
                        type="button"
                        onClick={() => onRetry(p.tempId)}
                        data-testid="chat-retry"
                        className="rounded-full border border-line px-2 py-0.5 text-caption text-ink hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        다시 보내기
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDiscard(p.tempId)}
                      data-testid="chat-discard"
                      className="rounded-full border border-line px-2 py-0.5 text-caption text-ink-muted hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      지우기
                    </button>
                  </>
                )}
              </span>
            }
          >
            {/* 로컬 원문을 렌더하지 않는다 — 마스킹된 응답으로 교체될 자리 (D4-10) */}
            <span className="text-primary-fg/80">
              {p.status === "sending"
                ? p.imagePath
                  ? "사진을 보내는 중이에요"
                  : "메시지를 보내는 중이에요"
                : p.imagePath
                  ? "보내지 못한 사진"
                  : "보내지 못한 메시지"}
            </span>
          </Bubble>
        ))}
      </ol>
    </div>
  );
}
