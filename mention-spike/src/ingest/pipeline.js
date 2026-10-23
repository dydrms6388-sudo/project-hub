// 원천 이벤트 → 봇/중복 필터 → 코인별 ZSET 저장.
// event: { id, author, text, createdAt(ms) }
import { createHash } from "node:crypto";
import { K } from "../redis.js";
import { config } from "../config.js";
import { buildExtractor, normalizeForDup } from "../extract.js";

const extract = buildExtractor(config.coins);
const botRe = new RegExp(config.filter.botNamePattern, "i");

export async function ingestEvent(redis, source, ev, nowMs = Date.now()) {
  const f = config.filter;
  const drop = async reason => {
    await redis.hincrby(K.source(source), `dropped_${reason}`, 1);
    return { accepted: [], dropped: reason };
  };

  if (!ev || !ev.id || !ev.author) return drop("invalid");
  const author = String(ev.author).toLowerCase();

  const first = await redis.set(K.seen(source, ev.id), "1", "EX", 86400, "NX");
  if (!first) return drop("dup_id");

  let ts = Number(ev.createdAt);
  if (!Number.isFinite(ts)) return drop("invalid");
  if (ts > nowMs) ts = nowMs; // 미래 시각(시계 오차)은 현재로 보정
  if (nowMs - ts > f.maxEventAgeSec * 1000) return drop("too_old");

  if (botRe.test(author) || (await redis.sismember(K.botAuthors(), author))) return drop("bot");
  const text = String(ev.text || "");
  if (text.trim().length < f.minContentChars) return drop("too_short");

  const coins = extract(text);
  if (!coins.length) return drop("no_coin");

  const norm = normalizeForDup(text);
  const hash = createHash("sha1").update(norm).digest("hex").slice(0, 16);
  const bucket = Math.floor(ts / 1000 / config.windowSec);
  const accepted = [];
  const droppedByCoin = {};
  for (const coin of coins) {
    // 서로 다른 계정이 같은 문구를 복붙 → 첫 건만 인정
    if (norm.length >= 8) {
      const ok = await redis.set(K.dupContent(coin, hash), "1", "EX", f.dupContentTtlSec, "NX");
      if (!ok) { droppedByCoin[coin] = "dup_content"; continue; }
    }
    // 한 작성자가 한 구간에 같은 코인을 도배 → 최대 N건만 인정
    const rk = K.authorRate(coin, author, bucket);
    const n = await redis.incr(rk);
    if (n === 1) await redis.expire(rk, config.windowSec * 3);
    if (n > f.maxPerAuthorPerWindow) { droppedByCoin[coin] = "author_rate"; continue; }

    await redis.zadd(K.mentions(coin), ts, JSON.stringify({ s: source, i: String(ev.id), a: author }));
    accepted.push(coin);
  }
  for (const reason of Object.values(droppedByCoin)) await redis.hincrby(K.source(source), `dropped_${reason}`, 1);
  if (accepted.length) await redis.hincrby(K.source(source), "accepted", 1);
  return { accepted, dropped: accepted.length ? null : Object.values(droppedByCoin)[0] || null };
}

// 소스 상태 기록 (신선도 판정의 근거). policy 는 UI 에 그대로 노출되는 수집 제약 설명.
// coveredSince = 끊김 없이 수집해 온 시작 시각. 수집이 freshnessMaxLag 이상 끊기면 다시 잰다.
// 직전 구간이 "0건"인 이유가 수집 공백이면 신규 급증 오탐이 되므로, 2구간 이상 연속 수집해야 판정에 쓴다.
export async function markSource(redis, name, { ok, pollIntervalSec, policy, error, fetched }) {
  const now = Date.now();
  const fields = { lastAttemptAt: now, pollIntervalSec: pollIntervalSec ?? "", policy: policy || "" };
  if (ok) {
    const [last, since] = await redis.hmget(K.source(name), "lastSuccessAt", "coveredSince");
    const gap = !last || now - Number(last) > config.freshnessMaxLagSec * 1000;
    Object.assign(fields, { lastSuccessAt: now, lastError: "", lastFetched: fetched ?? 0, coveredSince: gap || !since ? now : since });
  }
  else fields.lastError = String(error || "unknown").slice(0, 300);
  await redis.multi().hset(K.source(name), fields).sadd(K.sources(), name).exec();
}

export async function readSources(redis, nowMs = Date.now()) {
  const names = await redis.smembers(K.sources());
  const out = [];
  for (const name of names) {
    const h = await redis.hgetall(K.source(name));
    const lastSuccessAt = Number(h.lastSuccessAt || 0);
    const lagSec = lastSuccessAt ? Math.round((nowMs - lastSuccessAt) / 1000) : null;
    const coveredSince = Number(h.coveredSince || 0);
    out.push({
      name,
      lastSuccessAt: lastSuccessAt || null,
      lagSec,
      fresh: lagSec !== null && lagSec <= config.freshnessMaxLagSec,
      coveredSince: coveredSince || null,
      warm: !!coveredSince && nowMs - coveredSince >= 2 * config.windowSec * 1000,
      pollIntervalSec: h.pollIntervalSec ? Number(h.pollIntervalSec) : null,
      policy: h.policy || "",
      lastError: h.lastError || "",
      accepted: Number(h.accepted || 0),
      dropped: Object.fromEntries(Object.entries(h).filter(([k]) => k.startsWith("dropped_")).map(([k, v]) => [k.slice(8), Number(v)])),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
