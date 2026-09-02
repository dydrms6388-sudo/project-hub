/**
 * 분석 이벤트 어댑터 (E4 화면 전용). E1 이 `lib/analytics/track.ts` 를 병합하면 이 파일 본문을
 *   export { track } from "@/lib/analytics/track";
 * 한 줄로 교체한다(호출부 변경 없음). 그 전까지는 window.__dmTrack 이 있으면 위임, 없으면 개발 환경 console.debug.
 * 규칙(12_flows §10): 원문 메시지·닉네임·전화번호·사진 경로는 props 에 넣지 않는다.
 */
export type TrackProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    __dmTrack?: (name: string, props?: TrackProps) => void;
  }
}

export function track(name: string, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.__dmTrack === "function") {
      window.__dmTrack(name, props);
      return;
    }
    if (process.env.NODE_ENV !== "production") console.debug("[track]", name, props);
  } catch {
    /* 분석 실패는 화면에 영향 없음 */
  }
}
