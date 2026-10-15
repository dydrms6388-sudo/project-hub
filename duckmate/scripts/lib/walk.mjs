// =============================================================================
// E6 · 공통 유틸 — 파일 트리 워커 / 라우트 추출 / 색 출력
// Node 내장 모듈만 사용 (fs, path, url). 외부 의존성 0.
// =============================================================================

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 리포 루트 = scripts/lib/ 기준 두 단계 위 (duckmate/) */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** 어떤 검사에서도 절대 훑지 않는 디렉터리 */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
  ".vercel",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
]);

/**
 * dir 이하의 모든 파일 경로(절대)를 반환한다.
 * @param {string} dir
 * @param {(name: string, full: string) => boolean} [dirFilter] false 면 그 디렉터리를 건너뛴다
 */
export function walkFiles(dir, dirFilter) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (dirFilter && !dirFilter(e.name, full)) continue;
        stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

export function readIfExists(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** 리포 루트 기준 상대 경로(항상 슬래시) */
export function rel(p) {
  return p.slice(REPO_ROOT.length + 1).split("\\").join("/");
}

// ── 콘솔 출력 ────────────────────────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
export const red = wrap("31");
export const green = wrap("32");
export const yellow = wrap("33");
export const cyan = wrap("36");
export const dim = wrap("2");
export const bold = wrap("1");

/**
 * 위반/경고 수집기. 스크립트마다 하나씩 만들어 쓴다.
 */
export function createReporter(title) {
  /** @type {{rule:string, file:string, line:number|null, msg:string, owner:string}[]} */
  const violations = [];
  /** @type {{rule:string, file:string, line:number|null, msg:string, owner:string}[]} */
  const warnings = [];
  return {
    violations,
    warnings,
    fail(rule, file, line, msg, owner = "-") {
      violations.push({ rule, file, line, msg, owner });
    },
    warn(rule, file, line, msg, owner = "-") {
      warnings.push({ rule, file, line, msg, owner });
    },
    /** @returns {number} 프로세스 종료 코드 */
    finish(checkedSummary) {
      const fmt = (v) =>
        `  ${bold(v.rule)}  ${v.file}${v.line ? `:${v.line}` : ""}\n      ${v.msg}` +
        (v.owner && v.owner !== "-" ? `\n      ${dim(`담당: ${v.owner}`)}` : "");

      console.log(`\n${bold(cyan(`▶ ${title}`))}`);
      if (checkedSummary) console.log(dim(`  ${checkedSummary}`));

      if (warnings.length) {
        console.log(`\n${yellow(`⚠ 경고 ${warnings.length}건 (게이트 차단 아님)`)}`);
        for (const w of warnings) console.log(fmt(w));
      }
      if (violations.length) {
        console.log(`\n${red(`✖ 위반 ${violations.length}건`)}`);
        for (const v of violations) console.log(fmt(v));
        console.log(`\n${red(`✖ ${title} 실패 — 위반 ${violations.length}건`)}\n`);
        return 1;
      }
      console.log(`\n${green(`✔ ${title} 통과`)}${warnings.length ? dim(` (경고 ${warnings.length}건)`) : ""}\n`);
      return 0;
    },
  };
}

// ── Next.js App Router 라우트 추출 ───────────────────────────────────────────

/**
 * app 디렉터리에서 URL 경로를 계산한다.
 * - `(group)` 라우트 그룹 세그먼트 제거
 * - `@slot` 병렬 라우트 세그먼트 제거
 * - `_private` 폴더는 라우트가 아니므로 애초에 스캔에서 제외
 */
export function segmentsToPath(segments) {
  const kept = segments.filter(
    (s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"),
  );
  return "/" + kept.join("/");
}

/**
 * appDir 하위의 page/route 파일을 라우트 목록으로 변환.
 * @returns {{path:string, kind:"page"|"route", file:string, dirSegments:string[]}[]}
 */
export function collectRoutes(appDir) {
  const files = walkFiles(appDir, (name) => !name.startsWith("_"));
  /** @type {{path:string, kind:"page"|"route", file:string, dirSegments:string[]}[]} */
  const routes = [];
  for (const f of files) {
    const base = f.slice(appDir.length + 1).split("\\").join("/");
    const parts = base.split("/");
    const name = parts.pop();
    if (!/^(page|route)\.(tsx|ts|jsx|js)$/.test(name)) continue;
    routes.push({
      path: normalizePath(segmentsToPath(parts)),
      kind: name.startsWith("page") ? "page" : "route",
      file: f,
      dirSegments: parts,
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function normalizePath(p) {
  const cleaned = p.replace(/\/+/g, "/");
  return cleaned.length > 1 && cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

/** 동적 세그먼트를 샘플 값으로 치환 (헤더 정규식 매칭 테스트용) */
export function concretePath(routePath) {
  return routePath
    .replace(/\[\[?\.\.\.[^\]]+\]?\]/g, "sample-a/sample-b")
    .replace(/\[[^\]]+\]/g, "sample");
}
