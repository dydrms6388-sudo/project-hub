/**
 * 채팅 분석 이벤트 (12_flows §10 표 + 지시서 추가 이벤트). `@/lib/analytics/track` 단일 진입을 그대로 쓴다.
 * E1 의 `AnalyticsEvent` 유니온에 없는 채팅 이벤트(chat_opened·image_sent·chat_left·suggestion_picker_shown)는
 * 아래 `ChatExtraEvent` 로 두고 호출 시 캐스팅한다 — E1 이 유니온에 4개를 추가하면 캐스팅을 지운다(24_fe_chat §결정).
 * 원문·닉네임·사진 경로는 props 에 넣지 않는다(match_id 는 `hashId()` 해시).
 */
import { track as baseTrack, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/track";

export type ChatExtraEvent = "chat_opened" | "chat_list_viewed" | "image_sent" | "chat_left" | "suggestion_picker_shown";
export type ChatEvent = Extract<AnalyticsEvent, "message_sent" | "message_read" | "conversation_reciprocated" | "suggestion_selected" | "block_submitted"> | ChatExtraEvent;

export function trackChat(event: ChatEvent, props: AnalyticsProps = {}): void {
  baseTrack(event as AnalyticsEvent, props);
}
