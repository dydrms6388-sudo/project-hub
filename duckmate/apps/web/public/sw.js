/* 덕메이트 서비스워커 — Web Push 전용 (캐싱 없음)
 * payload(v1): { title, body, url, tag, kind, slot, template, qid, icon, badge }  ← apps/web/lib/push/templates.ts buildPayload
 *  - push               → 알림 표시 (같은 tag 는 교체 = 뭉침 UX)
 *  - notificationclick  → /api/push/opened 보고 후 딥링크(?src=push&slot=&t=) 로 포커스/열기
 *  - pushsubscriptionchange → 같은 VAPID 키로 재구독 후 /api/push/subscribe 에 저장
 */
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-72.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePayload(event) {
  if (!event.data) return { title: "새 알림", body: "", url: "/home", tag: "dm-generic", qid: null };
  try {
    const json = event.data.json();
    if (json && typeof json === "object" && typeof json.title === "string") return json;
  } catch (_) {
    /* text fallback */
  }
  let text = "";
  try {
    text = event.data.text();
  } catch (_) {
    /* ignore */
  }
  return { title: "새 알림", body: text.slice(0, 120), url: "/home", tag: "dm-generic", qid: null };
}

self.addEventListener("push", (event) => {
  const p = parsePayload(event);
  const options = {
    body: typeof p.body === "string" ? p.body : "",
    icon: p.icon || DEFAULT_ICON,
    badge: p.badge || DEFAULT_BADGE,
    tag: typeof p.tag === "string" ? p.tag : "dm-generic",
    renotify: false,
    lang: "ko",
    data: { url: typeof p.url === "string" ? p.url : "/home", qid: typeof p.qid === "number" ? p.qid : null, slot: p.slot || null, template: p.template || null },
  };
  event.waitUntil(self.registration.showNotification(p.title, options));
});

function buildTargetUrl(data) {
  let path = data && typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/home";
  const url = new URL(path, self.location.origin);
  url.searchParams.set("src", "push"); // E5 analytics: app_opened{source:push, push_slot}
  if (data && data.slot) url.searchParams.set("slot", String(data.slot));
  if (data && data.template) url.searchParams.set("t", String(data.template));
  return url.href;
}

async function reportOpened(qid) {
  if (!qid) return;
  try {
    await fetch("/api/push/opened", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qid }),
    });
  } catch (_) {
    /* 지표 누락만 */
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = buildTargetUrl(data);
  event.waitUntil(
    (async () => {
      await reportOpened(data.qid);
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          if (new URL(client.url).origin === self.location.origin && "focus" in client) {
            if ("navigate" in client) await client.navigate(target);
            return client.focus();
          }
        } catch (_) {
          /* next client */
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = (old && old.options && old.options.applicationServerKey) || null;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: self.navigator.userAgent, previousEndpoint: old ? old.endpoint : undefined }),
      });
    })(),
  );
});
