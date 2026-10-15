#!/usr/bin/env node
/**
 * familyday-kr/tests/run.mjs — 배포 게이트
 *   node gen.mjs && node tests/run.mjs
 *
 * 1) 촌수 계산 테스트 (4대까지 30개 이상)
 * 2) 전 HTML 에서 금지 문자열('광고 영역' / 'REPLACE_') 0건
 * 3) 허브 내부 상대 링크(href/src) 깨짐 0건 + 절대경로("/"로 시작) 사용 0건
 * 4) sitemap.xml 의 모든 URL 에 대응 파일 존재
 * (+) 음양력 변환이 확인된 명절 날짜와 일치하는지 검증
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import url from "node:url";

import { computeChon, chonText } from "../assets/js/kinship-core.mjs";
import { solarToLunar } from "../assets/js/lunar-core.mjs";
import { SEOLLAL, CHUSEOK } from "../data/holidays.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ORIGIN = "https://familyday-kr.vercel.app";

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass++; return true; }
  fail++; fails.push(label + (detail ? " — " + detail : ""));
  return false;
}

/* ───────────── 1) 촌수 계산 ───────────── */
// [경로, 기대 촌수, 인척 여부, 설명]
const CHON_CASES = [
  [["f"], 1, false, "아버지"],
  [["m"], 1, false, "어머니"],
  [["s"], 1, false, "아들"],
  [["d"], 1, false, "딸"],
  [["f", "f"], 2, false, "할아버지"],
  [["m", "m"], 2, false, "외할머니"],
  [["s", "s"], 2, false, "손자"],
  [["d", "d"], 2, false, "외손녀"],
  [["ob"], 2, false, "형"],
  [["yb"], 2, false, "남동생"],
  [["os"], 2, false, "누나"],
  [["ys"], 2, false, "여동생"],
  [["f", "f", "f"], 3, false, "증조할아버지"],
  [["s", "s", "s"], 3, false, "증손자"],
  [["f", "ob"], 3, false, "큰아버지"],
  [["f", "yb"], 3, false, "작은아버지"],
  [["f", "os"], 3, false, "고모"],
  [["m", "ob"], 3, false, "외삼촌"],
  [["m", "ys"], 3, false, "이모"],
  [["ob", "s"], 3, false, "조카"],
  [["os", "d"], 3, false, "조카딸(생질녀)"],
  [["f", "f", "f", "f"], 4, false, "고조할아버지"],
  [["f", "ob", "s"], 4, false, "친사촌"],
  [["f", "os", "d"], 4, false, "고종사촌"],
  [["m", "ob", "s"], 4, false, "외사촌"],
  [["m", "ys", "d"], 4, false, "이종사촌"],
  [["f", "f", "ob"], 4, false, "큰할아버지(종조부)"],
  [["ob", "s", "s"], 4, false, "형의 손자"],
  [["f", "f", "ob", "s"], 5, false, "당숙(5촌)"],
  [["f", "ob", "s", "s"], 5, false, "당질(5촌)"],
  [["f", "f", "ob", "s", "s"], 6, false, "재종형제(6촌)"],
  [["w"], 0, true, "아내(무촌 배우자)"],
  [["h"], 0, true, "남편(무촌 배우자)"],
  [["w", "f"], 1, true, "장인"],
  [["h", "m"], 1, true, "시어머니"],
  [["w", "ob"], 2, true, "손위 처남"],
  [["h", "yb"], 2, true, "시동생"],
  [["ob", "w"], 2, true, "형수"],
  [["os", "h"], 2, true, "매형"],
  [["s", "w"], 1, true, "며느리"],
  [["d", "h"], 1, true, "사위"],
  [["f", "os", "h"], 3, true, "고모부"],
  [["m", "ob", "w"], 3, true, "외숙모"],
  [["w", "ob", "s"], 3, true, "처조카"],
  [["f", "ob", "s", "w"], 4, true, "사촌 형의 아내"],
];
console.log("── 1) 촌수 계산 테스트");
for (const [p, chon, affinal, label] of CHON_CASES) {
  const r = computeChon(p);
  ok(r.chon === chon && r.affinal === affinal,
    `촌수: ${label} (${p.join(".")})`,
    `기대 ${chon}촌/${affinal ? "인척" : "혈족"} ↔ 결과 ${chonText(r)}`);
}
console.log(`   ${CHON_CASES.length}개 케이스 검사`);

/* ───────────── 파일 수집 ───────────── */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));

/* ───────────── 2) 금지 문자열 ───────────── */
console.log("── 2) 금지 문자열 검사");
const BANNED = ["광고 영역", "REPLACE_"];
let bannedHits = 0;
for (const f of htmlFiles) {
  const src = fs.readFileSync(f, "utf8");
  for (const b of BANNED) {
    if (src.includes(b)) {
      bannedHits++;
      fails.push(`금지 문자열 '${b}' 발견: ${path.relative(ROOT, f)}`);
      fail++;
    }
  }
}
ok(bannedHits === 0, "금지 문자열 0건", `${bannedHits}건 발견`);
console.log(`   HTML ${htmlFiles.length}개 검사, 위반 ${bannedHits}건`);

/* 광고 유닛이 정확히 규격대로 들어갔는지 (보조 검사) */
const adPages = htmlFiles.filter((f) => fs.readFileSync(f, "utf8").includes('class="adsbygoogle"'));
for (const f of adPages) {
  const src = fs.readFileSync(f, "utf8");
  const n = (src.match(/class="adsbygoogle"/g) || []).length;
  ok(n === 1, `광고 유닛 1개: ${path.relative(ROOT, f)}`, `${n}개 발견`);
  ok(src.includes('data-ad-client="ca-pub-5567719201265106"'), `광고 client 지정: ${path.relative(ROOT, f)}`);
  ok(src.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"), `광고 로더: ${path.relative(ROOT, f)}`);
}

/* ───────────── 3) 상대 링크 ───────────── */
console.log("── 3) 상대 링크 검사");
const EXTERNAL = /^(https?:|\/\/|mailto:|tel:|data:|javascript:|#)/i;
let linkCount = 0, brokenCount = 0, absCount = 0;
for (const f of htmlFiles) {
  const src = fs.readFileSync(f, "utf8");
  const dir = path.dirname(f);
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1].trim();
    if (!raw || EXTERNAL.test(raw)) continue;
    linkCount++;
    if (raw.startsWith("/")) {
      absCount++; fail++;
      fails.push(`절대경로 링크 사용: ${path.relative(ROOT, f)} → ${raw}`);
      continue;
    }
    const clean = raw.split("#")[0].split("?")[0];
    if (!clean) continue;
    let target = path.resolve(dir, decodeURIComponent(clean));
    if (clean.endsWith("/") || (fs.existsSync(target) && fs.statSync(target).isDirectory())) {
      target = path.join(target, "index.html");
    }
    if (!fs.existsSync(target)) {
      brokenCount++; fail++;
      fails.push(`깨진 링크: ${path.relative(ROOT, f)} → ${raw}`);
    }
  }
}
ok(brokenCount === 0, "깨진 상대 링크 0건", `${brokenCount}건`);
ok(absCount === 0, "절대경로('/') 링크 0건", `${absCount}건`);
console.log(`   링크 ${linkCount}개 검사, 깨짐 ${brokenCount}건 / 절대경로 ${absCount}건`);

/* ───────────── 4) sitemap ───────────── */
console.log("── 4) sitemap 검사");
const sitemapPath = path.join(ROOT, "sitemap.xml");
ok(fs.existsSync(sitemapPath), "sitemap.xml 존재");
const sm = fs.readFileSync(sitemapPath, "utf8");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
ok(locs.length > 0, "sitemap URL 존재");
let smMissing = 0;
const seenLoc = new Set();
for (const loc of locs) {
  if (seenLoc.has(loc)) { fail++; fails.push(`sitemap 중복 URL: ${loc}`); }
  seenLoc.add(loc);
  ok(loc.startsWith(SITE_ORIGIN + "/"), `sitemap URL 도메인: ${loc}`);
  let rel = loc.slice(SITE_ORIGIN.length + 1);
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const target = path.join(ROOT, rel);
  if (!fs.existsSync(target)) { smMissing++; fail++; fails.push(`sitemap 대응 파일 없음: ${loc} (${rel})`); }
}
ok(smMissing === 0, "sitemap 대응 파일 모두 존재", `${smMissing}건 누락`);
// 모든 HTML 이 sitemap 에 있는지 (역방향)
let notListed = 0;
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const url = SITE_ORIGIN + "/" + rel.replace(/index\.html$/, "");
  if (!seenLoc.has(url)) { notListed++; fails.push(`sitemap 미등록 HTML: ${rel}`); fail++; }
}
ok(notListed === 0, "모든 HTML 이 sitemap 에 등록됨", `${notListed}건 누락`);
console.log(`   sitemap URL ${locs.length}개, 누락 ${smMissing}건, 미등록 ${notListed}건`);

/* ───────────── 5) 필수 요소 ───────────── */
console.log("── 5) 페이지 필수 요소 검사");
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const src = fs.readFileSync(f, "utf8");
  ok(/<title>[^<]{10,}<\/title>/.test(src), `title 존재: ${rel}`);
  ok(/<meta name="description" content="[^"]{40,}"/.test(src), `description 존재: ${rel}`);
  ok(src.includes('<link rel="canonical"'), `canonical 존재: ${rel}`);
  ok(src.includes('"@type":"BreadcrumbList"'), `BreadcrumbList JSON-LD: ${rel}`);
  ok(/"@type":"(SoftwareApplication|Article)"/.test(src), `주 엔티티 JSON-LD: ${rel}`);
}
// FAQPage 는 정책 페이지를 제외한 모든 페이지에 있어야 한다
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (rel.startsWith("privacy/") || rel.startsWith("terms/")) continue;
  ok(src2(f).includes('"@type":"FAQPage"'), `FAQPage JSON-LD: ${rel}`);
  ok(/지역|가문|집안/.test(src2(f)), `지역차 고지 문구: ${rel}`);
}
function src2(f) { return fs.readFileSync(f, "utf8"); }

/* ───────────── 6) 음양력 변환 검증 ───────────── */
console.log("── 6) 음양력 변환 검증 (확인된 명절 날짜)");
const lunarCases = [
  ...SEOLLAL.filter((h) => !h.needsCheck).map((h) => [h.date, 1, 1, `${h.year} 설날`]),
  ...CHUSEOK.filter((h) => !h.needsCheck).map((h) => [h.date, 8, 15, `${h.year} 추석`]),
];
for (const [date, lm, ld, label] of lunarCases) {
  const [y, m, d] = date.split("-").map(Number);
  const r = solarToLunar(y, m, d);
  ok(r && r.month === lm && r.day === ld && !r.leap,
    `음양력: ${label} ${date}`,
    r ? `결과 음력 ${r.month}월 ${r.day}일` : "변환 실패");
}

/* ───────────── 7) 브라우저 스크립트 문법 + DOM 연결 검사 ───────────── */
console.log("── 7) 브라우저 스크립트 검사");
const JS_DIR = path.join(ROOT, "assets", "js");
const jsFiles = fs.readdirSync(JS_DIR).filter((f) => /\.(js|mjs)$/.test(f));
// 스크립트가 실행 중에 직접 만들어 넣는 id (HTML 에 없어도 정상)
const DYNAMIC_IDS = new Set(["ics", "cp", "fd-toast"]);

for (const f of jsFiles) {
  const full = path.join(JS_DIR, f);
  const src = fs.readFileSync(full, "utf8");
  // 문법 검사: 모듈로 파싱해 본다
  let syntaxOk = true, err = "";
  try {
    new Function("return (async()=>{})")(); // no-op
    // import 구문이 있으면 모듈 파싱, 없으면 스크립트 파싱
    if (/^\s*(import|export)\s/m.test(src)) {
      // 모듈 파싱은 동적 import 로 확인
    } else {
      new Function(src);
    }
  } catch (e) { syntaxOk = false; err = e.message; }
  ok(syntaxOk, `문법: assets/js/${f}`, err);
}

// 모듈 파일은 실제로 import 해 파싱 오류를 잡는다.
// (DOM 이 없어 실행은 ReferenceError 로 멈추지만, SyntaxError 는 파싱 단계에서 잡힌다)
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(JS_DIR, f), "utf8");
  if (!/^\s*import\s/m.test(src)) continue;
  let parsed = true, msg = "";
  try {
    await import(url.pathToFileURL(path.join(JS_DIR, f)).href);
  } catch (e) {
    if (e instanceof SyntaxError) { parsed = false; msg = e.message; }
  }
  ok(parsed, `모듈 파싱: assets/js/${f}`, msg);
}

// 각 HTML 이 참조하는 스크립트가 쓰는 #id 가 그 페이지에 실제로 있는지
let idMiss = 0, idChecked = 0;
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const html = fs.readFileSync(f, "utf8");
  const pageIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) {
    if (!s.includes("assets/js/")) continue;
    const jsPath = path.resolve(path.dirname(f), s);
    if (!fs.existsSync(jsPath)) continue;
    const js = fs.readFileSync(jsPath, "utf8");
    const used = new Set();
    for (const m of js.matchAll(/\$\("#([^"]+)"\)/g)) used.add(m[1]);
    for (const m of js.matchAll(/getElementById\("([^"]+)"\)/g)) used.add(m[1]);
    for (const id of used) {
      idChecked++;
      if (DYNAMIC_IDS.has(id) || pageIds.has(id)) continue;
      idMiss++; fail++;
      fails.push(`스크립트가 찾는 id 없음: ${rel} ← ${path.basename(jsPath)} #${id}`);
    }
  }
}
ok(idMiss === 0, "스크립트 ↔ HTML id 연결", `${idMiss}건 불일치`);
console.log(`   스크립트 ${jsFiles.length}개, id 참조 ${idChecked}건 검사, 불일치 ${idMiss}건`);

/* ───────────── 8) 최소 DOM 스텁 위에서 실제 실행 검사 ───────────── */
console.log("── 8) 스크립트 실행(스모크) 검사");

function makeCtx() {
  const noop = () => ctx;
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "canvas") return { width: 600, height: 400 };
      if (k === "measureText") return () => ({ width: 40 });
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return ctx;
}
function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    _html: "", value: "", checked: false, hidden: false, textContent: "",
    dataset: {}, style: {}, width: 640, height: 960, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
    insertBefore() {}, remove() {}, click() {}, select() {}, focus() {}, blur() {},
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    hasAttribute() { return false; }, matches() { return false; }, closest() { return null; },
    querySelector() { return makeEl("div"); }, querySelectorAll() { return []; },
    getContext() { return makeCtx(); }, toBlob(cb) { cb && cb(new Blob([""])); },
    toDataURL() { return "data:,"; }, scrollIntoView() {}, contains() { return false; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  return el;
}
function installDom() {
  const store = new Map();
  // 선택자별로 같은 요소를 돌려주고, 입력값에 실제로 쓰일 법한 기본값을 채워
  // 렌더링 깊은 경로(날짜 변환, .ics 생성, 캔버스 그리기)까지 실행되게 한다
  const DEFAULT_VALUES = {
    sdate: "1990-03-15", total: "600000", cap: "10", yrs: "10", ppl: "2",
    lm: "8", ld: "15", phrase: "0", giver: "홍길동", belong: "대학 동기",
    who: "할아버지", title: "○○ 결혼식 피로연", q: "",
  };
  const cache = new Map();
  function pick(sel) {
    if (cache.has(sel)) return cache.get(sel);
    const el = makeEl("input");
    const id = String(sel).replace(/^#/, "");
    el.id = id;
    if (DEFAULT_VALUES[id] !== undefined) el.value = DEFAULT_VALUES[id];
    cache.set(sel, el);
    return el;
  }
  const doc = {
    documentElement: makeEl("html"),
    body: makeEl("body"),
    head: makeEl("head"),
    createElement: (t) => makeEl(t),
    createTextNode: () => makeEl("text"),
    querySelector: (sel) => pick(sel),
    querySelectorAll: () => [],
    getElementById: (id) => pick("#" + id),
    addEventListener() {}, removeEventListener() {},
    execCommand() { return true; },
  };
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const win = {
    document: doc, localStorage: ls,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    print() {}, confirm: () => false, alert() {},
    location: { origin: "https://familyday-kr.vercel.app", pathname: "/kinship-calc/", search: "?p=f.ob.w&sex=F", href: "https://familyday-kr.vercel.app/kinship-calc/", hash: "" },
    URL: globalThis.URL, Blob: globalThis.Blob,
    navigator: { clipboard: { writeText: () => Promise.resolve() }, share: () => Promise.resolve() },
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    CanvasRenderingContext2D: undefined,
  };
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.localStorage = ls;
  globalThis.location = win.location;
  try { Object.defineProperty(globalThis, "navigator", { value: win.navigator, configurable: true, writable: true }); } catch (e) { /* 읽기 전용 navigator 는 그대로 둔다 */ }
  globalThis.confirm = win.confirm;
  globalThis.alert = win.alert;
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => "blob:x";
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
  // common.js 를 스크립트로 실행해 window.FD 준비
  const commonSrc = fs.readFileSync(path.join(JS_DIR, "common.js"), "utf8");
  new Function("window", "document", "localStorage", "navigator", "URL", commonSrc)(win, doc, ls, win.navigator, globalThis.URL);
  // 브라우저에서 window.FD 는 전역 식별자 FD 로도 보인다 — 동일하게 맞춘다
  globalThis.FD = win.FD;
  return win;
}

let smokeRun = 0;
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const html = fs.readFileSync(f, "utf8");
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
    .filter((s) => s.includes("assets/js/") && !s.endsWith("common.js"));
  for (const s of srcs) {
    const jsPath = path.resolve(path.dirname(f), s);
    if (!fs.existsSync(jsPath)) continue;
    const win = installDom();
    if (html.includes("window.__HOLIDAY")) {
      const m = html.match(/window\.__HOLIDAY=(\{[^;]+\});/);
      if (m) win.__HOLIDAY = JSON.parse(m[1]);
    }
    const src = fs.readFileSync(jsPath, "utf8");
    let err = "";
    try {
      if (/^\s*import\s/m.test(src)) {
        smokeRun++;
        await import(url.pathToFileURL(jsPath).href + "?smoke=" + smokeRun);
      } else {
        smokeRun++;
        new Function("window", "document", "FD", src)(win, win.document, win.FD);
      }
    } catch (e) { err = e && e.message ? e.message : String(e); }
    ok(!err, `실행: ${path.basename(jsPath)} (${rel})`, err);
  }
}
console.log(`   스크립트 실행 ${smokeRun}회, 오류 ${fails.filter((x) => x.startsWith("실행:")).length}건`);

/* ───────────── 9) 태그 균형 검사 ───────────── */
console.log("── 9) 태그 균형 검사");
const PAIRED = ["div", "section", "table", "thead", "tbody", "tr", "td", "th", "ul", "ol", "li",
  "p", "svg", "g", "a", "span", "main", "header", "footer", "nav", "canvas", "select", "option",
  "button", "label", "textarea", "style", "script", "html", "head", "body", "title"];
let unbalanced = 0;
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const html = fs.readFileSync(f, "utf8");
  for (const tag of PAIRED) {
    const open = (html.match(new RegExp("<" + tag + "[ >]", "g")) || []).length;
    const close = (html.match(new RegExp("</" + tag + ">", "g")) || []).length;
    if (open !== close) {
      unbalanced++; fail++;
      fails.push(`태그 불균형: ${rel} <${tag}> 여는 ${open}개 / 닫는 ${close}개`);
    }
  }
}
ok(unbalanced === 0, "HTML 태그 균형", `${unbalanced}건`);
console.log(`   HTML ${htmlFiles.length}개 검사, 불균형 ${unbalanced}건`);

/* ───────────── 10) 콘텐츠 정책 검사 ───────────── */
console.log("── 10) 콘텐츠 정책 검사");
const CROSS = [
  "https://tomatoeggcat.com/dydrms-chonsu/",
  "https://tomatoeggcat.com/family-title-finder/",
  "https://tomatoeggcat.com/dydrms-gyeongjosa/",
  "https://tomatoeggcat.com/gift-money/",
  "https://tomatoeggcat.com/dydrms-jeryegak/",
  "https://tomatoeggcat.com/dday/",
];
for (const f of htmlFiles) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (rel.startsWith("privacy/") || rel.startsWith("terms/")) continue;
  const html = fs.readFileSync(f, "utf8");
  const qs = [...html.matchAll(/<p class="q">Q\. ([^<]+)<\/p>/g)].map((m) => m[1]);
  ok(qs.some((q) => /지역/.test(q)), `FAQ 에 "지역마다 다른가요" 항목: ${rel}`);
  const n = CROSS.filter((u) => html.includes(u)).length;
  ok(n >= 2, `외부 크로스링크 2개 이상: ${rel}`, `${n}개`);
}
// 기록형 도구는 저장 안내 + 내보내기 + 전체 삭제를 갖춰야 한다
for (const rel of ["gift-guide/index.html", "seat-map/index.html"]) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  ok(html.includes("서버 저장 없음"), `저장 고지: ${rel}`);
  ok(/id="exp"/.test(html), `내보내기 버튼: ${rel}`);
  ok(/id="wipe"/.test(html), `전체 삭제 버튼: ${rel}`);
}
// 경조사비 페이지는 "정답이 아님" 라벨이 있어야 한다
{
  const html = fs.readFileSync(path.join(ROOT, "condolence/index.html"), "utf8");
  ok(html.includes("일반적 관행이며 정답이 아닙니다"), "경조사비 관행 라벨");
}
console.log("   FAQ·크로스링크·저장고지·관행라벨 검사 완료");

/* ───────────── 결과 ───────────── */
console.log("\n" + "─".repeat(52));
if (fail) {
  console.log(`❌ 실패 ${fail}건 / 통과 ${pass}건`);
  for (const f of fails.slice(0, 40)) console.log("   ✗ " + f);
  if (fails.length > 40) console.log(`   … 외 ${fails.length - 40}건`);
  process.exit(1);
}
console.log(`✅ 전부 통과 — ${pass}개 검사 통과 (HTML ${htmlFiles.length}개, 링크 ${linkCount}개, sitemap ${locs.length}개)`);
