// sw.js — 최소 오프라인 우선 서비스워커(허브 SDK 공용 템플릿).
// 정적 자산은 stale-while-revalidate, 내비게이션은 네트워크 우선+오프라인 폴백.
// 인증/결제/동적 API 는 캐시하지 않는다.
const CACHE = "hub-pwa-v1";
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 인증/결제/API 는 항상 네트워크(캐시 금지).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data") ||
    url.hostname !== self.location.hostname
  ) {
    return;
  }

  // 내비게이션: 네트워크 우선, 실패 시 오프라인 폴백.
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // 정적 자산: stale-while-revalidate.
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
