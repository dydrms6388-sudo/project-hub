#!/usr/bin/env node
/**
 * check-noindex — apps/web 를 프로덕션 모드(next build + next start, 더미 env)로 띄워 라우트별 인덱싱 정책을 실측한다 (E6, PRD F-043).
 *
 *  정책(12_flows §0-6 · 25_fe_profile 결정 6 · E6 지시):
 *   - index 허용 = `/`, `/legal`, `/legal/{terms,privacy,location,youth,community,refund,business}`, `/account/delete`, `/safety-guide`(H2)
 *   - 나머지 전부 noindex: <meta name="robots"> 에 noindex + X-Robots-Tag: noindex 헤더.
 *     · 로그인 필요 라우트는 307 → /login?next= 로 통과(리다이렉트 응답에도 X-Robots-Tag 필요)
 *     · (admin) 비로그인 = 404, /dev/* 프로덕션 = 404, 미존재 경로 = 404
 *   - sitemap.xml = 공식 페이지만, robots.txt Disallow 목록 + Sitemap 링크
 *   - company(apps/company/out) = 전 페이지 index,follow(404 제외) + sitemap 7 URL + robots Allow
 *
 *  사용: [NEXT_DIST_DIR=.next-e6] node scripts/check-noindex.mjs [--no-build] [--skip-company] [--port 3010] [--keep]
 *   --no-build : 기존 apps/web/$NEXT_DIST_DIR(기본 .next) 재사용 (CI 에서 build 직후 호출할 때)
 *   NEXT_DIST_DIR : 다른 에이전트의 next dev/build 와 .next 를 공유하지 않도록 산출물 폴더 분리(next.config.ts distDir)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(REPO_ROOT, "apps/web");
const COMPANY_OUT = join(REPO_ROOT, "apps/company/out");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const PORT = Number(args[args.indexOf("--port") + 1]) || 3010;
/** next.config.ts distDir = NEXT_DIST_DIR (G1/E6 가 동시 build/dev 로 .next 를 서로 지우지 않도록 분리). 기본 .next */
const DIST_DIR = process.env.NEXT_DIST_DIR || ".next";
const BASE = `http://127.0.0.1:${PORT}`;

import { DUMMY_ENV as BASE_ENV } from "./lib/dummy-env.mjs";
/** 더미 env(scripts/lib/dummy-env.mjs) + NODE_ENV=production. Supabase 에 실제 연결하지 않는다. */
const DUMMY_ENV = { ...BASE_ENV, NODE_ENV: "production" };

const UUID = "00000000-0000-4000-8000-000000000001";
const LEGAL = ["terms", "privacy", "location", "youth", "community", "refund", "business"];

/** kind: index | noindex-200 | login-redirect | not-found | redirect-308 | api */
const ROUTES = [
  ...["/", "/legal", ...LEGAL.map((s) => `/legal/${s}`), "/account/delete", "/safety-guide"].map((p) => ({ path: p, kind: "index" })),
  ...["/login", "/onboarding/age", "/onboarding/phone", "/blocked/age"].map((p) => ({ path: p, kind: "noindex-200" })),
  ...[
    "/onboarding/basic", "/onboarding/hobbies", "/onboarding/quiz", "/onboarding/card", "/onboarding/photos", "/verify",
    "/home", "/reco", "/reco/done", `/match/${UUID}`, "/chat", `/chat/${UUID}`,
    "/me", "/me/edit", "/me/photos",
    "/settings", "/settings/mode", "/settings/verify", "/settings/subscription", "/settings/notifications", "/settings/blocks",
    "/settings/data", "/settings/data/delete", "/settings/account", "/blocks", "/report", "/report/new", "/appeal", "/suspended", "/account/restore",
  ].map((p) => ({ path: p, kind: "login-redirect" })),
  ...["/admin", "/admin/photos", "/admin/reports", "/admin/users", "/admin/metrics", "/admin/audit"].map((p) => ({ path: p, kind: "not-found" })),
  ...["/dev/discover", "/dev/chat", "/dev/profile", "/no-such-page-e6"].map((p) => ({ path: p, kind: "not-found" })),
  { path: "/legal/youth-policy", kind: "redirect-308", to: "/legal/youth" },
  { path: "/api/health", kind: "api" },
];

const OFFICIAL = new Set(ROUTES.filter((r) => r.kind === "index").map((r) => r.path));
const REQUIRED_DISALLOW = ["/onboarding", "/verify", "/home", "/reco", "/match", "/chat", "/profile", "/me", "/settings", "/report", "/blocks", "/appeal", "/suspended", "/blocked", "/account/restore", "/admin", "/login", "/api", "/dev"];

const results = [];
let failures = 0;
function record(area, path, status, robotsMeta, xRobots, ok, note) {
  results.push({ area, path, status, robotsMeta: robotsMeta ?? "—", xRobots: xRobots ?? "—", ok, note: note ?? "" });
  if (!ok) failures++;
}
function metaRobots(html) {
  const m = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) ?? html.match(/<meta\s+content="([^"]*)"\s+name="robots"/i);
  return m ? m[1] : null;
}
const hasNoindex = (s) => typeof s === "string" && /noindex/i.test(s);

async function probe(path) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { accept: "text/html" } });
  const html = res.headers.get("content-type")?.includes("text/html") ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), xRobots: res.headers.get("x-robots-tag"), meta: metaRobots(html), html };
}

async function checkWebRoutes() {
  for (const r of ROUTES) {
    const p = await probe(r.path);
    let ok = false;
    let note = "";
    switch (r.kind) {
      case "index":
        ok = p.status === 200 && !hasNoindex(p.meta) && !hasNoindex(p.xRobots) && /index/.test(p.meta ?? "index");
        if (!ok) note = "200 + meta index + 헤더 없음 이어야 함";
        break;
      case "noindex-200":
        ok = p.status === 200 && hasNoindex(p.meta) && hasNoindex(p.xRobots);
        if (!ok) note = "200 + meta noindex + X-Robots-Tag 필요";
        break;
      case "login-redirect": {
        const loc = p.location ? new URL(p.location, BASE) : null;
        const redirected = [307, 308, 302, 303].includes(p.status) && loc?.pathname === "/login";
        if (redirected) {
          ok = hasNoindex(p.xRobots);
          note = ok ? `→ ${loc.pathname}${loc.search}` : "리다이렉트 응답에 X-Robots-Tag 없음";
        } else if (p.status === 200) {
          ok = hasNoindex(p.meta) && hasNoindex(p.xRobots);
          note = ok ? "200(로그인 불필요) + noindex" : "200 인데 noindex 누락";
        } else {
          note = "307 → /login 기대";
        }
        break;
      }
      case "not-found":
        ok = p.status === 404 && hasNoindex(p.xRobots ?? (r.path.startsWith("/no-such") ? "noindex" : null)) && (p.meta === null || hasNoindex(p.meta));
        if (!ok) note = "404 + X-Robots-Tag(noindex) 기대";
        if (r.path.startsWith("/no-such")) ok = p.status === 404 && (p.meta === null || hasNoindex(p.meta)); // 임의 경로는 헤더 규칙 대상 아님
        break;
      case "redirect-308": {
        const loc = p.location ? new URL(p.location, BASE) : null;
        ok = [308, 301].includes(p.status) && loc?.pathname === r.to;
        note = ok ? `→ ${r.to}` : `308 → ${r.to} 기대`;
        break;
      }
      case "api":
        ok = hasNoindex(p.xRobots);
        if (!ok) note = "/api/* X-Robots-Tag 필요";
        break;
    }
    record("web", r.path, p.status, p.meta, p.xRobots, ok, note);
  }
}

async function checkWebSitemapRobots() {
  const sm = await fetch(`${BASE}/sitemap.xml`);
  const xml = await sm.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const extra = locs.filter((p) => !OFFICIAL.has(p));
  const missing = [...OFFICIAL].filter((p) => !locs.includes(p));
  const ok = sm.status === 200 && extra.length === 0 && missing.length === 0;
  record("web", "/sitemap.xml", sm.status, `${locs.length} url`, null, ok, ok ? "공식 페이지만" : `초과 ${extra.join(",") || "-"} / 누락 ${missing.join(",") || "-"}`);

  const rb = await fetch(`${BASE}/robots.txt`);
  const txt = await rb.text();
  const disallows = [...txt.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
  const lack = REQUIRED_DISALLOW.filter((d) => !disallows.some((x) => x === d || x === d + "/"));
  const hasSitemap = /^Sitemap:\s*\S+\/sitemap\.xml/im.test(txt);
  const ok2 = rb.status === 200 && lack.length === 0 && hasSitemap;
  record("web", "/robots.txt", rb.status, `Disallow ${disallows.length}`, null, ok2, ok2 ? "필수 Disallow + Sitemap" : `누락 Disallow: ${lack.join(",") || "-"}${hasSitemap ? "" : " / Sitemap 줄 없음"}`);
}

function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}

function checkCompany() {
  if (!existsSync(COMPANY_OUT)) {
    record("company", "out/", 0, null, null, false, "apps/company/out 없음 — pnpm --filter @duckmate/company build 먼저");
    return;
  }
  for (const f of walkHtml(COMPANY_OUT)) {
    const rel = "/" + relative(COMPANY_OUT, f).replace(/\\/g, "/");
    const html = readFileSync(f, "utf8");
    const meta = metaRobots(html);
    const is404 = /(^|\/)404(\.html|\/index\.html)$/.test(rel);
    const ok = is404 ? hasNoindex(meta) : !hasNoindex(meta) && /index/.test(meta ?? "");
    record("company", rel, 200, meta, null, ok, is404 ? "404 페이지 noindex" : ok ? "" : "index, follow 기대");
  }
  const smPath = join(COMPANY_OUT, "sitemap.xml");
  const locs = existsSync(smPath) ? [...readFileSync(smPath, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname) : [];
  const appLeak = locs.filter((p) => /^\/(home|reco|chat|me|settings|onboarding|admin|dev)/.test(p));
  const ok = locs.length === 7 && appLeak.length === 0;
  record("company", "/sitemap.xml", 200, `${locs.length} url`, null, ok, ok ? "홈·법적 5·문의" : `7 URL 기대(현재 ${locs.length})${appLeak.length ? ` / 앱 경로 유출 ${appLeak.join(",")}` : ""}`);
  const rbPath = join(COMPANY_OUT, "robots.txt");
  const rb = existsSync(rbPath) ? readFileSync(rbPath, "utf8") : "";
  const ok2 = /^Allow:\s*\/$/im.test(rb) && /^Sitemap:/im.test(rb);
  record("company", "/robots.txt", 200, null, null, ok2, ok2 ? "Allow / + Sitemap" : "Allow: / 와 Sitemap 줄 필요");
}

function build() {
  console.log("[check-noindex] next build (apps/web, 더미 env) …");
  const r = spawnSync("pnpm", ["exec", "next", "build"], { cwd: WEB_DIR, stdio: "inherit", env: { ...process.env, ...DUMMY_ENV, NEXT_DIST_DIR: DIST_DIR, NODE_ENV: undefined } });
  if (r.status !== 0) { console.error("[check-noindex] build 실패"); process.exit(1); }
}

async function startServer() {
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: WEB_DIR, env: { ...process.env, ...DUMMY_ENV, NEXT_DIST_DIR: DIST_DIR }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return child;
    } catch { /* not yet */ }
    if (child.exitCode !== null) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  console.error("[check-noindex] next start 준비 실패\n" + log);
  child.kill("SIGTERM");
  process.exit(1);
}

function printTable() {
  console.log("\n| 영역 | 경로 | 상태 | meta robots | X-Robots-Tag | 판정 | 비고 |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of results) console.log(`| ${r.area} | ${r.path} | ${r.status} | ${r.robotsMeta} | ${r.xRobots} | ${r.ok ? "✅" : "❌"} | ${r.note} |`);
}

(async () => {
  if (!flag("--no-build")) build();
  else if (!existsSync(join(WEB_DIR, DIST_DIR, "BUILD_ID"))) { console.error(`[check-noindex] ${DIST_DIR}/BUILD_ID 없음 — --no-build 는 build 후에만`); process.exit(1); }
  const server = await startServer();
  try {
    await checkWebRoutes();
    await checkWebSitemapRobots();
  } finally {
    if (!flag("--keep")) server.kill("SIGTERM");
  }
  if (!flag("--skip-company")) checkCompany();
  printTable();
  console.log(`\n${failures === 0 ? "✅" : "❌"} [check-noindex] ${results.length} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
