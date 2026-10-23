import { test } from "node:test";
import assert from "node:assert/strict";
import { windowMetrics, growthPct } from "../src/detect/metrics.js";
import { classify, isAlertMatch, KIND } from "../src/detect/classify.js";
import { decideAlert } from "../src/detect/alertPolicy.js";
import { buildExtractor, normalizeForDup } from "../src/extract.js";

const th = { minGrowthPct: 200, minCount: 20, minUniqueAuthors: 5, cooldownSec: 600, realertMultiplier: 2, eventResetSec: 300, alertOnNewSurge: true };
const now = 1_000_000_000;
const mk = (n, from, to, authors = n) => Array.from({ length: n }, (_, i) => ({ ts: from + 1 + ((to - from - 1) * i) / Math.max(1, n), author: `a${i % authors}` }));

test("windowMetrics: 반열림 구간 (now-60s, now] / (now-120s, now-60s]", () => {
  const m = windowMetrics([
    { ts: now, author: "x" }, { ts: now - 60000, author: "y" }, { ts: now - 60001, author: "y" },
    { ts: now - 120000, author: "z" }, { ts: now + 1, author: "f" },
  ], now, 60);
  assert.deepEqual(m, { cur: 1, base: 2, curAuthors: 1, baseAuthors: 1 });
});

test("growthPct: 기준 0건이면 null (무한대 아님)", () => {
  assert.equal(growthPct(30, 0), null);
  assert.equal(growthPct(30, 10), 200);
  assert.equal(growthPct(5, 10), -50);
});

test("classify: +200% 이상 & 20건 이상 → SPIKE", () => {
  const r = classify({ cur: 30, base: 10, curAuthors: 10 }, th);
  assert.equal(r.kind, KIND.SPIKE);
  assert.equal(r.growthPct, 200);
});

test("classify: 증가율 경계 미만 / 건수 미달 / 작성자 미달", () => {
  assert.equal(classify({ cur: 29, base: 10, curAuthors: 10 }, th).reason, "below_min_growth");
  assert.equal(classify({ cur: 19, base: 1, curAuthors: 19 }, th).reason, "below_min_count");
  assert.equal(classify({ cur: 40, base: 5, curAuthors: 4 }, th).reason, "below_min_authors");
});

test("classify: 기준 0건 → NEW_SURGE, growthPct null", () => {
  const r = classify({ cur: 25, base: 0, curAuthors: 10 }, th);
  assert.equal(r.kind, KIND.NEW_SURGE);
  assert.equal(r.growthPct, null);
  assert.equal(isAlertMatch(r, th), true);
  assert.equal(isAlertMatch(r, { ...th, alertOnNewSurge: false }), false);
});

test("classify: 기준 0건이라도 최소 건수는 적용", () => {
  assert.equal(classify({ cur: 3, base: 0, curAuthors: 3 }, th).kind, null);
});

test("classify: 신선도 미달이면 후보 아님", () => {
  assert.equal(classify({ cur: 100, base: 1, curAuthors: 50 }, th, { fresh: false }).reason, "stale_data");
});

test("classify: 연속 수집 2구간 미만이면 후보 아님 (기동 직후 신규 급증 오탐 방지)", () => {
  assert.equal(classify({ cur: 50, base: 0, curAuthors: 30 }, th, { warm: false }).reason, "warming_up");
});

test("decideAlert: 새 이벤트 → 알림, 쿨다운 중 → 억제", () => {
  const a = decideAlert({ state: null, match: true, count: 30, nowMs: now, coin: "BTC", th });
  assert.equal(a.action, "alert");
  assert.equal(a.reason, "new_event");
  const b = decideAlert({ state: a.state, match: true, count: 100, nowMs: now + 10000, coin: "BTC", th });
  assert.equal(b.action, "suppress");
  assert.equal(b.reason, "cooldown");
  assert.equal(b.state.eventId, a.state.eventId);
});

test("decideAlert: 쿨다운 후 재알림 임계치 미달 → 억제, 충족 → 재알림", () => {
  let s = decideAlert({ state: null, match: true, count: 30, nowMs: now, coin: "BTC", th }).state;
  for (let t = 10000; t <= 600000; t += 10000) s = decideAlert({ state: s, match: true, count: 40, nowMs: now + t, coin: "BTC", th }).state;
  const c = decideAlert({ state: s, match: true, count: 59, nowMs: now + 610000, coin: "BTC", th });
  assert.equal(c.reason, "below_realert_threshold");
  const d = decideAlert({ state: c.state, match: true, count: 60, nowMs: now + 620000, coin: "BTC", th });
  assert.equal(d.action, "alert");
  assert.equal(d.reason, "realert");
  assert.equal(d.state.seq, 2);
  assert.equal(d.state.lastAlertCount, 60);
});

test("decideAlert: 잠깐 꺼졌다 다시 충족 → 같은 이벤트 (중복 알림 없음)", () => {
  const a = decideAlert({ state: null, match: true, count: 30, nowMs: now, coin: "BTC", th });
  const off = decideAlert({ state: a.state, match: false, count: 5, nowMs: now + 60000, coin: "BTC", th });
  assert.equal(off.action, "none");
  assert.ok(off.state);
  const on = decideAlert({ state: off.state, match: true, count: 30, nowMs: now + 120000, coin: "BTC", th });
  assert.equal(on.action, "suppress");
});

test("decideAlert: eventResetSec 이상 미충족 → 이벤트 종료, 다음 충족은 새 이벤트", () => {
  const a = decideAlert({ state: null, match: true, count: 30, nowMs: now, coin: "BTC", th });
  const closed = decideAlert({ state: a.state, match: false, count: 0, nowMs: now + 300000, coin: "BTC", th });
  assert.equal(closed.reason, "event_closed");
  assert.equal(closed.state, null);
  const again = decideAlert({ state: null, match: true, count: 30, nowMs: now + 310000, coin: "BTC", th });
  assert.equal(again.reason, "new_event");
});

test("extract: 캐시태그·티커·별칭, 짧은 일반어 오탐 방지", () => {
  const ex = buildExtractor([{ symbol: "BTC", aliases: ["bitcoin", "비트코인"] }, { symbol: "OP", aliases: [] }, { symbol: "SOL", aliases: ["solana"] }]);
  assert.deepEqual(ex("$btc pumping"), ["BTC"]);
  assert.deepEqual(ex("비트코인 간다"), ["BTC"]);
  assert.deepEqual(ex("BTC and SOL"), ["BTC", "SOL"]);
  assert.deepEqual(ex("op is great, top solution"), []);
  assert.deepEqual(ex("$OP up"), ["OP"]);
  assert.deepEqual(ex("Bitcoin bitcoin BTC"), ["BTC"]);
});

test("normalizeForDup: URL·숫자·구두점 무시", () => {
  assert.equal(normalizeForDup("BUY $PEPE now!!! https://x.y/z 123"), normalizeForDup("buy pepe NOW 99"));
});

test("mk helper sanity", () => assert.equal(windowMetrics(mk(10, now - 60000, now), now, 60).cur, 10));
