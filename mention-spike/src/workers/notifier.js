// 상시 알림 발송 worker. Redis Stream consumer group → 여러 개 띄워도 작업이 나뉜다.
import { hostname } from "node:os";
import { createRedis } from "../redis.js";
import { ensureGroup, pollOnce } from "../notify/queue.js";

const redis = createRedis();
const consumer = `${hostname()}-${process.pid}`;
let stopping = false;

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopping = true; redis.quit().finally(() => process.exit(0)); });

await ensureGroup(redis);
console.log(`[notifier] start consumer=${consumer}`);
while (!stopping) {
  try {
    const s = await pollOnce(redis, consumer);
    if (s.done || s.retry || s.dead) console.log(`[notifier] done=${s.done} retry=${s.retry} dead=${s.dead}`);
  } catch (e) {
    console.error(`[notifier] error: ${e.message}`);
    await new Promise(r => setTimeout(r, 2000));
  }
}
