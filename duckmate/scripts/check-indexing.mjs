#!/usr/bin/env node
// =============================================================================
// E6 · UGC noindex 게이트 (PRD F-QLT-01 / 배포 게이트 G-6)
//
// 검사 대상
//  1) apps/web  — 공식 페이지(`/`, `/legal/**`)만 index 허용, 그 외 전 라우트 noindex.
//                 · next.config.ts 의 X-Robots-Tag `source` 정규식 ↔ 실제 라우트 목록 대조
//                 · 각 page.tsx / layout.tsx 의 `metadata.robots` 파싱 후 교차 검증
//                 · sitemap 존재 여부 + 공식 페이지만 포함하는지
//  2) apps/company — 전 페이지 index 허용. 404(not-found)만 noindex 예외 (26_fe_company D-6).
//                 · app/sitemap.ts 의 ROUTES 집합 == 실제 라우트 집합
//                 · out/ 산출물이 있으면 HTML meta robots 까지 실측 검증
//
// 위반 시 목록 출력 + exit 1.
// =============================================================================

import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  REPO_ROOT,
  readIfExists,
  rel,
  collectRoutes,
  concretePath,
  createReporter,
  walkFiles,
  dim,
} from "./lib/walk.mjs";

const report = createReporter("check-indexing — UGC noindex 게이트");

const WEB_APP = join(REPO_ROOT, "apps/web/app");
const COMPANY_APP = join(REPO_ROOT, "apps/company/app");

// ── metadata.robots 파서 ─────────────────────────────────────────────────────

/**
 * 소스에서 `robots:` 선언을 전부 찾아 index 허용 여부를 뽑는다.
 * generateMetadata 안의 조건 분기(예: legal/[slug] 의 잘못된 slug → noindex)도
 * 모두 잡히므로 결과는 배열이다.
 * @returns {{values:(boolean|null)[], lines:number[]}}
 */
function parseRobots(src) {
  const values = [];
  const lines = [];
  const re = /robots\s*:\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const ch = src[start];
    let literal = "";
    if (ch === "{") {
      // 중괄호 균형 맞춰 객체 리터럴 추출 (중첩 1~2단계면 충분)
      let depth = 0;
      let i = start;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      literal = src.slice(start, i + 1);
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const end = src.indexOf(ch, start + 1);
      literal = src.slice(start, end === -1 ? start + 1 : end + 1);
    } else {
      literal = src.slice(start, start + 40);
    }

    let value = null; // null = 판정 불가
    if (/index\s*:\s*true/.test(literal)) value = true;
    else if (/index\s*:\s*false/.test(literal)) value = false;
    else if (/noindex/i.test(literal)) value = false;
    else if (/(^|[^o])index/i.test(literal.replace(/robots/g, ""))) value = true;

    values.push(value);
    lines.push(src.slice(0, m.index).split("\n").length);
  }
  return { values, lines };
}

/**
 * 라우트의 실효 robots 를 결정한다.
 * Next 의 metadata 병합 규칙: 자식이 robots 를 선언하면 그것이 이기고,
 * 선언하지 않으면 가장 가까운 상위 layout 의 값을 상속한다.
 */
function resolveRobots(appDir, route) {
  const chain = [];
  if (route.kind === "page") chain.push({ file: route.file, why: "page" });
  for (let i = route.dirSegments.length; i >= 0; i--) {
    const dir = join(appDir, ...route.dirSegments.slice(0, i));
    for (const ext of ["tsx", "ts", "jsx", "js"]) {
      const f = join(dir, `layout.${ext}`);
      if (existsSync(f)) {
        chain.push({ file: f, why: "layout" });
        break;
      }
    }
  }
  for (const link of chain) {
    const src = readIfExists(link.file);
    if (!src) continue;
    const { values, lines } = parseRobots(src);
    if (values.length === 0) continue;
    return {
      source: link.file,
      why: link.why,
      values,
      line: lines[0],
      allowsIndex: values.includes(true),
      mixed: values.includes(true) && values.includes(false),
      unknown: values.includes(null),
    };
  }
  return { source: null, why: "none", values: [], line: null, allowsIndex: false, mixed: false, unknown: false };
}

// ── next.config.ts 의 X-Robots-Tag 헤더 규칙 파서 ────────────────────────────

/**
 * headers() 안에서 X-Robots-Tag: noindex 를 붙이는 항목의 `source` 문자열을 뽑는다.
 */
function parseNoindexHeaderSources(src) {
  const out = [];
  // { source: "...", headers: [{ key: "X-Robots-Tag", value: "noindex..." }] }
  const blockRe = /\{\s*(?:\/\/[^\n]*\n\s*)*source\s*:\s*(["'`])([\s\S]*?)\1([\s\S]*?)\n\s*\},?/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const source = m[2];
    const body = m[3];
    if (/X-Robots-Tag/i.test(body) && /noindex/i.test(body)) {
      out.push({ source, line: src.slice(0, m.index).split("\n").length });
    }
  }
  return out;
}

/**
 * Next 의 `source` 패턴을 JS RegExp 로 변환한다.
 * 이 리포에서 쓰는 패턴은 정규식 리터럴 형태(`/((?!$|legal).*)`)라 그대로 앵커만 붙이면 된다.
 * `:param` 형태의 path-to-regexp 문법이 섞여 있으면 정적 평가가 불가능하므로 null 을 반환한다.
 */
function sourceToRegExp(source) {
  if (/:[A-Za-z_]/.test(source)) return null;
  try {
    return new RegExp(`^${source}$`);
  } catch {
    return null;
  }
}

/** `(?!$|legal|about)` 형태의 lookahead 에서 예외 토큰을 추출 */
function parseExclusionTokens(source) {
  const m = source.match(/\(\?!([^)]*)\)/);
  if (!m) return [];
  return m[1]
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t && t !== "$");
}

// ── 1) apps/web ──────────────────────────────────────────────────────────────

const OWNER_SCAFFOLD = "오케스트레이터(스캐폴드 소유) / 공식 페이지 담당 E4";

function isOfficialWebPath(p) {
  return p === "/" || p === "/legal" || p.startsWith("/legal/");
}

function checkWeb() {
  const routes = collectRoutes(WEB_APP);
  const pageRoutes = routes.filter((r) => r.kind === "page");
  const apiRoutes = routes.filter((r) => r.kind === "route");

  // 1-a. metadata.robots 교차 검증
  for (const r of pageRoutes) {
    const res = resolveRobots(WEB_APP, r);
    const official = isOfficialWebPath(r.path);

    if (!res.source) {
      report.fail(
        "WEB-META-MISSING",
        rel(r.file),
        null,
        `${r.path} — page/layout 어디에도 metadata.robots 선언이 없다. 상속 체인 최상단(app/layout.tsx)에 기본 noindex 를 두거나 이 라우트에 직접 선언할 것.`,
        "해당 라우트 담당 FE 에이전트",
      );
      continue;
    }
    if (res.unknown) {
      report.warn(
        "WEB-META-UNPARSED",
        rel(res.source),
        res.line,
        `${r.path} — robots 값을 정적으로 판정하지 못했다(변수/스프레드 추정). 수동 확인 필요.`,
      );
    }
    if (official && !res.allowsIndex) {
      report.fail(
        "WEB-OFFICIAL-NOINDEX",
        rel(res.source),
        res.line,
        `${r.path} 는 공식 페이지인데 실효 robots 가 noindex 다 (${res.why} 상속). index:true 를 명시할 것.`,
        "E4",
      );
    }
    if (!official && res.allowsIndex) {
      report.fail(
        "WEB-UGC-INDEXABLE",
        rel(res.source),
        res.line,
        `${r.path} 는 UGC/회원 영역인데 metadata.robots 가 index 를 허용한다 (PRD 절대 규칙 5 위반).`,
        "해당 라우트 담당 FE 에이전트",
      );
    }
    if (!official && res.mixed) {
      report.warn(
        "WEB-UGC-MIXED",
        rel(res.source),
        res.line,
        `${r.path} — 같은 파일에 index:true/false 가 섞여 있다. 분기 조건을 확인할 것.`,
      );
    }
  }

  // 1-b. next.config.ts X-Robots-Tag ↔ 라우트 대조
  const cfgPath = join(REPO_ROOT, "apps/web/next.config.ts");
  const cfg = readIfExists(cfgPath);
  if (!cfg) {
    report.fail("WEB-CONFIG-MISSING", "apps/web/next.config.ts", null, "next.config.ts 를 찾을 수 없다.");
    return { pageRoutes, apiRoutes };
  }
  const sources = parseNoindexHeaderSources(cfg);
  if (sources.length === 0) {
    report.fail(
      "WEB-HEADER-MISSING",
      rel(cfgPath),
      null,
      "headers() 에 X-Robots-Tag: noindex 규칙이 없다. metadata 만으로는 API 라우트·정적 파일을 덮지 못한다.",
      OWNER_SCAFFOLD,
    );
  }

  const compiled = sources
    .map((s) => ({ ...s, re: sourceToRegExp(s.source) }))
    .filter((s) => {
      if (!s.re) {
        report.warn(
          "WEB-HEADER-UNPARSED",
          rel(cfgPath),
          s.line,
          `source "${s.source}" 는 path-to-regexp 파라미터를 포함해 정적 평가가 불가능하다. 수동 확인 필요.`,
        );
        return false;
      }
      return true;
    });

  const covered = (p) => compiled.some((s) => s.re.test(p));

  for (const r of [...pageRoutes, ...apiRoutes]) {
    const p = concretePath(r.path);
    const official = isOfficialWebPath(r.path);
    if (official && covered(p)) {
      report.fail(
        "WEB-HEADER-OVERBLOCK",
        rel(cfgPath),
        compiled[0]?.line ?? null,
        `공식 페이지 ${r.path} 가 X-Robots-Tag noindex 헤더에 걸린다. HTTP 헤더는 metadata 를 덮으므로 index:true 가 무효화된다.`,
        OWNER_SCAFFOLD,
      );
    }
    if (!official && !covered(p)) {
      report.fail(
        "WEB-HEADER-GAP",
        rel(cfgPath),
        compiled[0]?.line ?? null,
        `${r.path} (${r.kind}) 가 X-Robots-Tag noindex 헤더 규칙에 걸리지 않는다. source 정규식을 넓힐 것.`,
        OWNER_SCAFFOLD,
      );
    }
  }

  // 1-c. 헤더 예외 토큰이 실제 공식 라우트인지 (고아 예외 = 미래 라우트 누출 구멍)
  const officialPrefixes = new Set(
    pageRoutes.filter((r) => isOfficialWebPath(r.path)).map((r) => r.path.split("/")[1] || ""),
  );
  for (const s of sources) {
    for (const token of parseExclusionTokens(s.source)) {
      if (!/^[a-z0-9-]+$/i.test(token)) continue;
      if (officialPrefixes.has(token) && !/\(\?=\//.test(s.source)) {
        report.warn(
          "WEB-HEADER-PREFIX-MATCH",
          rel(cfgPath),
          s.line,
          `noindex 예외 "${token}" 이 세그먼트 경계 없이 접두사로만 매칭된다 — /${token}xxx 같은 라우트가 생기면 의도치 않게 인덱싱된다. \`(?!$|${token}(?=/|$)|…)\` 형태로 경계를 명시하면 안전하다.`,
        );
      }
      if (!officialPrefixes.has(token)) {
        report.fail(
          "WEB-HEADER-STALE-EXCEPTION",
          rel(cfgPath),
          s.line,
          `noindex 예외 "${token}" 에 해당하는 공식 라우트가 존재하지 않는다. 접두사 매칭이라 앞으로 /${token}* 로 시작하는 UGC 라우트가 생기면 그대로 인덱싱된다. 삭제하거나 실제 라우트를 만들 것.`,
          OWNER_SCAFFOLD,
        );
      }
    }
  }

  // 1-d. sitemap / robots.txt 존재 + 공식 페이지만 포함
  const sitemapCandidates = [
    join(REPO_ROOT, "apps/web/app/sitemap.ts"),
    join(REPO_ROOT, "apps/web/app/sitemap.js"),
    join(REPO_ROOT, "apps/web/app/sitemap.xml/route.ts"),
    join(REPO_ROOT, "apps/web/public/sitemap.xml"),
  ];
  const sitemapFile = sitemapCandidates.find((f) => existsSync(f));
  if (!sitemapFile) {
    report.fail(
      "WEB-SITEMAP-MISSING",
      "apps/web/app/sitemap.ts",
      null,
      "apps/web 에 sitemap 이 없다. PRD G-6 '공식 페이지만 sitemap' 을 충족하려면 `/` 와 `/legal/**` 6종만 담은 app/sitemap.ts 가 필요하다.",
      "E4 (공식 페이지 담당)",
    );
  } else {
    const src = readIfExists(sitemapFile) ?? "";
    const paths = [...src.matchAll(/["'`](\/[A-Za-z0-9\-_/[\]]*)["'`]/g)].map((m) => m[1]);
    for (const p of paths) {
      if (!isOfficialWebPath(p)) {
        report.fail(
          "WEB-SITEMAP-UGC",
          rel(sitemapFile),
          null,
          `sitemap 에 비공식 라우트 ${p} 가 들어 있다. 공식 페이지(/, /legal/**)만 허용.`,
          "E4",
        );
      }
    }
  }

  const robotsTxt = [
    join(REPO_ROOT, "apps/web/app/robots.ts"),
    join(REPO_ROOT, "apps/web/app/robots.js"),
    join(REPO_ROOT, "apps/web/public/robots.txt"),
  ].find((f) => existsSync(f));
  if (!robotsTxt) {
    report.fail(
      "WEB-ROBOTSTXT-MISSING",
      "apps/web/app/robots.ts",
      null,
      "apps/web 에 robots.txt 생성부가 없다. 크롤러에 Disallow 를 명시하고 sitemap 위치를 알리려면 app/robots.ts 가 필요하다.",
      "E4 (공식 페이지 담당)",
    );
  }

  return { pageRoutes, apiRoutes };
}

// ── 2) apps/company ──────────────────────────────────────────────────────────

function checkCompany() {
  const routes = collectRoutes(COMPANY_APP).filter((r) => r.kind === "page");

  for (const r of routes) {
    const res = resolveRobots(COMPANY_APP, r);
    if (res.source && !res.allowsIndex) {
      report.fail(
        "CMP-NOINDEX",
        rel(res.source),
        res.line,
        `${r.path} — 회사 사이트는 전 페이지 인덱싱 허용이어야 한다(404 제외).`,
        "E5",
      );
    }
  }

  // sitemap ROUTES == 실제 라우트 집합
  const smFile = join(REPO_ROOT, "apps/company/app/sitemap.ts");
  const sm = readIfExists(smFile);
  if (!sm) {
    report.fail("CMP-SITEMAP-MISSING", "apps/company/app/sitemap.ts", null, "회사 사이트 sitemap 이 없다.", "E5");
  } else {
    const declared = new Set(
      [...sm.matchAll(/path\s*:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
    );
    const actual = new Set(routes.map((r) => r.path));
    for (const p of declared) {
      if (!actual.has(p)) {
        report.fail("CMP-SITEMAP-GHOST", rel(smFile), null, `sitemap 에 실제 라우트가 없는 경로 ${p} 가 있다.`, "E5");
      }
    }
    for (const p of actual) {
      if (!declared.has(p)) {
        report.fail(
          "CMP-SITEMAP-MISS",
          rel(smFile),
          null,
          `라우트 ${p} 가 sitemap 에 빠져 있다 (회사 사이트는 전 페이지 인덱싱 대상).`,
          "E5",
        );
      }
    }
  }

  if (!existsSync(join(REPO_ROOT, "apps/company/app/robots.ts"))) {
    report.fail("CMP-ROBOTSTXT-MISSING", "apps/company/app/robots.ts", null, "회사 사이트 robots.txt 생성부가 없다.", "E5");
  }

  // out/ 산출물 실측 (있을 때만 — .gitignore 대상이라 CI 첫 실행 시엔 없다)
  const outDir = join(REPO_ROOT, "apps/company/out");
  if (!existsSync(outDir)) {
    report.warn(
      "CMP-OUT-ABSENT",
      "apps/company/out",
      null,
      "정적 export 산출물이 없어 HTML meta robots 실측을 건너뛴다. `pnpm --filter @duckmate/company build` 후 재실행하면 실측까지 검사한다.",
    );
    return routes;
  }
  for (const f of walkFiles(outDir).filter((f) => f.endsWith(".html"))) {
    const html = readIfExists(f) ?? "";
    const metas = [...html.matchAll(/<meta\s+name="robots"\s+content="([^"]*)"/gi)].map((m) => m[1]);
    const is404 = f.endsWith("404.html");
    const hasNoindex = metas.some((v) => /noindex/i.test(v));
    if (hasNoindex && !is404) {
      report.fail(
        "CMP-OUT-NOINDEX",
        rel(f),
        null,
        `산출물에 noindex 가 붙어 있다 (content="${metas.join(" | ")}"). 404.html 만 예외다.`,
        "E5",
      );
    }
    if (is404 && metas.length > 1) {
      report.warn(
        "CMP-404-CONFLICT",
        rel(f),
        null,
        `404.html 에 robots meta 가 ${metas.length}개 있다 (${metas.join(" | ")}). noindex 와 index 지시가 동시 노출되어 크롤러 해석이 애매하다 — 실동작상 noindex 가 우선하므로 차단은 아니나 정리 권장.`,
      );
    }
    if (!hasNoindex && metas.length === 0) {
      report.warn("CMP-OUT-NOMETA", rel(f), null, "robots meta 가 아예 없다 (기본 index 로 취급).");
    }
  }
  return routes;
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

const web = checkWeb();
const cmp = checkCompany();

process.exit(
  report.finish(
    `apps/web 라우트 ${web.pageRoutes.length}개(page) + ${web.apiRoutes.length}개(route) / apps/company 라우트 ${cmp.length}개 검사`,
  ),
);
