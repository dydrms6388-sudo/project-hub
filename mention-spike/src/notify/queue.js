// Redis Stream 기반 알림 큐 소비. 처리 실패 시 ACK 하지 않고 pending 에 남겨
// XAUTOCLAIM 으로 재시도 → maxAttempts 초과 시 dead-letter 스트림으로 이동.
import { K, ALERT_GROUP } from "../redis.js";
import { config } from "../config.js";
import { audit } from "../audit.js";
import { deliverJob } from "./deliver.js";

export async function ensureGroup(redis) {
  try {
    await redis.xgroup("CREATE", K.alertQueue(), ALERT_GROUP, "0", "MKSTREAM");
  } catch (e) {
    if (!String(e.message).includes("BUSYGROUP")) throw e;
  }
}

async function handle(redis, id, fields, deliveries) {
  const job = JSON.parse(fields[fields.indexOf("job") + 1]);
  let outcome;
  try {
    outcome = await deliverJob(redis, job);
  } catch (e) {
    outcome = { done: false, error: e.message };
  }
  if (outcome.done) {
    await redis.multi().xack(K.alertQueue(), ALERT_GROUP, id).xdel(K.alertQueue(), id).exec();
    return "done";
  }
  if (deliveries >= config.notifier.maxAttempts) {
    await redis.xadd(K.alertDlq(), "*", "job", JSON.stringify(job), "results", JSON.stringify(outcome.results || outcome.error));
    await redis.multi().xack(K.alertQueue(), ALERT_GROUP, id).xdel(K.alertQueue(), id).exec();
    await audit(redis, "alert.dead_letter", { jobKey: job.jobKey, user: job.user, coin: job.coin, attempts: deliveries });
    return "dead";
  }
  return "retry";
}

// 한 번 폴링: 오래된 pending 재시도 + 신규 작업. blockMs=0 이면 대기 없이 반환.
export async function pollOnce(redis, consumer, { blockMs = 5000 } = {}) {
  const stats = { done: 0, retry: 0, dead: 0 };
  const [, claimed] = await redis.xautoclaim(K.alertQueue(), ALERT_GROUP, consumer, config.notifier.claimIdleMs, "0", "COUNT", 20);
  if (claimed?.length) {
    const pend = await redis.xpending(K.alertQueue(), ALERT_GROUP, "-", "+", 100, consumer);
    const count = Object.fromEntries(pend.map(p => [p[0], p[3]]));
    for (const [id, fields] of claimed) if (fields) stats[await handle(redis, id, fields, count[id] || 1)]++;
  }
  const args = ["GROUP", ALERT_GROUP, consumer, "COUNT", 20];
  if (blockMs > 0) args.push("BLOCK", blockMs);
  const res = await redis.xreadgroup(...args, "STREAMS", K.alertQueue(), ">");
  for (const [, entries] of res || []) for (const [id, fields] of entries) stats[await handle(redis, id, fields, 1)]++;
  return stats;
}
