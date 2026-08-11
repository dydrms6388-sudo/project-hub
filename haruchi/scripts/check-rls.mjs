#!/usr/bin/env node
/**
 * RLS 게이트 (스펙 7장-3, 11장).
 *
 * 마이그레이션에 정의된 public 테이블 중 RLS 가 꺼져 있거나 정책이 하나도 없는
 * 테이블이 있으면 빌드를 실패시킨다. "정책 없는 테이블"은 그 자체로 데이터 유출이다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = fileURLToPath(new URL('../supabase/migrations', import.meta.url));

const sql = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
  .join('\n');

const matchAll = (pattern) => [...sql.matchAll(pattern)].map((m) => m[1]);

const tables = new Set(matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi));
const rlsEnabled = new Set(
  matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi),
);
const withPolicy = new Set(matchAll(/create\s+policy\s+\w+\s+on\s+public\.(\w+)/gi));

const problems = [];
for (const table of [...tables].sort()) {
  if (!rlsEnabled.has(table)) problems.push(`${table}: RLS 가 켜져 있지 않다`);
  else if (!withPolicy.has(table)) problems.push(`${table}: RLS 는 켰지만 정책이 하나도 없다`);
}

if (tables.size === 0) {
  console.error('RLS 검사: 마이그레이션에서 테이블을 하나도 찾지 못했다. 검사기가 고장 났다.');
  process.exit(1);
}

if (problems.length > 0) {
  console.error('RLS 검사 실패:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`RLS 검사 통과: public 테이블 ${tables.size}개 전부 RLS + 정책 있음`);
