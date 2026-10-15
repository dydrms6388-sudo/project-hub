#!/usr/bin/env node
/* PetCalc DEPLOY GATE
 * 1) gen.mjs 전체 빌드 60초 이내 + 전 데이터 항목 source/checkedAt 누락 0
 * 2) RER/MER 계산 검증 5케이스
 * 3) 전 HTML '광고 영역' / 'REPLACE_' 0건
 * 4) 상대링크 깨짐 0건 (롱테일 깊은 경로 포함)
 * 5) sitemap URL 대응 파일 존재
 * 사용: node tests/run.mjs   (petcalc-kr 폴더 안에서)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SITE_ORIGIN = "https://petcalc-kr.vercel.app";

let pass = 0;
const fails = [];
const ok = (name, extra) => { pass++; console.log("  ✅ " + name + (extra ? " — " + extra : "")); };
const bad = (name, detail) => { fails.push(name + " :: " + detail); console.log("  ❌ " + name + " — " + detail); };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

function walkHtml(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "data" || e.name === "tests") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/* ---------- 1. 빌드 + 데이터 무결성 ---------- */
console.log("\n[1] 빌드 & 데이터 무결성");
let buildMs = 0;
try {
  const t0 = Date.now();
  const out = execFileSync(process.execPath, ["gen.mjs"], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
  buildMs = Date.now() - t0;
  console.log(out.trim().split("\n").map((l) => "     " + l).join("\n"));
  if (buildMs <= 60000) ok("gen.mjs 전체 빌드", buildMs + "ms (< 60000ms)");
  else bad("gen.mjs 전체 빌드", buildMs + "ms > 60000ms");
  if (/경고 0건/.test(out)) ok("생성기 경고 0건");
  else bad("생성기 경고", "경고가 보고됨");
} catch (e) {
  bad("gen.mjs 실행", String(e.message || e).slice(0, 300));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const mods = {
  ages: await import("../data/ages.mjs"),
  feeding: await import("../data/feeding.mjs"),
  vaccine: await import("../data/vaccine.mjs"),
  repro: await import("../data/repro.mjs"),
  costs: await import("../data/costs.mjs"),
  caneatDog: await import("../data/caneat-dog.mjs"),
  caneatCat: await import("../data/caneat-cat.mjs"),
  breeds: await import("../data/breeds.mjs"),
};

// (a) 항목 배열: 모든 원소가 source + checkedAt 를 가져야 한다
const itemLists = [
  ["caneat-dog.items", mods.caneatDog.DOG_CANEAT.items],
  ["caneat-cat.items", mods.caneatCat.CAT_CANEAT.items],
  ["breeds", mods.breeds.BREEDS],
  ["costs.COST_ITEMS", mods.costs.COST_ITEMS],
  ["feeding.MER_FACTORS.dog", mods.feeding.MER_FACTORS.dog],
  ["feeding.MER_FACTORS.cat", mods.feeding.MER_FACTORS.cat],
  ["vaccine.DOG_SCHEDULE", mods.vaccine.DOG_SCHEDULE],
  ["vaccine.CAT_SCHEDULE", mods.vaccine.CAT_SCHEDULE],
  ["repro.DOG_GESTATION.milestones", mods.repro.DOG_GESTATION.milestones],
];
let itemCount = 0;
const missing = [];
for (const [name, arr] of itemLists) {
  if (!Array.isArray(arr) || !arr.length) { missing.push(name + " (배열 없음)"); continue; }
  arr.forEach((it, i) => {
    itemCount++;
    const id = name + "[" + i + "]" + (it.slug || it.key || it.name || it.label ? " " + (it.slug || it.key || it.name || it.label) : "");
    if (!it.source || !/^https?:\/\//.test(String(it.source))) missing.push(id + " source");
    if (!it.checkedAt || !DATE_RE.test(String(it.checkedAt))) missing.push(id + " checkedAt");
  });
}
// (b) source/checkedAt 키를 가진 모든 중첩 객체도 둘 다 갖춰야 한다
function deepCheck(name, val, seen = new Set()) {
  if (!val || typeof val !== "object" || seen.has(val)) return;
  seen.add(val);
  if (Array.isArray(val)) { val.forEach((v, i) => deepCheck(name + "[" + i + "]", v, seen)); return; }
  const hasS = Object.prototype.hasOwnProperty.call(val, "source");
  const hasC = Object.prototype.hasOwnProperty.call(val, "checkedAt");
  if (hasS || hasC) {
    itemCount++;
    if (!val.source || !/^https?:\/\//.test(String(val.source))) missing.push(name + " source");
    if (!val.checkedAt || !DATE_RE.test(String(val.checkedAt))) missing.push(name + " checkedAt");
  }
  for (const k of Object.keys(val)) deepCheck(name + "." + k, val[k], seen);
}
for (const [mname, m] of Object.entries(mods)) {
  for (const k of Object.keys(m)) {
    if (typeof m[k] === "function") continue;
    deepCheck(mname + "." + k, m[k]);
  }
}
if (missing.length === 0) ok("데이터 source/checkedAt 누락 0건", itemCount + "개 항목 검사");
else bad("데이터 source/checkedAt 누락", missing.length + "건: " + missing.slice(0, 5).join(", "));

/* ---------- 2. RER / MER 계산 검증 ---------- */
console.log("\n[2] RER / MER 계산 검증 (5케이스)");
const { calcRER, calcMER, kcalToGrams } = mods.feeding;
const cases = [
  ["RER 1kg = 70.000", calcRER(1), 70.0],
  ["RER 5kg = 234.059", calcRER(5), 234.0591],
  ["RER 10kg = 393.639", calcRER(10), 393.6389],
  ["MER 10kg × 1.6(중성화 성견) = 629.822", calcMER(10, 1.6), 629.8222],
  ["MER 20kg × 1.2 = 794.423", calcMER(20, 1.2), 794.4229],
];
for (const [label, got, want] of cases) {
  if (near(got, want)) ok(label, got.toFixed(3));
  else bad(label, "기대 " + want + " / 실제 " + got);
}
// 보조 검증(그램 환산 · 잘못된 입력)
if (near(kcalToGrams(600, 360), 166.6667, 0.001)) ok("kcal→g 환산 600kcal / 360kcal·100g = 166.667g");
else bad("kcal→g 환산", String(kcalToGrams(600, 360)));
if (Number.isNaN(calcRER(0)) && Number.isNaN(calcRER(-3)) && Number.isNaN(calcMER(5, 0)))
  ok("잘못된 입력은 NaN 반환");
else bad("잘못된 입력 처리", "0/음수 입력이 NaN이 아님");

/* ---------- 3. 금지 문자열 ---------- */
console.log("\n[3] 금지 문자열 검사");
const files = walkHtml(ROOT);
const banned = [];
const cache = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  cache.set(f, s);
  if (s.includes("광고 영역")) banned.push(path.relative(ROOT, f) + " :: 광고 영역");
  if (s.includes("REPLACE_")) banned.push(path.relative(ROOT, f) + " :: REPLACE_");
}
if (banned.length === 0) ok("'광고 영역' / 'REPLACE_' 0건", files.length + "개 HTML 검사");
else bad("금지 문자열 발견", banned.length + "건: " + banned.slice(0, 3).join(", "));

// 광고 유닛 규격 확인
const adPages = files.filter((f) => cache.get(f).includes("adsbygoogle"));
const adBad = adPages.filter((f) => {
  const s = cache.get(f);
  const units = (s.match(/<ins class="adsbygoogle"/g) || []).length;
  return units !== 1 || !s.includes('data-ad-client="ca-pub-5567719201265106"') ||
    !s.includes('data-ad-format="auto"') || !s.includes('data-full-width-responsive="true"');
});
if (adBad.length === 0) ok("광고 유닛 규격(페이지당 1개·client·auto·responsive)", adPages.length + "개 페이지");
else bad("광고 유닛 규격", adBad.slice(0, 3).map((f) => path.relative(ROOT, f)).join(", "));

/* ---------- 4. 상대 링크 ---------- */
console.log("\n[4] 상대 링크 무결성");
const linkErrs = [];
const absErrs = [];
let linkCount = 0;
for (const f of files) {
  // <script> 안의 문자열 조합은 마크업 링크가 아니므로 제외하고 검사한다
  const s = cache.get(f).replace(/<script[\s\S]*?<\/script>/gi, "");
  const dir = path.dirname(f);
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(s))) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(raw)) continue;
    if (raw.startsWith("//")) continue;
    linkCount++;
    if (raw.startsWith("/")) { absErrs.push(path.relative(ROOT, f) + " → " + raw); continue; }
    let target = raw.split("#")[0].split("?")[0];
    if (!target) continue;
    let abs = path.resolve(dir, target);
    if (target.endsWith("/")) abs = path.join(abs, "index.html");
    if (!fs.existsSync(abs)) linkErrs.push(path.relative(ROOT, f) + " → " + raw);
    else if (!path.resolve(abs).startsWith(ROOT)) linkErrs.push(path.relative(ROOT, f) + " → " + raw + " (루트 밖)");
  }
}
if (absErrs.length === 0) ok("'/'로 시작하는 절대경로 내부 링크 0건");
else bad("절대경로 내부 링크", absErrs.length + "건: " + absErrs.slice(0, 3).join(", "));
if (linkErrs.length === 0) ok("깨진 상대 링크 0건", linkCount + "개 링크 검사");
else bad("깨진 상대 링크", linkErrs.length + "건: " + linkErrs.slice(0, 5).join(", "));

// 스크립트가 동적으로 만드는 링크(검색 결과)의 대상 파일도 실제로 있어야 한다
const dynErrs = [];
for (const [sp, mod] of [["dog", mods.caneatDog.DOG_CANEAT], ["cat", mods.caneatCat.CAT_CANEAT]]) {
  for (const it of mod.items) {
    const target = path.resolve(ROOT, "can-eat", "../" + sp + "/can-eat/" + it.slug + "/index.html");
    if (!fs.existsSync(target)) dynErrs.push(sp + "/" + it.slug);
  }
}
for (const b of mods.breeds.BREEDS) {
  if (!fs.existsSync(path.resolve(ROOT, "breed", b.slug + "/index.html"))) dynErrs.push("breed/" + b.slug);
}
if (dynErrs.length === 0) ok("스크립트 생성 링크 대상 파일 존재", (mods.caneatDog.DOG_CANEAT.items.length + mods.caneatCat.CAT_CANEAT.items.length + mods.breeds.BREEDS.length) + "개");
else bad("스크립트 생성 링크", dynErrs.length + "건: " + dynErrs.slice(0, 5).join(", "));

// 깊은 롱테일 경로가 실제로 존재하고 상위로 잘 올라가는지 표본 확인
const deepSamples = files.filter((f) => path.relative(ROOT, f).split(path.sep).length === 4);
if (deepSamples.length > 0) {
  const s = cache.get(deepSamples[0]);
  if (s.includes('href="../../../index.html"') && s.includes('href="../../../assets/style.css"'.replace("href", "href")) === false)
    ok("롱테일 3단계 상대경로", path.relative(ROOT, deepSamples[0]));
  else if (s.includes('href="../../../index.html"')) ok("롱테일 3단계 상대경로", path.relative(ROOT, deepSamples[0]));
  else bad("롱테일 3단계 상대경로", "../../../ 형태 링크를 찾지 못함");
} else bad("롱테일 3단계 경로", "깊이 3 페이지가 없음");

/* ---------- 5. sitemap ---------- */
console.log("\n[5] sitemap / robots");
const smPath = path.join(ROOT, "sitemap.xml");
if (!fs.existsSync(smPath)) bad("sitemap.xml", "파일 없음");
else {
  const sm = fs.readFileSync(smPath, "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const smErrs = [];
  for (const loc of locs) {
    if (!loc.startsWith(SITE_ORIGIN + "/")) { smErrs.push(loc + " (origin 불일치)"); continue; }
    const rel = loc.slice(SITE_ORIGIN.length + 1);
    const p = path.join(ROOT, rel, "index.html");
    if (!fs.existsSync(p)) smErrs.push(loc + " → 파일 없음");
  }
  if (smErrs.length === 0) ok("sitemap URL 대응 파일 존재", locs.length + "개 URL");
  else bad("sitemap URL", smErrs.length + "건: " + smErrs.slice(0, 3).join(", "));

  const htmlSet = new Set(files.map((f) => path.relative(ROOT, path.dirname(f)).split(path.sep).join("/")).map((d) => (d === "." ? "" : d)));
  const locSet = new Set(locs.map((l) => l.slice(SITE_ORIGIN.length + 1).replace(/\/$/, "")));
  const notListed = [...htmlSet].filter((d) => !locSet.has(d));
  if (notListed.length === 0) ok("모든 생성 HTML이 sitemap에 등재", htmlSet.size + "개");
  else bad("sitemap 누락 페이지", notListed.slice(0, 5).join(", "));
}
const robots = path.join(ROOT, "robots.txt");
if (fs.existsSync(robots) && fs.readFileSync(robots, "utf8").includes(SITE_ORIGIN + "/sitemap.xml")) ok("robots.txt 및 Sitemap 지시자");
else bad("robots.txt", "파일이 없거나 Sitemap 지시자가 없음");

/* ---------- 6. 필수 고지 / 메타 ---------- */
console.log("\n[6] 고지·메타 검사");
const healthDirs = ["dog-age", "cat-age", "food-amount", "vaccine", "weight-log", "can-eat", "breed", "pregnancy", "heat-cycle", "vet-consult"];
const noNotice = healthDirs.filter((d) => {
  const p = path.join(ROOT, d, "index.html");
  return !fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes("수의사와 상담하세요");
});
if (noNotice.length === 0) ok("건강 관련 페이지 상단 고지 고정", healthDirs.length + "개 확인");
else bad("건강 고지 누락", noNotice.join(", "));

const metaBad = files.filter((f) => {
  const s = cache.get(f);
  return !/<link rel="canonical" href="https:\/\//.test(s) || !s.includes('"@type":"BreadcrumbList"') || !s.includes('"@type":"FAQPage"');
});
if (metaBad.length === 0) ok("canonical + FAQPage + BreadcrumbList 전 페이지 존재");
else bad("JSON-LD/canonical 누락", metaBad.slice(0, 3).map((f) => path.relative(ROOT, f)).join(", "));

const titles = new Map();
for (const f of files) {
  const t = (cache.get(f).match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  titles.set(t, (titles.get(t) || 0) + 1);
}
const dupTitles = [...titles].filter(([, n]) => n > 1);
if (dupTitles.length === 0) ok("페이지별 고유 title", titles.size + "개");
else bad("중복 title", dupTitles.slice(0, 3).map(([t]) => t).join(" | "));

// 보험 비교/추천 금지
const insurance = files.filter((f) => /펫보험|반려동물 보험 (비교|추천)/.test(cache.get(f)));
if (insurance.length === 0) ok("펫보험 비교·링크 없음");
else bad("펫보험 언급", insurance.slice(0, 3).map((f) => path.relative(ROOT, f)).join(", "));

/* ---------- 결과 ---------- */
console.log("\n" + "=".repeat(52));
console.log("통과 " + pass + "건 / 실패 " + fails.length + "건 · HTML " + files.length + "개 · 빌드 " + buildMs + "ms");
if (fails.length) {
  console.log("\n실패 목록:");
  fails.forEach((f) => console.log(" - " + f));
  process.exit(1);
}
console.log("DEPLOY GATE 통과 ✅");
