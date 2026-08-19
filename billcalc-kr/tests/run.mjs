// billcalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node billcalc-kr/tests/run.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calcBill, calcDelta, kwhOf, naiveDelta, calcSaving } from "../lib/elec.mjs";
import { m3ToKwh, kwhToM3, m3ToMj, mjToM3, mjToKwh, kwhToMj, calcGasBill } from "../lib/gas.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };

/* ── 1. 전기요금 엔진: 요금표 기준 손계산 대조 ───────────────── */
// 손계산 근거: 저압 기본요금 910/1,600/7,300, 전력량 120.0/214.6/307.3,
// 기후환경 9원/kWh, 연료비조정 +5원/kWh, 부가세 10%(원미만 반올림),
// 기반기금 2.7%(10원미만 절사), 청구금액 10원미만 절사.

t("전기: 기타계절 200kWh(1단계 경계) = 31,220원", () => {
  const r = calcBill(200, { month: 5, voltage: "low" });
  assert.equal(r.tier, 1);
  assert.equal(r.base, 910);
  assert.equal(r.energy, 24000);      // 200×120
  assert.equal(r.climate, 1800);      // 200×9
  assert.equal(r.fuel, 1000);         // 200×5
  assert.equal(r.subtotal, 27710);
  assert.equal(r.vat, 2771);
  assert.equal(r.fund, 740);          // floor(748.17/10)*10
  assert.equal(r.total, 31220);       // floor(31221/10)*10
});

t("전기: 기타계절 201kWh → 2단계 진입(기본요금 점프)", () => {
  const r = calcBill(201, { month: 5 });
  assert.equal(r.tier, 2);
  assert.equal(r.base, 1600);
  assert.equal(r.energy, 24000 + 214); // floor(1×214.6)
  assert.equal(r.subtotal, 1600 + 24214 + 1809 + 1005);
  assert.equal(r.total, 32260);
});

t("전기: 기타계절 400kWh(2단계 경계) = 83,530원", () => {
  const r = calcBill(400, { month: 11 });
  assert.equal(r.tier, 2);
  assert.equal(r.base, 1600);
  assert.equal(r.energy, 24000 + 42920); // 200×120 + 200×214.6
  assert.equal(r.subtotal, 74120);
  assert.equal(r.vat, 7412);
  assert.equal(r.fund, 2000);
  assert.equal(r.total, 83530);
});

t("전기: 하계 300kWh는 1단계(구간 완화) = 46,320원", () => {
  const r = calcBill(300, { month: 7 });
  assert.equal(r.isSummer, true);
  assert.equal(r.tier, 1);
  assert.equal(r.base, 910);
  assert.equal(r.energy, 36000);
  assert.equal(r.subtotal, 41110);
  assert.equal(r.total, 46320);
});

t("전기: 하계 450kWh(2단계 상한) = 85,740원 / 동일 사용량 기타계절은 3단계", () => {
  const s = calcBill(450, { month: 8 });
  assert.equal(s.tier, 2);
  assert.equal(s.energy, 36000 + 32190); // 300×120 + 150×214.6
  assert.equal(s.subtotal, 76090);
  assert.equal(s.vat, 7609);
  assert.equal(s.fund, 2050);
  assert.equal(s.total, 85740);
  const o = calcBill(450, { month: 10 });
  assert.equal(o.tier, 3);
  assert.ok(o.total > s.total, "같은 450kWh라도 기타계절이 더 비싸야 함");
});

t("전기: 고압 350kWh 기타계절 = 60,010원", () => {
  const r = calcBill(350, { month: 3, voltage: "high" });
  assert.equal(r.base, 1260);
  assert.equal(r.energy, 21000 + 26100); // 200×105 + 150×174
  assert.equal(r.subtotal, 53260);
  assert.equal(r.total, 60010);
});

t("전기: 하계 1,100kWh 슈퍼유저 요금 반영 = 375,870원", () => {
  const r = calcBill(1100, { month: 8, voltage: "low" });
  const su = r.steps.find((s) => s.superUser);
  assert.ok(su, "슈퍼유저 단계 존재");
  assert.equal(su.kwh, 100);
  assert.equal(su.amount, 73620); // 100×736.2
  assert.equal(r.energy, 36000 + 32190 + 169015 + 73620);
  assert.equal(r.subtotal, 333525);
  assert.equal(r.total, 375870);
});

t("전기: 기타계절엔 슈퍼유저 미적용", () => {
  const r = calcBill(1100, { month: 4 });
  assert.ok(!r.steps.some((s) => s.superUser));
});

/* ── 2. ac-cost 누진 구간 이동 로직 ─────────────────────────── */
t("에어컨: 250→350kWh(구간 유지) 증가액 25,760원", () => {
  const d = calcDelta(250, 100, { month: 5 });
  assert.equal(d.before.total, 44880);
  assert.equal(d.after.total, 70640);
  assert.equal(d.delta, 25760);
  assert.equal(d.tierMoved, false);
});

t("에어컨: 180→280kWh(1→2단계 이동) 증가액 24,410원, 구간이동 표시", () => {
  const d = calcDelta(180, 100, { month: 5 });
  assert.equal(d.before.total, 28200);
  assert.equal(d.after.total, 52610);
  assert.equal(d.delta, 24410);
  assert.equal(d.tierMoved, true);
  // 같은 +100kWh라도 1단계 내에서만 쓴 경우(100→200)보다 훨씬 비싸야 함
  const cheap = calcDelta(100, 100, { month: 5 });
  assert.equal(cheap.delta, 31220 - 16120);
  assert.ok(d.delta > cheap.delta);
});

t("에어컨: 하계 400→500kWh(2→3단계 이동) 증가액 37,420원", () => {
  const d = calcDelta(400, 100, { month: 7 });
  assert.equal(d.before.total, 72860);
  assert.equal(d.after.total, 110280);
  assert.equal(d.delta, 37420);
  assert.equal(d.tierMoved, true);
});

t("에어컨: kWh 환산(1.8kW × 5h × 30일 = 270kWh)", () => {
  assert.equal(kwhOf(1800, 5, 30), 270);
});

/* ── 3. 가스 단위 변환 왕복 일관성 ──────────────────────────── */
t("가스: ㎥→MJ→kWh 왕복 오차 없음", () => {
  for (const m3 of [1, 10, 100, 123.45]) {
    for (const f of [42.7, 43.1, 42.564]) {
      const back = kwhToM3(m3ToKwh(m3, f), f);
      assert.ok(Math.abs(back - m3) < 1e-9, `${m3}@${f} → ${back}`);
      assert.ok(Math.abs(mjToM3(m3ToMj(m3, f), f) - m3) < 1e-9);
    }
  }
  assert.ok(Math.abs(kwhToMj(mjToKwh(360)) - 360) < 1e-9);
  assert.equal(mjToKwh(3.6), 1); // 정의값
});

t("가스: 요금 손계산 대조(100㎥ × 42.7 × 20원/MJ + 기본 1,000원)", () => {
  const r = calcGasBill(100, 20, { baseCharge: 1000, factor: 42.7 });
  assert.equal(r.mj, 4270);
  assert.equal(r.usageCharge, 85400);
  assert.equal(r.supply, 86400);
  assert.equal(r.vat, 8640);
  assert.equal(r.total, 95040);
});

/* ── 4~6. HTML 정적 검사 ────────────────────────────────────── */
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
assert.ok(files.length >= 15, "HTML 페이지 수 확인: " + files.length);

t(`정책: 금지 문자열 0건 (${files.length}개 HTML)`, () => {
  const banned = ["광고" + " 영역", "REPLACE" + "_"];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const b of banned) assert.ok(!html.includes(b), `${f} 에 금지 문자열 "${b}"`);
  }
});

t("링크: 루트 절대경로(/) 0건 + 상대링크 깨짐 0건", () => {
  const attrRe = /(?:href|src)\s*=\s*"([^"]+)"/g;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    let m;
    while ((m = attrRe.exec(html))) {
      const url = m[1];
      if (/^(https?:|mailto:|#|data:|javascript:)/.test(url)) continue;
      assert.ok(!url.startsWith("/"), `${f}: 루트 절대경로 금지 → ${url}`);
      let path = url.split("#")[0].split("?")[0];
      if (!path) continue;
      let target = resolve(dirname(f), path);
      if (path.endsWith("/")) target = join(target, "index.html");
      if (!existsSync(target) && existsSync(target + "/index.html") === false) {
        assert.ok(existsSync(target), `${f}: 깨진 링크 → ${url}`);
      }
    }
  }
});

t("sitemap: 모든 URL에 대응 파일 존재 + 주요 페이지 포함", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 15, "sitemap URL 수: " + locs.length);
  const origin = locs[0].match(/^https?:\/\/[^/]+/)[0];
  for (const loc of locs) {
    assert.ok(loc.startsWith(origin), "origin 불일치: " + loc);
    let rel = loc.slice(origin.length).replace(/^\//, "");
    let target = rel === "" ? join(ROOT, "index.html")
      : rel.endsWith("/") ? join(ROOT, rel, "index.html")
      : join(ROOT, rel);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  for (const must of ["electric-bill", "ac-cost", "gas-unit", "save-simulator"]) {
    assert.ok(locs.some((l) => l.includes("/" + must + "/")), "sitemap 누락: " + must);
  }
});

t("광고: 계산기 페이지에 adsbygoogle 유닛 1개(결과 하단)만 존재", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(units <= 1, `${f}: 광고 유닛 ${units}개 (최대 1)`);
  }
});


/* ── 2-b. 누진 이동 시 "단순 곱셈"보다 실제 증가액이 큰가 ───── */
t("에어컨: 1→2단계 이동 시 단순 곱셈보다 실제 증가액이 큼 (180+100kWh)", () => {
  const opts = { month: 5, voltage: "low" };
  const d = calcDelta(180, 100, opts);
  const n = naiveDelta(180, 100, opts);
  assert.equal(n.tier, 1);
  assert.equal(n.perKwh, 134);        // 120.0 + 9 + 5
  assert.equal(n.amount, 15100);      // 13,400 + 1,340 + 360
  assert.equal(d.delta, 24410);
  assert.ok(d.delta > n.amount, "구간 이동 시 실제 증가액 > 단순 곱셈");
  assert.ok(d.delta - n.amount > 9000, "차액 확인: " + (d.delta - n.amount));
});

t("에어컨: 2→3단계 이동 시 단순 곱셈보다 큼 (하계 400+100kWh)", () => {
  const opts = { month: 7, voltage: "low" };
  const d = calcDelta(400, 100, opts);
  const n = naiveDelta(400, 100, opts);
  assert.equal(n.tier, 2);
  assert.equal(n.perKwh, 228.6);      // 214.6 + 9 + 5
  assert.equal(n.amount, 25756);      // 22,860 + 2,286 + 610
  assert.equal(d.delta, 37420);
  assert.ok(d.delta > n.amount);
});

t("에어컨: 기타계절 380+100kWh(2→3단계) 단순 곱셈 대비 초과", () => {
  const opts = { month: 9, voltage: "low" };
  const d = calcDelta(380, 100, opts);
  const n = naiveDelta(380, 100, opts);
  assert.equal(d.before.tier, 2);
  assert.equal(d.after.tier, 3);
  assert.equal(d.tierMoved, true);
  assert.ok(d.delta > n.amount, `${d.delta} > ${n.amount}`);
  // 고압 계약에서도 동일한 성질이 유지되어야 함
  const h = { month: 9, voltage: "high" };
  assert.ok(calcDelta(380, 100, h).delta > naiveDelta(380, 100, h).amount);
});

t("절약: 사용량을 줄이면 누진 하향 이동으로 절감액이 단가×kWh보다 큼", () => {
  const opts = { month: 10, voltage: "low" };
  const s = calcSaving(410, 20, opts);   // 3단계 → 2단계
  assert.equal(s.before.tier, 3);
  assert.equal(s.after.tier, 2);
  assert.equal(s.tierMoved, true);
  assert.ok(s.saving > 20 * 307.3 * 1.1, "3단계 단가 단순 곱셈보다 절감액이 커야 함: " + s.saving);
  const none = calcSaving(300, 20, opts); // 구간 유지
  assert.equal(none.tierMoved, false);
  assert.ok(none.saving < s.saving);
});

/* ── 7. 생성물 구조 검사 ────────────────────────────────────── */
const TOOL_SLUGS = ["electric-bill", "ac-cost", "appliance-cost", "standby-power", "heating-cost",
  "gas-unit", "solar-home", "ev-charging", "bill-reader", "save-simulator"];

t(`페이지 생성: 도구 10종 + 허브 + 가전 롱테일 + 정책 (총 ${files.length})`, () => {
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "누락: " + s);
  assert.ok(existsSync(join(ROOT, "index.html")), "허브 index.html 누락");
  assert.ok(existsSync(join(ROOT, "appliance", "index.html")), "가전 목록 누락");
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")));
  assert.ok(existsSync(join(ROOT, "robots.txt")));
  const longtail = readdirSync(join(ROOT, "appliance")).filter((n) => statSync(join(ROOT, "appliance", n)).isDirectory());
  assert.ok(longtail.length >= 50, "가전 롱테일 페이지 수: " + longtail.length);
  assert.equal(files.length, 1 + TOOL_SLUGS.length + 1 + longtail.length + 2);
});

t("SEO: 페이지별 고유 title/description + JSON-LD 3종", () => {
  const titles = new Set(), descs = new Set();
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const ti = html.match(/<title>([^<]+)<\/title>/)[1];
    const de = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(ti), "중복 title: " + ti);
    assert.ok(!descs.has(de), "중복 description: " + de);
    titles.add(ti); descs.add(de);
    assert.ok(html.includes('"@type":"BreadcrumbList"'), f + ": BreadcrumbList 없음");
    const isPolicy = f.endsWith("privacy.html") || f.endsWith("terms.html");
    if (!isPolicy) {
      assert.ok(html.includes('"@type":"SoftwareApplication"'), f + ": SoftwareApplication 없음");
      assert.ok(html.includes('"@type":"FAQPage"'), f + ": FAQPage 없음");
    }
    assert.ok(html.includes('rel="canonical" href="https://billcalc-kr.vercel.app/'), f + ": canonical 없음");
  }
});

t("요금 기준일·출처 표기 + TomatoEggCat 크로스링크", () => {
  for (const s of TOOL_SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    const hasBasis = html.includes("2023년 5월 16일 개정 기준") || html.includes("지역 도시가스사가 각각 고시");
    assert.ok(hasBasis, s + ": 요금표 기준일 표기 없음");
    assert.ok(html.includes("cyber.kepco.co.kr") || html.includes("citygas.or.kr"), s + ": 출처 URL 없음");
    assert.ok(html.includes("https://tomatoeggcat.com/electric-bill-calc/"), s + ": 크로스링크 누락(electric-bill-calc)");
    assert.ok(html.includes("https://tomatoeggcat.com/pyeong-electric/"), s + ": 크로스링크 누락(pyeong-electric)");
  }
});

t("광고: 입력 화면 노출 금지(기본 hidden) + head 로더 존재", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    if (!html.includes('class="adsbygoogle"')) continue;
    assert.ok(/<div class="ad-wrap" id="adWrap" hidden>/.test(html), f + ": 광고 컨테이너가 기본 노출 상태");
    assert.ok(html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106'), f + ": head 로더 없음");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), f + ": ad client 불일치");
  }
});

t("인라인 모듈 스크립트 문법 검사", async () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      const code = m[1].replace(/^import [^\n]*;$/gm, "");
      try { new Script(code, { filename: f }); }
      catch (e) { assert.fail(f + " 스크립트 문법 오류: " + e.message); }
    }
  }
});

t("결과: 전기요금 계산 페이지는 항목별 산출 표(billTableHtml)를 출력", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    if (!/lib\/elec\.mjs/.test(html)) continue;
    assert.ok(html.includes("billTableHtml("), f + ": 항목별 산출 표 미출력");
  }
  // 표는 런타임 생성이므로 공용 헬퍼(assets/app.mjs)에서 항목 존재를 검증
  const helper = readFileSync(join(ROOT, "assets", "app.mjs"), "utf8");
  for (const item of ["기본요금", "전력량요금", "기후환경요금", "연료비조정요금", "부가가치세", "전력산업기반기금", "전기요금계"]) {
    assert.ok(helper.includes(item), "billTableHtml 항목 누락: " + item);
  }
});

t("JSON-LD 파싱 가능 (전 페이지)", () => {
  for (const f of files) {
    const m = readFileSync(f, "utf8").match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
    assert.ok(m, f + ": JSON-LD 블록 없음");
    JSON.parse(m[1]);
  }
});

console.log(`\n${pass} tests passed ✔`);
