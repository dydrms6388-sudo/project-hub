// 탐지 1회(tick). workers/engine.js 가 10초마다 호출한다.
import { K } from "../redis.js";
import { config } from "../config.js";
import { audit } from "../audit.js";
import { readSources } from "../ingest/pipeline.js";
import { listUsers } from "../settings.js";
import { windowMetrics } from "./metrics.js";
import { classify, isAlertMatch } from "./classify.js";
import { decideAlert } from "./alertPolicy.js";

export async function runTick(redis, nowMs = Date.now()) {
  const tickMs = config.tickSec * 1000;
  const tick = Math.floor(nowMs / tickMs);
  // 엔진을 여러 개 띄워도(HA) 같은 tick 은 한 번만 처리
  const got = await redis.set(K.tickLock(tick), process.pid, "PX", tickMs * 3, "NX");
  if (!got) return { skipped: true, tick };

  const W = config.windowSec * 1000;
  const sources = await readSources(redis, nowMs);
  const fresh = sources.some(s => s.fresh);
  // 신선한 소스 중 하나라도 직전 구간까지 연속 수집했어야 판정 (기동 직후 신규 급증 오탐 방지)
  const warm = sources.some(s => s.fresh && s.warm);
  const ready = fresh && warm;

  const prevRaw = await redis.get(K.snapshot());
  const prev = prevRaw ? JSON.parse(prevRaw) : null;
  const prevKind = Object.fromEntries((prev?.coins || []).map(c => [c.symbol, c.kind]));

  const metricsByCoin = {};
  const coins = [];
  for (const { symbol } of config.coins) {
    const key = K.mentions(symbol);
    await redis.zremrangebyscore(key, "-inf", nowMs - config.retentionSec * 1000);
    const rows = await redis.zrangebyscore(key, `(${nowMs - 2 * W}`, nowMs, "WITHSCORES");
    const mentions = [];
    for (let i = 0; i < rows.length; i += 2) mentions.push({ ts: Number(rows[i + 1]), author: JSON.parse(rows[i]).a });
    const m = windowMetrics(mentions, nowMs, config.windowSec);
    metricsByCoin[symbol] = m;
    const r = classify(m, config.defaults, { fresh, warm });
    coins.push({ symbol, ...m, growthPct: r.growthPct, kind: r.kind, reason: r.reason });

    if (r.kind && r.kind !== prevKind[symbol]) await audit(redis, "detect.candidate", { coin: symbol, kind: r.kind, ...m, growthPct: r.growthPct });
    else if (!r.kind && prevKind[symbol] && ready) await audit(redis, "detect.candidate_ended", { coin: symbol, ...m, growthPct: r.growthPct });
  }

  if (prev && prev.fresh !== fresh) await audit(redis, fresh ? "detect.fresh" : "detect.stale", { sources: sources.map(s => ({ name: s.name, lagSec: s.lagSec })) });

  const snapshot = {
    at: nowMs, tickSec: config.tickSec, windowSec: config.windowSec, fresh, warm,
    freshnessMaxLagSec: config.freshnessMaxLagSec, defaults: pickThresholds(config.defaults), sources, coins,
  };
  await redis.set(K.snapshot(), JSON.stringify(snapshot));
  await redis.publish(K.updates(), JSON.stringify({ type: "snapshot", snapshot }));

  // 신선도·연속 수집 미달이면 사용자 알림 판정을 하지 않는다 (상태도 건드리지 않음)
  const enqueued = [];
  if (ready) {
    for (const user of await listUsers(redis)) {
      const watch = user.coins?.length ? user.coins : config.coins.map(c => c.symbol);
      for (const coin of watch) {
        const m = metricsByCoin[coin];
        if (!m) continue;
        const job = await evaluateUserCoin(redis, user, coin, m, nowMs);
        if (job) enqueued.push(job);
      }
    }
  }
  return { skipped: false, tick, snapshot, enqueued };
}

async function evaluateUserCoin(redis, user, coin, m, nowMs) {
  const r = classify(m, user);
  const match = isAlertMatch(r, user);
  const sk = K.alertState(user.id, coin);
  const raw = await redis.get(sk);
  const state = raw ? JSON.parse(raw) : null;
  const d = decideAlert({ state, match, count: m.cur, nowMs, coin, th: user });

  if (d.state) {
    if (d.action === "suppress" && state?.lastSuppressReason !== d.reason) {
      await audit(redis, "alert.suppressed", { user: user.id, coin, eventId: d.state.eventId, reason: d.reason, cur: m.cur, lastAlertCount: d.state.lastAlertCount });
    }
    d.state.lastSuppressReason = d.action === "suppress" ? d.reason : null;
    const ttl = Math.ceil(Math.max(user.eventResetSec, user.cooldownSec)) + 60;
    await redis.set(sk, JSON.stringify(d.state), "EX", ttl);
  } else if (raw) {
    await redis.del(sk);
    await audit(redis, "alert.event_closed", { user: user.id, coin, eventId: state.eventId, alerts: state.seq });
  }
  if (d.action !== "alert") return null;

  const job = {
    jobKey: `${user.id}:${d.state.eventId}:${d.state.seq}`, user: user.id, coin, kind: r.kind,
    cur: m.cur, base: m.base, curAuthors: m.curAuthors, growthPct: r.growthPct, reason: d.reason,
    seq: d.state.seq, eventId: d.state.eventId, at: nowMs, windowSec: config.windowSec,
  };
  // 같은 jobKey 는 한 번만 큐에 넣는다 (엔진 재시작·재시도 대비)
  const first = await redis.set(`${config.keyPrefix}enq:${job.jobKey}`, "1", "EX", 86400, "NX");
  if (!first) return null;
  await redis.xadd(K.alertQueue(), "MAXLEN", "~", 100000, "*", "job", JSON.stringify(job));
  await audit(redis, "alert.enqueued", { jobKey: job.jobKey, user: user.id, coin, kind: r.kind, reason: d.reason, cur: m.cur, base: m.base, growthPct: r.growthPct });
  await redis.publish(K.updates(), JSON.stringify({ type: "alert", job }));
  return job;
}

export function pickThresholds(t) {
  const { minGrowthPct, minCount, minUniqueAuthors, cooldownSec, realertMultiplier, eventResetSec, alertOnNewSurge } = t;
  return { minGrowthPct, minCount, minUniqueAuthors, cooldownSec, realertMultiplier, eventResetSec, alertOnNewSurge };
}
