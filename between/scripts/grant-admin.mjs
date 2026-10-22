#!/usr/bin/env node
// 운영자 권한 부여 (로컬/스테이징 DB 직접 접속). 사용: npm run admin:grant -- <user-uuid> [admin|moderator]
// - 운영자는 반드시 "익명이 아닌" 계정이어야 한다 (DB public.is_admin() 이 JWT is_anonymous 를 검사).
// - local 드라이버: auth.users.is_anonymous 를 false 로 전환한다.
// - supabase: 해당 사용자가 먼저 이메일을 연결(영구 계정 전환)한 뒤, SQL Editor 에서
//   insert into public.admin_roles (user_id, role) values ('<uuid>', 'admin'); 를 실행한다.
import pg from "pg";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const [userId, role = "admin"] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/.test(userId ?? "") || !["admin", "moderator"].includes(role)) {
  console.error("usage: npm run admin:grant -- <user-uuid> [admin|moderator]");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const admin = new URL(process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres");
admin.pathname = url.pathname;
const c = new pg.Client({ connectionString: admin.toString() });
await c.connect();
const u = await c.query("update auth.users set is_anonymous = false where id = $1 returning id", [userId]);
if (!u.rowCount) {
  console.error("user not found");
  process.exit(1);
}
await c.query(
  "insert into public.admin_roles (user_id, role) values ($1, $2) on conflict (user_id) do update set role = excluded.role",
  [userId, role],
);
await c.end();
console.log(`✓ ${userId} → ${role}`);
