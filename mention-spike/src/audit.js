// 감사 로그: Redis Stream (조회·실시간용) + 선택적으로 JSONL 파일 (장기 보관용, AUDIT_FILE).
import { appendFile } from "node:fs/promises";
import { K } from "./redis.js";

const MAXLEN = Number(process.env.AUDIT_MAXLEN || 200000);

export async function audit(redis, type, data = {}) {
  const entry = { ts: Date.now(), type, ...data };
  const json = JSON.stringify(entry);
  await redis.xadd(K.audit(), "MAXLEN", "~", MAXLEN, "*", "type", type, "data", json);
  if (process.env.AUDIT_FILE) await appendFile(process.env.AUDIT_FILE, json + "\n").catch(() => {});
  return entry;
}

export async function readAudit(redis, { count = 100, type, before } = {}) {
  const end = before ? `(${before}` : "+";
  // 타입 필터가 있으면 넉넉히 읽은 뒤 거른다
  const rows = await redis.xrevrange(K.audit(), end, "-", "COUNT", type ? count * 10 : count);
  const out = [];
  for (const [id, fields] of rows) {
    const f = Object.fromEntries([[fields[0], fields[1]], [fields[2], fields[3]]]);
    if (type && f.type !== type) continue;
    out.push({ id, ...JSON.parse(f.data) });
    if (out.length >= count) break;
  }
  return out;
}

// 감사 로그에 남길 때 연락처는 일부 마스킹
export function maskContact(s) {
  if (!s) return s;
  const str = String(s);
  if (str.includes("@")) {
    const [u, d] = str.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  return str.length > 4 ? `${str.slice(0, 2)}***${str.slice(-2)}` : "***";
}
