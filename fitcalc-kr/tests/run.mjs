// fitcalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node fitcalc-kr/tests/run.mjs   (반드시 gen.mjs 를 먼저 실행할 것)
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ONE_RM_FORMULAS, averageOneRM, PERCENT_STEPS } from "../data/onerm.mjs";
import { RACE_DISTANCES, MILE_KM, paceFrom, timeFrom, distFrom, speedKmh, parseHMS, fmtHMS, fmtPace } from "../data/pace.mjs";
import { riegelPredict, RIEGEL_EXPONENT } from "../data/riegel.mjs";
import { HRMAX_FORMULAS, KARVONEN, HR_ZONES } from "../data/hr.mjs";
import { MET_TABLE, KCAL_FORMULA } from "../data/met.mjs";
import { PROGRAMS } from "../data/plank.mjs";
import { STRIDE_WALK, STRIDE_RUN, strideMeters } from "../data/steps.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const near = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, "기대 " + b + " 실제 " + a);

const TOOL_SLUGS = ["one-rm", "running-pace", "race-predict", "split-plan", "interval", "hr-zone",
  "workout-log", "calorie-burn", "step-convert", "plank-challenge", "protein-timing", "rest-day"];

const F = Object.fromEntries(ONE_RM_FORMULAS.map((f) => [f.id, f.fn]));

/* ── 1. 1RM 5공식 검증 (손계산 대조 5케이스) ────────────────── */
t("1RM ①: 100kg × 5회 — Epley 116.7 / Brzycki 112.5 / Lombardi 117.46 / O'Conner 112.5 / Wathan 116.58", () => {
  near(F.epley(100, 5), 116.7);
  near(F.brzycki(100, 5), 112.5, 1e-9);
  near(F.lombardi(100, 5), 117.46);
  near(F.oconner(100, 5), 112.5, 1e-9);
  near(F.wathan(100, 5), 116.58);
  near(averageOneRM(100, 5), (116.6667 + 112.5 + 117.4619 + 112.5 + 116.5827) / 5, 0.02);
});

t("1RM ②: 60kg × 10회 — Epley 80 / Brzycki 80 (두 공식이 일치하는 지점)", () => {
  near(F.epley(60, 10), 80, 1e-9);      // 60 × (1+10/30) = 80
  near(F.brzycki(60, 10), 80, 1e-9);    // 60 × 36/27 = 80
  near(F.oconner(60, 10), 75, 1e-9);    // 60 × 1.25
  near(F.lombardi(60, 10), 75.54);      // 60 × 10^0.1
  near(F.wathan(60, 10), 80.85);
});

t("1RM ③: 반복 1회는 모든 공식이 입력 무게 그대로", () => {
  for (const f of ONE_RM_FORMULAS) assert.equal(f.fn(140, 1), 140, f.id);
  assert.equal(averageOneRM(140, 1), 140);
});

t("1RM ④: 80kg × 3회 — Epley 88 / Brzycki 84.7 / O'Conner 86", () => {
  near(F.epley(80, 3), 88, 1e-9);              // 80 × 1.1
  near(F.brzycki(80, 3), 80 * 36 / 34, 1e-9);  // 84.71
  near(F.brzycki(80, 3), 84.71);
  near(F.oconner(80, 3), 86, 1e-9);
  near(F.lombardi(80, 3), 80 * Math.pow(3, 0.1), 1e-9);
});

t("1RM ⑤: 단조성·정합성 — 반복↑ 이면 1RM↑, 무게에 비례, %표 11단계", () => {
  for (const f of ONE_RM_FORMULAS) {
    let prev = 0;
    for (let r = 1; r <= 12; r++) { const v = f.fn(100, r); assert.ok(v >= prev - 1e-9, f.id + " r=" + r); prev = v; }
    near(f.fn(200, 6), 2 * f.fn(100, 6), 1e-9); // 무게 선형성
  }
  assert.equal(PERCENT_STEPS.value.length, 11);
  assert.equal(PERCENT_STEPS.value[0], 100);
  assert.ok(/^https?:/.test(PERCENT_STEPS.source), "%표 출처 URL 필요");
});

/* ── 2. 페이스 3변수 상호 역산 일관성 (5케이스) ─────────────── */
const PACE_CASES = [
  { name: "10km 50분", km: 10, time: 3000 },
  { name: "5km 25분", km: 5, time: 1500 },
  { name: "하프 1:45:00", km: 21.0975, time: 6300 },
  { name: "풀 4:00:00", km: 42.195, time: 14400 },
  { name: "1마일 7:30", km: MILE_KM.value, time: 450 },
];
for (const c of PACE_CASES) {
  t("페이스 상호 역산: " + c.name, () => {
    const p = paceFrom(c.km, c.time);
    near(timeFrom(c.km, p), c.time, 1e-9);
    near(distFrom(c.time, p), c.km, 1e-9);
    near(paceFrom(distFrom(c.time, p), timeFrom(c.km, p)), p, 1e-9);
    near(speedKmh(p), (c.km / c.time) * 3600, 1e-9);
    // 문자열 왕복(파싱↔포맷)도 깨지지 않아야 한다
    assert.equal(parseHMS(fmtHMS(c.time)), Math.round(c.time));
  });
}

t("페이스 손계산 대조: 10km 50분 = 5'00\"/km = 12km/h, 마일 페이스 8'03\"", () => {
  const p = paceFrom(10, 3000);
  assert.equal(p, 300);
  assert.equal(fmtPace(p), "5'00\"");
  assert.equal(speedKmh(p), 12);
  assert.equal(fmtPace(p * MILE_KM.value), "8'03\"");
  assert.equal(fmtHMS(timeFrom(42.195, p)), "3:30:59");
});

t("시간 파서: h:mm:ss / mm:ss / 단독 숫자 / 잘못된 입력", () => {
  assert.equal(parseHMS("1:45:30"), 6330);
  assert.equal(parseHMS("50:00"), 3000);
  assert.equal(parseHMS("45"), 2700);
  assert.equal(parseHMS("abc"), null);
  assert.equal(parseHMS(""), null);
  assert.equal(parseHMS("1:2:3:4"), null);
  assert.equal(parseHMS("-5:00"), null);
});

/* ── 3. Riegel 예측 (3케이스) ───────────────────────────────── */
t("Riegel ①: 5km 25:00 → 10km 예측 = 25분 × 2^1.06 ≈ 52:07", () => {
  const v = riegelPredict(1500, 5, 10);
  near(v, 1500 * Math.pow(2, 1.06), 1e-9);
  assert.equal(fmtHMS(v), "52:07");
});

t("Riegel ②: 10km 50:00 → 하프 1:50:19 / 풀 3:50:01", () => {
  assert.equal(fmtHMS(riegelPredict(3000, 10, 21.0975)), "1:50:19");
  assert.equal(fmtHMS(riegelPredict(3000, 10, 42.195)), "3:50:01");
});

t("Riegel ③: 왕복 일관성·지수·단조성", () => {
  const t1 = 5400, d1 = 21.0975;
  const t2 = riegelPredict(t1, d1, 42.195);
  near(riegelPredict(t2, 42.195, d1), t1, 1e-6);      // 역방향 예측 = 원래 기록
  assert.equal(RIEGEL_EXPONENT.value, 1.06);
  assert.ok(/^https?:/.test(RIEGEL_EXPONENT.source));
  assert.ok(t2 > t1 * 2, "거리 2배 → 시간은 2배보다 커야 함");
  assert.ok(riegelPredict(t1, d1, 10) < t1, "짧은 거리는 더 빨라야 함");
});

/* ── 데이터 모듈 규율(출처·확인 필요 TODO) ─────────────────── */
t("데이터: 심박/MET/보폭 계산 정합성 + 출처 URL 존재", () => {
  assert.equal(HRMAX_FORMULAS.find((f) => f.id === "fox").fn(35), 185);
  near(HRMAX_FORMULAS.find((f) => f.id === "tanaka").fn(35), 183.5, 1e-9);
  near(KARVONEN.fn(185, 60, 0.7), 60 + 125 * 0.7, 1e-9);
  assert.equal(HR_ZONES.value.length, 5);
  for (const f of HRMAX_FORMULAS) assert.ok(/^https?:/.test(f.source), f.id + " 출처 URL 필요");
  // MET: 70kg 이 MET 9.8 로 30분 → 9.8×3.5×70/200×30 = 360.15 kcal
  near(KCAL_FORMULA.fn(9.8, 70, 30), 360.15, 1e-9);
  for (const m of MET_TABLE) assert.ok(/^https?:/.test(m.met.source), m.id + " MET 출처 URL 필요");
  // 보폭: 키 170 × 0.415 = 70.55cm
  near(strideMeters(170, STRIDE_WALK.male.value), 0.7055, 1e-9);
  assert.ok(/^https?:/.test(STRIDE_WALK.male.source));
  // 출처 미확정 항목은 needsCheck + todo 문구를 반드시 달고 있어야 한다
  assert.equal(STRIDE_RUN.needsCheck, true);
  assert.ok(STRIDE_RUN.todo && STRIDE_RUN.todo.includes("확인 필요"));
});

t("데이터: 30일 챌린지 3종 × 30일, 휴식일 포함", () => {
  assert.equal(PROGRAMS.length, 3);
  for (const p of PROGRAMS) {
    assert.equal(p.value.length, 30, p.id + " 길이");
    assert.ok(p.value.some((v) => v === 0), p.id + " 휴식일 필요");
    assert.ok(p.value[29] > p.value[0], p.id + " 마지막이 첫날보다 커야 함");
  }
});

/* ── HTML 산출물 수집 ───────────────────────────────────────── */
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "tests" || name === "src" || name === "node_modules" || name === "data" || name === "assets") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}
const files = htmlFiles(ROOT);

t("페이지 생성: 도구 12종 + 허브 + privacy/terms (총 " + files.length + "개 HTML)", () => {
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "누락: " + s);
  assert.ok(existsSync(join(ROOT, "index.html")), "허브 누락");
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")));
  assert.ok(existsSync(join(ROOT, "robots.txt")), "robots.txt 누락");
  assert.ok(existsSync(join(ROOT, "sitemap.xml")), "sitemap.xml 누락");
  assert.ok(!existsSync(join(ROOT, "vercel.json")), "vercel.json 은 만들지 않는다");
  assert.equal(files.length, TOOL_SLUGS.length + 3);
});

/* ── 4. Wake Lock 게이트 (interval 페이지) ──────────────────── */
t("Wake Lock 게이트: interval 페이지에 wakeLock.request + visibilitychange 재획득 존재", () => {
  const html = readFileSync(join(ROOT, "interval", "index.html"), "utf8");
  assert.ok(html.includes('navigator.wakeLock.request("screen")'), "navigator.wakeLock.request 호출 없음");
  assert.ok(/"wakeLock" in navigator/.test(html), "Wake Lock 지원 여부 분기 없음");
  const m = html.match(/document\.addEventListener\("visibilitychange",[\s\S]{0,400}?\}\);/);
  assert.ok(m, "visibilitychange 핸들러 없음");
  assert.ok(/visibilityState === "visible"/.test(m[0]), "visibilitychange 핸들러에 visible 판정 없음");
  assert.ok(/acquireLock\(\)/.test(m[0]), "visibilitychange 핸들러에서 Wake Lock 재획득 안 함");
  assert.ok(/wakeLock\.release\(\)/.test(html), "정지 시 Wake Lock 해제 없음");
  assert.ok(html.includes("SpeechSynthesisUtterance"), "음성 카운트(Web Speech) 없음");
  assert.ok(html.includes("타바타"), "타바타 프리셋 표기 없음");
});

/* ── 5. 금칙 문자열 0건 ─────────────────────────────────────── */
t("정책: 금칙 문자열 0건 (" + files.length + "개 HTML)", () => {
  const banned = ["광고" + " 영역", "REPLACE" + "_", "TBD" + "_", "lorem ipsum"];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const b of banned) assert.ok(!html.includes(b), f + ' 에 금칙 문자열 "' + b + '"');
  }
});

/* ── 6. 절대경로·깨진 상대링크 0건 ──────────────────────────── */
t("링크: 루트 절대경로(/) 0건 + 깨진 상대링크 0건", () => {
  const attrRe = /(?:href|src)\s*=\s*"([^"]+)"/g;
  let checked = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    let m;
    while ((m = attrRe.exec(html))) {
      const url = m[1];
      if (/^(https?:|mailto:|#|data:|javascript:)/.test(url)) continue;
      assert.ok(!url.startsWith("/"), f + ": 루트 절대경로 금지 → " + url);
      const path = url.split("#")[0].split("?")[0];
      if (!path) continue;
      let target = resolve(dirname(f), path);
      if (path.endsWith("/")) target = join(target, "index.html");
      assert.ok(existsSync(target), f + ": 깨진 링크 → " + url);
      checked++;
    }
  }
  assert.ok(checked >= files.length * 3, "검사된 상대링크 수: " + checked);
});

t("링크: 인라인 모듈 import 경로도 실제 파일과 일치", () => {
  const impRe = /from\s+"(\.\.?\/[^"]+)"/g;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    let m;
    while ((m = impRe.exec(html))) {
      assert.ok(existsSync(resolve(dirname(f), m[1])), f + ": 깨진 import → " + m[1]);
    }
  }
});

/* ── 7. sitemap ─────────────────────────────────────────────── */
t("sitemap: 모든 URL에 대응 파일 존재 + 도구 12종 전부 포함", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  assert.equal(locs.length, TOOL_SLUGS.length + 3);
  const origin = locs[0].match(/^https?:\/\/[^/]+/)[0];
  assert.equal(origin, "https://fitcalc-kr.vercel.app");
  for (const loc of locs) {
    assert.ok(loc.startsWith(origin + "/"), "origin 불일치: " + loc);
    const rel = loc.slice(origin.length + 1);
    const target = rel === "" ? join(ROOT, "index.html")
      : rel.endsWith("/") ? join(ROOT, rel, "index.html")
      : join(ROOT, rel);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  for (const s of TOOL_SLUGS) assert.ok(locs.some((l) => l.endsWith("/" + s + "/")), "sitemap 누락: " + s);
  const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
  assert.ok(robots.includes(origin + "/sitemap.xml"), "robots.txt 에 sitemap 없음");
});

/* ── 8. 고유 title + JSON-LD 3종 ────────────────────────────── */
t("SEO: 페이지별 고유 title/description + canonical", () => {
  const titles = new Set(), descs = new Set();
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const ti = html.match(/<title>([^<]+)<\/title>/);
    const de = html.match(/<meta name="description" content="([^"]+)"/);
    assert.ok(ti && ti[1].trim(), f + ": title 없음");
    assert.ok(de && de[1].trim().length > 40, f + ": description 없음/너무 짧음");
    assert.ok(!titles.has(ti[1]), "중복 title: " + ti[1]);
    assert.ok(!descs.has(de[1]), "중복 description: " + de[1]);
    titles.add(ti[1]); descs.add(de[1]);
    assert.ok(html.includes('rel="canonical" href="https://fitcalc-kr.vercel.app/'), f + ": canonical 없음");
    assert.ok(html.includes('property="og:title"'), f + ": og:title 없음");
  }
  assert.equal(titles.size, files.length);
});

t("SEO: 도구 페이지 JSON-LD 3종(SoftwareApplication+FAQPage+BreadcrumbList) + 파싱 가능", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const isPolicy = f.endsWith("privacy.html") || f.endsWith("terms.html");
    if (isPolicy) continue;
    assert.ok(m, f + ": JSON-LD 없음");
    const data = JSON.parse(m[1]);
    const types = (data["@graph"] || []).map((g) => g["@type"]);
    if (f === join(ROOT, "index.html")) {
      assert.ok(types.includes("WebSite") && types.includes("FAQPage"), "허브 JSON-LD 부족: " + types);
      continue;
    }
    for (const need of ["SoftwareApplication", "FAQPage", "BreadcrumbList"]) {
      assert.ok(types.includes(need), f + ": JSON-LD " + need + " 없음");
    }
    const faq = data["@graph"].find((g) => g["@type"] === "FAQPage");
    assert.ok(faq.mainEntity.length >= 4, f + ": FAQ 4개 이상 필요 (" + faq.mainEntity.length + ")");
  }
});

/* ── 광고 정책 ──────────────────────────────────────────────── */
t("광고: 결과 하단 1개 + 기본 hidden + head 로더 (입력/타이머 화면 노출 금지)", () => {
  for (const s of TOOL_SLUGS) {
    const f = join(ROOT, s, "index.html");
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.equal(units, 1, s + ": 광고 유닛 " + units + "개 (정확히 1개)");
    assert.ok(/<section class="ad-box no-print" id="adBox" hidden/.test(html), s + ": 광고가 기본 노출 상태");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), s + ": ad client 불일치");
    assert.ok(html.includes('data-ad-format="auto"') && html.includes('data-full-width-responsive="true"'), s + ": 광고 포맷 속성 누락");
    assert.ok(html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106"), s + ": head 로더 없음");
    assert.ok(html.includes("showAd()"), s + ": 결과 표시 후 광고 언하이드 호출 없음");
  }
  // 타이머 실행 화면(runBox)에는 광고가 붙지 않아야 한다 — 완료(complete) 후에만 showAd
  const iv = readFileSync(join(ROOT, "interval", "index.html"), "utf8");
  const runIdx = iv.indexOf('id="runBox"');
  const adIdx = iv.indexOf('id="adBox"');
  assert.ok(runIdx > 0 && adIdx > runIdx, "interval: 광고가 타이머 화면보다 앞에 있음");
  assert.ok(/showAd\(\); \/\/ 광고는 운동이 끝난 뒤에만 노출/.test(iv), "interval: 완료 후 광고 노출 주석/호출 확인 실패");
});

/* ── 건강 고지·출처·크로스링크 ──────────────────────────────── */
t("고지: 전 도구 페이지 상단 건강 참고 고지 + 출처 박스", () => {
  for (const s of TOOL_SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("개인차가 큽니다"), s + ": 건강 고지 없음");
    assert.ok(html.includes("전문가와 상담"), s + ": 전문가 상담 문구 없음");
    assert.ok(html.includes("수치 출처 · 확인일"), s + ": 출처 박스 없음");
  }
  const rest = readFileSync(join(ROOT, "rest-day", "index.html"), "utf8");
  assert.ok((rest.match(/badge ref">참고</g) || []).length >= 3, "rest-day: '참고' 라벨 부족");
  // 출처 미확정 항목은 '확인 필요' 배지로 노출
  assert.ok(rest.includes("확인 필요"), "rest-day: 확인 필요 배지 없음");
  assert.ok(readFileSync(join(ROOT, "step-convert", "index.html"), "utf8").includes("확인 필요"), "step-convert: 확인 필요 배지 없음");
});

t("크로스링크: 각 도구 하단에 tomatoeggcat.com 절대 URL 2~3개", () => {
  const allowed = ["lift-rank-1rm", "running-pace-calc", "bmi", "bmr-tdee-calc", "protein-calc", "manbo-steps", "home-workout-routine", "calorie-burn-calc"];
  for (const s of TOOL_SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    const hits = [...html.matchAll(/https:\/\/tomatoeggcat\.com\/([a-z0-9-]+)\//g)].map((m) => m[1]);
    const uniq = [...new Set(hits)];
    assert.ok(uniq.length >= 2 && uniq.length <= 3, s + ": 크로스링크 " + uniq.length + "개 (2~3개 필요)");
    for (const h of uniq) assert.ok(allowed.includes(h), s + ": 허용되지 않은 크로스링크 " + h);
  }
});

/* ── 기록형 도구 정책 ───────────────────────────────────────── */
t("기록형: localStorage + CSV 내보내기 + 전체삭제 + '서버 저장 없음' 명시", () => {
  for (const s of ["workout-log", "plank-challenge"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("localStorage"), s + ": localStorage 언급 없음");
    assert.ok(html.includes("CSV 내보내기"), s + ": CSV 내보내기 없음");
    assert.ok(html.includes("전체 삭제"), s + ": 전체 삭제 없음");
    assert.ok(html.includes("서버로 전송되지 않"), s + ": 서버 저장 없음 명시 필요");
  }
  const wl = readFileSync(join(ROOT, "workout-log", "index.html"), "utf8");
  assert.ok(wl.includes("<svg") || wl.includes("'<svg"), "workout-log: 주간 볼륨 SVG 그래프 없음");
});

t("split-plan: 인쇄 지원(@media print + 인쇄 버튼)", () => {
  const html = readFileSync(join(ROOT, "split-plan", "index.html"), "utf8");
  assert.ok(html.includes("window.print()"), "인쇄 버튼 없음");
  assert.ok(html.includes('class="no-print"'), "인쇄 제외 클래스 없음");
  const css = readFileSync(join(ROOT, "assets", "style.css"), "utf8");
  assert.ok(/@media print/.test(css) && /\.no-print\{display:none/.test(css), "인쇄 CSS 없음");
});

/* ── 스크립트 문법 ──────────────────────────────────────────── */
t("인라인 모듈 스크립트 문법 검사", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      const code = m[1].replace(/^import [^\n]*$/gm, "");
      try { new Script("(async()=>{" + code + "})()", { filename: f }); }
      catch (e) { assert.fail(f + " 스크립트 문법 오류: " + e.message); }
    }
  }
});

t("허브: 도구 12종 카드 전부 링크", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  for (const s of TOOL_SLUGS) assert.ok(html.includes('href="' + s + '/"'), "허브 카드 누락: " + s);
  assert.equal((html.match(/class="card"/g) || []).length, TOOL_SLUGS.length);
});

console.log("\n" + pass + " tests passed ✔");
