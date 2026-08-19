// homecalc-kr DEPLOY GATE (의존성 0, Node 내장만 사용)
// 실행: node homecalc-kr/tests/run.mjs   (먼저 node gen.mjs 로 생성물 최신화)
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { Script } from "node:vm";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  M2_PER_PYEONG, pyeongToM2, m2ToPyeong,
  wallpaperCalc, flooringCalc, tileCalc, paintCalc, curtainCalc,
  rectsOverlap, inRoom, clampToRoom, rotateRect, anyCollision,
  lightingCalc, acSizeCalc, legalCapRate, depositToMonthly, monthlyToDeposit, movingCostEstimate,
} from "../lib/calc.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://homecalc-kr.vercel.app";
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ── 1. 자재 계산 손계산 대조 (도배·타일·페인트 각 3케이스) ──── */
t("도배: 롤 수 3케이스 손계산 일치", () => {
  // A) 둘레 20m × 2.4m = 48㎡, 광폭 1.06×15.6 = 16.536㎡/롤, +10% → 52.8 ÷ 16.536 = 3.193 → 4롤
  const a = wallpaperCalc({ perimeterM: 20, heightM: 2.4, openingsM2: 0, rollWidthM: 1.06, rollLengthM: 15.6, lossRate: 0.1 });
  assert.equal(a.wallArea, 48);
  assert.ok(near(a.rollArea, 16.536, 1e-12));
  assert.ok(near(a.needArea, 52.8, 1e-9));
  assert.equal(a.rolls, 4);
  // B) (16×2.3=36.8) − 3.6 = 33.2㎡, 소폭 0.53×12.5 = 6.625㎡/롤, +15% → 38.18 ÷ 6.625 = 5.763 → 6롤
  const b = wallpaperCalc({ perimeterM: 16, heightM: 2.3, openingsM2: 3.6, rollWidthM: 0.53, rollLengthM: 12.5, lossRate: 0.15 });
  assert.ok(near(b.wallArea, 33.2, 1e-9));
  assert.ok(near(b.rollArea, 6.625, 1e-12));
  assert.ok(near(b.needArea, 38.18, 1e-9));
  assert.equal(b.rolls, 6);
  // C) 경계 정확도: 20㎡ ÷ 10㎡/롤 = 정확히 2롤 (부동소수 올림 오차 없어야 함)
  const c = wallpaperCalc({ perimeterM: 10, heightM: 2, openingsM2: 0, rollWidthM: 1, rollLengthM: 10, lossRate: 0 });
  assert.equal(c.rolls, 2);
});

t("타일: 장 수 3케이스 손계산 일치", () => {
  // A) 300×300 + 줄눈 3mm → 303×303 = 91,809㎟ → ㎡당 10.892장 × 10㎡ = 108.92 × 1.08 = 117.63 → 118장
  const a = tileCalc({ areaM2: 10, tileWmm: 300, tileHmm: 300, groutMm: 3, lossRate: 0.08 });
  assert.ok(near(a.perM2, 1e6 / 91809, 1e-9));
  assert.ok(near(a.rawCount, 1e7 / 91809, 1e-9));
  assert.equal(a.tiles, 118);
  // B) 600×600 + 줄눈 5mm → 605×605 = 366,025㎟ → ㎡당 2.732장 × 20㎡ = 54.64 × 1.15 = 62.84 → 63장
  const b = tileCalc({ areaM2: 20, tileWmm: 600, tileHmm: 600, groutMm: 5, lossRate: 0.15 });
  assert.ok(near(b.perM2, 1e6 / 366025, 1e-9));
  assert.equal(b.tiles, 63);
  // C) 1000×1000 줄눈 0 → ㎡당 1장, 12㎡ 로스 0 → 정확히 12장
  const c = tileCalc({ areaM2: 12, tileWmm: 1000, tileHmm: 1000, groutMm: 0, lossRate: 0 });
  assert.equal(c.perM2, 1);
  assert.equal(c.tiles, 12);
});

t("페인트: 리터·캔 조합 3케이스 손계산 일치", () => {
  // A) 40㎡ × 2회 ÷ 10㎡/L = 8L → 4L캔 2개
  const a = paintCalc({ areaM2: 40, coats: 2, coveragePerL: 10, lossRate: 0 });
  assert.ok(near(a.liters, 8, 1e-12));
  assert.equal(a.litersUp, 8);
  assert.equal(a.can4, 2);
  assert.equal(a.can1, 0);
  // B) 33㎡ × 2회 ÷ 12㎡/L = 5.5L, +5% = 5.775 → 5.8L → 4L 1개 + 1L 2개
  const b = paintCalc({ areaM2: 33, coats: 2, coveragePerL: 12, lossRate: 0.05 });
  assert.ok(near(b.liters, 5.775, 1e-9));
  assert.equal(b.litersUp, 5.8);
  assert.equal(b.can4, 1);
  assert.equal(b.can1, 2);
  // C) 25.5㎡ × 3회 ÷ 9㎡/L = 8.5L → 4L 2개 + 1L 1개
  const c = paintCalc({ areaM2: 25.5, coats: 3, coveragePerL: 9, lossRate: 0 });
  assert.ok(near(c.liters, 8.5, 1e-9));
  assert.equal(c.can4, 2);
  assert.equal(c.can1, 1);
});

t("장판·커튼 보조 계산 손계산 일치", () => {
  // 59㎡ + 5% = 61.95 ÷ 1.5㎡/박스 = 41.3 → 42박스
  const f = flooringCalc({ areaM2: 59, boxCoverageM2: 1.5, lossRate: 0.05 });
  assert.ok(near(f.needArea, 61.95, 1e-9));
  assert.equal(f.boxes, 42);
  // 창 200cm × 2배 + 좌우 10cm×2 = 420cm ÷ 140cm = 3폭, 재단 230+25 = 255cm × 3 = 7.65m
  const c = curtainCalc({ windowWcm: 200, fullness: 2, fabricWcm: 140, sideAllowCm: 10, lengthCm: 230, hemAllowCm: 25 });
  assert.equal(c.neededWidth, 420);
  assert.equal(c.panels, 3);
  assert.equal(c.cutLengthCm, 255);
  assert.ok(near(c.totalFabricM, 7.65, 1e-9));
});

/* ── 2. 평↔㎡ 왕복 변환 정밀도 ──────────────────────────────── */
t("평↔㎡: 상수 3.305785 + 왕복 변환 정밀도", () => {
  assert.equal(M2_PER_PYEONG, 3.305785);
  assert.ok(Math.abs(M2_PER_PYEONG - 400 / 121) < 1e-6, "1평 = 400/121㎡ 근사 확인");
  assert.equal(pyeongToM2(1), 3.305785);
  assert.equal(m2ToPyeong(3.305785), 1);
  for (const p of [0.5, 1, 10, 17, 24.5, 33, 34, 59.123, 1000]) {
    const back = m2ToPyeong(pyeongToM2(p));
    assert.ok(Math.abs(back - p) <= Math.abs(p) * 1e-12, `평 왕복 오차: ${p} → ${back}`);
  }
  for (const m of [1, 59, 84, 112.39, 244.7]) {
    const back = pyeongToM2(m2ToPyeong(m));
    assert.ok(Math.abs(back - m) <= Math.abs(m) * 1e-12, `㎡ 왕복 오차: ${m} → ${back}`);
  }
  // 대표 대응값
  assert.ok(near(pyeongToM2(25), 82.644625, 1e-9));
  assert.ok(near(pyeongToM2(34), 112.39669, 1e-9));
});

/* ── 3. furniture-fit 코어 로직(순수 함수) 5케이스 + 터치 게이트 ── */
t("furniture-fit 코어: 충돌·경계 판정 5케이스", () => {
  const room = { w: 400, h: 300 };
  // (1) 명백히 겹치는 두 사각형
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 150, h: 200 }, { x: 100, y: 100, w: 200, h: 90 }), true);
  // (2) 모서리가 맞닿기만 한 경우(간격 0)는 겹침 아님
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 100, h: 200 }, { x: 100, y: 0, w: 160, h: 90 }), false);
  // (3) 방 경계: 딱 맞으면 안, 1cm라도 넘으면 밖
  assert.equal(inRoom({ x: 240, y: 100, w: 160, h: 200 }, room), true);
  assert.equal(inRoom({ x: 241, y: 100, w: 160, h: 200 }, room), false);
  assert.equal(inRoom({ x: -1, y: 0, w: 10, h: 10 }, room), false);
  // (4) clampToRoom 은 항상 방 안으로 되돌린다
  const c = clampToRoom({ x: 999, y: -50, w: 160, h: 200 }, room);
  assert.deepEqual(c, { x: 240, y: 0, w: 160, h: 200 });
  assert.equal(inRoom(c, room), true);
  // (5) 회전(w/h 스왑)으로 충돌이 해소되는 케이스
  const items = [
    { x: 0, y: 0, w: 200, h: 90 },   // 3인 소파
    { x: 150, y: 0, w: 100, h: 200 }, // 침대 — 겹침
  ];
  assert.equal(anyCollision(items, 1), true);
  items[1] = { x: 250, y: 0, w: 100, h: 200 };
  assert.equal(anyCollision(items, 1), false);
  // 좁은 방(가로 150cm): 200×100 가구는 안 들어가지만 90° 회전하면 들어간다
  const narrow = { w: 150, h: 300 };
  const wide = { x: 0, y: 0, w: 200, h: 100 };
  assert.equal(inRoom(clampToRoom(wide, narrow), narrow), false);
  const rot = rotateRect(wide);
  assert.deepEqual(rot, { x: 0, y: 0, w: 100, h: 200 });
  assert.equal(inRoom(clampToRoom(rot, narrow), narrow), true);
});

/* ── HTML 수집 ─────────────────────────────────────────────── */
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
const rel = (f) => f.slice(ROOT.length + 1);

t(`페이지 생성: 허브 + 도구 12 + 평형 롱테일 25 + 정책 2 = ${files.length}개`, () => {
  const TOOL_SLUGS = ["pyeong", "wallpaper", "flooring", "tile", "paint", "curtain",
    "furniture-fit", "moving-check", "moving-cost", "lighting", "ac-size", "deposit-conv"];
  for (const s of TOOL_SLUGS) assert.ok(existsSync(join(ROOT, s, "index.html")), "누락: " + s);
  assert.ok(existsSync(join(ROOT, "index.html")), "허브 누락");
  assert.ok(existsSync(join(ROOT, "privacy.html")) && existsSync(join(ROOT, "terms.html")), "정책 페이지 누락");
  assert.ok(existsSync(join(ROOT, "robots.txt")) && existsSync(join(ROOT, "sitemap.xml")), "robots/sitemap 누락");
  const longtail = readdirSync(join(ROOT, "pyeong")).filter((n) => statSync(join(ROOT, "pyeong", n)).isDirectory());
  assert.ok(longtail.length >= 20, "평형 롱테일 수: " + longtail.length);
  assert.equal(files.length, 1 + TOOL_SLUGS.length + longtail.length + 2);
});

t("furniture-fit: 생성 HTML 에 모바일 터치 핸들러 존재 (touchstart/touchmove)", () => {
  const html = readFileSync(join(ROOT, "furniture-fit", "index.html"), "utf8");
  assert.ok(/addEventListener\("touchstart"/.test(html), "touchstart 핸들러 없음");
  assert.ok(/addEventListener\("touchmove"/.test(html), "touchmove 핸들러 없음");
  assert.ok(/addEventListener\("touchend"/.test(html), "touchend 핸들러 없음");
  assert.ok(/passive:\s*false/.test(html), "터치 기본동작 차단(passive:false) 없음");
  assert.ok(html.includes("e.preventDefault()"), "드래그 중 스크롤 차단 없음");
  assert.ok(html.includes("<canvas"), "canvas 없음");
  assert.ok(html.includes("toDataURL"), "이미지 저장(PNG) 기능 없음");
  assert.ok(html.includes('"#p="'), "해시 공유 상태 인코딩 없음");
  assert.ok(html.includes("clampToRoom") && html.includes("anyCollision"), "코어 로직(lib/calc.mjs) 미사용");
});

/* ── 4. 금지 문자열 ─────────────────────────────────────────── */
t(`정책: 금지 문자열 0건 (${files.length}개 HTML)`, () => {
  const banned = ["광고" + " 영역", "REPLACE" + "_"];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const b of banned) assert.ok(!html.includes(b), `${rel(f)} 에 금지 문자열 "${b}"`);
  }
});

/* ── 5. 링크: 루트 절대경로 0건 + 깨진 상대링크 0건 ─────────── */
t("링크: 루트 절대경로(/) 0건 + 깨진 상대링크 0건", () => {
  const attrRe = /(?:href|src)\s*=\s*"([^"]*)"/g;
  let checked = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    let m;
    while ((m = attrRe.exec(html))) {
      const url = m[1];
      assert.ok(url.length > 0, `${rel(f)}: 빈 href/src 속성`);
      if (/^(https?:|mailto:|#|data:|javascript:)/.test(url)) continue;
      assert.ok(!url.startsWith("/"), `${rel(f)}: 루트 절대경로 금지 → ${url}`);
      const path = url.split("#")[0].split("?")[0];
      if (!path) continue;
      let target = resolve(dirname(f), path);
      if (path.endsWith("/")) target = join(target, "index.html");
      assert.ok(existsSync(target), `${rel(f)}: 깨진 링크 → ${url}`);
      checked++;
    }
  }
  assert.ok(checked > 200, "검사한 내부 링크 수: " + checked);
});

t("모듈 import 경로도 실제 파일로 해석됨", () => {
  let n = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/from "([^"]+)"/g)) {
      const spec = m[1];
      assert.ok(!spec.startsWith("/"), `${rel(f)}: 절대경로 import 금지 → ${spec}`);
      assert.ok(spec.startsWith("."), `${rel(f)}: 상대경로 import 아님 → ${spec}`);
      assert.ok(existsSync(resolve(dirname(f), spec)), `${rel(f)}: 없는 모듈 → ${spec}`);
      n++;
    }
  }
  assert.ok(n >= 12, "검사한 import 수: " + n);
});

/* ── 6. sitemap ─────────────────────────────────────────────── */
t("sitemap: 모든 URL 에 대응 파일 존재 + 개수 일치", () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, files.length, `sitemap ${locs.length} vs HTML ${files.length}`);
  for (const loc of locs) {
    assert.ok(loc.startsWith(ORIGIN + "/"), "origin 불일치: " + loc);
    const r = loc.slice(ORIGIN.length + 1);
    const target = r === "" ? join(ROOT, "index.html") : r.endsWith("/") ? join(ROOT, r, "index.html") : join(ROOT, r);
    assert.ok(existsSync(target), "sitemap 대응 파일 없음: " + loc);
  }
  for (const must of ["pyeong", "furniture-fit", "moving-check", "deposit-conv"]) {
    assert.ok(locs.some((l) => l === ORIGIN + "/" + must + "/"), "sitemap 누락: " + must);
  }
  const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
  assert.ok(robots.includes("Sitemap: " + ORIGIN + "/sitemap.xml"), "robots.txt sitemap 줄 없음");
});

/* ── 7. SEO: 고유 title/description + JSON-LD 3종 ───────────── */
t("SEO: 전 페이지 고유 title/description + JSON-LD 3종 + canonical", () => {
  const titles = new Set(), descs = new Set();
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const ti = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    const de = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
    assert.ok(ti && de, rel(f) + ": title/description 없음");
    assert.ok(!titles.has(ti), "중복 title: " + ti);
    assert.ok(!descs.has(de), "중복 description: " + de);
    titles.add(ti); descs.add(de);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1]);
    const types = ld["@graph"].map((g) => g["@type"]);
    assert.equal(types.length, 3, rel(f) + ": JSON-LD 3종 아님 → " + types.join(","));
    assert.ok(types.includes("FAQPage") && types.includes("BreadcrumbList"), rel(f) + ": FAQPage/BreadcrumbList 누락");
    const isPolicy = f.endsWith("privacy.html") || f.endsWith("terms.html");
    const isHub = rel(f) === "index.html";
    if (!isPolicy && !isHub) assert.ok(types.includes("SoftwareApplication"), rel(f) + ": SoftwareApplication 누락");
    const faq = ld["@graph"].find((g) => g["@type"] === "FAQPage");
    assert.ok(faq.mainEntity.length >= 3, rel(f) + ": FAQ 3개 미만");
    const crumb = ld["@graph"].find((g) => g["@type"] === "BreadcrumbList");
    assert.ok(crumb.itemListElement.every((i) => i.item.startsWith(ORIGIN + "/")), rel(f) + ": breadcrumb origin 불일치");
    const expect = ORIGIN + "/" + (rel(f) === "index.html" ? "" : rel(f).replace(/index\.html$/, ""));
    assert.ok(html.includes(`rel="canonical" href="${expect}"`), rel(f) + ": canonical 불일치 → " + expect);
    assert.ok(html.includes(`<meta property="og:url" content="${expect}" />`), rel(f) + ": og:url 불일치");
  }
});

/* ── 광고 정책 ──────────────────────────────────────────────── */
t("광고: 결과 영역 1개만·기본 hidden·head 로더·입력 화면 노출 금지", () => {
  let withAd = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const units = (html.match(/<ins class="adsbygoogle"/g) || []).length;
    assert.ok(units <= 1, `${rel(f)}: 광고 유닛 ${units}개 (최대 1)`);
    if (!units) continue;
    withAd++;
    assert.ok(html.includes('<div class="ad-slot" id="adSlot" hidden>'), rel(f) + ": 광고 컨테이너가 기본 노출 상태");
    assert.ok(/<div class="result" id="resultBox" hidden[\s\S]*?<ins class="adsbygoogle"/.test(html), rel(f) + ": 광고가 결과 영역 밖(입력 화면)에 있음");
    assert.ok(html.includes(`pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106`), rel(f) + ": head 로더 없음");
    assert.ok(html.includes('data-ad-client="ca-pub-5567719201265106"'), rel(f) + ": ad client 불일치");
    assert.ok(html.includes('data-ad-format="auto"') && html.includes('data-full-width-responsive="true"'), rel(f) + ": 광고 포맷 속성 누락");
    assert.ok(html.includes("hcShowResultAd()"), rel(f) + ": 결과 표시 후 언하이드 호출 없음");
  }
  assert.ok(withAd >= 37, "광고 포함 페이지 수: " + withAd);
});

/* ── 콘텐츠 규칙 ────────────────────────────────────────────── */
t("콘텐츠: 참고용 라벨·출처·크로스링크·관행값 고지", () => {
  const CROSS = ["https://tomatoeggcat.com/pyeong/", "https://tomatoeggcat.com/pyeong-converter-plus/",
    "https://tomatoeggcat.com/moving-cost-calc/", "https://tomatoeggcat.com/dydrms-isagak/",
    "https://tomatoeggcat.com/jeonse-monthly-convert/", "https://tomatoeggcat.com/pyeong-electric/"];
  const TOOLS = ["pyeong", "wallpaper", "flooring", "tile", "paint", "curtain",
    "furniture-fit", "moving-check", "moving-cost", "lighting", "ac-size", "deposit-conv"];
  for (const s of TOOLS) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    const n = CROSS.filter((u) => html.includes(u)).length;
    assert.ok(n >= 2 && n <= 3, `${s}: TomatoEggCat 크로스링크 ${n}개 (2~3개 필요)`);
    assert.ok(html.includes("참고용") || html.includes("참고 자료") || html.includes("참고치"), s + ": 참고용 라벨 없음");
  }
  // 자재 계산기: 로스율 조정 가능
  for (const s of ["wallpaper", "flooring", "tile", "paint"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("조정 가능"), s + ": 로스율/여유율 조정 UI 표기 없음");
    assert.ok(html.includes("관행"), s + ": 업계 관행 표기 없음");
  }
  // 페인트: 제품 도포율 직접 입력 우선
  const paint = readFileSync(join(ROOT, "paint", "index.html"), "utf8");
  assert.ok(paint.includes("제품 라벨") && paint.includes("도포율"), "paint: 제품 도포율 우선 안내 없음");
  // 이사 견적: 업체 견적 아님
  const mc = readFileSync(join(ROOT, "moving-cost", "index.html"), "utf8");
  assert.ok(mc.includes("업체 견적이 아닙니다") || mc.includes("업체 견적이 아니라"), "moving-cost: '업체 견적 아님' 명시 없음");
  assert.ok(mc.includes("ftc.go.kr"), "moving-cost: 표준약관 출처 없음");
  // 전월세: 법정 상한 산식 + 출처 + 기준금리 입력
  const dc = readFileSync(join(ROOT, "deposit-conv", "index.html"), "utf8");
  assert.ok(dc.includes("주택임대차보호법") && dc.includes("law.go.kr"), "deposit-conv: 법정 산식 출처 없음");
  assert.ok(dc.includes("기준금리") && dc.includes('id="base"'), "deposit-conv: 기준금리 사용자 입력 없음");
  assert.ok(dc.includes("bok.or.kr"), "deposit-conv: 한국은행 확인 링크 없음");
  // 체크리스트: localStorage + 초기화 + 서버 저장 없음
  const chk = readFileSync(join(ROOT, "moving-check", "index.html"), "utf8");
  assert.ok(chk.includes("localStorage"), "moving-check: localStorage 미사용");
  assert.ok(chk.includes("체크 초기화") && chk.includes("removeItem"), "moving-check: 초기화 기능 없음");
  assert.ok(chk.includes("서버로 전송·저장하지 않습니다") || chk.includes("서버 저장 없음"), "moving-check: 서버 저장 없음 고지 없음");
  // '확인 필요' 배지: 공적 출처가 없는 값이 쓰이는 도구
  for (const s of ["lighting", "ac-size", "moving-cost"]) {
    const html = readFileSync(join(ROOT, s, "index.html"), "utf8");
    assert.ok(html.includes("확인 필요"), s + ": 확인 필요 배지 없음");
  }
});

t("접근성·본문: h1 1개 + 소개/사용법/FAQ 본문 존재", () => {
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    assert.equal((html.match(/<h1>/g) || []).length, 1, rel(f) + ": h1 개수 이상");
    assert.ok(html.includes("<h2>자주 묻는 질문</h2>"), rel(f) + ": FAQ 본문 없음");
    assert.ok(html.includes("<h2>사용법</h2>") || html.includes("<h2>요약</h2>") || html.includes("<h2>이렇게 활용하세요</h2>"), rel(f) + ": 사용법 본문 없음");
    assert.ok(html.includes('lang="ko"'), rel(f) + ": lang 속성 없음");
  }
});

t("인라인 모듈 스크립트 문법 검사", () => {
  let n = 0;
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script type="module">\n([\s\S]*?)\n<\/script>/g)) {
      const code = m[1].replace(/^import [^\n]*;$/gm, "");
      try { new Script(code, { filename: rel(f) }); } catch (e) { assert.fail(rel(f) + " 스크립트 문법 오류: " + e.message); }
      n++;
    }
  }
  assert.ok(n >= 37, "검사한 인라인 스크립트 수: " + n);
});

/* ── 기타 계산 로직 회귀 ────────────────────────────────────── */
t("조명·에어컨·전월세·이사비 계산 회귀", () => {
  // 조명: 200lx × 20㎡ ÷ (0.6 × 0.8) = 8,333lm → 4,500lm 방등 2개
  const l = lightingCalc({ areaM2: 20, lux: 200, utilization: 0.6, maintenance: 0.8, bulbLm: 4500 });
  assert.ok(near(l.lumens, 4000 / 0.48, 1e-9));
  assert.equal(l.bulbs, 2);
  // 에어컨: 10평 × 0.5kW × (2.6/2.3) = 5.652kW
  const a = acSizeCalc({ pyeong: 10, perPyeongKw: 0.5, ceilingM: 2.6, baseCeilingM: 2.3 });
  assert.ok(near(a.kw, 5 * (2.6 / 2.3), 1e-9));
  assert.ok(near(a.btu, a.kw * 3412.14, 1e-6));
  // 전월세: 기준금리 2.5% → 상한 4.5%, 1억 → 월 37.5만원, 역산 일치
  const cap = legalCapRate(0.025);
  assert.ok(near(cap, 0.045, 1e-12));
  assert.equal(legalCapRate(0.09), 0.10); // 상한 10% 고정
  const m = depositToMonthly(100000000, cap);
  assert.ok(near(m, 375000, 1e-6));
  assert.ok(near(monthlyToDeposit(m, cap), 100000000, 1e-6));
  // 이사비: 5톤 포장 + 40km + 사다리 1곳
  const mv = movingCostEstimate({
    base: [700000, 1400000], packing: true, packingMult: [1.3, 1.6],
    distanceKm: 40, perKmOver30: [1000, 3000], ladderSides: 1, ladderPer: [120000, 250000],
    noElevFloors: 0, perFloor: [30000, 70000], acMove: false, acRange: [150000, 300000],
  });
  assert.equal(mv.min, Math.round(700000 * 1.3 + 10 * 1000 + 120000));
  assert.equal(mv.max, Math.round(1400000 * 1.6 + 10 * 3000 + 250000));
});


/* ── 8. 헤드리스 스모크: 각 페이지 스크립트를 스텁 DOM 위에서 실제 실행 ── */
import { createContext, runInContext } from "node:vm";
const CALC = await import("../lib/calc.mjs");

function makeCtx2d() {
  const noop = () => {};
  return {
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, moveTo: noop,
    lineTo: noop, stroke: noop, fill: noop, fillText: noop, save: noop, restore: noop,
    setTransform: noop, drawImage: noop, measureText: () => ({ width: 42 }),
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", globalAlpha: 1,
  };
}
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.style = {}; this.dataset = {};
    this._l = {}; this.value = ""; this.textContent = ""; this.innerHTML = "";
    this.hidden = false; this.checked = false; this.disabled = false; this.className = "";
    this.type = ""; this.parentElement = null;
    this.firstChild = { nodeValue: "" };
    this.classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
    this._ctx = makeCtx2d();
  }
  addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
  removeEventListener() {}
  appendChild(c) { this.children.push(c); c.parentElement = this; return c; }
  removeChild(c) { return c; }
  remove() {}
  setAttribute() {}
  getAttribute() { return null; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  getContext() { return this._ctx; }
  toDataURL() { return "data:image/png;base64,AAAA"; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 450 }; }
  get clientWidth() { return 680; }
  fire(type, ev) { (this._l[type] || []).forEach((f) => f(Object.assign({ target: this, preventDefault() {}, touches: [{ clientX: 10, clientY: 10 }], clientX: 10, clientY: 10 }, ev || {}))); }
  click() { this.fire("click"); }
}
function parseEls(html) {
  const els = new Map();
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (m[1] === "script" || m[1] === "meta" || m[1] === "link") continue;
    const id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) continue;
    const el = new El(m[1]);
    el.hidden = /\shidden(\s|>|$)/.test(attrs + ">");
    const v = (attrs.match(/\svalue="([^"]*)"/) || [])[1];
    if (v !== undefined) el.value = v;
    if (m[1] === "select") {
      const block = html.slice(m.index).split("</select>")[0];
      const opts = [...block.matchAll(/<option value="([^"]*)"([^>]*)>/g)];
      const selected = opts.find((o) => /\sselected/.test(o[2])) || opts[0];
      if (selected) el.value = selected[1];
    }
    els.set(id, el);
  }
  return els;
}
function runPage(file) {
  const html = readFileSync(file, "utf8");
  const m = html.match(/<script type="module">\n([\s\S]*?)\n<\/script>/);
  if (!m) return null;
  let code = m[1];
  const imported = {};
  code = code.replace(/^import \{([^}]+)\} from "[^"]+";$/gm, (_, names) => {
    for (const raw of names.split(",")) {
      const n = raw.trim();
      assert.ok(n in CALC, rel(file) + ": lib/calc.mjs 에 없는 export → " + n);
      imported[n] = CALC[n];
    }
    return "";
  });
  const els = parseEls(html);
  const card = new El("div");
  els.forEach((el) => { if (!el.parentElement) el.parentElement = card; });
  const doc = {
    documentElement: new El("html"), body: new El("body"),
    getElementById: (id) => els.get(id) || null,
    createElement: (tag) => new El(tag),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const store = {};
  const sandbox = Object.assign({
    document: doc,
    window: { addEventListener: () => {}, devicePixelRatio: 1, innerWidth: 800 },
    location: { hash: "", href: "https://homecalc-kr.vercel.app/x/", search: "" },
    history: { replaceState: () => {} },
    navigator: { clipboard: null, share: undefined },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    getComputedStyle: () => ({ getPropertyValue: () => "", paddingLeft: "18px", paddingRight: "18px" }),
    TextEncoder, TextDecoder, btoa, atob, console,
    hcFmt: (n, d) => Number(n).toFixed(d || 0),
    hcToast: () => {}, hcShowResultAd: () => { const s = els.get("adSlot"); if (s) s.hidden = false; },
  }, imported);
  const ctx = createContext(sandbox);
  runInContext(code, ctx, { filename: rel(file) });
  return { els, sandbox };
}

t("스모크: 12개 도구 스크립트가 스텁 DOM 에서 오류 없이 실행 + 결과·광고 노출", () => {
  const TOOLS = ["pyeong", "wallpaper", "flooring", "tile", "paint", "curtain",
    "furniture-fit", "moving-check", "moving-cost", "lighting", "ac-size", "deposit-conv"];
  for (const s of TOOLS) {
    const file = join(ROOT, s, "index.html");
    const r = runPage(file);
    assert.ok(r, s + ": 인라인 모듈 없음");
    const { els } = r;
    assert.equal(els.get("resultBox").hidden, true, s + ": 초기 상태에서 결과가 노출됨");
    assert.equal(els.get("adSlot").hidden, true, s + ": 입력 화면에서 광고가 노출됨");
    if (s === "pyeong") {
      const inp = els.get("inPy"); inp.value = "25"; inp.fire("input");
    } else if (s === "moving-check") {
      continue; // 체크 입력이 있어야 요약이 열리므로 로드 무오류만 확인
    } else {
      els.get("calcBtn").click();
    }
    assert.equal(els.get("resultBox").hidden, false, s + ": 계산 후 결과가 열리지 않음");
    assert.equal(els.get("adSlot").hidden, false, s + ": 결과 표시 후에도 광고가 닫혀 있음");
    assert.ok(String(els.get("resMain").innerHTML).length > 3, s + ": 결과 내용 없음");
  }
});

t("스모크: 평형 롱테일 페이지 변환기 동작", () => {
  for (const n of [10, 25, 34, 60]) {
    const { els } = runPage(join(ROOT, "pyeong", String(n), "index.html"));
    const inp = els.get("inM2"); inp.value = "84"; inp.fire("input");
    assert.equal(els.get("resultBox").hidden, false, n + "평 페이지: 결과 미표시");
    assert.ok(String(els.get("inPy").value).startsWith("25.4"), n + "평 페이지: 84㎡ → 25.41평 환산 실패 (" + els.get("inPy").value + ")");
  }
});

t("스모크: 가구 배치 드래그·회전·PNG·해시 공유가 오류 없이 동작", () => {
  const { els } = runPage(join(ROOT, "furniture-fit", "index.html"));
  const cv = els.get("cv");
  cv.fire("mousedown", { clientX: 20, clientY: 20 });
  cv.fire("touchstart", { touches: [{ clientX: 30, clientY: 30 }] });
  cv.fire("touchmove", { touches: [{ clientX: 90, clientY: 70 }] });
  cv.fire("touchend", { touches: [] });
  els.get("addBtn").click();
  els.get("rotBtn").click();
  els.get("calcBtn").click();
  els.get("pngBtn").click();
  els.get("linkBtn").click();
  els.get("delBtn").click();
  els.get("clrBtn").click();
  assert.equal(els.get("resultBox").hidden, false);
});

t("스모크: 이사 체크리스트 저장·초기화(localStorage)", () => {
  const { els, sandbox } = runPage(join(ROOT, "moving-check", "index.html"));
  const list = els.get("list");
  const boxes = [];
  const collect = (el) => { el.children.forEach((c) => { if (c.tagName === "input") boxes.push(c); collect(c); }); };
  collect(list);
  assert.ok(boxes.length >= 20, "체크박스 수: " + boxes.length);
  boxes[0].checked = true; boxes[0].fire("change");
  assert.ok(sandbox.localStorage.getItem("hc-moving-check"), "localStorage 저장 안 됨");
  assert.equal(els.get("resultBox").hidden, false, "체크 후 진행 요약 미표시");
  els.get("resetBtn").click();
  assert.equal(sandbox.localStorage.getItem("hc-moving-check"), null, "초기화 후에도 저장값이 남음");
  assert.equal(els.get("resultBox").hidden, true, "초기화 후 요약이 닫히지 않음");
});

console.log(`\n${pass} tests passed ✔`);
