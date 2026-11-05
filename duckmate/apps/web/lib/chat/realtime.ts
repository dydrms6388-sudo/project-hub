"use client";

/**
 * Realtime 구독 헬퍼 (E3 클라이언트). private 브로드캐스트 채널만 사용 — postgres_changes 아님.
 *
 *   const unsub = subscribeToMatch(matchId, {
 *     onMessage: (m) => queryClient.setQueryData(['messages', matchId], …),   // 중복(id) 제거됨
 *     onStatus:  (s) => chat.setRealtimeStatus(s),                             // 'polling' 이면 5초 폴링 폴백(PRD §5.5)
 *     onResync:  () => queryClient.invalidateQueries(['messages', matchId]),   // 재연결 직후 1회: 끊긴 동안 놓친 메시지 보충
 *     onMatchStatus: (p) => …,                                                 // blocked/left/paused → 입력창 종료 바
 *   });
 *   const unsubInbox = subscribeToInbox(profileId, { onEvent: () => invalidate(['matches']) });
 *
 * 채널 이름: match:{match_id} / inbox:{profile_id}. 서버(0030 트리거)가 realtime.send 로 masked 페이로드만 보낸다.
 * 권한: realtime.messages RLS(dm_chat_topics_read) — 당사자만 join 가능. JWT 는 setAuth 로 전달.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeInboxPayload, RealtimeMatchStatusPayload, RealtimeMessagePayload, RealtimeStatus } from "@/lib/chat/types";

export type MatchSubscriptionHandlers = {
  onMessage: (m: RealtimeMessagePayload) => void;
  onStatus?: (s: RealtimeStatus) => void;
  onResync?: () => void;
  onMatchStatus?: (p: RealtimeMatchStatusPayload) => void;
};
export type InboxSubscriptionHandlers = {
  onEvent: (e: { kind: "inbox"; payload: RealtimeInboxPayload } | { kind: "match_status"; payload: RealtimeMatchStatusPayload }) => void;
  onStatus?: (s: RealtimeStatus) => void;
  onResync?: () => void;
};

/** 최근 N개 id 를 기억해 재전송·재연결 중복을 걸러낸다 (순수 함수, 테스트 대상) */
export function createDeduper(capacity = 500): { seen: (id: string) => boolean; size: () => number } {
  const ids = new Set<string>();
  const order: string[] = [];
  return {
    seen(id: string): boolean {
      if (ids.has(id)) return true;
      ids.add(id);
      order.push(id);
      if (order.length > capacity) {
        const old = order.shift();
        if (old) ids.delete(old);
      }
      return false;
    },
    size: () => ids.size,
  };
}

/** SUBSCRIBED ↔ CHANNEL_ERROR/TIMED_OUT/CLOSED 전이를 RealtimeStatus 로, 재연결 시 resync 1회 */
export function createStatusTracker(onStatus?: (s: RealtimeStatus) => void, onResync?: () => void) {
  let wasConnected = false;
  let current: RealtimeStatus = "connecting";
  return (state: string) => {
    let next: RealtimeStatus;
    if (state === "SUBSCRIBED") next = "connected";
    else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") next = "polling";
    else next = "connecting";
    if (next === "connected" && wasConnected && current !== "connected") onResync?.();
    if (next === "connected") wasConnected = true;
    if (next !== current) {
      current = next;
      onStatus?.(next);
    }
  };
}

async function setRealtimeAuth(): Promise<void> {
  const supabase = createClient();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
  } catch {
    // 세션 없음: private 채널 join 이 거부된다(정상)
  }
}

function subscribePrivate(topic: string, bind: (ch: RealtimeChannel) => RealtimeChannel, track: (s: string) => void): () => void {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let cancelled = false;
  void setRealtimeAuth().then(() => {
    if (cancelled) return;
    channel = bind(supabase.channel(topic, { config: { private: true, broadcast: { self: false } } }));
    channel.subscribe((state) => track(String(state)));
  });
  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

export function subscribeToMatch(matchId: string, h: MatchSubscriptionHandlers): () => void {
  const dedupe = createDeduper();
  const track = createStatusTracker(h.onStatus, h.onResync);
  return subscribePrivate(
    `match:${matchId}`,
    (ch) =>
      ch
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const m = payload as RealtimeMessagePayload;
          if (!m || typeof m.id !== "string" || m.match_id !== matchId) return;
          if (dedupe.seen(m.id)) return;
          h.onMessage(m);
        })
        .on("broadcast", { event: "match_status" }, ({ payload }) => {
          const p = payload as RealtimeMatchStatusPayload;
          if (p?.match_id === matchId) h.onMatchStatus?.(p);
        }),
    track,
  );
}

export function subscribeToInbox(profileId: string, h: InboxSubscriptionHandlers): () => void {
  const dedupe = createDeduper();
  const track = createStatusTracker(h.onStatus, h.onResync);
  return subscribePrivate(
    `inbox:${profileId}`,
    (ch) =>
      ch
        .on("broadcast", { event: "inbox" }, ({ payload }) => {
          const p = payload as RealtimeInboxPayload;
          if (!p || typeof p.message_id !== "string" || dedupe.seen(p.message_id)) return;
          h.onEvent({ kind: "inbox", payload: p });
        })
        .on("broadcast", { event: "match_status" }, ({ payload }) => {
          const p = payload as RealtimeMatchStatusPayload;
          if (p?.match_id) h.onEvent({ kind: "match_status", payload: p });
        }),
    track,
  );
}
