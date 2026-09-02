"use client";

/**
 * ChatApi 컨텍스트(경량). `api.tsx` 의 `realChatApi` 는 Realtime(Supabase 브라우저 클라이언트 ~52KB gz) 을 정적으로 끌어오므로
 * 채팅 밖 화면(E2 `/match/[id]` 의 SuggestionPicker)이 컨텍스트만 필요할 때는 이 파일을 import 한다(H2).
 * 값이 null 이면 호출자가 기본 서버 액션으로 폴백한다(`api.tsx` useChatApi 는 realChatApi 로 폴백).
 */
import { createContext, useContext } from "react";
import type { ChatApi } from "./api";

export const ChatApiContext = createContext<ChatApi | null>(null);

/** 주입된 ChatApi 또는 null (Provider 밖) */
export function useOptionalChatApi(): ChatApi | null {
  return useContext(ChatApiContext);
}
