/**
 * 분석 이벤트 어댑터 (E4 화면 전용) — E1 `lib/analytics/track.ts` 에 위임한다(import 만, 12_flows §10 단일 진입).
 * E1 union 에 없는 E4 뷰 이벤트(아래 E4ViewEvent)는 병합 요청 항목이며, 그 전까지는 같은 dataLayer 경로로 흘려보낸다.
 * 규칙: 원문 메시지·닉네임·전화번호·사진 경로는 props 에 넣지 않는다(E1 어댑터가 금지 키를 한 번 더 제거).
 */
import { track as baseTrack, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/track";

/** E1 union 병합 요청 대상 (E4 화면 뷰·부가 액션) */
export type E4ViewEvent =
  | "me_viewed"
  | "settings_viewed"
  | "verify_center_viewed"
  | "notification_settings_viewed"
  | "report_opened"
  | "data_export_downloaded"
  | "photo_uploaded"
  | "photo_deleted"
  | "unblock_submitted"
  | "appeal_submitted"
  | "logged_out";

export type TrackProps = AnalyticsProps;

export function track(name: AnalyticsEvent | E4ViewEvent, props: TrackProps = {}): void {
  baseTrack(name as AnalyticsEvent, props);
}
