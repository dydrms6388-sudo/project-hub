"use client";

// =============================================================================
// E3 · 목록 화면 Realtime (D4 §6.2 subscribeToMatches)
//
// 목록은 서버 컴포넌트가 chat_rooms 뷰로 그린다 — 여기서는 새 메시지/읽음 이벤트가
// 오면 router.refresh() 로 서버 데이터를 다시 받아온다(로컬에서 목록 상태를 흉내내지
// 않는다 = DB 가 단일 진실).
// 대화방에 진입하면 방 화면이 subscribeToMatch 하나로 좁히므로(D4 §6.2 규약),
// 이 컴포넌트는 /chat 목록에서만 마운트한다.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { subscribeToMatches } from "@/lib/chat/realtime";

const REFRESH_THROTTLE_MS = 1500;

export function ChatListLive({ matchIds }: { matchIds: string[] }) {
  const router = useRouter();
  // 배열 새 참조로 인한 재구독을 막기 위해 키로 고정
  const key = matchIds.join(",");

  React.useEffect(() => {
    const ids = key.length > 0 ? key.split(",") : [];
    if (ids.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, REFRESH_THROTTLE_MS);
    };

    const off = subscribeToMatches(ids, { onMessage: refresh, onRead: refresh });
    return () => {
      if (timer !== null) clearTimeout(timer);
      off();
    };
  }, [key, router]);

  return null;
}
