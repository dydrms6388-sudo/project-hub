// carcalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node carcalc-kr/tests/run.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { carTax, acquisitionTax, loanSchedule, parseTire, tireDiameter, tireDiff, depreciation, fuelEconomy, fuelCost, floor10 } from "../lib/calc.mjs";
import { SITE_ORIGIN, TOOLS as TOOL_META } from "../data/site.mjs";
import { FINES } from "../data/fines.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };

/* ── 1. 자동차세 5케이스 (손계산 대조) ──────────────────────── */
// 근거: 지방세법 제127조 cc당 80/140/200원, 제151조 지방교육세 30%,
//       차령 3년차부터 5%p/년(최대 50%), 시행령 제125조 연납 공제 5%×(일수/365)

t("자동차세 ①: 1,000cc 경계 — cc당 80원, 지방교육세 30% 포함 104,000원", () => {
  const r = carTax({ cc: 1000, use: "nonbusiness", ageYears: 1 });
  assert.equal(r.perCc, 80);
  assert.equal(r.raw, 80000);          // 1000 × 80
  assert.equal(r.mainTax, 80000);
  assert.equal(r.educTax, 24000);      // 80,000 × 30%
  assert.equal(r.annualTotal, 104000);
  // 1cc만 넘으면 cc당 140원 구간으로 점프
  const j = carTax({ cc: 1001, use: "nonbusiness", ageYears: 1 });
  assert.equal(j.perCc, 140);
  assert.equal(j.raw, 140140);
  assert.equal(j.educTax, 42040);      // floor10(42,042)
  assert.equal(j.annualTotal, 182180);
  assert.ok(j.annualTotal - r.annualTotal > 78000, "1cc 차이로 78,000원 이상 점프해야 함");
});

t("자동차세 ②: 1,600cc 경계 — 291,200원 / 1,601cc는 416,260원", () => {
  const a = carTax({ cc: 1600, ageYears: 1 });
  assert.equal(a.perCc, 140);
  assert.equal(a.raw, 224000);         // 1600 × 140
  assert.equal(a.educTax, 67200);      // 224,000 × 30%
  assert.equal(a.annualTotal, 291200);
  const b = carTax({ cc: 1601, ageYears: 1 });
  assert.equal(b.perCc, 200);
  assert.equal(b.raw, 320200);         // 1601 × 200
  assert.equal(b.educTax, 96060);
  assert.equal(b.annualTotal, 416260);
});

t("자동차세 ③: 차령 경감 — 1,998cc 5년차 15% 경감 = 441,550원, 12년차 이후 50% 고정", () => {
  const r = carTax({ cc: 1998, ageYears: 5 });
  assert.equal(r.raw, 399600);                 // 1998 × 200
  assert.ok(Math.abs(r.reduction - 0.15) < 1e-9); // 5% × (5-2)
  assert.equal(r.mainTax, 339660);             // 399,600 × 0.85
  assert.equal(r.educTax, 101890);             // floor10(101,898)
  assert.equal(r.annualTotal, 441550);
  assert.equal(carTax({ cc: 1998, ageYears: 2 }).reduction, 0);       // 2년차는 경감 없음
  assert.ok(Math.abs(carTax({ cc: 1998, ageYears: 3 }).reduction - 0.05) < 1e-9);
  assert.equal(carTax({ cc: 1998, ageYears: 12 }).reduction, 0.5);
  assert.equal(carTax({ cc: 1998, ageYears: 25 }).reduction, 0.5);    // 상한 50%
});

t("자동차세 ④: 연납 할인 — 1,600cc 1월 연납 공제 13,320원, 납부액 277,880원", () => {
  const r = carTax({ cc: 1600, ageYears: 1, prepayMonth: 1 });
  assert.equal(r.annualTotal, 291200);
  // 291,200 × 5% × (334/365) = 13,323.39... → 10원 미만 절사
  assert.equal(r.prepayDiscount, 13320);
  assert.equal(r.prepayPaid, 277880);
  const sep = carTax({ cc: 1600, ageYears: 1, prepayMonth: 9 });
  assert.equal(sep.prepayDiscount, floor10(291200 * 0.05 * (92 / 365))); // 3,670
  assert.ok(sep.prepayDiscount < r.prepayDiscount, "9월 연납은 공제 기간이 짧아 할인이 작아야 함");
  assert.equal(carTax({ cc: 1600, ageYears: 1 }).prepayDiscount, 0);
});

t("자동차세 ⑤: 영업용은 지방교육세 0원 / 전기차는 정액 10만원 + 교육세 3만원", () => {
  const biz = carTax({ cc: 1600, use: "business", ageYears: 1 });
  assert.equal(biz.perCc, 18);
  assert.equal(biz.raw, 28800);
  assert.equal(biz.educTax, 0);        // 영업용 승용은 지방교육세 비과세
  assert.equal(biz.annualTotal, 28800);
  const ev = carTax({ cc: 0, use: "nonbusiness", ageYears: 1 });
  assert.equal(ev.raw, 100000);
  assert.equal(ev.educTax, 30000);
  assert.equal(ev.annualTotal, 130000);
  const evBiz = carTax({ cc: 0, use: "business", ageYears: 1 });
  assert.equal(evBiz.annualTotal, 20000);
});

/* ── 2. 취득세 3케이스 ──────────────────────────────────────── */
t("취득세 ①: 승용 비영업용 7% — 3,000만원 → 210만원", () => {
  const r = acquisitionTax({ price: 30000000, type: "passengerNonbusiness" });
  assert.equal(r.rate, 0.07);
  assert.equal(r.tax, 2100000);
});

t("취득세 ②: 경자동차 4% + 10원 미만 절사 — 12,345,678원 → 493,820원", () => {
  const r = acquisitionTax({ price: 12345678, type: "lightCar" });
  assert.equal(r.rate, 0.04);
  assert.equal(r.tax, 493820);         // 493,827.12 → floor10
  assert.ok(r.tax % 10 === 0);
});

t("취득세 ③: 영업용 4% / 승합·화물 5% / 이륜 2% 세율 대조", () => {
  assert.equal(acquisitionTax({ price: 25000000, type: "business" }).tax, 1000000);
  assert.equal(acquisitionTax({ price: 20000000, type: "nonPassengerNonbusiness" }).tax, 1000000);
  assert.equal(acquisitionTax({ price: 5000000, type: "motorcycle" }).tax, 100000);
  assert.throws(() => acquisitionTax({ price: 1000, type: "nope" }));
});

/* ── 3. 할부 원리금 스케줄 합계 일관성 ─────────────────────── */
t("할부: 스케줄 합계 = 원금 + 총이자 (두 방식 · 여러 조건)", () => {
  const cases = [
    { principal: 30000000, annualRate: 0.059, months: 60 },
    { principal: 12345678, annualRate: 0.0399, months: 36 },
    { principal: 5000000, annualRate: 0, months: 12 },
    { principal: 80000000, annualRate: 0.129, months: 84 },
    { principal: 1000000, annualRate: 0.05, months: 1 },
  ];
  for (const method of ["equalPayment", "equalPrincipal"]) {
    for (const c of cases) {
      const r = loanSchedule({ ...c, method });
      assert.equal(r.rows.length, c.months, `${method} ${c.months}개월 회차 수`);
      assert.equal(r.totalPrincipal, c.principal, `${method}: 원금 합계 불일치`);
      assert.equal(r.totalPay, r.totalPrincipal + r.totalInterest, `${method}: 총상환 = 원금 + 이자`);
      assert.equal(r.rows[r.rows.length - 1].balance, 0, `${method}: 마지막 잔액 0`);
      const sumInterest = r.rows.reduce((s, x) => s + x.interest, 0);
      assert.equal(sumInterest, r.totalInterest, `${method}: 회차별 이자 합 = 총이자`);
      for (const x of r.rows) assert.equal(x.pay, x.principalPart + x.interest, `${method}: 회차 납입금 = 원금+이자`);
      if (c.annualRate === 0) assert.equal(r.totalInterest, 0);
    }
  }
  // 같은 조건이면 원금균등의 총이자가 원리금균등보다 적다
  const ep = loanSchedule({ principal: 30000000, annualRate: 0.059, months: 60, method: "equalPayment" });
  const pr = loanSchedule({ principal: 30000000, annualRate: 0.059, months: 60, method: "equalPrincipal" });
  assert.ok(pr.totalInterest < ep.totalInterest, "원금균등 총이자 < 원리금균등 총이자");
  assert.ok(pr.rows[0].pay > ep.rows[0].pay, "원금균등 1회차 납입금이 더 크다");
});

/* ── 4. 타이어 대체 규격 지름 오차 3케이스 ─────────────────── */
t("타이어 ①: 205/55R16 전체 지름 631.9mm (림 인치×25.4 + 사이드월×2)", () => {
  const o = parseTire("205/55R16 91V");
  assert.deepEqual({ w: o.width, a: o.aspect, r: o.rim, li: o.loadIndex, ss: o.speedSymbol },
    { w: 205, a: 55, r: 16, li: 91, ss: "V" });
  assert.ok(Math.abs(tireDiameter(o) - 631.9) < 1e-9);   // 406.4 + 225.5
  assert.equal(parseTire("이건 규격이 아님"), null);
  assert.equal(parseTire("205/55/16"), null);
});

t("타이어 ②: 205/55R16 → 225/45R17 오차 +0.38% (±3% 이내)", () => {
  const d = tireDiff(parseTire("205/55R16"), parseTire("225/45R17"));
  assert.ok(Math.abs(d.d1 - 631.9) < 1e-9);
  assert.ok(Math.abs(d.d2 - 634.3) < 1e-9);              // 431.8 + 202.5
  assert.ok(Math.abs(d.diffMm - 2.4) < 1e-9);
  assert.ok(Math.abs(d.diffPct - 0.379806) < 1e-4, "오차율: " + d.diffPct);
  assert.ok(Math.abs(d.diffPct) <= 3, "±3% 권장 범위 안");
});

t("타이어 ③: 205/55R16 → 205/60R16 오차 +3.24% (±3% 초과) / 동일 규격은 0%", () => {
  const d = tireDiff(parseTire("205/55R16"), parseTire("205/60R16"));
  assert.ok(Math.abs(d.d2 - 652.4) < 1e-9);
  assert.ok(Math.abs(d.diffMm - 20.5) < 1e-9);
  assert.ok(Math.abs(d.diffPct - 3.244184) < 1e-4, "오차율: " + d.diffPct);
  assert.ok(Math.abs(d.diffPct) > 3, "±3% 초과 판정");
  const same = tireDiff(parseTire("205/55R16"), parseTire("205/55R16"));
  assert.equal(same.diffPct, 0);
  // 지름이 작아지는 조합은 음수 오차
  const down = tireDiff(parseTire("205/55R16"), parseTire("195/50R16"));
  assert.ok(down.diffPct < 0);
});

/* ── 보조: 감가·연비 모델 일관성 ───────────────────────────── */
t("감가·연비: 산식 일관성", () => {
  const d0 = depreciation({ price: 30000000, ageYears: 0, mileage: 0 });
  assert.equal(d0.value, 30000000);
  const d1 = depreciation({ price: 30000000, ageYears: 1, mileage: 15000 });
  assert.equal(d1.value, 24000000);                    // 1년차 -20%, 주행 보정 0
  const d2 = depreciation({ price: 30000000, ageYears: 2, mileage: 30000 });
  assert.equal(d2.value, 21600000);                    // ×0.9
  const many = depreciation({ price: 30000000, ageYears: 2, mileage: 80000 });
  assert.ok(many.value < d2.value, "주행거리가 많으면 잔존가치가 낮아야 함");
  assert.ok(many.mileageAdj >= -0.1, "주행 보정 하한 -10%");
  assert.equal(fuelEconomy(450, 36), 12.5);
  assert.equal(fuelEconomy(450, 0), 0);
  const fc = fuelCost({ km: 100, kmPerL: 10, pricePerL: 1700, roundTrip: true, toll: 5000 });
  assert.equal(fc.dist, 200);
  assert.equal(fc.liters, 20);
  assert.equal(fc.fuel, 34000);
  assert.equal(fc.toll, 10000);
  assert.equal(fc.total, 44000);
});

/* ── 5~8. 생성물 정적 검사 ─────────────────────────────────── */
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "tests" || name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}
const files = htmlFiles(ROOT);
const TOOL_SLUGS = TOOL_META.map((t) => t.slug);

t(`페이지 생성: 허브 1 + 도구 ${TOOL_SLUGS.length} + 과태료 목록 1 + 롱테일 ${FINES.length} + 정책 2 = ${files.length}`, () => {
  assert.ok(existsSync(join(ROOT, "index.html")), "허브 index.html 누락");
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "도구 누락: " + s);
  assert.ok(existsSync(join(ROOT, "fine", "index.html")), "과태료 목록 누락");
  for (const f of FINES) assert.ok(existsSync(join(ROOT, "fine", f.slug, "index.html")), "롱테일 누락: " + f.slug);
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")), "정책 페이지 누락");
  assert.ok(existsSync(join(ROOT, "robots.txt")), "robots.txt 누락");
  assert.ok(!existsSync(join(ROOT, "vercel.json")), "vercel.json 을 만들면 안 됨");
  assert.equal(files.length, 1 + TOOL_SLUGS.length + 1 + FINES.length + 2);
});

t(`(5) 금지 문자열 0건 — '광고 영역' / 'REPLACE_' (${files.length}개 HTML)`, () => {
  const banned = ["광고" + " 영역", "REPLACE" + "_"];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const b of banned) assert.ok(!html.includes(b), `${f} 에 금지 문자열 "${b}"`);
  }
});

t("(6) 링크: 루트 절대경로(/) 0건 + 깨진 상대링크 0건", () => {
  const attrRe = /(?:href|src)\s*=\s*"([^"]+)"/g;
  let checked = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
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
  assert.ok(checked > 200, "검사한 내부 링크 수: " + checked);
  // 인라인 모듈의 상대 import 경로도 실제 파일이어야 한다
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const im of html.matchAll(/from "((?:\.\.\/)*(?:lib|data)\/[^"]+)"/g)) {
      assert.ok(existsSync(resolve(dirname(f), im[1])), `${f}: 깨진 import → ${im[1]}`);
    }
  }
});

t("(7) sitemap: 모든 URL에 대응 파일 존재 + 전 페이지 수록", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, files.length, `sitemap URL(${locs.length}) ≠ HTML(${files.length})`);
  assert.equal(new Set(locs).size, locs.length, "sitemap 중복 URL");
  for (const loc of locs) {
    assert.ok(loc.startsWith(SITE_ORIGIN + "/"), "SITE_ORIGIN 불일치: " + loc);
    const rel = loc.slice(SITE_ORIGIN.length + 1);
    const target = rel === "" ? join(ROOT, "index.html") : rel.endsWith("/") ? join(ROOT, rel, "index.html") : join(ROOT, rel);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  for (const s of TOOL_SLUGS) assert.ok(locs.includes(`${SITE_ORIGIN}/${s}/`), "sitemap 누락: " + s);
  assert.ok(locs.includes(`${SITE_ORIGIN}/fine/speed-20/`), "sitemap 롱테일 누락");
  const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
  assert.ok(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), "robots.txt sitemap 누락");
});

t("(8) SEO: 전 페이지 고유 title/description + JSON-LD 3종 + canonical", () => {
  const titles = new Set(), descs = new Set();
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const ti = html.match(/<title>([^<]+)<\/title>/);
    const de = html.match(/<meta name="description" content="([^"]+)"/);
    assert.ok(ti && ti[1].trim(), f + ": title 없음");
    assert.ok(de && de[1].trim().length > 40, f + ": description 없음/너무 짧음");
    assert.ok(!titles.has(ti[1]), "중복 title: " + ti[1]);
    assert.ok(!descs.has(de[1]), "중복 description: " + f);
    titles.add(ti[1]); descs.add(de[1]);
    const ld = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
    assert.ok(ld, f + ": JSON-LD 블록 없음");
    const parsed = JSON.parse(ld[1]);
    const types = parsed["@graph"].map((g) => g["@type"]);
    assert.ok(types.includes("BreadcrumbList"), f + ": BreadcrumbList 없음");
    const isPolicy = f.endsWith("privacy.html") || f.endsWith("terms.html");
    if (!isPolicy) {
      assert.ok(types.includes("SoftwareApplication"), f + ": SoftwareApplication 없음");
      assert.ok(types.includes("FAQPage"), f + ": FAQPage 없음");
      const faq = parsed["@graph"].find((g) => g["@type"] === "FAQPage");
      assert.ok(faq.mainEntity.length >= 2, f + ": FAQ 항목 부족");
    }
    assert.ok(html.includes(`rel="canonical" href="${SITE_ORIGIN}/`), f + ": canonical 없음");
    assert.ok(html.includes(`<meta property="og:url" content="${SITE_ORIGIN}/`), f + ": og:url 없음");
  }
});

t("광고: 유닛 최대 1개 · 기본 hidden · head 로더 · client 일치", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(units <= 1, `${f}: 광고 유닛 ${units}개 (최대 1)`);
    if (!units) continue;
    assert.ok(html.includes('<div class="ad-wrap" id="adBox" hidden>'), f + ": 광고가 기본 노출 상태(입력 화면 광고 금지)");
    assert.ok(html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106'), f + ": head 로더 없음");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), f + ": ad client 불일치");
    assert.ok(html.includes('data-ad-format="auto"') && html.includes('data-full-width-responsive="true"'), f + ": ad 포맷 속성 누락");
  }
});

t("세금 페이지: 위택스 고지 + 산출 과정(산식) 출력", () => {
  for (const s of ["car-tax", "acquisition"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("참고용 추정") && html.includes("wetax.go.kr"), s + ": 위택스 확인 고지 없음");
    assert.ok(html.includes("C.steps("), s + ": 산출 과정 미출력");
  }
  const helper = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
  assert.ok(helper.includes("산출 과정"), "steps 헬퍼에 산출 과정 라벨 없음");
  // '확인 필요' 배지 + 직접 입력란
  const ct = readFileSync(join(ROOT, "car-tax", "index.html"), "utf8");
  assert.ok(ct.includes('class="badge todo">확인 필요'), "car-tax: 확인 필요 배지 없음");
  assert.ok(ct.includes('id="manual"'), "car-tax: 직접 입력란 없음");
  const aq = readFileSync(join(ROOT, "acquisition", "index.html"), "utf8");
  assert.ok(aq.includes('class="badge todo">확인 필요'), "acquisition: 확인 필요 배지 없음");
  assert.ok(aq.includes('id="rateOv"'), "acquisition: 세율 직접 입력란 없음");
});

t("크로스링크: 도구 페이지마다 tomatoeggcat.com 절대 URL 2개 이상", () => {
  const allowed = ["https://tomatoeggcat.com/car-maintenance-cycle/", "https://tomatoeggcat.com/car-insurance-rider/",
    "https://tomatoeggcat.com/loan-refi-calc/", "https://tomatoeggcat.com/dydrms-yeonbigak/", "https://tomatoeggcat.com/dydrms-driving-test/"];
  for (const s of TOOL_SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    const n = allowed.filter((u) => html.includes(u)).length;
    assert.ok(n >= 2, `${s}: 크로스링크 ${n}개 (2개 이상 필요)`);
  }
});

t("기록형 도구: localStorage + CSV + 전체삭제 + '서버 저장 없음' 명시", () => {
  for (const s of ["fuel-economy", "maintenance"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("서버 저장 없음"), s + ": 서버 저장 없음 문구 누락");
    assert.ok(html.includes("localStorage"), s + ": localStorage 안내 없음");
    assert.ok(html.includes("downloadCsv") || html.includes("CSV 내보내기"), s + ": CSV 내보내기 없음");
    assert.ok(html.includes("전체 삭제") || html.includes("기록 전체 삭제"), s + ": 전체 삭제 없음");
  }
  assert.ok(readFileSync(join(ROOT, "fuel-economy", "index.html"), "utf8").includes("<svg"), "fuel-economy: SVG 그래프 코드 없음");
});

t("과태료 롱테일: 금액·벌점 표기 + 조회표 상호 링크", () => {
  const table = readFileSync(join(ROOT, "fine-table", "index.html"), "utf8");
  for (const f of FINES) {
    assert.ok(table.includes(`href="../fine/${f.slug}/"`), "조회표에서 롱테일 링크 누락: " + f.slug);
    const html = readFileSync(join(ROOT, "fine", f.slug, "index.html"), "utf8");
    assert.ok(html.includes("../../fine-table/"), f.slug + ": 조회표 역링크 없음");
    assert.ok(html.includes("efine.go.kr"), f.slug + ": 이파인 확인처 링크 없음");
    if (f.fine != null) assert.ok(html.includes(f.fine.toLocaleString("ko-KR") + "원"), f.slug + ": 과태료 금액 표기 없음");
    if (f.penalty != null) assert.ok(html.includes(f.penalty.toLocaleString("ko-KR") + "원"), f.slug + ": 범칙금 금액 표기 없음");
  }
});

t("인라인 모듈 스크립트 문법 검사", () => {
  let n = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      const code = m[1].replace(/^import [^\n]*;$/gm, "");
      try { new Script(code, { filename: f }); n++; }
      catch (e) { assert.fail(f + " 스크립트 문법 오류: " + e.message); }
    }
  }
  assert.ok(n >= 15, "검사한 인라인 스크립트 수: " + n);
});


/* ── 9. 런타임 스모크: 각 페이지 스크립트를 실제로 실행 ────── */
function makeEl(init) {
  const e = Object.assign({
    value: "", checked: false, textContent: "", innerHTML: "", hidden: false, disabled: false,
    dataset: {}, style: {}, children: [], _on: {},
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); },
    setAttribute() {}, getAttribute() { return null; }, scrollIntoView() {}, click() {},
    remove() {}, focus() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
  }, init || {});
  return e;
}
function parseControls(html) {
  const byId = {}, radios = {};
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    const name = (tag.match(/\bname="([^"]+)"/) || [])[1];
    const val = (tag.match(/\bvalue="([^"]*)"/) || [])[1] || "";
    const checked = /\bchecked\b/.test(tag);
    if (id) byId[id] = { value: val, checked };
    if (name && checked && !(name in radios)) radios[name] = val;
    if (name && !(name in radios)) radios[name] = val;
  }
  for (const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const first = (m[2].match(/<option value="([^"]*)"/) || [])[1] || "";
    byId[m[1]] = { value: first, checked: false };
  }
  return { byId, radios };
}
async function smoke(file) {
  const html = readFileSync(file, "utf8");
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) return 0;
  const { byId, radios } = parseControls(html);
  const cache = new Map();
  const getEl = (id) => {
    if (!cache.has(id)) cache.set(id, makeEl(byId[id] || {}));
    return cache.get(id);
  };
  const store = {};
  const g = globalThis;
  g.window = g;
  g.document = {
    body: makeEl(),
    getElementById: getEl,
    createElement: () => makeEl(),
    querySelector: (sel) => {
      const r = sel.match(/input\[name=([\w-]+)\]:checked/);
      if (r) return makeEl({ value: radios[r[1]] || "" });
      return makeEl();
    },
    querySelectorAll: () => [],
  };
  g.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  g.alert = () => {}; g.confirm = () => false;
  g.location = { reload() {} };
  g.navigator = g.navigator || {};
  // window.CC 로더(classic script) 평가
  new Script(readFileSync(join(ROOT, "assets", "app.js"), "utf8"), { filename: "app.js" }).runInThisContext();
  const tmp = join(dirname(file), "__smoke.mjs");
  writeFileSync(tmp, m[1], "utf8");
  try {
    await import(pathToFileURL(tmp).href + "?v=" + Date.now() + Math.random());
    // 계산 버튼 핸들러를 실제로 호출
    const go = cache.get("go");
    if (go && go._on.click) for (const fn of go._on.click) fn.call(go, { type: "click" });
  } finally { rmSync(tmp, { force: true }); }
  return 1;
}

let smoked = 0;
for (const f of files) smoked += await smoke(f);
pass++;
console.log(`ok - (9) 런타임 스모크: 인라인 스크립트 ${smoked}개 실행 + 계산 핸들러 호출 무오류`);

console.log(`\n${pass} tests passed ✔`);
