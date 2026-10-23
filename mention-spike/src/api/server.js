// API + 실시간 UI 서버 (SSE). 의존성 없는 node:http.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRedis, K, ALERT_GROUP } from "../redis.js";
import { config } from "../config.js";
import { audit, readAudit } from "../audit.js";
import { getUser, listUsers, saveUser, deleteUser } from "../settings.js";
import { ingestEvent, markSource, readSources } from "../ingest/pipeline.js";
import { deliverJob } from "../notify/deliver.js";

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
async function readBody(req, limit = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid json"), { status: 400 }); }
}

export function createApp({ redis, subscriber, token = config.api.token, ingestToken = config.api.ingestToken }) {
  const clients = new Set();
  subscriber.subscribe(K.updates());
  subscriber.on("message", (_ch, msg) => {
    for (const res of clients) res.write(`data: ${msg}\n\n`);
  });

  const authed = (req, url) => {
    if (!token) return true;
    const h = req.headers.authorization || "";
    const t = h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("token") || "";
    return safeEq(t, token);
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    try {
      if (req.method === "GET" && (path === "/" || path === "/index.html")) {
        const html = await readFile(join(config.publicDir, "index.html"));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      if (path === "/healthz") return json(res, 200, { ok: true, redis: redis.status });

      // 외부 수집 파이프라인 push (공식 API 웹훅/스트리밍을 별도 프로세스로 받는 경우)
      if (req.method === "POST" && path === "/api/ingest") {
        const h = req.headers.authorization || "";
        if (!ingestToken || !safeEq(h.replace(/^Bearer /, ""), ingestToken)) return json(res, 401, { error: "unauthorized" });
        const body = await readBody(req, 5_000_000);
        const source = String(body.source || "");
        if (!/^[a-z0-9_-]{1,32}$/.test(source)) return json(res, 400, { error: "source: 소문자/숫자/-/_ 1~32자" });
        const events = Array.isArray(body.events) ? body.events.slice(0, 1000) : [];
        let accepted = 0;
        const dropped = {};
        for (const ev of events) {
          const r = await ingestEvent(redis, source, ev);
          if (r.accepted.length) accepted++;
          else if (r.dropped) dropped[r.dropped] = (dropped[r.dropped] || 0) + 1;
        }
        await markSource(redis, source, { ok: true, pollIntervalSec: body.pollIntervalSec ?? null, policy: String(body.policy || "push ingest").slice(0, 200), fetched: events.length });
        return json(res, 200, { received: events.length, accepted, dropped });
      }

      if (!path.startsWith("/api/")) return json(res, 404, { error: "not found" });
      if (!authed(req, url)) return json(res, 401, { error: "unauthorized" });

      if (req.method === "GET" && path === "/api/stream") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        const snap = await redis.get(K.snapshot());
        if (snap) res.write(`data: ${JSON.stringify({ type: "snapshot", snapshot: JSON.parse(snap) })}\n\n`);
        clients.add(res);
        const hb = setInterval(() => res.write(": hb\n\n"), 15000);
        req.on("close", () => { clearInterval(hb); clients.delete(res); });
        return;
      }
      if (req.method === "GET" && path === "/api/snapshot") {
        const snap = await redis.get(K.snapshot());
        return json(res, 200, snap ? JSON.parse(snap) : null);
      }
      if (req.method === "GET" && path === "/api/sources") return json(res, 200, await readSources(redis));
      if (req.method === "GET" && path === "/api/coins") return json(res, 200, config.coins);
      if (req.method === "GET" && path === "/api/queue") {
        const [len, dead] = await Promise.all([redis.xlen(K.alertQueue()), redis.xlen(K.alertDlq())]);
        let pending = 0;
        try { pending = (await redis.xpending(K.alertQueue(), ALERT_GROUP))[0]; } catch {}
        return json(res, 200, { length: len, pending, deadLetter: dead });
      }
      if (req.method === "GET" && path === "/api/audit") {
        const count = Math.min(500, Number(url.searchParams.get("count") || 100));
        return json(res, 200, await readAudit(redis, { count, type: url.searchParams.get("type") || undefined, before: url.searchParams.get("before") || undefined }));
      }
      if (req.method === "GET" && path === "/api/users") return json(res, 200, await listUsers(redis));

      const m = path.match(/^\/api\/users\/([^/]+)(\/test-alert)?$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (m[2] && req.method === "POST") {
          const user = await getUser(redis, id);
          if (!user) return json(res, 404, { error: "user not found" });
          const body = await readBody(req);
          const channels = Array.isArray(body.channels) && body.channels.length ? body.channels.filter(c => c === "telegram" || c === "email") : ["telegram", "email"];
          const job = { test: true, jobKey: `test:${id}:${Date.now()}`, user: id, coin: "TEST", at: Date.now(), windowSec: config.windowSec };
          await audit(redis, "alert.test_requested", { user: id, channels });
          const r = await deliverJob(redis, job, { channels });
          return json(res, 200, r.results);
        }
        if (req.method === "GET") {
          const u = await getUser(redis, id);
          return u ? json(res, 200, { id, ...u }) : json(res, 404, { error: "user not found" });
        }
        if (req.method === "PUT") {
          const r = await saveUser(redis, id, await readBody(req), { actor: req.headers["x-actor"] ? String(req.headers["x-actor"]).slice(0, 40) : "api" });
          return json(res, r.ok ? 200 : 400, r);
        }
        if (req.method === "DELETE") {
          await deleteUser(redis, id);
          return json(res, 200, { ok: true });
        }
      }
      return json(res, 404, { error: "not found" });
    } catch (e) {
      if (!res.headersSent) json(res, e.status || 500, { error: e.message });
      else res.end();
    }
  });
  server.on("close", () => { for (const r of clients) r.end(); });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!config.api.token && process.env.ALLOW_NO_TOKEN !== "1") {
    console.error("API_TOKEN 이 필요합니다 (로컬 개발만 ALLOW_NO_TOKEN=1).");
    process.exit(1);
  }
  const redis = createRedis();
  const subscriber = createRedis();
  const server = createApp({ redis, subscriber });
  server.listen(config.api.port, () => console.log(`[api] http://localhost:${config.api.port}`));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
}
