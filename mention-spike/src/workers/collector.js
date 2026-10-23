// 상시 수집 worker. 소스별로 자기 폴링 간격(공식 API 제약 기반)으로 돈다.
// 탐지 주기(10초)와 수집 주기는 독립적이다.
import { createRedis } from "../redis.js";
import { config } from "../config.js";
import { ingestEvent, markSource } from "../ingest/pipeline.js";
import { createRedditAdapter } from "../ingest/adapters/reddit.js";
import { createSimulatorAdapter } from "../ingest/adapters/simulator.js";

const redis = createRedis();
const adapters = [];
if (config.reddit.enabled) adapters.push(createRedditAdapter());
if (config.simulator.enabled) adapters.push(createSimulatorAdapter());
if (!adapters.length) console.warn("[collector] 활성 소스 없음 — REDDIT_ENABLED=1 또는 SIMULATOR_ENABLED=1 (push 수집은 API 서버 /api/ingest)");

let stopping = false;
async function loop(a) {
  while (!stopping) {
    const started = Date.now();
    try {
      const { events, paused } = await a.fetch();
      let accepted = 0;
      for (const ev of events) if ((await ingestEvent(redis, a.name, ev)).accepted.length) accepted++;
      await markSource(redis, a.name, { ok: true, pollIntervalSec: a.pollIntervalSec, policy: a.policy, fetched: events.length });
      console.log(`[collector] ${a.name} fetched=${events.length} accepted=${accepted}${paused ? ` paused=${paused}s` : ""}`);
    } catch (e) {
      await markSource(redis, a.name, { ok: false, pollIntervalSec: a.pollIntervalSec, policy: a.policy, error: e.message }).catch(() => {});
      console.error(`[collector] ${a.name} error: ${e.message}`);
    }
    const wait = Math.max(0, a.pollIntervalSec * 1000 - (Date.now() - started));
    await new Promise(r => setTimeout(r, wait));
  }
}

for (const a of adapters) loop(a);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopping = true; redis.quit().finally(() => process.exit(0)); });
