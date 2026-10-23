// 실제 Redis + 가짜 Telegram/SMTP 서버로 수집 → 탐지 → 큐 → 발송 전 구간을 검증.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startRedis, startFakeTelegram, startFakeSmtp } from "./helpers.js";

let redisSrv, tg, smtp, redis, sub, mods, now;

before(async () => {
  redisSrv = await startRedis();
  tg = await startFakeTelegram();
  smtp = await startFakeSmtp();
  Object.assign(process.env, {
    REDIS_URL: redisSrv.url, TELEGRAM_BOT_TOKEN: "TEST:TOKEN", TELEGRAM_API_BASE: tg.base,
    SMTP_URL: smtp.url, SMTP_FROM: "alerts@tomatoeggcat.com", DEFAULT_MIN_UNIQUE_AUTHORS: "8",
  });
  const { createRedis } = await import("../src/redis.js");
  mods = {
    ...(await import("../src/redis.js")),
    ...(await import("../src/ingest/pipeline.js")),
    ...(await import("../src/detect/engine.js")),
    ...(await import("../src/notify/queue.js")),
    ...(await import("../src/settings.js")),
    ...(await import("../src/audit.js")),
    config: (await import("../src/config.js")).config,
    createApp: (await import("../src/api/server.js")).createApp,
  };
  redis = createRedis();
  sub = createRedis();
  await mods.ensureGroup(redis);
  now = Math.floor(Date.now() / 10000) * 10000;
  await mods.saveUser(redis, "u1", { name: "테스터", telegramChatId: "111", email: "u1@example.com", minUniqueAuthors: 5 });
  await mods.markSource(redis, "test", { ok: true, pollIntervalSec: 5, policy: "test" });
  await redis.hset(mods.K.source("test"), "coveredSince", Date.now() - 3600000); // 이미 충분히 연속 수집한 상태
});

after(async () => {
  await redis?.quit();
  await sub?.quit();
  tg?.stop(); smtp?.stop(); redisSrv?.stop();
});

let seq = 0;
// 숫자는 복붙 판정 정규화에서 지워지므로 본문 고유성은 문자로 만든다
const letters = n => n.toString(26).split("").map(d => String.fromCharCode(97 + parseInt(d, 26))).join("") + "q";
async function burst(coin, n, fromMs, toMs, { authors = n, tag = coin } = {}) {
  for (let i = 0; i < n; i++) {
    const ts = fromMs + 1 + Math.floor(((toMs - fromMs - 1) * i) / n);
    await mods.ingestEvent(redis, "test", { id: `e${++seq}`, author: `${tag}-a${i % authors}`, text: `$${coin} msg ${letters(seq)}`, createdAt: ts }, now + 30000);
  }
}

test("SPIKE: +200% & 20건 이상 → 큐 투입 → Telegram·Email 실제 발송 경로", async () => {
  await burst("BTC", 10, now - 120000, now - 60000);
  await burst("BTC", 30, now - 60000, now);
  const r = await mods.runTick(redis, now);
  const btc = r.snapshot.coins.find(c => c.symbol === "BTC");
  assert.deepEqual({ cur: btc.cur, base: btc.base, kind: btc.kind, growthPct: btc.growthPct }, { cur: 30, base: 10, kind: "SPIKE", growthPct: 200 });
  assert.equal(r.enqueued.length, 1);
  assert.equal(r.enqueued[0].coin, "BTC");

  const s = await mods.pollOnce(redis, "t1", { blockMs: 0 });
  assert.equal(s.done, 1);
  assert.equal(tg.calls.length, 1);
  assert.equal(tg.calls[0].chat_id, "111");
  assert.match(tg.calls[0].text, /\[BTC\] 언급 급상승/);
  assert.match(tg.calls[0].text, /증가율 \+200%/);
  assert.equal(smtp.mails.length, 1);
  assert.deepEqual(smtp.mails[0].to, ["u1@example.com"]);
});

test("같은 tick 재실행은 락으로 무시, 쿨다운 중엔 중복 알림 없음", async () => {
  assert.equal((await mods.runTick(redis, now)).skipped, true);
  // 급증 지속: 다음 tick 에도 조건 충족 (최근 45건 vs 직전 ~13건)
  await burst("BTC", 20, now, now + 10000, { tag: "BTC2" });
  const r = await mods.runTick(redis, now + 10000);
  assert.equal(r.snapshot.coins.find(c => c.symbol === "BTC").kind, "SPIKE");
  assert.equal(r.enqueued.filter(j => j.coin === "BTC").length, 0);
  const sup = await mods.readAudit(redis, { type: "alert.suppressed" });
  assert.ok(sup.some(a => a.coin === "BTC" && a.reason === "cooldown"));
});

test("기준 0건 → NEW_SURGE 로 별도 분류 (증가율 무한대 아님)", async () => {
  await burst("ETH", 25, now - 35000, now + 15000);
  const r = await mods.runTick(redis, now + 20000);
  const eth = r.snapshot.coins.find(c => c.symbol === "ETH");
  assert.equal(eth.kind, "NEW_SURGE");
  assert.equal(eth.growthPct, null);
  assert.equal(r.enqueued.find(j => j.coin === "ETH")?.kind, "NEW_SURGE");
  await mods.pollOnce(redis, "t1", { blockMs: 0 });
  assert.match(tg.calls.at(-1).text, /신규 급증/);
  assert.doesNotMatch(tg.calls.at(-1).text, /Infinity|무한/);
});

test("봇·중복 id·복붙·오래된 이벤트·작성자 도배 필터", async () => {
  const t = now;
  const ing = ev => mods.ingestEvent(redis, "test", ev, now + 30000);
  assert.equal((await ing({ id: "b1", author: "PumpBot", text: "$DOGE moon", createdAt: t })).dropped, "bot");
  await redis.sadd(mods.K.botAuthors(), "spammer1");
  assert.equal((await ing({ id: "b2", author: "spammer1", text: "$DOGE moon", createdAt: t })).dropped, "bot");
  assert.deepEqual((await ing({ id: "d1", author: "alice", text: "DOGE 간다 진짜 간다", createdAt: t })).accepted, ["DOGE"]);
  assert.equal((await ing({ id: "d1", author: "alice", text: "DOGE 간다 진짜 간다", createdAt: t })).dropped, "dup_id");
  assert.equal((await ing({ id: "d2", author: "bob", text: "$doge!! 간다 진짜 간다 https://x", createdAt: t })).dropped, "dup_content");
  assert.equal((await ing({ id: "o1", author: "carol", text: "$DOGE old news", createdAt: now + 30000 - 400000 })).dropped, "too_old");
  const r1 = await ing({ id: "r1", author: "dave", text: "$DOGE one", createdAt: t });
  const r2 = await ing({ id: "r2", author: "dave", text: "$DOGE two", createdAt: t });
  const r3 = await ing({ id: "r3", author: "dave", text: "$DOGE three", createdAt: t });
  assert.deepEqual([r1.accepted, r2.accepted, r3.dropped], [["DOGE"], ["DOGE"], "author_rate"]);
});

test("최소 고유 작성자 미달이면 후보 아님", async () => {
  // 40건이지만 작성자 3명 → 작성자당 2건 제한으로 6건만 인정 + 작성자 미달
  await burst("ADA", 40, now - 30000, now + 20000, { authors: 3 });
  const r = await mods.runTick(redis, now + 30000);
  const ada = r.snapshot.coins.find(c => c.symbol === "ADA");
  assert.equal(ada.kind, null);
  assert.ok(ada.curAuthors <= 3);
});

test("채널 일부 실패 → 재시도 시 성공한 채널(Email)은 재발송하지 않음", async () => {
  await burst("SOL", 5, now - 80000, now - 20000);
  await burst("SOL", 24, now - 15000, now + 35000);
  tg.state.failNext = 1;
  const r = await mods.runTick(redis, now + 40000);
  assert.ok(r.enqueued.some(j => j.coin === "SOL"));
  const mailsBefore = smtp.mails.length, tgBefore = tg.calls.length;
  const s1 = await mods.pollOnce(redis, "t1", { blockMs: 0 });
  assert.equal(s1.retry, 1);
  assert.equal(smtp.mails.length, mailsBefore + 1);
  assert.equal(tg.calls.length, tgBefore);

  mods.config.notifier.claimIdleMs = 0;
  const s2 = await mods.pollOnce(redis, "t1", { blockMs: 0 });
  assert.equal(s2.done, 1);
  assert.equal(tg.calls.length, tgBefore + 1);
  assert.equal(smtp.mails.length, mailsBefore + 1, "email 중복 발송 금지");
  const failed = await mods.readAudit(redis, { type: "alert.failed" });
  assert.ok(failed.some(a => a.coin === "SOL" && a.channel === "telegram"));
});

test("데이터 신선도 미달 → 판정·알림 중단", async () => {
  await redis.hset(mods.K.source("test"), "lastSuccessAt", Date.now() - 10 * 60000);
  await burst("PEPE", 30, now - 10000, now + 45000);
  const r = await mods.runTick(redis, now + 50000);
  assert.equal(r.snapshot.fresh, false);
  assert.equal(r.snapshot.coins.find(c => c.symbol === "PEPE").reason, "stale_data");
  assert.equal(r.enqueued.length, 0);
  assert.ok((await mods.readAudit(redis, { type: "detect.stale" })).length >= 1);
  await mods.markSource(redis, "test", { ok: true, pollIntervalSec: 5, policy: "test" });
});

test("API: 인증, 사용자 임계치 저장(감사 로그), 실제 발송 테스트 엔드포인트, push ingest", async () => {
  const app = mods.createApp({ redis, subscriber: sub, token: "secret", ingestToken: "ing" });
  const port = await new Promise(r => app.listen(0, () => r(app.address().port)));
  const base = `http://127.0.0.1:${port}`;
  const H = { authorization: "Bearer secret", "content-type": "application/json" };
  try {
    assert.equal((await fetch(`${base}/api/users`)).status, 401);

    const bad = await fetch(`${base}/api/users/u9`, { method: "PUT", headers: H, body: JSON.stringify({ minCount: -1 }) });
    assert.equal(bad.status, 400);
    const ok = await fetch(`${base}/api/users/u9`, { method: "PUT", headers: H, body: JSON.stringify({ telegramChatId: "999", email: "u9@example.com", minCount: 50, coins: ["BTC"] }) });
    assert.equal(ok.status, 200);
    const u = await (await fetch(`${base}/api/users/u9`, { headers: H })).json();
    assert.equal(u.minCount, 50);
    assert.equal(u.minGrowthPct, 200);
    const log = await mods.readAudit(redis, { type: "settings.updated" });
    const entry = log.find(a => a.user === "u9");
    assert.equal(entry.changes.minCount.to, 50);
    assert.equal(entry.changes.email.to, "u9***@example.com");

    const tgBefore = tg.calls.length, mailBefore = smtp.mails.length;
    const t = await (await fetch(`${base}/api/users/u9/test-alert`, { method: "POST", headers: H, body: "{}" })).json();
    assert.equal(t.telegram.ok, true);
    assert.equal(t.email.ok, true);
    assert.equal(tg.calls.length, tgBefore + 1);
    assert.equal(tg.calls.at(-1).chat_id, "999");
    assert.match(tg.calls.at(-1).text, /\[테스트\]/);
    assert.equal(smtp.mails.length, mailBefore + 1);
    assert.ok((await mods.readAudit(redis, { type: "alert.test_sent" })).length >= 2);

    assert.equal((await fetch(`${base}/api/ingest`, { method: "POST", body: "{}" })).status, 401);
    const ing = await (await fetch(`${base}/api/ingest`, {
      method: "POST", headers: { authorization: "Bearer ing", "content-type": "application/json" },
      body: JSON.stringify({ source: "pushsrc", pollIntervalSec: 30, events: [{ id: "p1", author: "zed", text: "$XRP 뉴스", createdAt: Date.now() }, { id: "p2", author: "newsbot", text: "$XRP", createdAt: Date.now() }] }),
    })).json();
    assert.deepEqual(ing, { received: 2, accepted: 1, dropped: { bot: 1 } });
    const srcs = await (await fetch(`${base}/api/sources`, { headers: H })).json();
    assert.equal(srcs.find(s => s.name === "pushsrc").pollIntervalSec, 30);

    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /10초 단위 데이터 수집을 의미하지 않습니다|단위 데이터 수집을 의미하지 않습니다/);
  } finally {
    await new Promise(r => app.close(r));
  }
});

test("수집 공백 후 재개 → 2구간 연속 수집 전에는 판정 대기 (warming_up)", async () => {
  await redis.hset(mods.K.source("test"), "lastSuccessAt", Date.now() - 10 * 60000);
  await mods.markSource(redis, "test", { ok: true, pollIntervalSec: 5, policy: "test" });
  const [src] = (await mods.readSources(redis)).filter(s => s.name === "test");
  assert.equal(src.fresh, true);
  assert.equal(src.warm, false);
  await burst("XRP", 30, now + 60000, now + 69000);
  const r = await mods.runTick(redis, now + 70000);
  assert.equal(r.snapshot.warm, false);
  assert.equal(r.snapshot.coins.find(c => c.symbol === "XRP").reason, "warming_up");
  assert.equal(r.enqueued.length, 0);
});
