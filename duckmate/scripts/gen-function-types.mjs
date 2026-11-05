#!/usr/bin/env node
/**
 * scripts/gen-function-types.mjs — 로컬 PG(마이그레이션 적용본)의 public 함수 시그니처를
 * `packages/db/src/types.ts` 의 `Database["public"]["Functions"]` 블록 형태로 출력한다(H1).
 *
 *   사용: node scripts/gen-function-types.mjs [DB이름] > /tmp/functions.ts
 *   env : PGSUPER="psql" 등으로 psql 실행기를 덮어쓸 수 있다(기본: root 면 `su postgres -c psql`).
 *
 * 트리거 함수와 composite 인자 함수(score_pair 등 SQL 내부 전용)는 제외한다 — PostgREST 로 호출 불가.
 * 출력은 참고용 초안이며, 주석(service role 전용 표기 등)은 손으로 유지한다.
 */
import { execFileSync } from "node:child_process";

const DB = process.argv[2] ?? "duckmate_test";
const SQL = `
select coalesce(json_agg(json_build_object(
  'name', p.proname,
  'args', pg_get_function_arguments(p.oid),
  'ret',  pg_get_function_result(p.oid),
  'kind', p.prokind::text,
  'auth', has_function_privilege('authenticated', p.oid, 'execute'),
  'anon', has_function_privilege('anon', p.oid, 'execute')
) order by p.proname), '[]'::json)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';`;

function psql(raw) {
  const sql = raw.replace(/\s+/g, " ").trim();
  const runner = process.env.PGSUPER;
  if (runner) return execFileSync("sh", ["-c", `${runner} -d ${DB} -Atc ${JSON.stringify(sql)}`], { encoding: "utf8" });
  if (process.getuid?.() === 0) {
    return execFileSync("su", ["postgres", "-c", `psql -d ${DB} -Atc ${JSON.stringify(sql)}`], { encoding: "utf8" });
  }
  return execFileSync("psql", ["-d", DB, "-Atc", sql], { encoding: "utf8" });
}

/** 테이블/뷰 Row 타입 이름 규약(types.ts) */
const ROW_TYPE = {
  moderation_jobs: "ModerationJobRow",
  push_queue: "PushQueueRow",
};

const SCALAR = {
  uuid: "string", text: "string", date: "string", interval: "string",
  "timestamp with time zone": "string", "time without time zone": "string", citext: "string",
  smallint: "number", integer: "number", bigint: "number", numeric: "number", "double precision": "number", real: "number",
  boolean: "boolean", jsonb: "Json", json: "Json", void: "undefined", record: "Json",
};

let ENUMS = new Set();

function tsType(pg) {
  let t = pg.trim().replace(/^public\./, "");
  let arr = false;
  if (t.endsWith("[]")) { arr = true; t = t.slice(0, -2).trim(); }
  let out;
  if (SCALAR[t]) out = SCALAR[t];
  else if (ENUMS.has(t)) out = `Enums["${t}"]`;
  else if (ROW_TYPE[t]) out = ROW_TYPE[t];
  else out = "Json";
  return arr ? `${out}[]` : out;
}

/** "p_a uuid, p_b integer DEFAULT 30" → [{name,type,optional}] */
function parseArgs(argstr) {
  if (!argstr.trim()) return [];
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of argstr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((raw) => {
    const s = raw.trim();
    const def = / DEFAULT /i.test(s);
    const head = s.split(/ DEFAULT /i)[0].trim();
    const m = head.match(/^(?:VARIADIC\s+|OUT\s+|INOUT\s+)?([a-z_][a-z0-9_]*)\s+(.+)$/i);
    if (!m) return { name: "arg", type: tsType(head), optional: def };
    return { name: m[1], type: tsType(m[2]), optional: def };
  });
}

function parseReturn(ret) {
  const r = ret.trim();
  if (/^SETOF /i.test(r)) return `${tsType(r.replace(/^SETOF /i, ""))}[]`;
  const table = r.match(/^TABLE\((.*)\)$/is);
  if (table) {
    const cols = parseArgs(table[1]).map((c) => `${c.name}: ${c.type}`).join("; ");
    return `Array<{ ${cols} }>`;
  }
  return tsType(r);
}

const enumRows = psql(
  `select string_agg(distinct t.typname, ',') from pg_type t join pg_enum e on e.enumtypid = t.oid
   join pg_namespace n on n.oid = t.typnamespace where n.nspname='public';`,
).trim();
ENUMS = new Set(enumRows ? enumRows.split(",") : []);

const fns = JSON.parse(psql(SQL));
const lines = [];
for (const f of fns) {
  const args = parseArgs(f.args);
  if (f.ret.trim() === "trigger") continue;
  if (args.some((a) => a.type === "Json" && /profiles|matches|photos/.test(f.args))) {
    lines.push(`      // ${f.name}: composite 인자(SQL 내부 전용) — RPC 대상 아님`);
    continue;
  }
  const argType = args.length === 0
    ? "Record<string, never>"
    : `{ ${args.map((a) => `${a.name}${a.optional ? "?" : ""}: ${a.type}${a.optional ? " | null" : ""}`).join("; ")} }`;
  const scope = !f.auth && !f.anon ? "  /** service role 전용 */\n" : "";
  lines.push(`${scope}      ${f.name}: { Args: ${argType}; Returns: ${parseReturn(f.ret)} };`);
}
process.stdout.write(`    Functions: {\n${lines.join("\n")}\n    };\n`);
