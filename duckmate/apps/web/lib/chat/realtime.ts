"use client";

// =============================================================================
// D4 · 채팅 Realtime 구독 헬퍼 (apps/web/lib/chat/realtime.ts)
//
// 전송 방식 = **Broadcast 전용**. postgres_changes 는 쓰지 않는다(00009 결정).
//   messages 는 supabase_realtime 퍼블리케이션에 등록돼 있지 않으며, 서버 트리거가
//   masked_body 등 화이트리스트 컬럼만 담아 `realtime.send()` 로 쏜다.
//   → 원문 body·mask_rules 는 어떤 이벤트에도 존재하지 않는다.
//
// 채널: topic = `match:{matchId}`, private = true.
//   private 채널이므로 소켓에 유저 JWT 가 실려야 한다 → subscribe 전에
//   `supabase.realtime.setAuth()` 를 호출한다. 인가는 realtime.messages RLS
//   (can_access_match_topic) 가 판정하며, **클라이언트는 broadcast 를 보낼 수 없다**
//   (insert 정책 없음 = 이벤트 위조 불가). 따라서 수신 payload 는 서버산으로 신뢰 가능.
//
// 재연결 규약:
//   broadcast 는 at-most-once — 끊긴 동안의 메시지는 재생되지 않는다.
//   재구독에 성공하면 onResync(lastMessageId) 가 호출되므로, 호출자는 반드시
//   서버의 getMessagesSince(matchId, lastId) 로 갭을 메워야 한다(E3 규약).
// =============================================================================

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// 이벤트 페이로드 (00009 트리거 / send-message Edge Function 이 만드는 형태)
// ---------------------------------------------------------------------------

/** trg_messages_broadcast_insert — 컬럼 화이트리스트와 1:1 */
export interface NewMessageEvent {
  id: number;
  match_id: string;
  sender_id: string | null;
  masked_body: string;
  image_path: string | null;
  read_at: string | null;
  created_at: string;
}

/** trg_messages_broadcast_read — 문장 단위 1회 (mark_read 일괄 처리) */
export interface MessageReadEvent {
  match_id: string;
  /** 읽은 사람(= 상대). service role 경로면 null */
  reader_id: string | null;
  /** 이 id 이하의 내 메시지를 읽음 처리하면 된다 */
  up_to_id: number;
  read_at: string;
  count: number;
}

/** send-message Edge Function 이 WARN/QUEUE 시 수신자에게 쏘는 안전 카드 (A5 §5.2) */
export interface SafetyCardEvent {
  match_id: string;
  card: "money" | "invest" | "sexual";
  /** 이 프로필에게만 노출한다 — 발신자 화면에는 띄우지 않는다 */
  for_profile_id: string;
  message_id: number | null;
}

export type ChatConnectionStatus =
  | "connecting"
  | "subscribed"
  | "reconnecting"
  | "closed";

export interface ChatSubscriptionHandlers {
  onMessage?: (event: NewMessageEvent) => void;
  onRead?: (event: MessageReadEvent) => void;
  onSafetyCard?: (event: SafetyCardEvent) => void;
  onStatus?: (status: ChatConnectionStatus) => void;
  /**
   * 재구독 성공 시(최초 구독 제외) 호출. 호출자는 서버 액션으로
   * getMessagesSince(matchId, lastSeenId) 를 불러 누락분을 채운다.
   */
  onResync?: () => void;
}

export interface ChatSubscriptionOptions extends ChatSubscriptionHandlers {
  /** 테스트/SSR 회피용 주입구. 기본은 브라우저 Supabase 클라이언트 */
  client?: SupabaseClient;
}

// ---------------------------------------------------------------------------
// 재연결 백오프 (1s → 2s → 4s → 8s → 15s 상한, ±20% 지터)
// ---------------------------------------------------------------------------

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 15000;

function backoffDelay(attempt: number): number {
  const raw = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(attempt - 1, 0), BACKOFF_MAX_MS);
  const jitter = raw * 0.2 * (Math.random() * 2 - 1);
  return Math.round(raw + jitter);
}

// ---------------------------------------------------------------------------
// subscribeToMatch — 대화방 1개 구독
// ---------------------------------------------------------------------------

/**
 * 반환값을 호출하면 구독이 완전히 정리된다(useEffect cleanup 에 그대로 반환).
 * 같은 matchId 로 두 번 호출하면 채널이 2개 열리므로, 컴포넌트당 1회만 호출할 것.
 */
export function subscribeToMatch(
  matchId: string,
  options: ChatSubscriptionOptions = {},
): () => void {
  if (typeof window === "undefined") return () => {};

  const supabase = options.client ?? createClient();
  const topic = `match:${matchId}`;

  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let hadSubscribed = false;
  let disposed = false;

  const setStatus = (status: ChatConnectionStatus) => options.onStatus?.(status);

  const clearRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const teardown = () => {
    if (channel) {
      const c = channel;
      channel = null;
      void supabase.removeChannel(c);
    }
  };

  const scheduleRetry = () => {
    if (disposed || retryTimer !== null) return;
    attempt += 1;
    setStatus("reconnecting");
    retryTimer = setTimeout(() => {
      retryTimer = null;
      teardown();
      void connect();
    }, backoffDelay(attempt));
  };

  async function connect(): Promise<void> {
    if (disposed) return;
    setStatus(hadSubscribed ? "reconnecting" : "connecting");

    // private 채널: 소켓에 최신 JWT 를 실어 준다(토큰 갱신 후 재구독 시에도 필수)
    try {
      await supabase.realtime.setAuth();
    } catch {
      // 세션이 아직 준비되지 않았어도 subscribe 실패 → 백오프 재시도로 흡수
    }
    if (disposed) return;

    const next = supabase.channel(topic, { config: { private: true } });

    next.on("broadcast", { event: "new_message" }, ({ payload }) => {
      options.onMessage?.(payload as NewMessageEvent);
    });
    next.on("broadcast", { event: "message_read" }, ({ payload }) => {
      options.onRead?.(payload as MessageReadEvent);
    });
    next.on("broadcast", { event: "safety_card" }, ({ payload }) => {
      options.onSafetyCard?.(payload as SafetyCardEvent);
    });

    next.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        clearRetry();
        attempt = 0;
        setStatus("subscribed");
        if (hadSubscribed) options.onResync?.();
        hadSubscribed = true;
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        scheduleRetry();
      }
    });

    channel = next;
  }

  // 탭 복귀·네트워크 복구 시 백오프를 기다리지 않고 즉시 재시도
  const onWake = () => {
    if (disposed) return;
    if (document.visibilityState === "hidden") return;
    if (channel && channel.state === "joined") return;
    clearRetry();
    attempt = 0;
    teardown();
    void connect();
  };

  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", onWake);

  void connect();

  return () => {
    disposed = true;
    clearRetry();
    window.removeEventListener("online", onWake);
    document.removeEventListener("visibilitychange", onWake);
    teardown();
    setStatus("closed");
  };
}

// ---------------------------------------------------------------------------
// subscribeToMatches — /chat 목록·탭 배지용 다중 구독
// ---------------------------------------------------------------------------

/**
 * 열려 있는 대화방 전부를 구독해 목록의 마지막 메시지·안읽음 배지를 갱신한다.
 * 방 수가 많아지면 채널 수도 같이 늘어나므로, 목록 화면에서만 사용하고
 * 대화방 진입 시에는 subscribeToMatch 하나로 좁힐 것(E3 규약).
 */
export function subscribeToMatches(
  matchIds: readonly string[],
  options: ChatSubscriptionOptions = {},
): () => void {
  const unsubscribers = matchIds.map((id) => subscribeToMatch(id, options));
  return () => {
    for (const off of unsubscribers) off();
  };
}
