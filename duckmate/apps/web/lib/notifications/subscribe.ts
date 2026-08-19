"use client";

// =============================================================================
// D7 · 푸시 구독 클라이언트 플로우 — 권한 요청 → PushManager 구독 → 서버 등록
//
// 호출 규약 (E1/E4):
//   1) OS 권한 팝업 전에 반드시 프라이머 화면("매칭·궁합 카드 소식을 알려드릴까요?")
//      을 먼저 보여주고, 유저가 수락한 경우에만 subscribeToPush() 를 호출한다
//      (B3 §5.2 · R11 — 첫 실행 즉시 요청 금지).
//   2) 거부(denied) 시 UX 규약: 재요청 팝업을 다시 시도하지 않는다. 알림 설정
//      화면(E4)에서 "브라우저 알림 설정에서 허용으로 바꿀 수 있어요" 안내 +
//      브라우저/OS 설정 딥링크 버튼만 노출. 죄책감·반복 프롬프트 금지.
//   3) 브라우저 푸시 권한 허용 ≠ 광고성 수신동의 (B1 §6-③ E1 지시).
//      광고성 동의는 알림 설정 화면의 별도 토글(saveNotificationPrefs 의
//      marketingConsent)로만 수집한다 — 이 파일은 권한·구독·토큰 등록만 담당.
// =============================================================================

import { getPushAdapter, type PushPermission } from "./adapter";

export type SubscribeResult =
  /** 구독 + 서버 등록 완료 */
  | { status: "subscribed" }
  /** 이 브라우저는 Web Push 미지원 — 안내 문구만, 에러 아님 */
  | { status: "unsupported" }
  /** 유저가 권한 거부 — 재요청 금지, 설정 화면 안내로만 (규약 2) */
  | { status: "denied" }
  /** 팝업을 닫음(default 유지) — 다음 자연스러운 접점에서 프라이머 재노출 가능 */
  | { status: "dismissed" }
  | { status: "error"; message: string };

/** 현재 권한 상태 조회 (프라이머 노출 여부 판단용 — granted 면 프라이머 생략) */
export function getPushPermission(): PushPermission {
  return getPushAdapter().getPermission();
}

/** 이미 구독·등록까지 끝난 상태인지 (알림 설정 화면의 토글 초기값용) */
export async function isPushSubscribed(): Promise<boolean> {
  const adapter = getPushAdapter();
  if (adapter.getPermission() !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * 권한 요청 → 구독 → 서버 등록.
 * 프라이머 화면에서 유저가 "알려주세요"를 누른 직후에만 호출할 것.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  const adapter = getPushAdapter();

  const current = adapter.getPermission();
  if (current === "unsupported") return { status: "unsupported" };
  if (current === "denied") return { status: "denied" };

  let permission: PushPermission;
  try {
    permission = await adapter.requestPermission();
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "권한 요청 실패" };
  }
  if (permission === "denied") return { status: "denied" };
  if (permission !== "granted") return { status: "dismissed" };

  let token: string | null;
  try {
    token = await adapter.getToken();
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "구독 생성 실패" };
  }
  if (!token) return { status: "error", message: "푸시 구독을 만들지 못했어요." };

  // 서버 등록 — /api/push (Route Handler). 실패해도 브라우저 구독은 유지되므로
  // 재시도 시 같은 구독이 멱등 등록된다 (push_tokens (user_id, token) unique).
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: JSON.parse(token) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { status: "error", message: body?.message ?? `토큰 등록 실패 (${res.status})` };
  }
  return { status: "subscribed" };
}

/**
 * 구독 해제: 브라우저 구독 취소 + 서버 토큰 비활성화.
 * (광고성 수신거부와는 별개 — 그것은 marketingConsent 토글이 담당)
 */
export async function unsubscribeFromPush(): Promise<{ ok: boolean; message?: string }> {
  const adapter = getPushAdapter();
  if (adapter.getPermission() === "unsupported") return { ok: true };

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const res = await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) return { ok: false, message: `서버 등록 해제 실패 (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "구독 해제 실패" };
  }
}
