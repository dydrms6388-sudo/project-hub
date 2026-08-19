// cookcalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node cookcalc-kr/tests/run.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DENSITY, DENSITY_UNITS } from "../data/density.mjs";
import { STORAGE } from "../data/storage.mjs";
import { AIRFRYER, OVEN_RULE } from "../data/airfryer.mjs";
import { CALORIES } from "../data/calories.mjs";
import { RICE_RATIO, COFFEE_RATIO, BRINE, KIMCHI, SYRUP, PANS } from "../data/misc.mjs";
import {
  parseLine, parseList, scaleLine, scaleList, fmtQty, findDensity,
  toGram, fromGram, panVolume, panRatio, ovenToAir, riceWater, round,
} from "../lib/cook.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKED = "2026-08-19";
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };

/* ── 1. 데이터 스키마: source / checkedAt 누락 0 ─────────────── */
const isUrlOrText = (s) => typeof s === "string" && s.trim().length > 5;
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

t(`밀도표 ${DENSITY.length}종: value·source·checkedAt 누락 0`, () => {
  assert.ok(DENSITY.length >= 50, "밀도 항목 수: " + DENSITY.length);
  const names = new Set();
  for (const d of DENSITY) {
    assert.ok(d.name && d.cat, "이름/분류 누락: " + JSON.stringify(d));
    assert.ok(typeof d.value === "number" && d.value > 0 && d.value < 3, d.name + ": 밀도 값 이상 " + d.value);
    assert.ok(isUrlOrText(d.source), d.name + ": source 누락");
    assert.ok(okDate(d.checkedAt), d.name + ": checkedAt 형식 오류");
    assert.equal(d.checkedAt, CHECKED, d.name + ": checkedAt 불일치");
    assert.ok(!names.has(d.name), "밀도표 중복 재료: " + d.name);
    names.add(d.name);
  }
  for (const [k, u] of Object.entries(DENSITY_UNITS)) {
    assert.ok(u.ml > 0 && isUrlOrText(u.source) && okDate(u.checkedAt), "계량 단위 메타 누락: " + k);
  }
});

t(`보관표 ${STORAGE.length}종 · 에어프라이어표 ${AIRFRYER.length}종 · 열량표 ${CALORIES.length}종: source·checkedAt 누락 0`, () => {
  for (const s of STORAGE) {
    assert.ok(s.name && s.cat && s.value, "보관표 항목 이상: " + s.name);
    const v = s.value;
    assert.ok(v.room || v.fridge || v.frozen, s.name + ": 보관기간이 전부 비어 있음");
    assert.ok(isUrlOrText(s.source) && okDate(s.checkedAt), s.name + ": source/checkedAt 누락");
  }
  for (const a of AIRFRYER) {
    assert.ok(a.value.temp > 100 && a.value.temp <= 220, a.name + ": 온도 범위 이상");
    assert.ok(/^\d+(~\d+)?$/.test(String(a.value.time)), a.name + ": 시간 표기 이상 " + a.value.time);
    assert.ok(isUrlOrText(a.source) && okDate(a.checkedAt), a.name + ": source/checkedAt 누락");
  }
  for (const c of CALORIES) {
    assert.ok(c.serving && typeof c.value === "number" && c.value > 0, c.name + ": 열량/제공량 이상");
    assert.ok(isUrlOrText(c.source) && okDate(c.checkedAt), c.name + ": source/checkedAt 누락");
  }
});

t("소도구 기준값(밥물·커피·염지·김치·청·팬): source·checkedAt 누락 0", () => {
  const check = (o, where) => {
    assert.ok(isUrlOrText(o.source), where + ": source 누락");
    assert.ok(okDate(o.checkedAt), where + ": checkedAt 누락");
    assert.ok(o.value !== undefined, where + ": value 누락");
  };
  RICE_RATIO.types.forEach((x) => check(x, "RICE type " + x.key));
  RICE_RATIO.cookers.forEach((x) => check(x, "RICE cooker " + x.key));
  COFFEE_RATIO.forEach((x) => check(x, "COFFEE " + x.key));
  [BRINE.wet.waterPerMeat, BRINE.wet.saltPct, BRINE.wet.sugarPct, BRINE.dry.saltPct, BRINE.dry.sugarPct].forEach((x, i) => check(x, "BRINE " + i));
  BRINE.times.forEach((x) => check(x, "BRINE time " + x.name));
  [KIMCHI.waterPerCabbage, KIMCHI.brinePct, KIMCHI.sprinklePct, KIMCHI.time].forEach((x, i) => check(x, "KIMCHI " + i));
  [SYRUP.standard, SYRUP.lowSugar, SYRUP.jarFactor].forEach((x, i) => check(x, "SYRUP " + i));
  PANS.forEach((x) => check(x, "PAN " + x.key));
  check(OVEN_RULE.tempDelta, "OVEN tempDelta");
  check(OVEN_RULE.timeFactor, "OVEN timeFactor");
  assert.ok(OVEN_RULE.label.includes("관행 규칙"), "에어프라이어 변환 규칙에 '관행 규칙' 라벨 필요");
});

/* ── 2. recipe-scale 단위 파서 10케이스 + 배수 적용 ─────────── */
const CASES = [
  { in: "설탕 2큰술",        name: "설탕",    qty: 2,   unit: "큰술",   kind: "vol",   x: 2,   out: "설탕 4큰술" },
  { in: "물 300ml",          name: "물",      qty: 300, unit: "ml",     kind: "vol",   x: 0.5, out: "물 150ml" },
  { in: "밀가루 1+1/2컵",    name: "밀가루",  qty: 1.5, unit: "컵",     kind: "vol",   x: 2,   out: "밀가루 3컵" },
  { in: "소금 약간",         name: null,      qty: null, unit: null,    kind: "vague", x: 2,   out: "소금 약간" },
  { in: "돼지고기 300g",     name: "돼지고기", qty: 300, unit: "g",     kind: "mass",  x: 1.5, out: "돼지고기 450g" },
  { in: "달걀 2개",          name: "달걀",    qty: 2,   unit: "개",     kind: "count", x: 0.5, out: "달걀 1개" },
  { in: "- 다진마늘 1/2작은술", name: "다진마늘", qty: 0.5, unit: "작은술", kind: "vol", x: 3, out: "다진마늘 1+1/2작은술" },
  { in: "1. 간장 3큰술",     name: "간장",    qty: 3,   unit: "큰술",   kind: "vol",   x: 1 / 3, out: "간장 1큰술" },
  { in: "버터 1과 1/2 큰술", name: "버터",    qty: 1.5, unit: "큰술",   kind: "vol",   x: 2,   out: "버터 3큰술" },
  { in: "우유 1컵",          name: "우유",    qty: 1,   unit: "컵",     kind: "vol",   x: 2.5, out: "우유 2+1/2컵" },
  { in: "대파 1대",          name: "대파",    qty: 1,   unit: "대",     kind: "count", x: 2,   out: "대파 2대" },
  { in: "올리브유 2T",       name: "올리브유", qty: 2,  unit: "T",      kind: "vol",   x: 2,   out: "올리브유 4T" },
];
t(`레시피 파서 ${CASES.length}케이스: 수량·단위 인식 + 배수 적용 결과`, () => {
  assert.ok(CASES.length >= 10, "파서 케이스 10개 이상 필요");
  for (const c of CASES) {
    const p = parseLine(c.in);
    assert.equal(p.kind, c.kind, c.in + ": kind " + p.kind);
    assert.equal(p.qty, c.qty, c.in + ": qty " + p.qty);
    if (c.name) assert.equal(p.name, c.name, c.in + ": name " + p.name);
    if (c.unit !== null) assert.equal(p.unit, c.unit, c.in + ": unit " + p.unit);
    const s = scaleLine(p, c.x);
    assert.equal(s.text, c.out, c.in + " ×" + c.x + " → " + s.text + " (기대: " + c.out + ")");
  }
});

t("레시피 목록 전체 파싱: 빈 줄 무시 + 부피 재료 g 병기 + 모호 표기 비배수", () => {
  const text = `돼지고기 300g\n\n설탕 2큰술\n간장 3큰술\n후춧가루 약간\n물 1컵`;
  const rows = scaleList(text, 2);
  assert.equal(rows.length, 5, "빈 줄 제거 후 5줄");
  const sugar = rows.find((r) => r.name === "설탕");
  assert.equal(sugar.qty, 4);
  assert.equal(sugar.gram, round(4 * 15 * 0.8, 1));      // 설탕 밀도 0.8 → 48g
  const soy = rows.find((r) => r.name === "간장");
  assert.equal(soy.gram, round(6 * 15 * 1.15, 1));       // 간장 1.15 → 103.5g
  const vague = rows.find((r) => r.kind === "vague");
  assert.equal(vague.scaled, false, "'약간'은 배수를 적용하지 않아야 함");
  const meat = rows.find((r) => r.name === "돼지고기");
  assert.equal(meat.qty, 600);
  assert.equal(meat.gram, null, "질량 단위 재료는 밀도 병기 대상이 아님");
});

t("수량 표기 포맷: 정수·분수·혼분수 왕복", () => {
  assert.equal(fmtQty(3), "3");
  assert.equal(fmtQty(0.5), "1/2");
  assert.equal(fmtQty(1.5), "1+1/2");
  assert.equal(fmtQty(1 / 3), "1/3");
  assert.equal(fmtQty(2 + 3 / 4), "2+3/4");
  assert.equal(fmtQty(0.13), "0.13");
});

/* ── 3. 베이킹 팬 부피 환산 3케이스 ─────────────────────────── */
t("베이킹 팬 부피 환산 3케이스 (원형 πr²h · 사각 w×l×h)", () => {
  const r1 = PANS.find((p) => p.key === "round1");   // 지름 15 · 높이 7
  const r2 = PANS.find((p) => p.key === "round2");   // 지름 18 · 높이 7
  const sq = PANS.find((p) => p.key === "square15"); // 15×15×7
  const pd = PANS.find((p) => p.key === "pound");    // 21×9×8

  // (1) 원형 1호 부피 = π × 7.5² × 7 ≈ 1237ml
  assert.ok(Math.abs(panVolume(r1) - Math.PI * 56.25 * 7) < 1e-9);
  assert.equal(round(panVolume(r1), 1), 1237);   // π × 7.5² × 7
  // (2) 사각 15cm = 1575ml, 파운드팬 = 1512ml
  assert.equal(panVolume(sq), 1575);
  assert.equal(panVolume(pd), 1512);
  // (3) 1호 → 2호 배수는 지름비(1.2)가 아니라 그 제곱(1.44)
  assert.equal(round(panRatio(r1, r2), 2), 1.44);
  assert.ok(Math.abs(panRatio(r1, r2) - Math.pow(18 / 15, 2)) < 1e-9, "높이가 같으면 지름비의 제곱");
  // 역방향 왕복
  assert.ok(Math.abs(panRatio(r1, r2) * panRatio(r2, r1) - 1) < 1e-12);
  // 원형 1호 → 정사각 15cm
  assert.equal(round(panRatio(r1, sq), 3), round(1575 / (Math.PI * 56.25 * 7), 3));
});

/* ── 4. 밀도 왕복 변환(g → 컵 → g) 일관성 ───────────────────── */
t(`밀도 왕복 변환: 전 재료 ${DENSITY.length}종 g→컵→g / g→큰술→g 오차 0`, () => {
  for (const d of DENSITY) {
    for (const grams of [1, 37.5, 100, 250, 1000]) {
      for (const unit of ["컵", "큰술", "작은술", "ml"]) {
        const back = toGram(fromGram(grams, unit, d.value), unit, d.value);
        assert.ok(Math.abs(back - grams) < 1e-9, `${d.name} ${grams}g→${unit}→g = ${back}`);
      }
    }
    // 부피 → 무게 → 부피
    const cups = 1.75;
    const roundTrip = fromGram(toGram(cups, "컵", d.value), "컵", d.value);
    assert.ok(Math.abs(roundTrip - cups) < 1e-9, d.name + " 컵 왕복");
  }
  // 알려진 값 대조 (1컵 = 200ml)
  assert.equal(round(toGram(1, "컵", findDensity("물").value), 1), 200);
  assert.equal(round(toGram(1, "컵", findDensity("설탕").value), 1), 160);
  assert.equal(round(toGram(1, "컵", findDensity("밀가루").value), 1), 100);
  assert.equal(round(toGram(1, "컵", findDensity("쌀").value), 1), 166);
  assert.equal(round(toGram(1, "큰술", findDensity("간장").value), 1), 17.3);
  // 이름 부분 일치 조회
  assert.equal(findDensity("중력분 밀가루").name, "밀가루");
  assert.equal(findDensity("존재하지않는재료xyz"), null);
});

t("기타 엔진: 오븐→에어프라이어 변환 · 밥물 비율", () => {
  const r = ovenToAir(200, 25, OVEN_RULE);
  assert.equal(r.temp, 180);          // 200 - 20
  assert.equal(r.mid, 20);            // 25 × 0.8
  assert.ok(r.minMin <= r.mid && r.mid <= r.minMax);
  const w = riceWater(2, RICE_RATIO.types[0], RICE_RATIO.cookers[1], false);
  assert.equal(w.riceMl, 400);
  assert.equal(w.riceG, 330);
  assert.equal(w.waterMl, 480);       // 400 × 1.2 × 1.0
  const pot = riceWater(2, RICE_RATIO.types[0], RICE_RATIO.cookers[2], false);
  assert.ok(pot.waterMl > w.waterMl, "냄비는 증발 보정으로 물이 더 많아야 함");
});

/* ── 5~8. 생성물(HTML) 정적 검사 ────────────────────────────── */
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "tests" || name === "node_modules") continue;
      out.push(...htmlFiles(p));
    } else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}
const files = htmlFiles(ROOT);
assert.ok(files.length >= 200, "HTML 페이지 수 확인: " + files.length);

t(`정책: 금지 문자열 0건 (${files.length}개 HTML)`, () => {
  const banned = ["광고" + " 영역", "REPLACE" + "_"];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const b of banned) assert.ok(!html.includes(b), `${f} 에 금지 문자열 "${b}"`);
  }
});

t("링크: 루트 절대경로(/) 0건 + 깨진 상대링크 0건", () => {
  const attrRe = /(?:href|src)\s*=\s*"([^"]+)"/g;
  let checked = 0;
  for (const f of files) {
    // 스크립트 블록(런타임 문자열)은 제외하고 실제 HTML 속성만 검사
    const html = readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
    let m;
    while ((m = attrRe.exec(html))) {
      const url = m[1];
      if (/^(https?:|mailto:|#|data:|javascript:)/.test(url)) continue;
      assert.ok(!url.startsWith("/"), `${f}: 루트 절대경로 금지 → ${url}`);
      const path = url.split("#")[0].split("?")[0];
      if (!path) continue;
      let target = resolve(dirname(f), path);
      if (path.endsWith("/")) target = join(target, "index.html");
      assert.ok(existsSync(target), `${f}: 깨진 링크 → ${url}`);
      checked++;
    }
  }
  assert.ok(checked > 500, "검사한 상대링크 수: " + checked);
});

t("인라인 모듈 스크립트: 상대 import 경로 실재 + 문법 오류 0", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      const code = m[1];
      for (const im of code.matchAll(/from "([^"]+)"/g)) {
        const target = resolve(dirname(f), im[1]);
        assert.ok(existsSync(target), `${f}: import 대상 없음 → ${im[1]}`);
      }
      const stripped = code.replace(/^import [^\n]*;$/gm, "");
      try { new Script(stripped, { filename: f }); }
      catch (e) { assert.fail(f + " 스크립트 문법 오류: " + e.message); }
    }
  }
});

t("sitemap: 모든 URL에 대응 파일 존재 + 도구·롱테일 포함", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, files.length, `sitemap URL(${locs.length}) 과 HTML(${files.length}) 수 불일치`);
  const origin = "https://cookcalc-kr.vercel.app";
  for (const loc of locs) {
    assert.ok(loc.startsWith(origin + "/"), "origin 불일치: " + loc);
    const rel = loc.slice(origin.length + 1);
    const target = rel === "" ? join(ROOT, "index.html")
      : rel.endsWith("/") ? join(ROOT, rel, "index.html")
      : join(ROOT, rel);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  assert.equal(new Set(locs).size, locs.length, "sitemap 중복 URL");
  for (const must of TOOL_SLUGS) assert.ok(locs.includes(`${origin}/${must}/`), "sitemap 누락: " + must);
  assert.ok(locs.some((l) => l.startsWith(origin + "/convert/") && l !== origin + "/convert/"), "계량 롱테일 누락");
  assert.ok(locs.some((l) => l.startsWith(origin + "/airfryer/") && l !== origin + "/airfryer/"), "에어프라이어 롱테일 누락");
  assert.ok(locs.some((l) => l.startsWith(origin + "/storage/") && l !== origin + "/storage/"), "보관 롱테일 누락");
  assert.ok(readFileSync(join(ROOT, "robots.txt"), "utf8").includes(origin + "/sitemap.xml"), "robots.txt sitemap 링크 없음");
});

t("SEO: 전 페이지 고유 title/description + JSON-LD 3종 + canonical", () => {
  const titles = new Set(), descs = new Set();
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const ti = html.match(/<title>([^<]+)<\/title>/)[1];
    const de = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(ti), "중복 title: " + ti);
    assert.ok(!descs.has(de), "중복 description: " + de);
    titles.add(ti); descs.add(de);
    const ld = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
    assert.ok(ld, f + ": JSON-LD 블록 없음");
    const types = JSON.parse(ld[1])["@graph"].map((n) => n["@type"]);
    assert.ok(types.includes("BreadcrumbList"), f + ": BreadcrumbList 없음");
    const isPolicy = f.endsWith("privacy.html") || f.endsWith("terms.html");
    if (!isPolicy) {
      assert.ok(types.includes("SoftwareApplication"), f + ": SoftwareApplication 없음");
      assert.ok(types.includes("FAQPage"), f + ": FAQPage 없음");
    }
    assert.ok(html.includes('rel="canonical" href="https://cookcalc-kr.vercel.app/'), f + ": canonical 없음");
    assert.ok(html.includes('property="og:url"'), f + ": og:url 없음");
    assert.ok(/<h1>[^<]+<\/h1>/.test(html), f + ": h1 없음");
  }
  assert.equal(titles.size, files.length);
});

t("광고: 유닛 최대 1개 · 기본 hidden(입력 화면 노출 금지) · head 로더", () => {
  let withAd = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(units <= 1, `${f}: 광고 유닛 ${units}개 (최대 1)`);
    assert.ok(html.includes(`client=ca-pub-5567719201265106`), f + ": head 로더 없음");
    if (!units) continue;
    withAd++;
    assert.ok(/<div class="ad-wrap" id="adWrap" hidden>/.test(html), f + ": 광고 컨테이너가 기본 노출 상태");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), f + ": ad client 불일치");
    assert.ok(html.includes('data-ad-format="auto"') && html.includes('data-full-width-responsive="true"'), f + ": ad 속성 누락");
    assert.ok(/showAd|show\("resultBox"\)/.test(html), f + ": 결과 표시 시 광고 언하이드 코드 없음");
  }
  assert.ok(withAd >= 200, "광고 유닛이 있는 페이지 수: " + withAd);
  // 정책 페이지에는 광고 없음
  for (const p of ["privacy.html", "terms.html"]) {
    assert.ok(!readFileSync(join(ROOT, p), "utf8").includes('class="adsbygoogle"'), p + ": 정책 페이지에 광고");
  }
});

/* ── 구조·콘텐츠 검사 ───────────────────────────────────────── */
const TOOL_SLUGS = ["unit-convert", "recipe-scale", "rice-water", "airfryer", "storage", "kimchi-salt",
  "coffee-ratio", "brine", "sugar-syrup", "baking-pan", "calorie-plate", "timer-multi"];

t(`페이지 생성: 도구 12종 + 허브 + 롱테일 3종 + 정책 (총 ${files.length})`, () => {
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "도구 누락: " + s);
  assert.ok(existsSync(join(ROOT, "index.html")), "허브 누락");
  assert.ok(existsSync(join(ROOT, "convert", "index.html")), "계량 목록 누락");
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")));
  assert.ok(existsSync(join(ROOT, "robots.txt")) && existsSync(join(ROOT, "sitemap.xml")));
  const dirs = (d) => readdirSync(join(ROOT, d)).filter((n) => statSync(join(ROOT, d, n)).isDirectory());
  assert.equal(dirs("convert").length, DENSITY.length, "계량 롱테일 수");
  assert.equal(dirs("airfryer").length, AIRFRYER.length, "에어프라이어 롱테일 수");
  assert.equal(dirs("storage").length, STORAGE.length, "보관 롱테일 수");
  assert.equal(files.length, 1 + TOOL_SLUGS.length + 1 + DENSITY.length + AIRFRYER.length + STORAGE.length + 2);
});

t("도구 페이지: 고유 본문(소개·사용법·FAQ) + 크로스링크 2~3개", () => {
  const CROSS = ["airfryer-time", "fridge-recipe", "home-cafe-recipe", "seasonal-food", "naengpa"];
  for (const s of TOOL_SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("<h2>사용법</h2>") || html.includes("이 표를 쓰는 법") || /<h2>[^<]*순서<\/h2>/.test(html) || /<h2>[^<]*씁니다<\/h2>/.test(html), s + ": 사용법 섹션 없음");
    assert.ok(html.includes("자주 묻는 질문"), s + ": FAQ 섹션 없음");
    const hits = CROSS.filter((c) => html.includes("https://tomatoeggcat.com/" + c + "/"));
    assert.ok(hits.length >= 2 && hits.length <= 3, `${s}: 크로스링크 ${hits.length}개 (2~3개 필요) → ${hits}`);
  }
});

t("데이터 라벨: 보관='보관 상태에 따라 다름' · 에어프라이어='관행 규칙, 참고용' · 안전 '참고용' 고지", () => {
  const sto = readFileSync(join(ROOT, "storage", "index.html"), "utf8");
  assert.ok(sto.includes("보관 상태에 따라 다름"), "보관 도구: 상태 라벨 없음");
  assert.ok(sto.includes("참고용"), "보관 도구: 참고용 고지 없음");
  assert.ok(sto.includes("foodsafetykorea.go.kr"), "보관 도구: 출처 링크 없음");
  const air = readFileSync(join(ROOT, "airfryer", "index.html"), "utf8");
  assert.ok(air.includes("관행 규칙, 참고용"), "에어프라이어 도구: 관행 규칙 라벨 없음");
  for (const s of ["brine", "kimchi-salt", "calorie-plate"]) {
    assert.ok(readFileSync(join(ROOT, s, "index.html"), "utf8").includes("참고용"), s + ": 참고용 고지 없음");
  }
  assert.ok(readFileSync(join(ROOT, "calorie-plate", "index.html"), "utf8").includes("재미"), "칼로리: 재미용 고지 없음");
  // 롱테일 표본
  const one = readdirSync(join(ROOT, "storage")).find((n) => statSync(join(ROOT, "storage", n)).isDirectory());
  assert.ok(readFileSync(join(ROOT, "storage", one, "index.html"), "utf8").includes("보관 상태에 따라 다름"), "보관 롱테일 라벨 없음");
  const oneAir = readdirSync(join(ROOT, "airfryer")).find((n) => statSync(join(ROOT, "airfryer", n)).isDirectory());
  assert.ok(readFileSync(join(ROOT, "airfryer", oneAir, "index.html"), "utf8").includes("관행 규칙, 참고용"), "에어프라이어 롱테일 라벨 없음");
});

t("SITE_ORIGIN 단일 상수: canonical·og·sitemap 전부 동일 오리진", () => {
  const gen = readFileSync(join(ROOT, "gen.mjs"), "utf8");
  const origins = [...gen.matchAll(/https:\/\/cookcalc-kr[^"'`\s]*/g)].map((m) => m[0]);
  assert.ok(origins.every((o) => o === "https://cookcalc-kr.vercel.app"), "gen.mjs 내 오리진 하드코딩 불일치: " + origins.join(","));
  assert.equal((gen.match(/const SITE_ORIGIN = "https:\/\/cookcalc-kr\.vercel\.app"/g) || []).length, 1);
  assert.ok(!existsSync(join(ROOT, "vercel.json")), "vercel.json 을 만들지 않아야 함");
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const can = html.match(/rel="canonical" href="([^"]+)"/)[1];
    const og = html.match(/property="og:url" content="([^"]+)"/)[1];
    assert.equal(can, og, f + ": canonical 과 og:url 불일치");
  }
});

console.log(`\n${pass} tests passed ✔`);
