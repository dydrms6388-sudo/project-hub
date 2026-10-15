#!/usr/bin/env node
/**
 * measure-web-vitals — Lighthouse 대체/보완 실측 (E6).
 *
 *  Playwright(크로미움) 로 페이지를 열어 PerformanceObserver 로 LCP·CLS, FCP/TTFB, DOM 노드 수, JS/CSS 전송량(gzip) 을 재고
 *  axe-core(로컬 node_modules → npm pack 캐시 → 불가 시 자체 규칙) 로 WCAG 2.1 AA 위반을 센다.
 *  `--lighthouse` 를 주면 `npx lighthouse@13` 로 4개 카테고리 점수도 같이 낸다(크로미움 경로 = CHROME_PATH).
 *
 *  대상
 *   - web(prod, next start)      : / · /login · /legal/terms · /account/delete
 *   - web(dev, next dev)         : /dev/discover?screen=reco · /dev/discover?screen=home · /dev/chat?view=room · /dev/profile
 *                                  (NODE_ENV=production 이면 404 라 dev 서버가 필요. JS 크기는 비압축·개발 번들이라 참고값)
 *   - company(apps/company/out)  : / · /contact/ · /legal/terms/   (내장 정적 서버, gzip)
 *  목표: LCP ≤ 2.5s · CLS ≤ 0.1 · web 홈 런타임 JS ≤ 200KB gz
 *        company 홈은 **First Load ≤ 130KB gz + 페이지 고유 ≤ 30KB gz** (13_company_site 결정 23 개정 — 27_fe_quality 결정 16 제안을 H2 가 반영).
 *        Next App Router 공통 프레임워크가 102KB gz 라 기존 "홈 JS ≤ 80KB" 는 React 를 버리지 않는 한 도달 불가였다.
 *        런타임 전송량(jsGzKb)은 nomodule 폴리필 39.5KB 를 포함하므로 First Load(app-build-manifest) 와 값이 다르다 — 판정은 First Load 기준.
 *
 *  사용: [NEXT_DIST_DIR=.next-e6] node scripts/measure-web-vitals.mjs [--no-build] [--skip-dev] [--skip-company] [--lighthouse]
 *        [--json <file>] [--md <file>] [--strict]
 *   --no-build : apps/web/$NEXT_DIST_DIR 재사용. dev 서버는 NEXT_DEV_DIST_DIR(기본 .next-dev) 로 분리해 prod 산출물을 건드리지 않는다.
 *   --strict   : 목표 미달·axe critical/serious 위반이 있으면 exit 1 (기본은 측정만, exit 0)
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { CHROMIUM_CANDIDATES, DUMMY_ENV } from "./lib/dummy-env.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(REPO_ROOT, "apps/web");
const COMPANY_OUT = join(REPO_ROOT, "apps/company/out");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DIST_DIR = process.env.NEXT_DIST_DIR || ".next";
const DEV_DIST_DIR = process.env.NEXT_DEV_DIST_DIR || ".next-dev";
const PORT_PROD = Number(opt("--port", 3011));
const PORT_DEV = PORT_PROD + 1;
const PORT_COMPANY = PORT_PROD + 2;

const TARGETS = {
  lcpMs: 2500,
  cls: 0.1,
  /** 런타임 same-origin JS 전송량(gz, nomodule 폴리필 포함) */
  jsGzKb: { "web:/": 200 },
  /** First Load JS (app-build-manifest: root layout + 그룹 layout + page, gz) */
  firstLoadGzKb: { "company:/": 130 },
  /** 페이지 고유 JS (First Load 에서 layout 공통분을 뺀 값, gz) */
  pageOwnGzKb: { "company:/": 30 },
};
const PAGES = {
  prod: ["/", "/login", "/legal/terms", "/account/delete"],
  dev: ["/dev/discover?screen=reco", "/dev/discover?screen=home", "/dev/chat?view=room", "/dev/profile"],
  company: ["/", "/contact/", "/legal/terms/"],
};

const require = createRequire(join(WEB_DIR, "package.json"));
const { chromium } = require("@playwright/test");
const chromiumPath = CHROMIUM_CANDIDATES.find((p) => existsSync(p));

// ---------- axe-core 확보 ----------
function loadAxe() {
  try {
    return readFileSync(createRequire(join(REPO_ROOT, "package.json")).resolve("axe-core/axe.min.js"), "utf8");
  } catch { /* not installed */ }
  const cacheDir = join(REPO_ROOT, "node_modules/.cache/e6-axe");
  const cached = join(cacheDir, "package/axe.min.js");
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  try {
    mkdirSync(cacheDir, { recursive: true });
    const r = spawnSync("npm", ["pack", "axe-core@4.10.3", "--silent"], { cwd: cacheDir, stdio: "pipe", timeout: 90_000 });
    if (r.status === 0) {
      spawnSync("tar", ["-xzf", "axe-core-4.10.3.tgz", "package/axe.min.js"], { cwd: cacheDir });
      if (existsSync(cached)) return readFileSync(cached, "utf8");
    }
  } catch { /* offline */ }
  return null;
}

// ---------- 서버 ----------
function waitFor(url, { timeoutMs = 120_000, child, okStatuses = [200] } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((res, rej) => {
    const tick = async () => {
      if (child && child.exitCode !== null) return rej(new Error(`server exited (${child.exitCode})`));
      try {
        const r = await fetch(url, { redirect: "manual" });
        if (okStatuses.includes(r.status)) return res();
      } catch { /* not yet */ }
      if (Date.now() > deadline) return rej(new Error(`timeout waiting ${url}`));
      setTimeout(tick, 700);
    };
    tick();
  });
}

function spawnNext(argv, env) {
  const child = spawn("pnpm", ["exec", "next", ...argv], { cwd: WEB_DIR, env: { ...process.env, ...DUMMY_ENV, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  child.log = "";
  child.stdout.on("data", (d) => (child.log += d));
  child.stderr.on("data", (d) => (child.log += d));
  return child;
}

async function startProd() {
  if (!flag("--no-build")) {
    console.log(`[vitals] next build → ${DIST_DIR}`);
    const r = spawnSync("pnpm", ["exec", "next", "build"], { cwd: WEB_DIR, stdio: "inherit", env: { ...process.env, ...DUMMY_ENV, NEXT_DIST_DIR: DIST_DIR, NODE_ENV: undefined } });
    if (r.status !== 0) throw new Error("next build failed");
  }
  const child = spawnNext(["start", "-p", String(PORT_PROD)], { NEXT_DIST_DIR: DIST_DIR, NODE_ENV: "production" });
  await waitFor(`http://127.0.0.1:${PORT_PROD}/api/health`, { child, timeoutMs: 60_000 });
  return child;
}

async function startDev() {
  const child = spawnNext(["dev", "-p", String(PORT_DEV)], { NEXT_DIST_DIR: DEV_DIST_DIR, NODE_ENV: undefined });
  await waitFor(`http://127.0.0.1:${PORT_DEV}/dev/profile`, { child, timeoutMs: 180_000 });
  return child;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".xml": "application/xml", ".txt": "text/plain", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
function startStatic(root, port) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(root, p);
    if (p.endsWith("/")) file = join(file, "index.html");
    else if (!extname(p)) file = existsSync(join(root, p, "index.html")) ? join(root, p, "index.html") : `${file}.html`;
    let status = 200;
    if (!existsSync(file) || statSync(file).isDirectory()) { file = join(root, "404.html"); status = 404; }
    if (!existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    const body = readFileSync(file);
    const type = MIME[extname(file)] ?? "application/octet-stream";
    const gz = /gzip/.test(req.headers["accept-encoding"] ?? "") && /^(text|application)/.test(type);
    res.writeHead(status, { "content-type": type, ...(gz ? { "content-encoding": "gzip" } : {}), "cache-control": "no-store" });
    res.end(gz ? gzipSync(body) : body);
  });
  // 포트 점유(이전 실행 잔재) 시 다음 포트로 최대 10회 이동
  return new Promise((res, rej) => {
    let tries = 0;
    const tryListen = (pt) => {
      server.once("error", (e) => (e.code === "EADDRINUSE" && tries++ < 10 ? tryListen(pt + 1) : rej(e)));
      server.listen(pt, "127.0.0.1", () => { server.port = pt; res(server); });
    };
    tryListen(port);
  });
}

// ---------- 측정 ----------
const INIT_SCRIPT = `
  window.__vitals = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
`;

const FALLBACK_RULES = `(() => {
  const v = [];
  const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent || Array.from(el.querySelectorAll('img[alt]')).map(i => i.alt).join(' ')).trim();
  const imgs = Array.from(document.images).filter(i => !i.hasAttribute('alt'));
  if (imgs.length) v.push({ id: 'image-alt', impact: 'critical', nodes: imgs.length });
  const btn = Array.from(document.querySelectorAll('button, a[href], [role=button]')).filter(el => vis(el) && !name(el));
  if (btn.length) v.push({ id: 'button-name/link-name', impact: 'critical', nodes: btn.length, sample: btn[0].outerHTML.slice(0, 120) });
  const ctl = Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea')).filter(el => vis(el) && !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label')));
  if (ctl.length) v.push({ id: 'label', impact: 'critical', nodes: ctl.length, sample: ctl[0].outerHTML.slice(0, 120) });
  const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => +h.tagName[1]);
  let skips = 0; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips++;
  if (skips) v.push({ id: 'heading-order', impact: 'moderate', nodes: skips });
  if (!document.documentElement.lang) v.push({ id: 'html-has-lang', impact: 'serious', nodes: 1 });
  const ids = Array.from(document.querySelectorAll('[id]')).map(e => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) v.push({ id: 'duplicate-id', impact: 'minor', nodes: dup.length, sample: dup[0] });
  if (document.querySelectorAll('main').length !== 1) v.push({ id: 'landmark-one-main', impact: 'moderate', nodes: document.querySelectorAll('main').length });
  return v;
})()`;

async function measurePage(browser, base, path, { mode, axeSource }) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const page = await ctx.newPage();
  const external = new Set();
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return route.continue();
    external.add(u.hostname);
    return route.abort(); // 샌드박스: 외부 CDN(Pretendard) 차단 → 폴백 폰트로 측정
  });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140)); });
  const http4xx = [];
  page.on("response", (r) => { if (r.status() >= 400 && new URL(r.url()).hostname === "127.0.0.1") http4xx.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await page.addInitScript(INIT_SCRIPT);
  const url = base + path;
  // 워밍업 1회(서버 캐시·dev 컴파일). 측정은 두 번째 로드(브라우저 캐시는 새 컨텍스트라 비어 있음)
  { const warm = await browser.newContext(); const wp = await warm.newPage(); await wp.route("**/*", (r) => (/^(127\.0\.0\.1|localhost)$/.test(new URL(r.request().url()).hostname) ? r.continue() : r.abort())); await wp.goto(url, { waitUntil: "load", timeout: 120_000 }); await warm.close(); }
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  try { await page.waitForLoadState("networkidle", { timeout: 10_000 }); } catch { /* 폴링 등 */ }
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const sameOrigin = res.filter((r) => new URL(r.name).origin === location.origin);
    const sum = (arr, k) => arr.reduce((n, r) => n + (r[k] || 0), 0);
    const js = sameOrigin.filter((r) => /\.js(\?|$)/.test(r.name));
    const css = sameOrigin.filter((r) => /\.css(\?|$)/.test(r.name));
    return {
      lcp: window.__vitals.lcp, cls: window.__vitals.cls,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      ttfb: nav?.responseStart ?? null, dcl: nav?.domContentLoadedEventEnd ?? null, load: nav?.loadEventEnd ?? null,
      docTransfer: nav?.transferSize ?? 0,
      domNodes: document.getElementsByTagName("*").length,
      jsCount: js.length, jsTransfer: sum(js, "transferSize"), jsDecoded: sum(js, "decodedBodySize"),
      cssTransfer: sum(css, "transferSize"), title: document.title, h1: document.querySelectorAll("h1").length,
      metaRobots: document.querySelector('meta[name="robots"]')?.content ?? null,
    };
  });
  let axe = null;
  if (axeSource) {
    await page.addScriptTag({ content: axeSource });
    axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      return { engine: "axe-core " + window.axe.version, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.[0] ?? "", help: v.help })), passes: r.passes.length };
    });
  } else {
    axe = { engine: "fallback-rules", violations: await page.evaluate(FALLBACK_RULES), passes: null };
  }
  await ctx.close();
  return { mode, path, url, ...m, wall: Date.now() - t0, external: [...external], consoleErrors, http4xx, axe };
}

// ---------- Lighthouse ----------
/** 비동기 spawn — company 정적 서버가 같은 프로세스의 이벤트 루프에 있으므로 spawnSync 를 쓰면 서버가 응답하지 못해 Lighthouse 가 타임아웃한다 */
function runLighthouse(url, outFile) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--yes", "lighthouse@13.4.1", url, "--output=json", `--output-path=${outFile}`, "--chrome-flags=--headless=new --no-sandbox --disable-gpu", "--only-categories=performance,accessibility,best-practices,seo", "--form-factor=mobile", "--quiet"], {
      env: { ...process.env, CHROME_PATH: chromiumPath ?? process.env.CHROME_PATH }, stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 300_000);
    child.on("exit", (code) => { clearTimeout(timer); resolve(parseLighthouse(code, outFile, err)); });
  });
}
function parseLighthouse(status, outFile, stderr) {
  if (status !== 0 || !existsSync(outFile)) return { error: (stderr || "lighthouse failed").trim().split("\n").slice(-3).join(" ").slice(0, 200) };
  const j = JSON.parse(readFileSync(outFile, "utf8"));
  const fails = (cat) => j.categories[cat].auditRefs.map((a) => j.audits[a.id]).filter((a) => a && a.score === 0).map((a) => a.id);
  return {
    scores: Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)])),
    lcp: j.audits["largest-contentful-paint"]?.numericValue, cls: j.audits["cumulative-layout-shift"]?.numericValue, tbt: j.audits["total-blocking-time"]?.numericValue,
    fails: { accessibility: fails("accessibility"), seo: fails("seo"), "best-practices": fails("best-practices") },
  };
}

// ---------- 번들(First Load JS) ----------
function bundleReport(appDir, distDir) {
  const manifestPath = join(appDir, distDir, "app-build-manifest.json");
  if (!existsSync(manifestPath)) return null;
  const { pages } = JSON.parse(readFileSync(manifestPath, "utf8"));
  const gzCache = new Map();
  const gz = (f) => {
    if (!gzCache.has(f)) { const p = join(appDir, distDir, f); gzCache.set(f, existsSync(p) ? gzipSync(readFileSync(p)).length : 0); }
    return gzCache.get(f);
  };
  const rows = [];
  for (const key of Object.keys(pages)) {
    if (!key.endsWith("/page")) continue;
    const segs = key.split("/").slice(1, -1);
    const files = new Set(pages["/layout"] ?? []);
    for (let i = 1; i <= segs.length; i++) for (const f of pages[`/${segs.slice(0, i).join("/")}/layout`] ?? []) files.add(f);
    for (const f of pages[key]) files.add(f);
    const route = "/" + segs.filter((s) => !/^\(.*\)$/.test(s)).join("/");
    const js = [...files].filter((f) => f.endsWith(".js"));
    // 페이지 고유분 = page 엔트리에만 있는 청크(layout 공통분 제외)
    const layoutFiles = new Set([...files].filter((f) => !pages[key].includes(f)));
    const own = js.filter((f) => !layoutFiles.has(f));
    rows.push({
      route: route === "/" ? "/" : route.replace(/\/$/, ""),
      files: js.length,
      firstLoadGzKb: +(js.reduce((n, f) => n + gz(f), 0) / 1024).toFixed(1),
      pageOwnGzKb: +(own.reduce((n, f) => n + gz(f), 0) / 1024).toFixed(1),
    });
  }
  return rows.sort((a, b) => b.firstLoadGzKb - a.firstLoadGzKb);
}

// ---------- 출력 ----------
const kb = (n) => (n == null ? "—" : (n / 1024).toFixed(1));
const ms = (n) => (n == null ? "—" : Math.round(n));
function verdict(r, area) {
  const fails = [];
  if (r.lcp > TARGETS.lcpMs) fails.push(`LCP>${TARGETS.lcpMs}`);
  if (r.cls > TARGETS.cls) fails.push(`CLS>${TARGETS.cls}`);
  const key = `${area}:${r.path}`;
  if (TARGETS.jsGzKb[key] && r.mode !== "dev" && r.jsTransfer / 1024 > TARGETS.jsGzKb[key]) fails.push(`JS>${TARGETS.jsGzKb[key]}KB`);
  const a11y = (r.axe?.violations ?? []).filter((v) => v.impact === "critical" || v.impact === "serious");
  if (a11y.length) fails.push(`a11y ${a11y.map((v) => v.id).join(",")}`);
  return fails;
}

/** 번들 목표(First Load·페이지 고유) 판정 — 영역별 라우트 키 `area:route` */
function bundleFails(report) {
  const fails = [];
  for (const [area, rows] of Object.entries(report.bundles ?? {})) {
    for (const r of rows ?? []) {
      const key = `${area}:${r.route}`;
      if (TARGETS.firstLoadGzKb[key] && r.firstLoadGzKb > TARGETS.firstLoadGzKb[key]) fails.push(`${key} FirstLoad ${r.firstLoadGzKb}>${TARGETS.firstLoadGzKb[key]}KB`);
      if (TARGETS.pageOwnGzKb[key] && r.pageOwnGzKb > TARGETS.pageOwnGzKb[key]) fails.push(`${key} PageOwn ${r.pageOwnGzKb}>${TARGETS.pageOwnGzKb[key]}KB`);
    }
  }
  return fails;
}

function toMarkdown(report) {
  const L = [];
  L.push(`| 영역 | 모드 | 경로 | LCP ms | CLS | FCP | TTFB | DOM | JS(gz KB) | JS 파일 | axe 위반(critical/serious·기타) | 판정 |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of report.pages) {
    const vio = r.axe?.violations ?? [];
    const hi = vio.filter((v) => v.impact === "critical" || v.impact === "serious");
    const fails = verdict(r, r.area);
    L.push(`| ${r.area} | ${r.mode} | ${r.path} | ${ms(r.lcp)} | ${r.cls.toFixed(3)} | ${ms(r.fcp)} | ${ms(r.ttfb)} | ${r.domNodes} | ${kb(r.jsTransfer)}${r.mode === "dev" ? "*" : ""} | ${r.jsCount} | ${hi.length}/${vio.length - hi.length}${vio.length ? ` (${vio.map((v) => v.id).join(", ")})` : ""} | ${fails.length ? "❌ " + fails.join("; ") : "✅"} |`);
  }
  if (report.lighthouse?.length) {
    L.push("", `| 영역 | 경로 | Perf | A11y | BP | SEO | LCP ms | CLS | TBT ms | 실패 감사 |`, `|---|---|---|---|---|---|---|---|---|---|`);
    for (const l of report.lighthouse) {
      if (l.error) { L.push(`| ${l.area} | ${l.path} | — | — | — | — | — | — | — | ${l.error} |`); continue; }
      const f = Object.entries(l.fails).flatMap(([c, ids]) => ids.map((i) => `${c}:${i}`)).join(", ");
      L.push(`| ${l.area} | ${l.path} | ${l.scores.performance} | ${l.scores.accessibility} | ${l.scores["best-practices"]} | ${l.scores.seo} | ${ms(l.lcp)} | ${(l.cls ?? 0).toFixed(3)} | ${ms(l.tbt)} | ${f || "—"} |`);
    }
  }
  for (const [name, rows] of Object.entries(report.bundles ?? {})) {
    if (!rows) continue;
    L.push("", `**${name} First Load JS (gzip, app-build-manifest 기준: root layout + 그룹 layout + page)**`, "", `| 라우트 | JS 파일 수 | First Load gz KB | 페이지 고유 gz KB | 판정 |`, `|---|---|---|---|---|`);
    for (const r of rows) {
      const key = `${name}:${r.route}`;
      const f = [];
      if (TARGETS.firstLoadGzKb[key] && r.firstLoadGzKb > TARGETS.firstLoadGzKb[key]) f.push(`First Load>${TARGETS.firstLoadGzKb[key]}`);
      if (TARGETS.pageOwnGzKb[key] && r.pageOwnGzKb > TARGETS.pageOwnGzKb[key]) f.push(`고유>${TARGETS.pageOwnGzKb[key]}`);
      const target = TARGETS.firstLoadGzKb[key] || TARGETS.pageOwnGzKb[key];
      L.push(`| ${r.route} | ${r.files} | ${r.firstLoadGzKb} | ${r.pageOwnGzKb} | ${target ? (f.length ? "❌ " + f.join("; ") : "✅") : "—"} |`);
    }
  }
  return L.join("\n");
}

// ---------- main ----------
(async () => {
  const axeSource = loadAxe();
  console.log(`[vitals] axe: ${axeSource ? "axe-core" : "fallback rules"} · chromium: ${chromiumPath ?? "playwright default"} · dist: ${DIST_DIR}`);
  const report = { generatedAt: new Date().toISOString(), targets: TARGETS, pages: [], lighthouse: [], bundles: {} };
  const checkpoint = () => { if (opt("--json")) writeFileSync(resolve(opt("--json")), JSON.stringify(report, null, 2)); };
  const browser = await chromium.launch({ executablePath: chromiumPath, args: ["--no-sandbox"] });
  const procs = [];
  try {
    const prod = await startProd();
    procs.push(prod);
    const base = `http://127.0.0.1:${PORT_PROD}`;
    for (const p of PAGES.prod) { const r = await measurePage(browser, base, p, { mode: "prod", axeSource }); report.pages.push({ area: "web", ...r }); console.log(`  web prod ${p} LCP ${ms(r.lcp)} CLS ${r.cls.toFixed(3)} JS ${kb(r.jsTransfer)}KB axe ${r.axe.violations.length}`); }
    if (flag("--lighthouse")) {
      const dir = join(REPO_ROOT, "node_modules/.cache/e6-lighthouse"); mkdirSync(dir, { recursive: true });
      for (const p of PAGES.prod) { const l = await runLighthouse(base + p, join(dir, `web${p.replace(/[^a-z0-9]/gi, "_") || "_root"}.json`)); report.lighthouse.push({ area: "web", path: p, ...l }); console.log(`  lighthouse web ${p}`, l.scores ?? l.error); }
    }
    prod.kill("SIGTERM");
    report.bundles.web = bundleReport(WEB_DIR, DIST_DIR);
    checkpoint();

    if (!flag("--skip-dev")) {
      console.log(`[vitals] next dev → ${DEV_DIST_DIR} (dev 라우트)`);
      const dev = await startDev();
      procs.push(dev);
      const dbase = `http://127.0.0.1:${PORT_DEV}`;
      for (const p of PAGES.dev) { const r = await measurePage(browser, dbase, p, { mode: "dev", axeSource }); report.pages.push({ area: "web", ...r }); console.log(`  web dev ${p} LCP ${ms(r.lcp)} CLS ${r.cls.toFixed(3)} axe ${r.axe.violations.length}`); }
      dev.kill("SIGTERM");
      checkpoint();
    }

    if (!flag("--skip-company")) {
      if (!existsSync(COMPANY_OUT)) console.warn("[vitals] apps/company/out 없음 — pnpm --filter @duckmate/company build 먼저 (건너뜀)");
      else {
        const srv = await startStatic(COMPANY_OUT, PORT_COMPANY);
        const cbase = `http://127.0.0.1:${srv.port}`;
        for (const p of PAGES.company) { const r = await measurePage(browser, cbase, p, { mode: "static", axeSource }); report.pages.push({ area: "company", ...r }); console.log(`  company ${p} LCP ${ms(r.lcp)} CLS ${r.cls.toFixed(3)} JS ${kb(r.jsTransfer)}KB axe ${r.axe.violations.length}`); }
        if (flag("--lighthouse")) {
          const dir = join(REPO_ROOT, "node_modules/.cache/e6-lighthouse");
          for (const p of PAGES.company) { const l = await runLighthouse(cbase + p, join(dir, `company${p.replace(/[^a-z0-9]/gi, "_") || "_root"}.json`)); report.lighthouse.push({ area: "company", path: p, ...l }); console.log(`  lighthouse company ${p}`, l.scores ?? l.error); }
        }
        srv.close();
        report.bundles.company = bundleReport(join(REPO_ROOT, "apps/company"), ".next");
      }
    }
  } finally {
    for (const c of procs) if (c.exitCode === null) c.kill("SIGTERM");
    await browser.close();
  }

  const md = toMarkdown(report);
  console.log("\n" + md);
  if (opt("--json")) writeFileSync(resolve(opt("--json")), JSON.stringify(report, null, 2));
  if (opt("--md")) writeFileSync(resolve(opt("--md")), md + "\n");
  const failed = report.pages.filter((r) => verdict(r, r.area).length);
  const bundleFailed = bundleFails(report);
  if (bundleFailed.length) console.log(`\n⚠️ [vitals] 번들 목표 미달: ${bundleFailed.join(", ")}`);
  console.log(`\n${failed.length || bundleFailed.length ? "⚠️" : "✅"} [vitals] ${report.pages.length} pages, ${failed.length} below target${failed.length ? ": " + failed.map((r) => `${r.area}${r.path}`).join(", ") : ""}${bundleFailed.length ? ` · 번들 ${bundleFailed.length}건` : ""}${flag("--strict") ? "" : " (측정 모드, exit 0)"}`);
  process.exit(flag("--strict") && (failed.length || bundleFailed.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
