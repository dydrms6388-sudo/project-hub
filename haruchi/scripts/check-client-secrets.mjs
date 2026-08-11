#!/usr/bin/env node
/**
 * 클라이언트 번들 시크릿 스캔 (스펙 7장-4, 11장).
 *
 * service_role 키는 서버 코드에서만 읽어야 한다. 'use client' 파일이나
 * NEXT_PUBLIC_ 접두어를 통해 브라우저로 새어 나가면 RLS 가 통째로 무력화된다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['apps', 'packages'];
const SKIP = new Set(['node_modules', '.next', 'dist', 'out', 'coverage', '.git']);

/** 브라우저로 나가면 안 되는 이름들 */
const SECRET_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'ANTHROPIC_API_KEY',
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(full)) yield full;
  }
}

const problems = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const source = readFileSync(file, 'utf8');
    const relative = file.slice(ROOT.length);

    // NEXT_PUBLIC_ 접두어가 붙은 시크릿은 무조건 번들에 들어간다.
    for (const secret of SECRET_NAMES) {
      if (source.includes(`NEXT_PUBLIC_${secret}`)) {
        problems.push(`${relative}: NEXT_PUBLIC_${secret} — 브라우저 번들에 노출된다`);
      }
    }

    // 클라이언트 컴포넌트에서 시크릿을 읽는 경우.
    const isClientComponent = /^\s*['"]use client['"]/m.test(source);
    if (isClientComponent) {
      for (const secret of SECRET_NAMES) {
        if (source.includes(secret)) {
          problems.push(`${relative}: 'use client' 파일에서 ${secret} 를 읽는다`);
        }
      }
    }

    // 하드코딩된 JWT 형태의 키 (service_role 키는 eyJ 로 시작하는 JWT 다).
    const hardcoded = /['"]eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+['"]/.exec(
      source,
    );
    if (hardcoded) {
      problems.push(`${relative}: JWT 로 보이는 문자열이 소스에 하드코딩되어 있다`);
    }
  }
}

if (problems.length > 0) {
  console.error('클라이언트 시크릿 스캔 실패:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('클라이언트 시크릿 스캔 통과');
