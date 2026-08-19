/* =============================================================================
 * 덕메이트(DuckMate) · D7 서비스워커 — Web Push 수신 · 알림 표시 · 딥링크 라우팅
 *
 * 순수 JS(빌드 대상 아님). `apps/web/tsconfig.json` 의 include 는 ts/tsx 글롭만
 * 잡으므로 이 파일은 타입체크·번들에 포함되지 않는다 (allowJs:true 지만 include 밖).
 * 등록 경로는 `/sw.js` = scope `/` — lib/notifications/adapter.ts 의 SW_PATH 와 동일.
 *
 * ⚠️ fetch 핸들러 없음 = 오프라인 캐싱 미도입(Phase 1). 푸시 전용 워커다.
 *    캐싱/오프라인은 Phase 4 Capacitor 전환 때 재검토 (문서 20 §7).
 *
 * 수신 페이로드는 push-dispatch/copy.ts 의 PushPayloadV1 과 1:1 대응한다:
 *   { v:1, kind, slot, title, body, deeplink, tag, unsubscribePath? }
 *   · deeplink       = 경로 기반 상대 라우트 (B3 §5.1 — 해시/쿼리 화면전환 금지)
 *   · unsubscribePath= 광고성(is_marketing)일 때만 존재 → 수신거부 액션 버튼 노출
 * ========================================================================== */

"use strict";

/** 페이로드 스키마 버전 — 서버(copy.ts PushPayloadV1.v)와 맞춘다 */
const PAYLOAD_VERSION = 1;

/** 폴백 카피 — data 없는 push(브라우저 테스트·스키마 불일치)에도 알림은 반드시 뜬다.
 *  (userVisibleOnly:true 구독은 무알림 수신이 반복되면 구독이 해지될 수 있음) */
const FALLBACK = {
  title: "덕메이트",
  body: "새 소식이 도착했어요.",
  deeplink: "/home",
  tag: "duckmate-generic",
};

const ICON = "/icons/notification-192.png";
const BADGE = "/icons/badge-72.png";

/* ---------------------------------------------------------------------------
 * 라이프사이클 — 새 워커를 즉시 활성화해 카피/라우팅 수정이 다음 푸시부터 반영되게
 * ------------------------------------------------------------------------ */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ---------------------------------------------------------------------------
 * 유틸
 * ------------------------------------------------------------------------ */

/** 페이로드 파싱 + 최소 검증. 형식이 어긋나면 폴백으로 낮춰 표시한다. */
function parsePayload(event) {
  if (!event.data) return { ...FALLBACK, kind: "unknown", slot: "system" };
  let raw = null;
  try {
    raw = event.data.json();
  } catch {
    const text = typeof event.data.text === "function" ? event.data.text() : "";
    return { ...FALLBACK, body: text || FALLBACK.body, kind: "unknown", slot: "system" };
  }
  if (!raw || typeof raw !== "object") {
    return { ...FALLBACK, kind: "unknown", slot: "system" };
  }
  // v 불일치 = 서버가 앞서 나간 상태. 알림은 띄우되 알려진 필드만 신뢰한다.
  const version = typeof raw.v === "number" ? raw.v : PAYLOAD_VERSION;
  return {
    v: version,
    kind: typeof raw.kind === "string" ? raw.kind : "unknown",
    slot: typeof raw.slot === "string" ? raw.slot : "system",
    title: typeof raw.title === "string" && raw.title ? raw.title : FALLBACK.title,
    body: typeof raw.body === "string" && raw.body ? raw.body : FALLBACK.body,
    deeplink: sanitizePath(raw.deeplink) || FALLBACK.deeplink,
    tag: typeof raw.tag === "string" && raw.tag ? raw.tag : FALLBACK.tag,
    unsubscribePath: sanitizePath(raw.unsubscribePath) || undefined,
  };
}

/**
 * 경로 기반 딥링크만 허용 — "/" 로 시작하는 내부 상대경로가 아니면 버린다.
 * (절대 URL·`//evil.com`·`javascript:` 주입 차단. B3 §5.1 경로 규약과 동일 선상)
 */
function sanitizePath(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

/** 광고성 여부 = 수신거부 경로 동반 여부 (copy.ts buildPayload 규약) */
function isMarketing(payload) {
  return typeof payload.unsubscribePath === "string" && payload.unsubscribePath.length > 0;
}

/** 열려 있는 같은 오리진의 창 클라이언트 목록 */
async function windowClients() {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return list.filter((c) => {
    try {
      return new URL(c.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
}

/** 포그라운드 클라이언트에 브로드캐스트 (adapter.onMessage / E그룹 리스너가 수신) */
async function broadcast(message) {
  const list = await windowClients();
  for (const client of list) client.postMessage(message);
  return list;
}

/* ---------------------------------------------------------------------------
 * push — 알림 표시 + 포그라운드 중계
 * ------------------------------------------------------------------------ */
self.addEventListener("push", (event) => {
  const payload = parsePayload(event);

  const actions = [];
  if (isMarketing(payload)) {
    // 정보통신망법 §50 — 광고성은 수신거부 경로를 즉시 제공 (제목의 "(광고)" 접두는 서버가 부착)
    actions.push({ action: "unsubscribe", title: "알림 설정" });
  }

  const options = {
    body: payload.body,
    // 같은 슬롯의 알림은 쌓이지 않고 최신 1건으로 대체된다 (일 2건 상한 체감 유지)
    tag: payload.tag,
    renotify: false,
    // 진동/사운드로 재촉하지 않는다 — C1 톤 규약(죄책감·조바심 금지)의 연장
    silent: false,
    requireInteraction: false,
    icon: ICON,
    badge: BADGE,
    actions,
    data: {
      v: payload.v,
      kind: payload.kind,
      slot: payload.slot,
      deeplink: payload.deeplink,
      unsubscribePath: payload.unsubscribePath ?? null,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, options);
      // 포그라운드에서 앱을 보고 있는 경우 인앱 뱃지/토스트 갱신용 중계
      // (adapter.ts WebPushAdapter.onMessage 가 이 type 을 구독한다 — 이름 고정)
      await broadcast({ type: "duckmate:push", payload });
    })()
  );
});

/* ---------------------------------------------------------------------------
 * notificationclick — 딥링크 라우팅
 *
 * 규약 (E그룹 계약):
 *   ① 앱 창이 이미 열려 있으면 → focus() + postMessage("duckmate:push-open").
 *      SW 가 직접 navigate 하지 않는다 (SPA 상태·스크롤 보존). 실제 이동은
 *      루트 레이아웃의 리스너가 router.push(deeplink) 로 수행한다.
 *   ② 열린 창이 없으면 → openWindow(deeplink + "?pn=<kind>").
 *      진입 화면이 `pn` 쿼리를 읽어 push_open 계측 후 history.replaceState 로 제거한다.
 *      (쿼리는 계측 마커일 뿐 화면 전환 수단이 아니므로 B3 §5.1 위배 아님)
 * ------------------------------------------------------------------------ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const kind = typeof data.kind === "string" ? data.kind : "unknown";
  const slot = typeof data.slot === "string" ? data.slot : "system";
  const isUnsubscribe = event.action === "unsubscribe";
  const target =
    (isUnsubscribe ? sanitizePath(data.unsubscribePath) : sanitizePath(data.deeplink)) ||
    FALLBACK.deeplink;

  event.waitUntil(
    (async () => {
      const message = {
        type: "duckmate:push-open",
        payload: { kind, slot, deeplink: target, action: event.action || "open" },
      };

      const list = await windowClients();
      if (list.length > 0) {
        // 이미 포커스된 창을 우선, 없으면 첫 번째 창
        const client = list.find((c) => c.focused) || list[0];
        try {
          if (typeof client.focus === "function") await client.focus();
        } catch {
          /* 포커스 거부(브라우저 정책) — 메시지는 그대로 보낸다 */
        }
        client.postMessage(message);
        return;
      }

      // 콜드 스타트: 계측 마커를 붙여 새 창을 연다
      const url = new URL(target, self.location.origin);
      url.searchParams.set("pn", kind);
      await self.clients.openWindow(url.pathname + url.search);
    })()
  );
});

/* ---------------------------------------------------------------------------
 * pushsubscriptionchange — 브라우저가 구독을 갱신/폐기했을 때 서버 동기화
 *
 * 옛 endpoint 는 DELETE 로 비활성화, 새 구독은 POST 로 재등록한다. 세션 쿠키가
 * 없는 상태(로그아웃)면 401 이 나고 조용히 끝난다 — 다음 로그인 시
 * subscribe.ts 가 같은 구독을 멱등 등록한다.
 * ------------------------------------------------------------------------ */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldSubscription = event.oldSubscription || null;
      const oldEndpoint = oldSubscription ? oldSubscription.endpoint : null;

      let newSubscription = event.newSubscription || null;
      if (!newSubscription) {
        // 서버 VAPID 공개키는 SW 가 모르므로 이전 구독의 applicationServerKey 를 재사용
        const key =
          oldSubscription && oldSubscription.options
            ? oldSubscription.options.applicationServerKey
            : null;
        if (key) {
          try {
            newSubscription = await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            });
          } catch {
            newSubscription = null;
          }
        }
      }

      if (oldEndpoint) {
        await fetch("/api/push", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: oldEndpoint }),
        }).catch(() => undefined);
      }

      if (newSubscription) {
        await fetch("/api/push", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: newSubscription.toJSON() }),
        }).catch(() => undefined);
      } else {
        // 재구독 실패 → 앱이 떠 있으면 클라이언트에게 재구독을 위임
        await broadcast({ type: "duckmate:push-resubscribe" });
      }
    })()
  );
});

/* ---------------------------------------------------------------------------
 * message — 페이지에서 워커로 (배포 직후 즉시 교체 트리거)
 * ------------------------------------------------------------------------ */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "duckmate:skip-waiting") self.skipWaiting();
});
