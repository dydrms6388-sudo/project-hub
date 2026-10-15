// =============================================================================
// D7 · PushAdapter — 플랫폼별 푸시 클라이언트 추상화 (B3 §5.2 규약 그대로)
//
// interface: getPermission() / requestPermission() / getToken() / onMessage()
//   · Phase 1: WebPushAdapter (VAPID Web Push)
//   · Phase 4: NativePushAdapter (FCM/APNs via Capacitor) — 자리만 확보.
//     화면(E4 알림 설정)과 subscribe.ts 는 어댑터 인터페이스만 참조하므로
//     전환 시 getPushAdapter() 의 분기 1곳 외 무수정이다.
//
// 브라우저 전용 모듈 — 서버 컴포넌트에서 import 하지 말 것.
// =============================================================================

export type PushPermission = "granted" | "denied" | "default" | "unsupported";

export interface PushAdapter {
  readonly platform: "web" | "ios" | "android";
  /** 현재 권한 상태 (unsupported = 이 브라우저/런타임이 푸시 미지원) */
  getPermission(): PushPermission;
  /**
   * OS 권한 팝업 요청. 반드시 프라이머 화면 수락 후에만 호출할 것 (B3 R11 —
   * 첫 실행 즉시 요청 금지). 'denied' 상태에서 재호출해도 팝업은 다시 뜨지 않는다.
   */
  requestPermission(): Promise<PushPermission>;
  /**
   * 발송용 토큰 획득 (권한 granted 전제).
   * web: PushSubscription.toJSON() 의 JSON 문자열 / 네이티브: FCM·APNs 토큰.
   */
  getToken(): Promise<string | null>;
  /** 포그라운드 수신 핸들러 등록. 반환값 = 해제 함수 */
  onMessage(handler: (payload: unknown) => void): () => void;
}

// ---------------------------------------------------------------------------
// base64url → Uint8Array (applicationServerKey 용)
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const SW_PATH = "/sw.js";

// ---------------------------------------------------------------------------
// WebPushAdapter — Phase 1 구현
// ---------------------------------------------------------------------------
class WebPushAdapter implements PushAdapter {
  readonly platform = "web" as const;

  private supported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  getPermission(): PushPermission {
    if (!this.supported()) return "unsupported";
    return Notification.permission as PushPermission;
  }

  async requestPermission(): Promise<PushPermission> {
    if (!this.supported()) return "unsupported";
    // denied 는 브라우저가 팝업을 다시 띄우지 않는다 — 재요청은 설정 화면의
    // OS/브라우저 설정 안내로만 (subscribe.ts UX 규약 참조)
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    return result as PushPermission;
  }

  async getToken(): Promise<string | null> {
    if (!this.supported() || Notification.permission !== "granted") return null;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY 미설정 — 구독 불가");
      return null;
    }
    const registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }));
    return JSON.stringify(subscription.toJSON());
  }

  onMessage(handler: (payload: unknown) => void): () => void {
    if (!this.supported()) return () => undefined;
    // sw.js 가 포그라운드 클라이언트에 postMessage 로 중계한 push 페이로드 수신
    const listener = (event: MessageEvent) => {
      if (event.data?.type === "duckmate:push") handler(event.data.payload);
    };
    navigator.serviceWorker.addEventListener("message", listener);
    return () => navigator.serviceWorker.removeEventListener("message", listener);
  }
}

// ---------------------------------------------------------------------------
// NativePushAdapter — Phase 4 자리 (FCM/APNs · Capacitor)
// B3 규약: 발송 정책(슬롯·상한·카피)은 서버 공통 계층이므로 여기는 토큰/권한만.
// ---------------------------------------------------------------------------
class NativePushAdapter implements PushAdapter {
  constructor(readonly platform: "ios" | "android") {}
  getPermission(): PushPermission {
    return "unsupported";
  }
  requestPermission(): Promise<PushPermission> {
    return Promise.reject(new Error("NativePushAdapter 는 Phase 4(Capacitor)에서 구현된다."));
  }
  getToken(): Promise<string | null> {
    return Promise.reject(new Error("NativePushAdapter 는 Phase 4(Capacitor)에서 구현된다."));
  }
  onMessage(): () => void {
    return () => undefined;
  }
}

/**
 * 런타임별 어댑터 팩토리 — 직접 new 금지, 항상 이 함수 경유 (E-1 getRuntime 규약).
 * Phase 4: Capacitor.getPlatform() 연결 시 이 분기만 바뀐다.
 */
export function getPushAdapter(): PushAdapter {
  const runtime: "web" | "ios" | "android" = "web"; // Phase 4: getRuntime() 연결
  if (runtime === "web") return new WebPushAdapter();
  return new NativePushAdapter(runtime);
}
