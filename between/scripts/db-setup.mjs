#!/usr/bin/env node
// 로컬 PostgreSQL 에 BETWEEN DB 를 구성한다 (Supabase 호환 auth shim + 마이그레이션 [+ 데모 시드]).
//   node scripts/db-setup.mjs            # DATABASE_URL 의 DB 에 미적용 마이그레이션 적용 (없으면 생성)
//   node scripts/db-setup.mjs --reset    # DB 를 지우고 처음부터
//   node scripts/db-setup.mjs --seed     # 데모 프로필 시드 (개발용)
// Supabase 프로젝트에는 이 스크립트가 아니라 `supabase db push` 를 사용한다 (DEPLOYMENT.md).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const appUrl = new URL(process.env.DATABASE_URL ?? "postgres://between_app:between_app@localhost:5432/between_dev");
const adminUrl = new URL(process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres");
const dbName = appUrl.pathname.slice(1);
const appUser = decodeURIComponent(appUrl.username);
const appPassword = decodeURIComponent(appUrl.password);

if (!/^[a-z0-9_]+$/.test(dbName) || !/^[a-z0-9_]+$/.test(appUser)) {
  throw new Error(`unsafe db/user name: ${dbName}/${appUser}`);
}
if (!["localhost", "127.0.0.1"].includes(appUrl.hostname)) {
  throw new Error("db-setup.mjs 는 로컬 DB 전용입니다. Supabase 에는 supabase db push 를 사용하세요.");
}

async function withClient(url, fn) {
  const c = new pg.Client({ connectionString: url.toString() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

await withClient(adminUrl, async (c) => {
  const exists = (await c.query("select 1 from pg_database where datname = $1", [dbName])).rowCount > 0;
  if (exists && args.has("--reset")) {
    await c.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [dbName]);
    await c.query(`drop database ${dbName}`);
  }
  if (!exists || args.has("--reset")) {
    await c.query(`create database ${dbName}`);
    console.log(`created database ${dbName}`);
  }
  for (const r of ["anon", "authenticated"]) {
    await c.query(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${r}') then create role ${r} nologin noinherit; end if; end $$`);
  }
  await c.query(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if; end $$`);
  const roleExists = (await c.query("select 1 from pg_roles where rolname = $1", [appUser])).rowCount > 0;
  if (!roleExists) {
    await c.query(`create role ${appUser} login noinherit password ${pg.escapeLiteral ? pg.escapeLiteral(appPassword) : `'${appPassword.replace(/'/g, "''")}'`}`);
  }
  // 앱 접속 역할은 아무 권한 없이(noinherit) 접속해, 요청마다 SET LOCAL ROLE 로 전환한다
  await c.query(`grant anon, authenticated, service_role to ${appUser}`);
});

const dbAdminUrl = new URL(adminUrl);
dbAdminUrl.pathname = `/${dbName}`;

await withClient(dbAdminUrl, async (c) => {
  await c.query(readFileSync(join(root, "supabase/local/auth-shim.sql"), "utf8"));
  await c.query(`create schema if not exists local_meta;
    create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz default now())`);
  const applied = new Set((await c.query("select name from local_meta.migrations")).rows.map((r) => r.name));
  const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    await c.query("begin");
    try {
      await c.query(readFileSync(join(root, "supabase/migrations", f), "utf8"));
      await c.query("insert into local_meta.migrations (name) values ($1)", [f]);
      await c.query("commit");
      console.log(`applied ${f}`);
    } catch (e) {
      await c.query("rollback");
      console.error(`FAILED ${f}: ${e.message}`);
      process.exit(1);
    }
  }
  await c.query(`grant usage on schema local_meta to service_role`);
});

if (args.has("--seed")) {
  const { seed } = await import("./seed.mjs");
  await withClient(dbAdminUrl, (c) => seed(c, root));
}
console.log(`✓ ${dbName} ready`);
