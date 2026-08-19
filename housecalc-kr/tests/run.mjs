// housecalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node housecalc-kr/tests/run.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acqStandardRatePct, acquisitionTax, brokerFeeCalc, leaseAmount, subscriptionScore,
  monthlyPayment, maxLoanFromPayment, totalInterest, dsrPct, dsrMaxLoan, stampDuty,
  progressiveTax, marginalTax, remainingBalance, cumulativeInterest, equalPrincipal,
  equalPrincipalCumInterest, prepayFee,
} from "../assets/calc.mjs";
import * as UI from "../assets/ui.mjs";
import * as CALC from "../assets/calc.mjs";
import { acquisition } from "../data/acquisition.mjs";
import { brokerFee } from "../data/brokerfee.mjs";
import { loanRules } from "../data/loan.mjs";
import { registration } from "../data/registration.mjs";
import { subscription } from "../data/subscription.mjs";
import { jeonseInsurance } from "../data/insurance.mjs";
import { holding } from "../data/holding.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const 억 = 100_000_000, 만 = 10_000;

/* ── 1. 취득세: 손계산 5케이스 (구간 경계 포함) ───────────────── */
t("취득세: 5억 → 표준 1% → 취득세 500만원 (+지방교육세 50만)", () => {
  const r = acquisitionTax(5 * 억);
  assert.equal(r.ratePct, 1);
  assert.equal(r.tax, 5_000_000);
  assert.equal(r.eduPct, 0.1);
  assert.equal(r.eduTax, 500_000);
  assert.equal(r.ruralTax, 0);            // 85㎡ 이하 비과세
  assert.equal(r.total, 5_500_000);
});

t("취득세: 6억 경계 → 여전히 1% → 600만원", () => {
  const r = acquisitionTax(6 * 억);
  assert.equal(acqStandardRatePct(6 * 억), 1);
  assert.equal(r.tax, 6_000_000);
  assert.equal(r.total, 6_600_000);
  // 6억 초과부터 구간 산식으로 진입 (6.1억 → 6.1×2/3−3 = 1.0667%)
  assert.equal(acqStandardRatePct(6.1 * 억), 1.0667);
});

t("취득세: 7.5억 → 구간 산식 (7.5억×2÷3억−3) = 2% → 1,500만원", () => {
  assert.equal(acqStandardRatePct(7.5 * 억), 2);
  const r = acquisitionTax(7.5 * 억);
  assert.equal(r.tax, 15_000_000);
  assert.equal(r.eduPct, 0.2);
  assert.equal(r.eduTax, 1_500_000);
  assert.equal(r.total, 16_500_000);
  // 산식 자체 검증: 7억 ≈ 1.6667%, 8억 ≈ 2.3333%
  assert.equal(acqStandardRatePct(7 * 억), 1.6667);
  assert.equal(acqStandardRatePct(8 * 억), 2.3333);
});

t("취득세: 9억 경계 → 산식 결과가 정확히 3% → 2,700만원", () => {
  assert.equal(acqStandardRatePct(9 * 억), 3);
  const r = acquisitionTax(9 * 억);
  assert.equal(r.tax, 27_000_000);
  assert.equal(r.total, 27_000_000 + 2_700_000);
});

t("취득세: 10억(9억 초과) → 3% → 3,000만원 · 85㎡ 초과면 농특세 200만 추가", () => {
  const r = acquisitionTax(10 * 억);
  assert.equal(r.ratePct, 3);
  assert.equal(r.tax, 30_000_000);
  assert.equal(r.eduTax, 3_000_000);
  assert.equal(r.total, 33_000_000);
  const big = acquisitionTax(10 * 억, { areaOver85: true });
  assert.equal(big.ruralPct, 0.2);
  assert.equal(big.ruralTax, 2_000_000);
  assert.equal(big.total, 35_000_000);
});

t("취득세: 세율 직접 입력이 자동 판정보다 우선", () => {
  const r = acquisitionTax(10 * 억, { overrideRatePct: 8 });
  assert.equal(r.ratePct, 8);
  assert.equal(r.surcharged, true);
  assert.equal(r.eduPct, 0.4);            // 중과 시 고정 0.4%
  assert.equal(r.tax, 80_000_000);
});

/* ── 2. 중개보수: 상한 5케이스 (구간 경계 포함) ───────────────── */
const SB = brokerFee.saleBrackets.value, LB = brokerFee.leaseBrackets.value;

t("중개보수: 매매 4,500만원 → 0.6% = 27만이지만 한도액 25만 적용", () => {
  const r = brokerFeeCalc(4500 * 만, SB);
  assert.equal(r.ratePct, 0.6);
  assert.equal(r.raw, 270_000);
  assert.equal(r.cap, 250_000);
  assert.equal(r.capped, true);
  assert.equal(r.fee, 250_000);
});

t("중개보수: 매매 5,000만원(경계) → 0.5% 구간 진입 = 25만원", () => {
  const r = brokerFeeCalc(5000 * 만, SB);
  assert.equal(r.ratePct, 0.5);
  assert.equal(r.fee, 250_000);
  assert.equal(r.capped, false);          // 한도 80만 미달
});

t("중개보수: 매매 2억(경계) → 0.4% = 80만원, 한도 없음", () => {
  const r = brokerFeeCalc(2 * 억, SB);
  assert.equal(r.ratePct, 0.4);
  assert.equal(r.cap, null);
  assert.equal(r.fee, 800_000);
});

t("중개보수: 매매 9억(경계) → 0.5% = 450만원", () => {
  const r = brokerFeeCalc(9 * 억, SB);
  assert.equal(r.ratePct, 0.5);
  assert.equal(r.fee, 4_500_000);
  // 8.9억은 아직 0.4% 구간
  assert.equal(brokerFeeCalc(8.9 * 억, SB).ratePct, 0.4);
});

t("중개보수: 매매 15억(경계) → 0.7% = 1,050만원", () => {
  const r = brokerFeeCalc(15 * 억, SB);
  assert.equal(r.ratePct, 0.7);
  assert.equal(r.fee, 10_500_000);
  assert.equal(brokerFeeCalc(14.9 * 억, SB).ratePct, 0.6);
});

t("중개보수: 월세 환산 — 보증금+월세×100, 5천만 미만이면 ×70 재환산", () => {
  const conv = brokerFee.monthlyConversion.value;
  // 3천만 + 월 50만 → 8천만 → 임대차 0.4% 구간, 한도 30만
  const a1 = leaseAmount(3000 * 만, 50 * 만, conv);
  assert.equal(a1, 8000 * 만);
  const r1 = brokerFeeCalc(a1, LB);
  assert.equal(r1.ratePct, 0.4);
  assert.equal(r1.raw, 320_000);
  assert.equal(r1.fee, 300_000);          // 한도액 적용
  // 1천만 + 월 30만 → 4천만(5천만 미만) → 1천만 + 30만×70 = 3,100만
  const a2 = leaseAmount(1000 * 만, 30 * 만, conv);
  assert.equal(a2, 3100 * 만);
  const r2 = brokerFeeCalc(a2, LB);
  assert.equal(r2.ratePct, 0.5);
  assert.equal(r2.fee, 155_000);
});

/* ── 3. 청약 가점: 3케이스 (84점 만점 포함) ──────────────────── */
t("청약: 무주택 15년 32 + 부양가족 6명 35 + 통장 15년 17 = 84점 만점", () => {
  const s = subscriptionScore({ noHouseYears: 15, dependents: 6, accountYears: 15 });
  assert.equal(s.noHousePts, 32);
  assert.equal(s.dependentsPts, 35);
  assert.equal(s.accountPts, 17);
  assert.equal(s.total, 84);
  assert.equal(s.total, subscription.totalMax.value);
  // 만점 초과 불가
  const over = subscriptionScore({ noHouseYears: 30, dependents: 10, accountYears: 30 });
  assert.equal(over.total, 84);
});

t("청약: 유주택 0 + 부양가족 2명 15 + 통장 5년 7 = 22점", () => {
  const s = subscriptionScore({ noHouseYears: 12, hasHouse: true, dependents: 2, accountYears: 5 });
  assert.equal(s.noHousePts, 0);
  assert.equal(s.dependentsPts, 15);
  assert.equal(s.accountPts, 7);
  assert.equal(s.total, 22);
});

t("청약: 무주택 0.5년 2 + 부양가족 0명 5 + 통장 0.3년 1 = 8점", () => {
  const s = subscriptionScore({ noHouseYears: 0.5, dependents: 0, accountYears: 0.3 });
  assert.equal(s.noHousePts, 2);
  assert.equal(s.dependentsPts, 5);
  assert.equal(s.accountPts, 1);
  assert.equal(s.total, 8);
  // 통장 6개월~1년은 2점, 1년이면 3점
  assert.equal(subscriptionScore({ accountYears: 0.6 }).accountPts, 2);
  assert.equal(subscriptionScore({ accountYears: 1 }).accountPts, 3);
});

/* ── 4. DSR 원리금 계산: 3케이스 (독립 상각 시뮬레이션 대조) ──── */
function simulate(principal, annualRatePct, months, payment) {
  const r = annualRatePct / 100 / 12;
  let bal = principal, interest = 0;
  for (let i = 0; i < months; i++) {
    const int = bal * r;
    interest += int;
    bal = bal + int - payment;
  }
  return { balance: bal, interest };
}

t("DSR: 3억·연 4%·30년 원리금균등 — 상각 시뮬레이션 잔액 0 수렴", () => {
  const pay = monthlyPayment(3 * 억, 4, 360);
  const sim = simulate(3 * 억, 4, 360, pay);
  assert.ok(Math.abs(sim.balance) < 1, "만기 잔액 ≈ 0, 실제 " + sim.balance);
  assert.ok(Math.abs(sim.interest - totalInterest(3 * 억, 4, 360)) < 1);
  assert.ok(Math.abs(pay - 1_432_246) < 2, "월 상환액 ≈ 1,432,246원, 실제 " + Math.round(pay));
  // 역산 왕복
  assert.ok(Math.abs(maxLoanFromPayment(pay, 4, 360) - 3 * 억) < 1);
});

t("DSR: 무이자(0%) 1.2억·10년 = 월 100만원 / DSR 비율 계산", () => {
  const pay = monthlyPayment(120_000_000, 0, 120);
  assert.equal(pay, 1_000_000);
  assert.equal(totalInterest(120_000_000, 0, 120), 0);
  // 연소득 6천만, 연 원리금 1,200만 → DSR 20%
  assert.equal(dsrPct(60_000_000, 12_000_000), 20);
  assert.ok(!isFinite(dsrPct(0, 1_000_000)) || Number.isNaN(dsrPct(0, 1_000_000)));
});

t("DSR: 한도 역산 — 연소득 6천/40%/기존 600만 → 남은 여력으로 대출 산출", () => {
  const d = dsrMaxLoan({ annualIncome: 60_000_000, dsrLimitPct: 40, existingAnnual: 6_000_000, ratePct: 4, months: 360 });
  assert.equal(d.capacityYear, 18_000_000);
  assert.equal(d.monthlyBudget, 1_500_000);
  // 역산한 대출액을 다시 월납으로 되돌리면 월 여력과 일치해야 함
  assert.ok(Math.abs(monthlyPayment(d.maxLoan, 4, 360) - 1_500_000) < 1);
  // 스트레스 가산금리를 넣으면 한도가 줄어야 함
  const s = dsrMaxLoan({ annualIncome: 60_000_000, dsrLimitPct: 40, existingAnnual: 6_000_000, ratePct: 4, stressAddPct: 1.5, months: 360 });
  assert.ok(s.maxLoan < d.maxLoan);
  // 여력이 없으면 0
  const zero = dsrMaxLoan({ annualIncome: 30_000_000, dsrLimitPct: 40, existingAnnual: 20_000_000, ratePct: 4, months: 360 });
  assert.equal(zero.maxLoan, 0);
});

/* ── 4-b. 보조 산식 (등기·보유세·대출비교) ───────────────────── */
t("보조: 인지세·재산세 누진·종부세 누진·중도상환수수료", () => {
  // 인지세: 주택 1억 이하 비과세, 5억 주택은 15만원 구간
  assert.equal(stampDuty(1 * 억, registration.stampDuty.value, { isHouse: true }), 0);
  assert.equal(stampDuty(5 * 억, registration.stampDuty.value, { isHouse: true }), 150_000);
  // 재산세 표준: 과세표준 1억 → 6만 + (1억−6천만)×0.15% = 12만
  assert.equal(progressiveTax(1 * 억, holding.propertyTaxStandard.value), 120_000);
  // 1주택 특례: 과세표준 1억 → 3만 + 4천만×0.1% = 7만
  assert.equal(progressiveTax(1 * 억, holding.propertyTaxOneHome.value.brackets), 70_000);
  // 종부세 일반: 과세표준 4억 → 3억×0.5% + 1억×0.7% = 220만
  assert.equal(marginalTax(4 * 억, holding.jongbuRates.value.general), 2_200_000);
  // 중도상환수수료: 잔액 2억 × 1.2% × (36−12)/36 = 160만
  assert.equal(prepayFee(2 * 억, 1.2, { sliding: true, exemptMonths: 36, paidMonths: 12 }), 1_600_000);
  assert.equal(prepayFee(2 * 억, 1.2, { sliding: false }), 2_400_000);
  assert.equal(prepayFee(2 * 억, 1.2, { sliding: true, exemptMonths: 36, paidMonths: 40 }), 0);
});

t("보조: 원리금균등 잔액·누적이자와 원금균등 총이자", () => {
  const P = 3 * 억, R = 4, M = 360;
  const bal = remainingBalance(P, R, M, 36);
  const cum = cumulativeInterest(P, R, M, 36);
  const sim = simulate(P, R, 36, monthlyPayment(P, R, M));
  assert.ok(Math.abs(bal - sim.balance) < 1, "잔액 일치");
  assert.ok(Math.abs(cum - sim.interest) < 1, "누적이자 일치");
  assert.equal(remainingBalance(P, R, M, M), 0);
  // 원금균등 총이자 = P×r×(n+1)/2
  const e = equalPrincipal(P, R, M);
  let brute = 0; const r = R / 100 / 12, per = P / M;
  for (let i = 0; i < M; i++) brute += (P - per * i) * r;
  assert.ok(Math.abs(e.totalInterest - brute) < 1);
  assert.ok(Math.abs(equalPrincipalCumInterest(P, R, M, 36) - (() => { let s = 0; for (let i = 0; i < 36; i++) s += (P - per * i) * r; return s; })()) < 1);
  // 원금균등 총이자 < 원리금균등 총이자
  assert.ok(e.totalInterest < totalInterest(P, R, M));
});

/* ── 5. 데이터 전 항목 source/checkedAt 누락 0 ───────────────── */
t("데이터: 전 항목이 value·source·checkedAt를 갖추고 todo에는 안내문 존재", () => {
  const sets = { acquisition, brokerFee, loanRules, registration, subscription, jeonseInsurance, holding };
  let n = 0;
  for (const [gname, group] of Object.entries(sets)) {
    for (const [key, d] of Object.entries(group)) {
      const where = gname + "." + key;
      assert.ok(d && typeof d === "object", where + " 객체 아님");
      assert.ok("value" in d, where + " value 누락");
      assert.ok(typeof d.source === "string" && /^https?:\/\//.test(d.source), where + " source 누락/형식 오류");
      assert.equal(d.checkedAt, "2026-08-19", where + " checkedAt 누락/불일치");
      if (d.todo) assert.ok(typeof d.todoNote === "string" && d.todoNote.length > 10, where + " todoNote 누락");
      n++;
    }
  }
  assert.ok(n >= 30, "데이터 항목 수 " + n);
  console.log("   · 검사한 데이터 항목:", n, "개 / 확인 필요(todo):",
    Object.values(sets).reduce((a, g) => a + Object.values(g).filter((d) => d.todo).length, 0), "개");
});

/* ── HTML 수집 ──────────────────────────────────────────────── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}
const HTML = walk(ROOT).sort();
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => f.slice(ROOT.length + 1);

/* ── 6. 광고 플레이스홀더 0건 + 광고 규칙 ────────────────────── */
t("광고: '광고 영역'·'REPLACE_' 잔재 0건, 결과 하단 1개·기본 hidden", () => {
  for (const f of HTML) {
    const h = read(f);
    assert.ok(!h.includes("광고 영역"), rel(f) + " 에 '광고 영역' 잔재");
    assert.ok(!h.includes("REPLACE_"), rel(f) + " 에 'REPLACE_' 잔재");
    const ins = (h.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(ins <= 1, rel(f) + " 광고 유닛 " + ins + "개 (1개 이하만 허용)");
    if (ins === 1) {
      assert.ok(h.includes('data-ad-client="ca-pub-5567719201265106"'), rel(f) + " 광고 client 누락");
      assert.ok(h.includes('data-ad-format="auto"') && h.includes('data-full-width-responsive="true"'), rel(f) + " 광고 속성 누락");
      assert.ok(/<div class="adbox" id="adbox" hidden>/.test(h), rel(f) + " 광고가 기본 노출 상태(입력 화면 광고 금지)");
      assert.ok(h.includes("pagead2.googlesyndication.com"), rel(f) + " head 로더 누락");
      // 결과 하단: 광고 블록이 결과 영역보다 뒤에 있어야 함
      assert.ok(h.indexOf('id="adbox"') > h.indexOf('id="result"'), rel(f) + " 광고가 결과 영역보다 앞");
    }
  }
  console.log("   · 검사한 HTML:", HTML.length, "개");
});

/* ── 7. 절대경로 0건 + 상대링크 파일 존재 ────────────────────── */
t("링크: 절대경로('/'로 시작) 0건 · 내부 상대링크 전부 실재", () => {
  let checked = 0;
  for (const f of HTML) {
    const h = read(f);
    for (const m of h.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(u)) continue;
      assert.ok(!u.startsWith("/"), rel(f) + " 절대경로 링크: " + u);
      const target = u.endsWith("/") ? u + "index.html" : u;
      const abs = resolve(dirname(f), target.split("#")[0]);
      assert.ok(existsSync(abs), rel(f) + " 깨진 상대링크: " + u);
      checked++;
    }
  }
  console.log("   · 검사한 내부 링크:", checked, "개");
});

/* ── 8. sitemap URL ↔ 파일 대응 ──────────────────────────────── */
t("sitemap: 모든 URL에 대응 파일 존재 · 모든 HTML이 sitemap에 등재", () => {
  const sm = read(join(ROOT, "sitemap.xml"));
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 15, "sitemap URL 수 " + locs.length);
  const origin = "https://housecalc-kr.vercel.app/";
  const files = new Set();
  for (const loc of locs) {
    assert.ok(loc.startsWith(origin), "SITE_ORIGIN 불일치: " + loc);
    const p = loc.slice(origin.length);
    const file = p === "" ? "index.html" : p.endsWith("/") ? p + "index.html" : p;
    assert.ok(existsSync(join(ROOT, file)), "sitemap URL에 파일 없음: " + loc);
    files.add(file);
  }
  for (const f of HTML) assert.ok(files.has(rel(f)), "sitemap 누락: " + rel(f));
  const robots = read(join(ROOT, "robots.txt"));
  assert.ok(robots.includes(origin + "sitemap.xml"), "robots.txt Sitemap 누락");
  console.log("   · sitemap URL:", locs.length, "개");
});

/* ── 9. 고유 title · JSON-LD 3종 · 고지 문구 ─────────────────── */
const NOTICE_PHRASE = "참고용 추정이며 실제 세액·한도는 위택스·국세청·금융기관에서 확인";
t("SEO: 페이지별 고유 title/description · JSON-LD 3종 · 상단 고지 문구", () => {
  const titles = new Set(), descs = new Set();
  for (const f of HTML) {
    const h = read(f);
    const title = (h.match(/<title>([^<]+)<\/title>/) || [])[1];
    assert.ok(title && title.length > 8, rel(f) + " title 없음/짧음");
    assert.ok(!titles.has(title), rel(f) + " title 중복: " + title);
    titles.add(title);
    const desc = (h.match(/<meta name="description" content="([^"]+)"/) || [])[1];
    assert.ok(desc && desc.length > 40, rel(f) + " description 없음/짧음");
    assert.ok(!descs.has(desc), rel(f) + " description 중복");
    descs.add(desc);
    assert.ok(h.includes(NOTICE_PHRASE), rel(f) + " 상단 고지 문구 누락");
    assert.ok(/<link rel="canonical" href="https:\/\/housecalc-kr\.vercel\.app\//.test(h), rel(f) + " canonical 누락");
    assert.ok(h.includes('property="og:title"') && h.includes('property="og:url"'), rel(f) + " OG 태그 누락");
    const ld = (h.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/) || [])[1];
    assert.ok(ld, rel(f) + " JSON-LD 없음");
    const g = JSON.parse(ld)["@graph"];
    const types = g.map((x) => x["@type"]);
    for (const need of ["SoftwareApplication", "FAQPage", "BreadcrumbList"]) {
      assert.ok(types.includes(need), rel(f) + " JSON-LD " + need + " 누락");
    }
    const faq = g.find((x) => x["@type"] === "FAQPage");
    assert.ok(faq.mainEntity.length >= 3, rel(f) + " FAQ 3개 미만");
    const bc = g.find((x) => x["@type"] === "BreadcrumbList");
    assert.ok(bc.itemListElement.length >= 1, rel(f) + " BreadcrumbList 비어 있음");
    // 결과 화면에 산출 과정(산식) 컨테이너가 있어야 함(도구 페이지)
    if (h.includes('id="result"')) assert.ok(h.includes('id="detail"'), rel(f) + " 산출 과정 영역 없음");
  }
  console.log("   · 고유 title:", titles.size, "개");
});

t("크로스링크: 각 도구 페이지에 tomatoeggcat.com 절대 URL 2개 이상", () => {
  const tools = HTML.filter((f) => rel(f).endsWith("/index.html") && rel(f) !== "index.html");
  assert.equal(tools.length, 12, "도구 페이지 12개여야 함, 현재 " + tools.length);
  for (const f of tools) {
    const h = read(f);
    const links = new Set([...h.matchAll(/href="(https:\/\/tomatoeggcat\.com\/[a-z-]+\/)"/g)].map((m) => m[1]));
    assert.ok(links.size >= 2, rel(f) + " 본가 크로스링크 " + links.size + "개 (2개 이상 필요)");
  }
  console.log("   · 도구 페이지:", tools.length, "개 모두 크로스링크 2개 이상");
});

t("민감정보: 실명·전화·주민번호·이메일 입력 필드 없음", () => {
  for (const f of HTML) {
    const h = read(f);
    assert.ok(!/type="(email|tel)"/.test(h), rel(f) + " 개인정보 입력 필드 존재");
    assert.ok(!/name="(name|phone|ssn|email)"/.test(h), rel(f) + " 개인정보 입력 필드 존재");
  }
});

/* ── 10. 페이지 스크립트 무결성 (문법·import 경로·DOM id) ─────── */
t("스크립트: 문법 오류 0 · import 경로 실재 · 참조 id 전부 존재", () => {
  let n = 0;
  for (const f of HTML) {
    const h = read(f);
    const m = h.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
    if (!m) continue;
    const code = m[1];
    // import 경로가 실제 파일이어야 함
    for (const im of code.matchAll(/from "([^"]+)"/g)) {
      const abs = resolve(dirname(f), im[1]);
      assert.ok(existsSync(abs), rel(f) + " import 경로 없음: " + im[1]);
      assert.ok(!im[1].includes("__U__"), rel(f) + " __U__ 토큰 미치환");
    }
    // import 문을 제거한 본문을 문법 검사
    const body = code.replace(/^import .*$/gm, "");
    try { new Function(body); } catch (e) { assert.fail(rel(f) + " 스크립트 문법 오류: " + e.message); }
    // 스크립트가 참조하는 DOM id가 HTML에 존재해야 함
    for (const idm of body.matchAll(/\$\("([a-zA-Z][\w-]*)"\)/g)) {
      assert.ok(h.includes('id="' + idm[1] + '"'), rel(f) + " 없는 id 참조: " + idm[1]);
    }
    for (const idm of body.matchAll(/(?:setText|setHtml|echo|chips)\("([a-zA-Z][\w-]*)"/g)) {
      assert.ok(h.includes('id="' + idm[1] + '"'), rel(f) + " 없는 id 참조: " + idm[1]);
    }
    n++;
  }
  assert.equal(n, 12, "스크립트를 가진 도구 페이지 12개여야 함, 현재 " + n);
  console.log("   · 스크립트 검사:", n, "개 페이지");
});

t("스크립트: named import가 실제 export와 일치", () => {
  const NS = { "assets/ui.mjs": UI, "assets/calc.mjs": CALC };
  let n = 0;
  for (const f of HTML) {
    const h = read(f);
    const m = h.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
    if (!m) continue;
    for (const im of m[1].matchAll(/import \{([^}]+)\} from "([^"]+)"/g)) {
      const mod = im[2].replace(/^(\.\.\/)+/, "");
      const ns = NS[mod];
      if (!ns) continue;
      for (const name of im[1].split(",").map((x) => x.trim()).filter(Boolean)) {
        assert.ok(name in ns, rel(f) + " " + mod + " 에 없는 export 사용: " + name);
        n++;
      }
    }
  }
  console.log("   · 검사한 named import:", n, "개");
});

console.log("\n통과: " + pass + "개 검사 · HTML " + HTML.length + "개 · DEPLOY GATE OK");
