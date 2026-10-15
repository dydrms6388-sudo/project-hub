"use client";

import { useMemo } from "react";
import { ChatApiProvider } from "../api";
import { ChatListScreen } from "../ChatListScreen";
import { ChatRoomScreen } from "../ChatRoomScreen";
import { createMockChatApi, DEV_MATCH_MINJAE, DEV_ME, DEV_MESSAGES, DEV_ROOMS } from "./mockApi";

export type DevView = "list" | "room";

export function DevChatPlayground({ view, matchId, realtime, scam }: { view: DevView; matchId?: string; realtime?: "connected" | "polling"; scam?: boolean }) {
  const api = useMemo(() => createMockChatApi({ realtime }), [realtime]);
  const id = matchId ?? DEV_MATCH_MINJAE;
  const room = DEV_ROOMS.find((r) => r.match_id === id) ?? DEV_ROOMS[0]!;
  const initialMessages = { items: DEV_MESSAGES[id] ?? [], nextBefore: null };

  return (
    <ChatApiProvider api={api}>
      <div className="mx-auto max-w-md border-x border-border">
        {view === "list" ? (
          <ChatListScreen initial={DEV_ROOMS} myProfileId={DEV_ME} />
        ) : (
          <ChatRoomScreen matchId={id} myProfileId={DEV_ME} initialRoom={{ ...room, partner_scam_banner: Boolean(scam) }} initialMessages={initialMessages} riskBanner={false} compat={82} />
        )}
      </div>
    </ChatApiProvider>
  );
}
