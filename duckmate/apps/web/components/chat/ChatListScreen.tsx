"use client";

/**
 * 채팅 목록 `/chat` (12_flows §5.1). TanStack ['matches'] + inbox Realtime(폴백 5초 폴링). 정렬 = 마지막 메시지(없으면 매칭) 최신순.
 */
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, EmptyState, SkeletonList, VerifyBadge, cn } from "@duckmate/ui";
import type { ChatListItem } from "@/lib/chat/types";
import { useChatStore } from "@/stores/chat";
import { useChatApi } from "./api";
import { PollingBar } from "./ChatBanners";
import { CHAT_POLL_INTERVAL_MS, hasMaskedToken, isEnded, relativeLabel } from "./model";
import { PartnerAvatar } from "./PartnerAvatar";
import { trackChat } from "./track";
import { useMounted } from "./useMounted";

const STATUS_BADGE: Record<Exclude<ChatListItem["status"], "active">, string> = { blocked: "종료", left: "떠남", paused: "일시정지" };

function sortKey(i: ChatListItem): number {
  return Date.parse(i.last_message_at ?? i.matched_at) || 0;
}

export function ChatListScreen({ initial, myProfileId }: { initial: ChatListItem[]; myProfileId: string }) {
  const api = useChatApi();
  const qc = useQueryClient();
  const realtimeStatus = useChatStore((s) => s.realtimeStatus);
  const setRealtimeStatus = useChatStore((s) => s.setRealtimeStatus);
  const activeMatchId = useChatStore((s) => s.activeMatchId);
  const readLocally = useChatStore((s) => s.readLocally);

  const query = useQuery<ChatListItem[]>({
    queryKey: ["matches"],
    initialData: initial,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await api.fetchChatList();
      if (!r.ok) return qc.getQueryData<ChatListItem[]>(["matches"]) ?? [];
      return r.data;
    },
  });

  useEffect(() => {
    trackChat("chat_list_viewed", { count: initial.length, unread_rooms: initial.filter((i) => i.unread_count > 0).length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = api.subscribeToInbox(myProfileId, {
      onEvent: () => void qc.invalidateQueries({ queryKey: ["matches"] }),
      onStatus: setRealtimeStatus,
      onResync: () => void qc.invalidateQueries({ queryKey: ["matches"] }),
    });
    return () => {
      unsub();
      setRealtimeStatus("connecting");
    };
  }, [api, myProfileId, qc, setRealtimeStatus]);

  useEffect(() => {
    if (realtimeStatus !== "polling") return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ["matches"] }), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [realtimeStatus, qc]);

  const rows = useMemo(() => [...query.data].sort((a, b) => sortKey(b) - sortKey(a)), [query.data]);
  const mounted = useMounted();

  return (
    <div className="flex min-h-dvh flex-col bg-background" data-testid="chat-list">
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur">
        <h1 className="text-h2">채팅</h1>
      </header>
      {realtimeStatus === "polling" ? <PollingBar /> : null}
      {!mounted ? (
        <SkeletonList rows={Math.min(Math.max(rows.length, 3), 6)} className="px-4 py-4" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="💬"
          title="아직 대화가 없어요"
          description="매칭되면 여기서 바로 시작할 수 있어요. 첫 마디는 제안 카드가 골라 드려요."
          action={
            <Button asChild variant="outline">
              <Link href="/reco">오늘의 추천 보기</Link>
            </Button>
          }
          className="flex-1 justify-center"
        />
      ) : (
        <ul className="divide-y divide-border" aria-label="대화 목록">
          {rows.map((i) => {
            const localRead = readLocally[i.match_id];
            const unread = activeMatchId === i.match_id || (localRead && i.last_message_at && localRead >= i.last_message_at) ? 0 : i.unread_count;
            const ended = isEnded(i.status);
            const gone = i.partner_nickname === null || i.partner_status !== "active";
            const nickname = i.partner_nickname ?? "탈퇴한 사용자";
            const needsFirst = !ended && i.first_message_at === null;
            return (
              <li key={i.match_id}>
                <Link
                  href={`/chat/${i.match_id}`}
                  data-testid="chat-list-item"
                  data-match-id={i.match_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <PartnerAvatar partnerId={i.partner_id} nickname={i.partner_nickname} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("truncate text-label", gone ? "text-muted-foreground" : "text-foreground")}>{nickname}</span>
                      <VerifyBadge level={i.partner_verify_level} />
                      {ended ? (
                        <Badge variant="muted" size="sm">
                          {STATUS_BADGE[i.status as Exclude<ChatListItem["status"], "active">]}
                        </Badge>
                      ) : null}
                    </span>
                    <span className={cn("truncate text-body-sm", unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {ended && !i.last_preview ? "대화가 종료됐어요" : needsFirst ? "첫 마디를 골라 보세요 · 제안 카드 3장" : i.last_preview ? (hasMaskedToken(i.last_preview) ? i.last_preview.replace(/\[(연락처|링크|계좌) 숨김\]/g, "[$1 가림]") : i.last_preview) : "아직 메시지가 없어요"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-caption text-muted-foreground">{relativeLabel(i.last_message_at ?? i.matched_at)}</span>
                    {unread > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-semibold text-accent-foreground" aria-label={`안 읽은 메시지 ${unread}개`} data-testid="chat-unread">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : needsFirst ? (
                      <Badge variant="primary" size="sm">
                        NEW
                      </Badge>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
