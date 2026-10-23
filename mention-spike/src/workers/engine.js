// 상시 탐지 worker. 벽시계 기준 10초 경계에 맞춰 runTick 실행 (서버리스 cron 미사용).
import { createRedis } from "../redis.js";
import { config } from "../config.js";
import { runTick } from "../detect/engine.js";

const redis = createRedis();
const tickMs = config.tickSec * 1000;
let timer;

async function step() {
  const now = Math.floor(Date.now() / tickMs) * tickMs; // tick 경계 시각으로 고정 → 인스턴스 간 동일 구간
  const t0 = Date.now();
  try {
    const r = await runTick(redis, now);
    if (!r.skipped) {
      const hot = r.snapshot.coins.filter(c => c.kind).map(c => `${c.symbol}:${c.kind}`);
      console.log(`[engine] tick=${r.tick} fresh=${r.snapshot.fresh} candidates=${hot.join(",") || "-"} enqueued=${r.enqueued.length} ${Date.now() - t0}ms`);
    }
  } catch (e) {
    console.error(`[engine] tick error: ${e.stack || e.message}`);
  }
  schedule();
}
function schedule() {
  const wait = tickMs - (Date.now() % tickMs) + 50;
  timer = setTimeout(step, wait);
}

console.log(`[engine] start tick=${config.tickSec}s window=${config.windowSec}s`);
schedule();
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { clearTimeout(timer); redis.quit().finally(() => process.exit(0)); });
