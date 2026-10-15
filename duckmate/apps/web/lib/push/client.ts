/**
 * 브라우저 헬퍼 (클라이언트 컴포넌트에서 호출). 서버 import 없음.
 *
 *   const r = await enablePush();                      // sw 등록 → 권한 → 구독 (한 번에)
 *   if (r.status === "granted" && r.subscription) await subscribePush({ subscription: r.subscription });   // 서버 액션
 *
 * 권한 요청 타이밍 규칙(E1/E2): 브라우저 프롬프트는 반드시 사용자 제스처(버튼) 안에서, 소프트 배너(C1 #34) 뒤에.
 * 하루 1회, 거부(denied) 후에는 다시 묻지 않고 인앱 배너만(PRD §4.8).
 */
import type { PushSubscriptionInput } from "./schemas";

export const SW_PATH = "/sw.js";
export const PUSH_PERMISSION_PROMPTED_KEY = "dm_push_prompted_on"; // localStorage: 마지막 소프트 배너 노출 loop_date

export type PermissionState = NotificationPermission | "unsupported";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getPermissionState(): PermissionState {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** NEXT_PUBLIC_VAPID_PUBLIC_KEY (빌드 시 인라인). 없으면 null → 푸시 기능 비활성 */
export function vapidPublicKeyFromEnv(): string | null {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return k && k.trim().length > 0 ? k.trim() : null;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(path: string = SW_PATH): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(path, { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn("[push] service worker register failed", e);
    return null;
  }
}

/** 브라우저 프롬프트. 사용자 제스처 안에서만 호출할 것 */
export async function requestPermission(): Promise<PermissionState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH).catch(() => undefined);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export function serializeSubscription(sub: PushSubscription): PushSubscriptionInput | null {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: { p256dh, auth } };
}

/** 권한이 이미 granted 인 상태에서 구독 생성(없으면 새로) */
export async function subscribeBrowser(vapidPublicKey: string): Promise<PushSubscriptionInput | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return serializeSubscription(existing);
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource });
  return serializeSubscription(sub);
}

/** 브라우저 구독 해제. 반환 = 해제된 endpoint (서버 unsubscribePush 에 넘긴다) */
export async function unsubscribeBrowser(): Promise<string | null> {
  const sub = await getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* 이미 만료 */
  }
  return endpoint;
}

export type EnablePushResult = { status: PermissionState; subscription?: PushSubscriptionInput; reason?: "no_vapid_key" | "subscribe_failed" | "sw_failed" };

/** sw 등록 → 권한 요청 → 구독. 버튼 핸들러 안에서 호출 */
export async function enablePush(vapidPublicKey: string | null = vapidPublicKeyFromEnv()): Promise<EnablePushResult> {
  if (!isPushSupported()) return { status: "unsupported" };
  if (!vapidPublicKey) return { status: getPermissionState(), reason: "no_vapid_key" };
  const reg = await registerServiceWorker();
  if (!reg) return { status: getPermissionState(), reason: "sw_failed" };
  const perm = await requestPermission();
  if (perm !== "granted") return { status: perm };
  try {
    const subscription = await subscribeBrowser(vapidPublicKey);
    return subscription ? { status: "granted", subscription } : { status: "granted", reason: "subscribe_failed" };
  } catch (e) {
    console.warn("[push] subscribe failed", e);
    return { status: "granted", reason: "subscribe_failed" };
  }
}

/** 소프트 배너 하루 1회 노출 게이트 (loop_date 문자열을 넘긴다) */
export function shouldShowPermissionBanner(loopDate: string): boolean {
  if (!isPushSupported() || Notification.permission !== "default") return false;
  try {
    return window.localStorage.getItem(PUSH_PERMISSION_PROMPTED_KEY) !== loopDate;
  } catch {
    return true;
  }
}

export function markPermissionBannerShown(loopDate: string): void {
  try {
    window.localStorage.setItem(PUSH_PERMISSION_PROMPTED_KEY, loopDate);
  } catch {
    /* 저장 불가 환경 */
  }
}
