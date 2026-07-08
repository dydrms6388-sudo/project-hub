/* 스터디서클 서비스워커 — 앱 셸 캐시(오프라인에서도 앱이 열리도록) */
const CACHE = "teen-study-circle-v1";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest",
  "./favicon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 같은 스코프 GET: 캐시 우선 + 백그라운드 갱신(stale-while-revalidate) */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/teen-study-circle")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      // 네트워크 실패는 여기서 항상 흡수해 null로 정리한다. 캐시 히트일 때는(cached 분기)
      // 이 network 프로미스를 기다리지 않고 버려서 백그라운드 갱신으로만 쓴다.
      const network = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => null);
      if (cached) return cached; // stale-while-revalidate: 캐시를 즉시 응답, network는 백그라운드 갱신용
      // 캐시 미스: 네트워크 응답을 기다린다. 실패 시(오프라인) 내비게이션 요청은 캐시된
      // 앱 셸(index.html)로, 그 외 요청은 최소한의 오류 응답으로 대체해 respondWith가
      // 항상 유효한 Response를 받도록 한다.
      return network.then((res) => {
        if (res) return res;
        if (e.request.mode === "navigate") return caches.match("./index.html").then((idx) => idx || Response.error());
        return new Response("", { status: 503, statusText: "Offline" });
      });
    })
  );
});
