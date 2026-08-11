#!/usr/bin/env node
/**
 * 시드 카테고리 동기화 검사.
 *
 * packages/categorizer 의 SEED_CATEGORIES 와 마이그레이션의 시드 목록이 어긋나면,
 * 분류기가 DB 에 없는 카테고리를 가리키게 되어 거래에 category_id 를 붙이지 못한다.
 * 조용히 미분류가 늘어나는 종류의 사고라 CI 에서 막는다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATEGORIES_TS = fileURLToPath(new URL('../packages/categorizer/src/categories.ts', import.meta.url));
const MIGRATION = fileURLToPath(new URL('../supabase/migrations/0002_seed_categories.sql', import.meta.url));

const tsSource = readFileSync(CATEGORIES_TS, 'utf8');
const sqlSource = readFileSync(MIGRATION, 'utf8');

const CATEGORY_LITERAL =
  /\{\s*key:\s*'([^']+)',\s*name:\s*'([^']+)',\s*kind:\s*'([^']+)',\s*parent:\s*(null|'[^']+'),\s*isFixed:\s*(true|false),\s*sortOrder:\s*(\d+)\s*\}/g;

const fromCode = new Map();
for (const match of tsSource.matchAll(CATEGORY_LITERAL)) {
  const [, key, name, kind, parent, isFixed, sortOrder] = match;
  fromCode.set(key, {
    name,
    kind,
    isFixed: isFixed === 'true',
    sortOrder: Number(sortOrder),
    parent: parent === 'null' ? null : parent.slice(1, -1),
  });
}

const SQL_ROW = /^\s*\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(true|false),\s*(\d+),\s*(null|'[^']+')\)/gm;

const fromSql = new Map();
for (const match of sqlSource.matchAll(SQL_ROW)) {
  const [, key, name, kind, isFixed, sortOrder, parent] = match;
  fromSql.set(key, {
    name,
    kind,
    isFixed: isFixed === 'true',
    sortOrder: Number(sortOrder),
    parent: parent === 'null' ? null : parent.slice(1, -1),
  });
}

const problems = [];

if (fromCode.size === 0) problems.push('categories.ts 에서 카테고리를 하나도 읽지 못했다. 검사기가 고장 났다.');
if (fromSql.size === 0) problems.push('마이그레이션에서 시드 행을 하나도 읽지 못했다. 검사기가 고장 났다.');

for (const key of fromCode.keys()) {
  if (!fromSql.has(key)) problems.push(`${key}: 코드에는 있지만 마이그레이션에 없다`);
}
for (const key of fromSql.keys()) {
  if (!fromCode.has(key)) problems.push(`${key}: 마이그레이션에는 있지만 코드에 없다`);
}

for (const [key, code] of fromCode) {
  const sql = fromSql.get(key);
  if (!sql) continue;
  for (const field of ['name', 'kind', 'isFixed', 'sortOrder', 'parent']) {
    if (code[field] !== sql[field]) {
      problems.push(`${key}.${field}: 코드 ${JSON.stringify(code[field])} ≠ SQL ${JSON.stringify(sql[field])}`);
    }
  }
}

if (problems.length > 0) {
  console.error('시드 카테고리 동기화 검사 실패:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`시드 카테고리 동기화 검사 통과: ${fromCode.size}개 일치`);
