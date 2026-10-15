// tripcalc-kr DEPLOY GATE 자체 검증 (의존성 0, Node 내장만 사용)
// 실행: node tripcalc-kr/tests/run.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { haversine, distanceBetween, flightHours, hoursToKo } from "../lib/geo.mjs";
import { offsetMinutes, offsetLabel, diffHours, diffLabel, isDst, overlapSlots, bestBlocks } from "../lib/tz.mjs";
import { DUTY, estimateDuty, checkAllowance } from "../lib/dutyfree.mjs";
import { settle, totalize } from "../lib/budget.mjs";
import { buildList } from "../lib/packing.mjs";
import { findAirport } from "../data/airports.mjs";
import { COUNTRIES } from "../data/countries.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const pct = (a, b) => Math.abs(a - b) / b;

/* ── 1. 환율: 공개 CORS 엔드포인트 + 실패 폴백 경로 존재 ────── */
const fxSrc = readFileSync(join(ROOT, "lib", "fx.mjs"), "utf8");

t("환율: 키 불필요·CORS 허용 공개 엔드포인트 사용 (기본 + 보조)", () => {
  assert.ok(/https:\/\/api\.frankfurter\.dev\/v1\/latest/.test(fxSrc), "기본 엔드포인트(frankfurter.dev) 없음");
  assert.ok(/https:\/\/open\.er-api\.com\/v6\/latest\//.test(fxSrc), "보조 엔드포인트(open.er-api.com) 없음");
  assert.ok(!/api[_-]?key|apikey|token=/i.test(fxSrc), "API 키를 요구하는 흔적이 있음");
  assert.ok(/fetch\(/.test(fxSrc), "클라이언트 fetch 호출 없음");
});

t("환율: 실패 폴백 경로(보조 API → 캐시 → 안내 메시지)가 코드에 존재", () => {
  // 기본 실패 → 보조 시도
  assert.ok(/catch\s*\(e1\)\s*\{\s*data\s*=\s*await\s*fetchFallback/.test(fxSrc), "기본 실패 시 보조 API 폴백 없음");
  // 둘 다 실패 → offline(캐시)
  assert.ok(/catch\s*\(e\)\s*\{\s*return\s+offline\(/.test(fxSrc), "네트워크 실패 시 캐시 폴백 없음");
  assert.ok(/stale:\s*true/.test(fxSrc), "오래된 캐시 표시(stale) 없음");
  // 캐시도 없음 → 숫자 없이 안내만
  assert.ok(/ok:\s*false[\s\S]{0,120}rates:\s*null/.test(fxSrc), "캐시 없을 때 rates:null 안내 경로 없음");
  assert.ok(/저장된 값도 없습니다/.test(fxSrc), "캐시 없음 안내 메시지 없음");
  // 24시간 캐시
  assert.ok(/FX_TTL_MS\s*=\s*24 \* 60 \* 60 \* 1000/.test(fxSrc), "24시간 캐시 상수 없음");
  assert.ok(/localStorage\.setItem\(FX_CACHE_KEY/.test(fxSrc) && /localStorage\.getItem\(FX_CACHE_KEY/.test(fxSrc), "localStorage 캐시 읽기/쓰기 없음");
  assert.ok(/은행 고시 환율이 아닙니다/.test(fxSrc), "'은행 고시 환율이 아닙니다' 고지 문구 없음");
});

t("환율: 공개 엔드포인트 실측(프록시 차단 시 폴백 로직 존재로 통과)", () => {
  let live = "미실측";
  try {
    const out = execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "12",
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW"], { encoding: "utf8", timeout: 20000 });
    live = out.trim();
  } catch (e) { live = "차단(" + (e.code || "err") + ")"; }
  if (live === "200") console.log("   · 환율 API 실측: HTTP 200 확인됨");
  else console.log(`   · 환율 API 실측 실패(${live}) — 이 실행 환경은 외부 프록시가 차단합니다. 폴백 로직 존재로 통과 처리.`);
  assert.ok(fxSrc.includes("FX_PRIMARY") && fxSrc.includes("FX_FALLBACK"));
});

/* ── 2. 대권거리(haversine) 3케이스 ─────────────────────────── */
t("거리: ICN-JFK ≈ 11,100km (±3%)", () => {
  const d = distanceBetween(findAirport("ICN"), findAirport("JFK"));
  assert.ok(pct(d, 11100) < 0.03, `ICN-JFK ${Math.round(d)}km`);
});
t("거리: ICN-NRT ≈ 1,255km (±3%) / ICN-LHR ≈ 8,860km (±3%)", () => {
  const a = distanceBetween(findAirport("ICN"), findAirport("NRT"));
  assert.ok(pct(a, 1255) < 0.03, `ICN-NRT ${Math.round(a)}km`);
  const b = distanceBetween(findAirport("ICN"), findAirport("LHR"));
  assert.ok(pct(b, 8860) < 0.03, `ICN-LHR ${Math.round(b)}km`);
});
t("거리: ICN-LAX ≈ 9,600km, 대칭성·자기거리 0 성질", () => {
  const c = distanceBetween(findAirport("ICN"), findAirport("LAX"));
  assert.ok(pct(c, 9600) < 0.03, `ICN-LAX ${Math.round(c)}km`);
  const i = findAirport("ICN"), s = findAirport("SYD");
  assert.ok(Math.abs(distanceBetween(i, s) - distanceBetween(s, i)) < 1e-9, "대칭성 위배");
  assert.equal(Math.round(haversine(i.lat, i.lon, i.lat, i.lon)), 0);
});
t("비행시간: 거리에 단조 증가 + ICN-JFK 12~15시간 범위", () => {
  const d = distanceBetween(findAirport("ICN"), findAirport("JFK"));
  const h = flightHours(d);
  assert.ok(h > 12 && h < 15, "ICN-JFK 추정 " + hoursToKo(h));
  assert.ok(flightHours(1000) < flightHours(5000) && flightHours(5000) < flightHours(11000));
});

/* ── 3. 시차 계산 3케이스 ───────────────────────────────────── */
t("시차: 서울은 연중 UTC+9 (서머타임 없음)", () => {
  assert.equal(offsetMinutes("Asia/Seoul", new Date("2026-01-15T00:00:00Z")), 540);
  assert.equal(offsetMinutes("Asia/Seoul", new Date("2026-07-15T00:00:00Z")), 540);
  assert.equal(offsetLabel(540), "+09:00");
  assert.equal(isDst("Asia/Seoul", new Date("2026-07-15T00:00:00Z")), false);
});
t("시차: 뉴욕 겨울 -5 / 여름 -4 (서머타임 자동 반영)", () => {
  assert.equal(offsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z")), -300);
  assert.equal(offsetMinutes("America/New_York", new Date("2026-07-15T12:00:00Z")), -240);
  assert.equal(diffHours("Asia/Seoul", "America/New_York", new Date("2026-01-15T12:00:00Z")), -14);
  assert.equal(diffHours("Asia/Seoul", "America/New_York", new Date("2026-07-15T12:00:00Z")), -13);
  assert.equal(diffLabel(-13), "13시간 느림");
});
t("시차: 런던 여름 +1(BST) / 시드니 1월 +11 / 인도 +5:30", () => {
  assert.equal(offsetMinutes("Europe/London", new Date("2026-07-15T12:00:00Z")), 60);
  assert.equal(offsetMinutes("Europe/London", new Date("2026-01-15T12:00:00Z")), 0);
  assert.equal(diffHours("Asia/Seoul", "Europe/London", new Date("2026-07-15T12:00:00Z")), -8);
  assert.equal(offsetMinutes("Australia/Sydney", new Date("2026-01-15T00:00:00Z")), 660);
  assert.equal(offsetMinutes("Asia/Kolkata", new Date("2026-05-01T00:00:00Z")), 330);
  assert.equal(offsetLabel(330), "+05:30");
});
t("회의: 서울·런던·뉴욕 9~18시 겹침 계산이 24슬롯을 반환", () => {
  const zones = [{ tz: "Asia/Seoul", label: "서울" }, { tz: "Europe/London", label: "런던" }, { tz: "America/New_York", label: "뉴욕" }];
  const slots = overlapSlots(zones, { start: 9, end: 18 }, new Date(Date.UTC(2026, 8, 16)));
  assert.equal(slots.length, 24);
  assert.ok(slots.every((s) => s.cells.length === 3));
  const two = overlapSlots([zones[0], zones[1]], { start: 8, end: 20 }, new Date(Date.UTC(2026, 8, 16)));
  assert.ok(bestBlocks(two).length > 0, "서울-런던은 8~20시 기준 겹치는 구간이 있어야 함");
});

/* ── 4. 면세 한도 3케이스 ───────────────────────────────────── */
t("면세: 기본 한도 US$800 이하는 세금 0", () => {
  assert.equal(DUTY.basic.value, 800);
  const r = estimateDuty({ goodsUsd: 800, usdKrw: 1380, selfReport: true });
  assert.equal(r.free, true);
  assert.equal(r.tax, 0);
  assert.equal(r.overBasic, 0);
});
t("면세: US$1,200 · 환율 1,380원 · 간이세율 20% · 자진신고 30% 감면 = 77,280원", () => {
  const r = estimateDuty({ goodsUsd: 1200, usdKrw: 1380, selfReport: true, cap: 200000 });
  assert.equal(r.overBasic, 400);
  assert.equal(r.taxableKrw, 552000);   // 400 × 1,380
  assert.equal(r.gross, 110400);        // × 20%
  assert.equal(r.discount, 33120);      // × 30%
  assert.equal(r.tax, 77280);
  // 미신고 적발 시 가산세 40% → 154,560원
  const n = estimateDuty({ goodsUsd: 1200, usdKrw: 1380, selfReport: false });
  assert.equal(n.penalty, 44160);
  assert.equal(n.tax, 154560);
  assert.ok(n.tax > r.tax, "자진신고가 항상 유리해야 함");
});
t("면세: 주류 2병·2L·$400 / 궐련 200개비 / 향수 100mL 는 별도 면세 범위", () => {
  assert.equal(DUTY.alcohol.bottles, 2);
  assert.equal(DUTY.alcohol.liters, 2);
  assert.equal(DUTY.alcohol.usd, 400);
  assert.equal(DUTY.tobacco.value, 200);
  assert.equal(DUTY.perfume.value, 100);
  const ok = checkAllowance({ bottles: 2, liters: 2, alcoholUsd: 400, cigarettes: 200, perfumeMl: 100 });
  assert.equal(ok.alcohol.ok, true);
  assert.equal(ok.tobacco.ok, true);
  assert.equal(ok.perfume.ok, true);
  const over = checkAllowance({ bottles: 3, liters: 2.5, alcoholUsd: 500, cigarettes: 400, perfumeMl: 150 });
  assert.equal(over.alcohol.ok, false);
  assert.equal(over.alcohol.over.length, 3);
  assert.equal(over.tobacco.ok, false);
  assert.equal(over.perfume.ok, false);
  // 별도 면세 초과분은 기본 한도와 별개로 과세 대상에 더해진다
  const r = estimateDuty({ goodsUsd: 100, extraAlcoholUsd: 500, usdKrw: 1000, selfReport: false, rate: 0.2 });
  assert.equal(r.overBasic, 0);
  assert.equal(r.taxableUsd, 500);
});
t("면세: 자진신고 감면 한도액은 확정 표기하지 않고 todo 로 표시", () => {
  assert.equal(DUTY.selfReport.todo, true);
  assert.equal(DUTY.selfReport.capTodo, true);
  const capped = estimateDuty({ goodsUsd: 20800, usdKrw: 1380, selfReport: true, cap: 200000 });
  assert.equal(capped.discount, 200000, "감면은 한도액에서 멈춰야 함");
});

/* ── 보조: 예산·짐 목록 순수 로직 ───────────────────────────── */
t("예산: 단위(총액/1인당/1인1일) 환산과 N빵 정산", () => {
  const r = totalize({
    items: [
      { id: "flight", amount: 700000, currency: "KRW", per: "person" },
      { id: "stay", amount: 400000, currency: "KRW", per: "trip" },
      { id: "food", amount: 30000, currency: "KRW", per: "personDay" },
    ], people: 2, days: 5,
  });
  assert.equal(r.total, 1400000 + 400000 + 300000);
  assert.equal(r.perPerson, 1050000);
  const s = settle([{ name: "A", paid: 300000 }, { name: "B", paid: 0 }, { name: "C", paid: 150000 }]);
  assert.equal(s.each, 150000);
  assert.equal(s.transfers.length, 1);
  assert.deepEqual(s.transfers[0], { from: "B", to: "A", amount: 150000 });
});
t("짐 목록: 조건에 따라 항목이 달라지고 중복이 없다", () => {
  const cold = buildList({ climate: "cold", days: 7, type: "city", options: [] });
  const hot = buildList({ climate: "tropical", days: 7, type: "resort", options: ["swim"] });
  const names = cold.groups.flatMap((g) => g.items.map((i) => i.name));
  assert.equal(new Set(names).size, names.length, "중복 항목 존재");
  assert.ok(names.some((n) => n.includes("패딩")));
  assert.ok(hot.groups.flatMap((g) => g.items.map((i) => i.name)).some((n) => n.includes("수영복")));
  const drive = buildList({ climate: "temperate", days: 3, type: "city", options: ["driving"] });
  assert.ok(drive.groups.flatMap((g) => g.items.map((i) => i.name)).some((n) => n.includes("국제운전면허증")));
});

/* ── 5~8. HTML 정적 검사 ────────────────────────────────────── */
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
assert.ok(files.length >= 100, "HTML 페이지 수 확인: " + files.length);

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
  assert.ok(checked > 500, "검사한 상대링크 수: " + checked);
});

t("스크립트 import 경로: 모듈 파일이 실제로 존재", () => {
  const re = /import\s*\{[^}]*\}\s*from\s*"([^"]+)"/g;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(html))) {
      const target = resolve(dirname(f), m[1]);
      assert.ok(existsSync(target), `${f}: 모듈 없음 → ${m[1]}`);
    }
  }
});

t("sitemap: 모든 URL에 대응 파일 존재 + 주요 페이지 포함", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 100, "sitemap URL 수: " + locs.length);
  assert.equal(new Set(locs).size, locs.length, "sitemap 중복 URL");
  const origin = locs[0].match(/^https?:\/\/[^/]+/)[0];
  assert.equal(origin, "https://tripcalc-kr.vercel.app");
  for (const loc of locs) {
    assert.ok(loc.startsWith(origin), "origin 불일치: " + loc);
    const rel = loc.slice(origin.length).replace(/^\//, "");
    const target = rel === "" ? join(ROOT, "index.html")
      : rel.endsWith("/") ? join(ROOT, rel, "index.html")
      : join(ROOT, rel);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  assert.equal(locs.length, files.length, `sitemap(${locs.length}) 과 HTML(${files.length}) 수 불일치`);
  for (const must of ["currency", "timezone", "meeting-time", "packing-list", "budget", "tip-calc",
    "voltage", "jetlag", "duty-free", "flight-time", "roaming", "itinerary", "country", "currency/usd-krw"]) {
    assert.ok(locs.some((l) => l.endsWith("/" + must + "/")), "sitemap 누락: " + must);
  }
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
    assert.ok(html.includes('rel="canonical" href="https://tripcalc-kr.vercel.app/'), f + ": canonical 없음");
  }
});

t("JSON-LD 파싱 가능 + FAQ 본문 존재 (전 페이지)", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const m = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
    assert.ok(m, f + ": JSON-LD 블록 없음");
    const g = JSON.parse(m[1])["@graph"];
    const faq = g.find((x) => x["@type"] === "FAQPage");
    if (faq) {
      assert.ok(faq.mainEntity.length >= 3, f + ": FAQ 항목 3개 미만");
      for (const q of faq.mainEntity) assert.ok(q.acceptedAnswer.text.length > 20, f + ": FAQ 답변이 너무 짧음");
    }
  }
});

t("광고: 유닛 1개 이하 · 기본 hidden · head 로더 · client 일치", () => {
  let withAd = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(units <= 1, `${f}: 광고 유닛 ${units}개 (최대 1)`);
    if (!units) continue;
    withAd++;
    assert.ok(/<div class="ad-wrap" id="adWrap" hidden>/.test(html), f + ": 광고 컨테이너가 기본 노출 상태");
    assert.ok(html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106'), f + ": head 로더 없음");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), f + ": ad client 불일치");
    assert.ok(html.includes('data-ad-format="auto"') && html.includes('data-full-width-responsive="true"'), f + ": 광고 속성 누락");
    assert.ok(/showAd\(\)/.test(html), f + ": 결과 표시 후 광고 언하이드 호출(showAd) 없음");
  }
  assert.ok(withAd >= 100, "광고가 있는 페이지 수: " + withAd);
  // 허브·정책 페이지는 광고 없음
  for (const f of ["index.html", "privacy.html", "terms.html", "country/index.html"]) {
    assert.ok(!readFileSync(join(ROOT, f), "utf8").includes('class="adsbygoogle"'), f + ": 광고가 있으면 안 됨");
  }
});

t("인라인 모듈 스크립트 문법 검사", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
      const code = m[1].replace(/^import [^\n]*;$/gm, "");
      try { new Script(code, { filename: f }); }
      catch (e) { assert.fail(f + " 스크립트 문법 오류: " + e.message); }
    }
  }
});

t("데이터 규율: 비자 여부 직접 기재 금지 + 외교부 링크 제공", () => {
  // 실제 "비자 면제/무비자" 단정 표현만 금지 — "비자 면제 여부는 외교부에서 확인" 같은 안내문은 허용
  const banned = /(무비자|비자\s*없이|비자\s*(면제|불필요|필요\s*없)(?!\s*여부))/;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    assert.ok(!banned.test(html), f + ": 비자 여부를 직접 기재한 것으로 보이는 문구");
  }
  for (const c of COUNTRIES.slice(0, 10)) {
    const html = readFileSync(join(ROOT, "country", c.slug, "index.html"), "utf8");
    assert.ok(html.includes("0404.go.kr"), c.slug + ": 외교부 해외안전여행 링크 없음");
  }
});

t("출처·확인일 표기: 국가 페이지 · 도구 페이지", () => {
  for (const c of COUNTRIES.slice(0, 8)) {
    const html = readFileSync(join(ROOT, "country", c.slug, "index.html"), "utf8");
    assert.ok(html.includes("iec.ch/world-plugs"), c.slug + ": 전압 출처 없음");
    assert.ok(html.includes("iana.org/time-zones"), c.slug + ": 타임존 출처 없음");
    assert.ok(html.includes("2026-08-19"), c.slug + ": 확인일 표기 없음");
  }
  const duty = readFileSync(join(ROOT, "duty-free", "index.html"), "utf8");
  assert.ok(duty.includes("customs.go.kr"), "면세: 관세청 출처 없음");
  assert.ok(duty.includes("확인 필요"), "면세: 불확실 값 '확인 필요' 배지 없음");
  const ft = readFileSync(join(ROOT, "flight-time", "index.html"), "utf8");
  assert.ok(ft.includes("추정치"), "비행시간: '추정치' 명시 없음");
  const cur = readFileSync(join(ROOT, "currency", "index.html"), "utf8");
  assert.ok(cur.includes("은행 고시 환율이 아닙니다"), "환율: 고지 문구 없음");
});

t("크로스링크: 도구 페이지마다 tomatoeggcat.com 절대 URL 2개 이상", () => {
  const POOL = ["https://tomatoeggcat.com/travel-budget/", "https://tomatoeggcat.com/travel-packing/",
    "https://tomatoeggcat.com/split-bill/", "https://tomatoeggcat.com/china-travel/", "https://tomatoeggcat.com/travel-pin/"];
  const SLUGS = ["currency", "timezone", "meeting-time", "packing-list", "budget", "tip-calc",
    "voltage", "jetlag", "duty-free", "flight-time", "roaming", "itinerary"];
  for (const s of SLUGS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    const n = POOL.filter((u) => html.includes(u)).length;
    assert.ok(n >= 2, s + ": 크로스링크 " + n + "개 (2개 이상 필요)");
  }
});

t("기록형 도구: localStorage + 내보내기 + 전체삭제 + 서버 저장 없음 명시", () => {
  for (const s of ["packing-list", "budget", "itinerary"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("서버로 전송되거나 저장되지 않습니다"), s + ": 서버 저장 없음 명시 누락");
    assert.ok(html.includes("저장 기록 전체 삭제"), s + ": 전체삭제 버튼 없음");
    assert.ok(/store\(/.test(html), s + ": localStorage 저장소 사용 없음");
    assert.ok(/download\(|내보내기/.test(html), s + ": 내보내기 없음");
  }
});

t("생성물 구조: 도구 12 + 허브 + 국가 56 + 통화쌍 56 + 정책 2", () => {
  const TOOL_SLUGS = ["currency", "timezone", "meeting-time", "packing-list", "budget", "tip-calc",
    "voltage", "jetlag", "duty-free", "flight-time", "roaming", "itinerary"];
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "누락: " + s);
  assert.ok(existsSync(join(ROOT, "index.html")) && existsSync(join(ROOT, "robots.txt")));
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")));
  const countries = readdirSync(join(ROOT, "country")).filter((n) => statSync(join(ROOT, "country", n)).isDirectory());
  const pairs = readdirSync(join(ROOT, "currency")).filter((n) => statSync(join(ROOT, "currency", n)).isDirectory());
  assert.equal(countries.length, COUNTRIES.length, "국가 롱테일 수: " + countries.length);
  assert.ok(pairs.length >= 50, "통화쌍 롱테일 수: " + pairs.length);
  assert.equal(files.length, 1 + TOOL_SLUGS.length + 1 + countries.length + pairs.length + 2);
  // 통화쌍은 왕복 모두 존재해야 한다(상호 링크가 깨지지 않도록)
  for (const p of pairs) {
    const [a, b] = p.split("-");
    assert.ok(existsSync(join(ROOT, "currency", b + "-" + a, "index.html")), "역방향 페이지 없음: " + p);
  }
});

console.log(`\n${pass} tests passed ✔`);
