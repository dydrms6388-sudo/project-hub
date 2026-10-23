// 사용자별 임계치/알림 채널 저장. Redis STRING(json) — AOF 켜진 Redis 를 전제로 영속.
import { K } from "./redis.js";
import { config } from "./config.js";
import { audit, maskContact } from "./audit.js";

const NUM_RULES = {
  minGrowthPct: [0, 100000],
  minCount: [1, 1000000],
  minUniqueAuthors: [1, 100000],
  cooldownSec: [0, 86400 * 7],
  realertMultiplier: [1, 1000],
  eventResetSec: [10, 86400],
};

export function validateSettings(input, { partial = false } = {}) {
  const errors = [];
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(NUM_RULES)) {
    if (input[k] === undefined) { if (!partial) out[k] = config.defaults[k]; continue; }
    const v = Number(input[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) errors.push(`${k}: ${lo}~${hi} 사이 숫자`);
    else out[k] = v;
  }
  if (input.alertOnNewSurge !== undefined) out.alertOnNewSurge = !!input.alertOnNewSurge;
  if (input.name !== undefined) out.name = String(input.name).slice(0, 60);
  if (input.telegramChatId !== undefined) {
    const v = String(input.telegramChatId).trim();
    if (v && !/^-?\d{1,20}$|^@[A-Za-z0-9_]{5,64}$/.test(v)) errors.push("telegramChatId: 숫자 chat id 또는 @channel");
    else out.telegramChatId = v;
  }
  if (input.email !== undefined) {
    const v = String(input.email).trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push("email: 형식 오류");
    else out.email = v;
  }
  if (input.channels !== undefined) {
    out.channels = { telegram: !!input.channels.telegram, email: !!input.channels.email };
  }
  if (input.coins !== undefined) {
    const known = new Set(config.coins.map(c => c.symbol));
    const list = Array.isArray(input.coins) ? input.coins.map(String) : [];
    const bad = list.filter(c => !known.has(c));
    if (bad.length) errors.push(`coins: 알 수 없는 코인 ${bad.join(",")}`);
    else out.coins = list;
  }
  return { ok: errors.length === 0, errors, value: out };
}

export function withDefaults(u) {
  return { ...config.defaults, channels: { ...config.defaults.channels }, ...u };
}

export async function getUser(redis, id) {
  const raw = await redis.get(K.user(id));
  return raw ? withDefaults(JSON.parse(raw)) : null;
}

export async function listUsers(redis) {
  const ids = await redis.smembers(K.users());
  if (!ids.length) return [];
  const raws = await redis.mget(ids.map(K.user));
  return raws.map((r, i) => (r ? withDefaults({ id: ids[i], ...JSON.parse(r) }) : null)).filter(Boolean);
}

export async function saveUser(redis, id, input, { actor = "api" } = {}) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return { ok: false, errors: ["id: 영문/숫자/-/_ 1~40자"] };
  const { ok, errors, value } = validateSettings(input, { partial: true });
  if (!ok) return { ok, errors };
  const prevRaw = await redis.get(K.user(id));
  const prev = prevRaw ? JSON.parse(prevRaw) : {};
  const next = { ...prev, ...value, id, updatedAt: Date.now() };
  await redis.multi().set(K.user(id), JSON.stringify(next)).sadd(K.users(), id).exec();

  const changes = {};
  for (const k of Object.keys(value)) {
    if (JSON.stringify(prev[k]) === JSON.stringify(value[k])) continue;
    const mask = k === "email" || k === "telegramChatId";
    changes[k] = { from: mask ? maskContact(prev[k]) : prev[k], to: mask ? maskContact(value[k]) : value[k] };
  }
  await audit(redis, "settings.updated", { user: id, actor, created: !prevRaw, changes });
  return { ok: true, user: withDefaults(next) };
}

export async function deleteUser(redis, id, { actor = "api" } = {}) {
  await redis.multi().del(K.user(id)).srem(K.users(), id).exec();
  await audit(redis, "settings.deleted", { user: id, actor });
}
