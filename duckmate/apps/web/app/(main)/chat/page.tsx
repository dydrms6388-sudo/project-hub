// =============================================================================
// E3 · /chat — 매칭·대화 목록 [F-CHT-01, F-CHT-05] (12_flows §4.1)
//
// 구조 (§결정-1: "매칭 탭"은 별도 탭이 아니라 채팅 탭 상단의 새 매칭 스트립):
//   ① 새 매칭 스트립 — 아직 메시지가 0건인 활성 매칭(ChatRoom.isNew)
//   ② 대화 목록     — 상대 프로필 · 마지막 메시지(masked_body) · 안읽음 수
//   ③ 7일 무응답 방 — 조용히 하단 정렬 + "제안 카드 다시 보내기"(리믹스). 재촉 카피 금지.
//
// 게이트: 채팅은 Lv2 라우트다((main)/layout.tsx 주석 — Lv 게이트는 라우트별).
//         requireVerifyLevel(2) 미달 시 /verify?required=2 로 (페이월 아님, §8.6).
// 표시 원칙: last_message_body 는 chat_rooms 뷰가 내려주는 masked_body 다 —
//         원문은 클라이언트에 존재하지 않는다(D4 §5).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Badge, Card, CardDescription, CardTitle, VerifyLevelBadge } from "@duckmate/ui";
import { requireVerifyLevel } from "@/lib/auth/guards";
import { getChatRooms, type ChatRoom } from "@/lib/chat/queries";
import { LinkButton } from "../_components/link-button";
import { RetryCard } from "../_components/retry-card";
import { TrackEvent } from "../_components/track-event";
import { ChatListLive } from "./_components/chat-list-live";
import { formatRelative, previewText, STALE_AFTER_MS } from "./_components/format";

export const metadata: Metadata = {
  title: "채팅",
  robots: { index: false, follow: false },
};

/** 대화방에서 되돌아올 때 붙는 안내 (차단/비참여 여부는 구분해 노출하지 않는다 — D4 §6.3) */
const NOTICE: Record<string, string> = {
  "match-not-found": "지금은 열 수 없는 대화방이에요.",
  closed: "대화가 종료된 방이에요.",
  blocked: "차단을 완료했어요. 이 상대는 더 이상 보이지 않아요.",
  reported: "신고가 접수됐어요. 24시간 이내에 검토하고 결과를 알려드려요.",
};

function isStale(room: ChatRoom, now: number): boolean {
  if (!room.lastMessage) return false;
  return now - new Date(room.lastMessage.createdAt).getTime() > STALE_AFTER_MS;
}

export default async function ChatListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { profile } = await requireVerifyLevel(2);
  const { notice } = await searchParams;
  const res = await getChatRooms(profile.id);

  if (!res.ok) {
    return (
      <RetryCard
        title="대화를 불러오지 못했어요"
        description="연결이 불안정할 수 있어요. 잠시 후 다시 시도해 주세요."
      />
    );
  }

  const now = Date.now();
  const rooms = res.data;
  const newMatches = rooms.filter((r) => r.isNew && r.status === "active");
  const talking = rooms.filter((r) => !r.isNew);
  const fresh = talking.filter((r) => !isStale(r, now));
  const stale = talking.filter((r) => isStale(r, now));
  const ordered = [...fresh, ...stale];
  const noticeText = notice ? NOTICE[notice] : undefined;

  return (
    <div className="flex flex-col gap-5" data-testid="chat-list">
      <TrackEvent name="chat_list_open" props={{ room_count: rooms.length }} />
      <ChatListLive matchIds={rooms.map((r) => r.matchId)} />

      <h1 className="text-h1">채팅</h1>

      {noticeText ? (
        <p role="status" className="rounded-2xl bg-primary-tint px-4 py-3 text-body-sm text-primary-tint-fg">
          {noticeText}
        </p>
      ) : null}

      {newMatches.length > 0 ? (
        <section aria-labelledby="new-match-heading" className="flex flex-col gap-3">
          <h2 id="new-match-heading" className="text-h3">
            새 매칭
          </h2>
          <ul
            className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1"
            data-testid="chat-new-match-strip"
          >
            {newMatches.map((room) => (
              <li key={room.matchId} className="snap-start">
                <Link
                  href={`/chat/${room.matchId}`}
                  data-testid="chat-new-match-item"
                  data-match-id={room.matchId}
                  className="flex w-32 flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Avatar name={room.partner?.nickname ?? "탈퇴한 사용자"} size="md" />
                  <span className="w-full truncate text-body font-semibold">
                    {room.partner?.nickname ?? "탈퇴한 사용자"}
                  </span>
                  <span className="text-caption text-ink-muted">먼저 말 걸어보기</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-caption text-ink-muted">
            첫 마디는 준비해 뒀어요. 방에 들어가면 제안 카드 3개가 기다리고 있어요.
          </p>
        </section>
      ) : null}

      {ordered.length > 0 ? (
        <section aria-labelledby="talking-heading" className="flex flex-col gap-2">
          <h2 id="talking-heading" className="sr-only">
            대화 중인 방
          </h2>
          <ul className="flex flex-col gap-2">
            {ordered.map((room) => {
              const nickname = room.partner?.nickname ?? "탈퇴한 사용자";
              const preview = room.lastMessage
                ? previewText(room.lastMessage.body, room.lastMessage.imagePath)
                : "";
              const stalled = isStale(room, now);
              return (
                <li key={room.matchId}>
                  <Link
                    href={`/chat/${room.matchId}`}
                    data-testid="chat-room-item"
                    data-match-id={room.matchId}
                    data-unread={room.unreadCount}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Avatar name={nickname} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-body font-semibold">{nickname}</span>
                        {room.partner ? (
                          <VerifyLevelBadge level={room.partner.verifyLevel} compact />
                        ) : null}
                        {room.status !== "active" ? (
                          <Badge variant="neutral">종료</Badge>
                        ) : null}
                      </div>
                      <span className="truncate text-body-sm text-ink-muted">
                        {room.lastMessage?.mine && preview ? `나: ${preview}` : preview}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-caption text-ink-muted">
                        {room.lastMessage ? formatRelative(room.lastMessage.createdAt, now) : ""}
                      </span>
                      {room.unreadCount > 0 ? (
                        <Badge variant="brand">{`안읽음 ${room.unreadCount}`}</Badge>
                      ) : null}
                    </div>
                  </Link>

                  {stalled && room.status === "active" ? (
                    // 7일 무응답: 재촉하지 않고 다음 행동 1개만 제안한다 (12_flows §4.1)
                    <div className="mt-1 pl-4">
                      <LinkButton
                        href={`/chat/${room.matchId}?remix=1`}
                        variant="ghost"
                        size="sm"
                        className="text-body-sm"
                      >
                        제안 카드 다시 보내기
                      </LinkButton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {rooms.length === 0 ? (
        <Card data-testid="chat-empty">
          <CardTitle>아직 대화방이 없어요</CardTitle>
          <CardDescription className="mt-1">
            서로 좋아요가 오가면 여기에 방이 생겨요. 오늘의 추천에서 취향이 겹치는 사람부터
            둘러볼까요?
          </CardDescription>
          <div className="mt-4">
            <LinkButton href="/discover" variant="primary" size="md">
              오늘의 추천 보기
            </LinkButton>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
