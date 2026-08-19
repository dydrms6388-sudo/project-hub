// homecalc-kr 정적 페이지 생성기 — Node 내장 모듈만 사용(의존성 0)
// 실행: node homecalc-kr/gen.mjs
// 생성물: index.html, <tool>/index.html × 12, pyeong/<n>/index.html 롱테일,
//         privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as CONFIG from "./site.config.mjs";
import { M2_PER_PYEONG, EXCLUSIVE_RATE_RANGE } from "./data/units.mjs";
import {
  WALLPAPER_ROLLS, WALLPAPER_LOSS, FLOORING_PRODUCTS, FLOORING_LOSS,
  TILE_LOSS, TILE_GROUT_DEFAULT_MM, PAINT_COVERAGE, CURTAIN_DEFAULTS,
} from "./data/materials.mjs";
import { ROOM_LUX, UTILIZATION_DEFAULT, BULB_PRESETS } from "./data/lighting.mjs";
import { COOLING_PER_PYEONG_KW, CEILING_BASE_M, EFFICIENCY_LABEL_INFO } from "./data/acsize.mjs";
import { LEGAL_CONVERSION_CAP, BASE_RATE_EXAMPLE } from "./data/deposit.mjs";
import { FURNITURE_PRESETS } from "./data/furniture.mjs";
import { GOV_LINKS, CHECKLIST, COST_ITEMS } from "./data/moving.mjs";
import { PYEONG_PAGES } from "./data/pyeong-pages.mjs";

/* ── 절대 URL 단일 상수 (canonical / og / sitemap 전부 여기서 파생) ── */
const SITE_ORIGIN = "https://homecalc-kr.vercel.app";
const SITE_NAME = "홈캘크 HomeCalc";
const ADS = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

if (CONFIG.SITE_ORIGIN !== SITE_ORIGIN) {
  console.log(`⚠ site.config.mjs 의 SITE_ORIGIN(${CONFIG.SITE_ORIGIN})이 gen.mjs 상수와 다릅니다.`);
}

/* TomatoEggCat 크로스링크 (절대 URL) */
const TEC = {
  pyeong: { url: "https://tomatoeggcat.com/pyeong/", ic: "📐", n: "평수 계산기 (TomatoEggCat)" },
  pyeongPlus: { url: "https://tomatoeggcat.com/pyeong-converter-plus/", ic: "📏", n: "평수 변환 플러스 (TomatoEggCat)" },
  moving: { url: "https://tomatoeggcat.com/moving-cost-calc/", ic: "🚚", n: "이사 비용 계산기 (TomatoEggCat)" },
  isagak: { url: "https://tomatoeggcat.com/dydrms-isagak/", ic: "📦", n: "이사각 — 이사 준비 (TomatoEggCat)" },
  jeonse: { url: "https://tomatoeggcat.com/jeonse-monthly-convert/", ic: "🏦", n: "전월세 전환 계산기 (TomatoEggCat)" },
  elec: { url: "https://tomatoeggcat.com/pyeong-electric/", ic: "⚡", n: "평형별 전기요금 (TomatoEggCat)" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const J = (o) => JSON.stringify(o);

/* ── 광고: 결과 영역 안에서만, 기본 hidden ── */
const AD = `      <div class="ad-slot" id="adSlot" hidden>
        <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS}" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </div>`;

/* 표준 결과 블록 */
const RESULT = (inner) => `    <div class="result" id="resultBox" hidden aria-live="polite">
${inner}
${AD}
    </div>`;

const STD_RESULT = RESULT(`      <p class="big" id="resMain">—</p>
      <p class="sub" id="resSub"></p>
      <div class="formula" id="resFormula"></div>
      <p class="src" id="srcLine"></p>`);

/* 참고용 고지 */
const PRACTICE_NOTE = `<p class="note">이 계산은 <strong>업계 일반 관행값</strong>을 사용한 <strong>참고용</strong> 결과입니다. 제품 라벨·시방서 표기가 있으면 그 값을 직접 입력하세요. 실제 시공 전에는 시공사 실측 견적이 우선합니다.</p>`;

/* ── 공통 HTML 셸 ────────────────────────────────────────────── */
function shell(p) {
  const path = p.path; // "" | "pyeong/" | "pyeong/25/" | "privacy.html"
  const depth = path.endsWith("/") ? path.split("/").filter(Boolean).length : 0;
  const U = "../".repeat(depth);
  const HOME = U || "./";
  const canonical = SITE_ORIGIN + "/" + path;
  const T = (s) => String(s == null ? "" : s).replace(/__U__/g, U).replace(/__HOME__/g, HOME);

  const graph = [];
  if (p.ld === "website") {
    graph.push({ "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN + "/", description: p.desc, inLanguage: "ko" });
  } else if (p.ld === "webpage") {
    graph.push({ "@type": "WebPage", name: p.h1, url: canonical, description: p.desc, inLanguage: "ko" });
  } else {
    graph.push({
      "@type": "SoftwareApplication", name: p.appName || p.h1, url: canonical,
      applicationCategory: "UtilityApplication", operatingSystem: "Web", inLanguage: "ko",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" }, description: p.desc,
    });
  }
  graph.push({
    "@type": "FAQPage",
    mainEntity: (p.faq || []).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });
  const crumbs = [{ name: "홈", path: "" }].concat(p.crumbs || []);
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE_ORIGIN + "/" + c.path })),
  });

  const crumbNav = path === "" ? "" : `  <nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">홈</a>` +
    (p.crumbs || []).map((c, i, arr) => ` <span class="sep">›</span> ` +
      (i === arr.length - 1 ? `<span class="cur">${esc(c.name)}</span>` : `<a href="${U}${c.path}">${esc(c.name)}</a>`)).join("") +
    `</nav>\n`;

  const faqHtml = (p.faq || []).map((f) =>
    `    <div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${esc(f.a)}</p></div>`).join("\n");

  const about = `  <section class="about">
${T(p.intro || "")}
${T(p.howto || "")}
${faqHtml ? `    <h2>자주 묻는 질문</h2>\n${faqHtml}` : ""}
${T(p.note || "")}
  </section>`;

  const rel = (p.related || []).map((r) => r.url
    ? `      <a class="rel" href="${r.url}" rel="noopener"><span class="ic">${r.ic}</span>${esc(r.n)}</a>`
    : `      <a class="rel" href="${U}${r.path}"><span class="ic">${r.ic}</span>${esc(r.n)}</a>`).join("\n");
  const related = rel ? `  <section class="related">
    <h2>${p.relatedTitle || "관련 도구"}</h2>
    <div class="rel-grid">
${rel}
    </div>
  </section>` : "";

  const script = p.script ? `<script type="module">\n${T(p.script)}\n</script>\n` : "";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />
<script>try{var t=localStorage.getItem('tec-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${p.emoji}</text></svg>" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${esc(p.ogTitle || p.title)}" />
<meta property="og:description" content="${esc(p.ogDesc || p.desc)}" />
<meta property="og:url" content="${canonical}" />
<meta name="google-adsense-account" content="${ADS}" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS}" crossorigin="anonymous"></script>
<link rel="stylesheet" href="${U}assets/style.css" />
<script type="application/ld+json">
${J({ "@context": "https://schema.org", "@graph": graph })}
</script>
</head>
<body>
<div class="wrap${p.wide ? " wide" : ""}">
  <div class="topbar">
    <a class="brand" href="${HOME}">🏠 홈캘크 <span>HomeCalc</span></a>
    <button class="theme-btn" type="button" aria-label="테마 전환">☀/🌙</button>
  </div>
${crumbNav}  <div class="hero">
    <div class="emoji" aria-hidden="true">${p.heroEmoji || p.emoji}</div>
    <h1>${esc(p.h1)}</h1>
    <p class="lead">${T(p.lead)}</p>
  </div>

${T(p.body)}

${about}

${related}

  <footer>
    <p style="margin:0 0 8px">🏠 <a href="${HOME}">홈캘크 HomeCalc</a> — 집·인테리어·이사 계산기 허브</p>
    <p style="margin:0"><a href="${U}privacy.html">개인정보처리방침</a>·<a href="${U}terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/" rel="noopener">TomatoEggCat</a></p>
  </footer>
</div>
<div class="toast" id="toast"></div>
<script src="${U}assets/app.js"></script>
${script}</body>
</html>
`;
}

/* ── 공통 조각 ──────────────────────────────────────────────── */
const PY_CHIPS = PYEONG_PAGES.value.map((x) => `<a class="chip" href="__U__pyeong/${x.p}/">${x.p}평</a>`).join("");
const UNIT_SRC = `출처: <a href="${M2_PER_PYEONG.source}" rel="noopener">계량에 관한 법률</a>(법정 단위 ㎡) · 1평 = 400/121㎡ · 확인일 ${M2_PER_PYEONG.checkedAt}`;

/* ── 도구 12종 정의 ─────────────────────────────────────────── */
const TOOLS = [

/* 1. 평수 계산기 ------------------------------------------------ */
{
  slug: "pyeong", emoji: "📐", nav: "평수 계산기",
  hubName: "평수 계산기", hubDesc: "평↔㎡ 변환, 전용·공급면적 개념, 평형별 상세 페이지",
  title: "평수 계산기 — 평↔제곱미터(㎡) 변환, 전용·공급면적 | 홈캘크",
  ogTitle: "평수 계산기 — 평↔㎡ 즉시 변환",
  desc: "평을 제곱미터로, ㎡를 평으로 즉시 변환합니다. 1평=3.305785㎡(계량법 관용 환산 400/121). 전용면적·공급면적 차이 정리와 10~60평 평형별 상세 페이지 제공.",
  h1: "평수 계산기",
  lead: "평↔제곱미터(㎡)를 즉시 변환합니다. 1평 = 3.305785㎡ (계량법 관용 환산 400/121㎡).",
  body: `  <div class="card">
    <h2>평 ↔ ㎡ 변환</h2>
    <div class="grid2">
      <label class="f">평 (坪)
        <input type="number" id="inPy" inputmode="decimal" step="any" min="0" placeholder="예: 25" />
      </label>
      <label class="f">제곱미터 (㎡)
        <input type="number" id="inM2" inputmode="decimal" step="any" min="0" placeholder="예: 84" />
      </label>
    </div>
    <p class="sub">어느 쪽이든 입력하면 반대쪽이 바로 계산됩니다.</p>
${STD_RESULT}
  </div>`,
  intro: `    <h2>평형별 상세 페이지</h2>
    <p>자주 찾는 평형은 전용·공급면적 대응과 함께 별도 페이지로 정리했습니다.</p>
    <div class="chips">${PY_CHIPS}</div>
    <h2>소개</h2>
    <p>부동산 광고와 등기부는 ㎡로, 실제 대화는 "몇 평"으로 하다 보니 매번 환산이 필요합니다. 이 계산기는 1평 = 400/121㎡ = 3.305785㎡ 관용 환산으로 양방향 변환하고, 전용률(전용면적÷공급면적) 참고 범위까지 함께 보여줍니다.</p>
    <h2>전용면적·공급면적·계약면적</h2>
    <ul>
      <li><strong>전용면적</strong> — 현관문 안쪽, 우리 집 식구만 쓰는 공간. 등기부와 청약 자격의 기준.</li>
      <li><strong>공급면적</strong> — 전용면적 + 주거공용면적(계단·복도·엘리베이터 홀). "○○평형" 표기의 근거.</li>
      <li><strong>계약면적</strong> — 공급면적 + 기타공용면적(주차장·관리실 등). 오피스텔 분양 표기에 자주 쓰임.</li>
    </ul>
    <p>같은 "25평형"이라도 단지 전용률(통상 ${Math.round(EXCLUSIVE_RATE_RANGE.value.min * 100)}~${Math.round(EXCLUSIVE_RATE_RANGE.value.max * 100)}%)에 따라 실사용 면적이 다르므로, 정확한 값은 분양 카탈로그나 건축물대장을 확인하세요.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>평 또는 ㎡ 한쪽에 숫자를 입력합니다.</li>
      <li>반대 단위 값과 전용면적 참고 범위가 즉시 표시됩니다.</li>
      <li>평형별 페이지에서 해당 평형의 상세 설명을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "1평은 정확히 몇 ㎡인가요?", a: "400/121㎡ = 3.3057851…㎡입니다. 실무에서는 3.3058 또는 3.305785로 계산합니다." },
    { q: "부동산 광고에는 왜 ㎡만 쓰나요?", a: "계량에 관한 법률상 법정 단위가 ㎡이기 때문입니다. '평'은 거래 관행상 병기되는 관용 단위입니다." },
    { q: "34평형이 전용 84㎡인 이유는?", a: "공급면적 약 112㎡(≈34평) 아파트의 전용면적이 84㎡ 안팎인 경우가 많아 '34평형=전용 84㎡'가 관행 표기로 굳어졌습니다. 단지마다 전용률이 달라 정확한 값은 분양 자료·건축물대장을 확인해야 합니다." },
    { q: "땅(대지) 평수도 같은 환산인가요?", a: "네, 토지·건물 모두 1평 = 3.305785㎡ 동일 환산입니다." },
  ],
  related: [{ path: "furniture-fit/", ic: "🛋️", n: "가구 배치 시뮬레이터" }, { path: "ac-size/", ic: "❄️", n: "에어컨 평수 계산기" }, TEC.pyeongPlus, TEC.elec],
  script: `import { pyeongToM2, m2ToPyeong } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const box = $("resultBox");
function show(py, m2, from) {
  box.hidden = false;
  $("resMain").innerHTML = from === "py"
    ? hcFmt(py, 4) + "평 = <span>" + hcFmt(m2, 4) + "㎡</span>"
    : hcFmt(m2, 4) + "㎡ = <span>" + hcFmt(py, 4) + "평</span>";
  $("resSub").textContent = "공급면적 기준일 때 전용률 " + Math.round(${EXCLUSIVE_RATE_RANGE.value.min} * 100) + "~" + Math.round(${EXCLUSIVE_RATE_RANGE.value.max} * 100) + "% 가정 시 전용면적은 약 "
    + hcFmt(m2 * ${EXCLUSIVE_RATE_RANGE.value.min}, 1) + "~" + hcFmt(m2 * ${EXCLUSIVE_RATE_RANGE.value.max}, 1) + "㎡ 수준입니다 (참고용).";
  $("resFormula").textContent = "㎡ = 평 × 3.305785 · 평 = ㎡ ÷ 3.305785 (1평 = 400/121㎡)";
  $("srcLine").innerHTML = ${J(UNIT_SRC)};
  hcShowResultAd();
}
$("inPy").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  if (!isFinite(v) || v < 0) return;
  const m2 = pyeongToM2(v);
  $("inM2").value = Math.round(m2 * 10000) / 10000;
  show(v, m2, "py");
});
$("inM2").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  if (!isFinite(v) || v < 0) return;
  const py = m2ToPyeong(v);
  $("inPy").value = Math.round(py * 10000) / 10000;
  show(py, v, "m2");
});`,
},

/* 2. 도배 자재 ------------------------------------------------- */
{
  slug: "wallpaper", emoji: "🧻", nav: "도배 자재 계산기",
  hubName: "도배 자재 계산기", hubDesc: "벽 치수·문/창 제외 → 벽지 몇 롤 필요한지",
  title: "도배 벽지 롤 수 계산기 — 벽 면적·여유율 반영 | 홈캘크",
  ogTitle: "도배 벽지 롤 수 계산기",
  desc: "벽 둘레와 천장 높이, 문·창문 제외 면적을 넣으면 필요한 벽지 롤 수를 계산합니다. 광폭합지(106cm)·소폭합지(53cm) 규격과 무늬 여유율(10~15%)을 반영한 참고용 산출.",
  h1: "도배 자재 계산기",
  lead: "벽 둘레 × 천장 높이에서 문·창문을 빼고, 재단·무늬 여유율을 더해 <strong>필요한 벽지 롤 수</strong>를 계산합니다.",
  body: `  <div class="card">
    <h2>벽 치수 입력</h2>
    <div class="grid2">
      <label class="f">벽 둘레 (m) <span class="hint">— (가로+세로)×2</span>
        <input type="number" id="perimeter" inputmode="decimal" step="any" min="0" value="16" />
      </label>
      <label class="f">천장 높이 (m)
        <input type="number" id="height" inputmode="decimal" step="any" min="0" value="2.3" />
      </label>
      <label class="f">문·창문 등 제외 면적 (㎡)
        <input type="number" id="openings" inputmode="decimal" step="any" min="0" value="0" placeholder="예: 문 1.6 + 창 2.4" />
      </label>
      <label class="f">벽지 규격 <span class="hint">— 제품 라벨 우선</span>
        <select id="rollSpec"></select>
      </label>
      <label class="f">여유율(로스) <span class="hint">— 조정 가능</span>
        <select id="loss">
          <option value="0.1">민무늬 +10% (관행)</option>
          <option value="0.15">무늬 벽지 +15% (관행)</option>
          <option value="0.05">최소 여유 +5%</option>
          <option value="0.2">큰 리피트·복잡한 구조 +20%</option>
        </select>
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">롤 수 계산하기</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>도배를 셀프로 하거나 자재만 따로 살 때 가장 헷갈리는 것이 "몇 롤을 사야 하나"입니다. 이 계산기는 벽 면적(둘레×높이)에서 문·창문 면적을 빼고, 재단·무늬 맞춤 여유율을 더해 필요한 롤 수를 올림으로 계산합니다.</p>
    <p>벽지 규격과 여유율은 <strong>업계 일반 관행값(참고용)</strong>이며 제조사·제품마다 다릅니다. 구매 전 제품 라벨의 폭·길이를 확인하세요.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>방의 가로·세로를 재서 둘레(=(가로+세로)×2)를 m 단위로 입력합니다.</li>
      <li>천장 높이(통상 2.2~2.4m)와 문/창문 면적 합계를 입력합니다.</li>
      <li>벽지 규격과 여유율을 고르고 계산 버튼을 누릅니다. 여유율은 자유롭게 조정할 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "실크 벽지와 합지 벽지의 롤 수가 다른가요?", a: "규격(폭 106cm)이 같다면 롤 수 계산은 동일합니다. 다만 실크는 부직포·본드 등 부자재가 추가로 필요합니다." },
    { q: "문·창문 면적은 꼭 빼야 하나요?", a: "작은 창 1~2개는 여유분으로 흡수되지만, 발코니 창처럼 큰 개구부는 빼는 것이 정확합니다." },
    { q: "계산 결과대로 사면 모자라지 않나요?", a: "여유율을 반영해 올림 계산하지만 천장고가 불규칙하거나 무늬 리피트가 큰 제품은 1롤 더 여유를 두는 것이 안전합니다. 본 결과는 참고용입니다." },
    { q: "천장도 도배하려면?", a: "천장 면적(가로×세로)을 문·창문 칸에 음수로 넣을 수는 없으므로, 벽 둘레 대신 (벽 면적 + 천장 면적) ÷ 천장 높이 값을 둘레 칸에 넣어 계산하세요." },
  ],
  note: PRACTICE_NOTE,
  related: [{ path: "paint/", ic: "🎨", n: "페인트 양 계산기" }, { path: "flooring/", ic: "🪵", n: "장판·마루 계산기" }, TEC.pyeong, TEC.isagak],
  script: `import { wallpaperCalc } from "__U__lib/calc.mjs";
const ROLLS = ${J(WALLPAPER_ROLLS.value)};
const $ = (id) => document.getElementById(id);
const sel = $("rollSpec");
ROLLS.forEach((r, i) => { const o = document.createElement("option"); o.value = i; o.textContent = r.name; sel.appendChild(o); });
$("calcBtn").addEventListener("click", () => {
  const perimeterM = parseFloat($("perimeter").value);
  const heightM = parseFloat($("height").value);
  const openingsM2 = parseFloat($("openings").value) || 0;
  if (!isFinite(perimeterM) || !isFinite(heightM) || perimeterM <= 0 || heightM <= 0) { hcToast("벽 둘레와 천장 높이를 입력하세요"); return; }
  const spec = ROLLS[+sel.value];
  const lossRate = parseFloat($("loss").value);
  const r = wallpaperCalc({ perimeterM, heightM, openingsM2, rollWidthM: spec.widthM, rollLengthM: spec.lengthM, lossRate });
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "벽지 약 <span>" + r.rolls + "롤</span> <small>(" + spec.name + ")</small>";
  $("resSub").textContent = "도배 면적 " + hcFmt(r.wallArea, 2) + "㎡ → 여유 " + Math.round(lossRate * 100) + "% 포함 " + hcFmt(r.needArea, 2) + "㎡ ÷ 롤당 " + hcFmt(r.rollArea, 2) + "㎡";
  $("resFormula").textContent = "롤 수 = 올림( (둘레 " + perimeterM + "m × 높이 " + heightM + "m − 제외 " + openingsM2 + "㎡) × " + (1 + lossRate).toFixed(2) + " ÷ " + hcFmt(r.rollArea, 3) + "㎡ )";
  $("srcLine").innerHTML = "규격·여유율: 업계 일반 관행(참고용, 제품 라벨 우선) · 확인일 ${WALLPAPER_LOSS.checkedAt} <span class=\\"badge todo\\">확인 필요</span>";
  hcShowResultAd();
});`,
},

/* 3. 장판·마루 -------------------------------------------------- */
{
  slug: "flooring", emoji: "🪵", nav: "장판·마루 계산기",
  hubName: "장판·마루 계산기", hubDesc: "바닥 면적 → 로스율 반영 박스 수",
  title: "장판·마루 자재 계산기 — 바닥 면적별 박스 수 | 홈캘크",
  ogTitle: "장판·마루 박스 수 계산기",
  desc: "바닥 면적(㎡ 또는 평)과 제품 박스당 시공 면적을 넣으면 필요한 마루 박스 수를 계산합니다. 일자 시공 5%·헤링본 12% 등 로스율 조정 가능. 장판(롤 재단)은 필요 ㎡로 표시.",
  h1: "장판·마루 계산기",
  lead: "바닥 면적에 시공 로스율을 더해 <strong>필요한 마루 박스 수</strong>를 계산합니다. 장판은 재단 기준 ㎡로 안내합니다.",
  body: `  <div class="card">
    <h2>바닥 면적 입력</h2>
    <div class="grid2">
      <label class="f">면적
        <input type="number" id="area" inputmode="decimal" step="any" min="0" value="59" />
      </label>
      <label class="f">면적 단위
        <select id="unit"><option value="m2">㎡ (제곱미터)</option><option value="py">평</option></select>
      </label>
      <label class="f">제품 종류
        <select id="prod"></select>
      </label>
      <label class="f">박스당 시공 면적 (㎡) <span class="hint" id="boxHint"></span>
        <input type="number" id="box" inputmode="decimal" step="any" min="0" />
      </label>
      <label class="f">시공 로스율 <span class="hint">— 조정 가능</span>
        <select id="loss">
          <option value="0.05">일자 시공 +5% (관행)</option>
          <option value="0.12">헤링본·패턴 +12% (관행)</option>
          <option value="0.08">복잡한 구조 +8%</option>
          <option value="0.15">대각선·큰 패턴 +15%</option>
        </select>
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">필요 자재량 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>마루는 박스 단위로 판매되고 박스마다 시공 면적(㎡)이 다릅니다. 여기에 재단·파손 로스를 더해야 실제 구매량이 나옵니다. 이 계산기는 면적을 평/㎡ 어느 쪽으로 넣어도 되고, 제품 상세에 적힌 박스당 시공 면적을 직접 입력해 정확도를 높일 수 있습니다.</p>
    <p>장판(모노륨)처럼 폭 1.8m 롤로 재단하는 제품은 박스 개념이 없어 필요 ㎡와 재단 길이 감만 안내합니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>바닥 면적을 ㎡ 또는 평으로 입력합니다. (전용면적 중 실제 시공할 방/거실 면적)</li>
      <li>제품 종류를 고르면 박스당 시공 면적이 자동으로 채워집니다. 구매 제품 값으로 수정하세요.</li>
      <li>시공 방식에 맞는 로스율을 고르고 계산합니다.</li>
    </ol>`,
  faq: [
    { q: "박스당 시공 면적은 어디서 확인하나요?", a: "제품 상세페이지나 박스 옆면에 '시공면적 ○㎡' 형태로 표기됩니다. 강마루는 대개 1.5㎡ 안팎이지만 제품마다 다릅니다." },
    { q: "로스율은 얼마로 잡아야 하나요?", a: "일자 시공은 5% 내외, 헤링본·대각선 등 패턴 시공은 10~15%를 잡는 것이 일반적인 관행입니다. 방이 좁고 굴곡이 많을수록 크게 잡습니다." },
    { q: "기존 바닥 철거 비용도 나오나요?", a: "아니요. 이 도구는 자재량만 계산합니다. 철거·평탄화 작업 비용은 시공사 견적을 받아야 합니다." },
    { q: "면적을 평으로 넣으면 어떻게 환산되나요?", a: "1평 = 3.305785㎡로 환산한 뒤 계산합니다." },
  ],
  note: PRACTICE_NOTE,
  related: [{ path: "wallpaper/", ic: "🧻", n: "도배 자재 계산기" }, { path: "tile/", ic: "🧱", n: "타일 계산기" }, TEC.pyeong, TEC.isagak],
  script: `import { flooringCalc, pyeongToM2 } from "__U__lib/calc.mjs";
const PRODUCTS = ${J(FLOORING_PRODUCTS.value)};
const $ = (id) => document.getElementById(id);
const sel = $("prod");
PRODUCTS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.name; sel.appendChild(o); });
function syncBox() {
  const p = PRODUCTS[+sel.value];
  if (p.boxCoverageM2 == null) {
    $("box").value = ""; $("box").disabled = true;
    $("boxHint").textContent = "— 롤 재단 제품(박스 없음)";
  } else {
    $("box").disabled = false; $("box").value = p.boxCoverageM2;
    $("boxHint").textContent = "— 제품 표기값으로 수정";
  }
}
sel.addEventListener("change", syncBox);
syncBox();
$("calcBtn").addEventListener("click", () => {
  const v = parseFloat($("area").value);
  if (!isFinite(v) || v <= 0) { hcToast("면적을 입력하세요"); return; }
  const areaM2 = $("unit").value === "py" ? pyeongToM2(v) : v;
  const lossRate = parseFloat($("loss").value);
  const p = PRODUCTS[+sel.value];
  const boxCoverageM2 = p.boxCoverageM2 == null ? 0 : parseFloat($("box").value);
  const r = flooringCalc({ areaM2, boxCoverageM2, lossRate });
  $("resultBox").hidden = false;
  if (p.boxCoverageM2 == null) {
    $("resMain").innerHTML = "필요 자재 <span>" + hcFmt(r.needArea, 2) + "㎡</span> <small>(폭 1.8m 롤 기준 약 " + hcFmt(r.needArea / 1.8, 1) + "m 길이)</small>";
    $("resSub").textContent = "바닥 " + hcFmt(areaM2, 2) + "㎡ + 로스 " + Math.round(lossRate * 100) + "% — 장판은 방 폭에 맞춰 재단하므로 실측 후 여유 길이를 더해 주문하세요.";
    $("resFormula").textContent = "필요 면적 = " + hcFmt(areaM2, 2) + "㎡ × " + (1 + lossRate).toFixed(2);
  } else {
    if (!isFinite(boxCoverageM2) || boxCoverageM2 <= 0) { hcToast("박스당 시공 면적을 입력하세요"); return; }
    $("resMain").innerHTML = "약 <span>" + r.boxes + "박스</span> <small>(" + p.name + ")</small>";
    $("resSub").textContent = "바닥 " + hcFmt(areaM2, 2) + "㎡ → 로스 " + Math.round(lossRate * 100) + "% 포함 " + hcFmt(r.needArea, 2) + "㎡ ÷ 박스당 " + boxCoverageM2 + "㎡ (총 시공 가능 " + hcFmt(r.boxes * boxCoverageM2, 2) + "㎡)";
    $("resFormula").textContent = "박스 수 = 올림( " + hcFmt(areaM2, 2) + "㎡ × " + (1 + lossRate).toFixed(2) + " ÷ " + boxCoverageM2 + "㎡ )";
  }
  $("srcLine").innerHTML = "박스 규격·로스율: 업계 일반 관행(참고용, 제품 표기 우선) · 확인일 ${FLOORING_LOSS.checkedAt} <span class=\\"badge todo\\">확인 필요</span>";
  hcShowResultAd();
});`,
},

/* 4. 타일 ------------------------------------------------------ */
{
  slug: "tile", emoji: "🧱", nav: "타일 계산기",
  hubName: "타일 계산기", hubDesc: "타일 규격·줄눈 폭 → 필요 장수 + 시공 로스",
  title: "타일 장수 계산기 — 규격·줄눈 폭·로스율 반영 | 홈캘크",
  ogTitle: "타일 장수 계산기",
  desc: "시공 면적과 타일 규격(300×300, 600×600 등), 줄눈 폭을 넣으면 필요한 타일 장수를 계산합니다. 정시공 8%·대각선 15% 로스율 조정 가능, ㎡당 장수도 함께 표시.",
  h1: "타일 계산기",
  lead: "타일 규격과 줄눈(메지) 폭으로 <strong>㎡당 장수</strong>를 구하고, 시공 로스를 더해 필요한 총 장수를 계산합니다.",
  body: `  <div class="card">
    <h2>시공 조건 입력</h2>
    <div class="grid2">
      <label class="f">시공 면적 (㎡)
        <input type="number" id="area" inputmode="decimal" step="any" min="0" value="10" />
      </label>
      <label class="f">타일 규격 프리셋
        <select id="preset"></select>
      </label>
      <label class="f">타일 가로 (mm)
        <input type="number" id="tw" inputmode="decimal" step="any" min="1" value="300" />
      </label>
      <label class="f">타일 세로 (mm)
        <input type="number" id="th" inputmode="decimal" step="any" min="1" value="300" />
      </label>
      <label class="f">줄눈(메지) 폭 (mm)
        <input type="number" id="grout" inputmode="decimal" step="any" min="0" value="${TILE_GROUT_DEFAULT_MM.value}" />
      </label>
      <label class="f">시공 로스율 <span class="hint">— 조정 가능</span>
        <select id="loss">
          <option value="0.08">정시공 +8% (관행)</option>
          <option value="0.15">대각선·패턴 +15% (관행)</option>
          <option value="0.05">넓고 단순한 면 +5%</option>
          <option value="0.2">굴곡 많은 욕실 +20%</option>
        </select>
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">필요 장수 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>타일 장수는 타일 크기만으로 계산하면 실제보다 많이 나옵니다. 줄눈(메지) 폭만큼 한 장이 차지하는 면적이 커지기 때문입니다. 이 계산기는 (타일 가로+줄눈)×(세로+줄눈)을 한 장의 점유 면적으로 잡아 ㎡당 장수를 구한 뒤, 재단·파손 로스를 더합니다.</p>
    <p>욕실 벽·바닥처럼 굴곡이 많은 곳은 로스가 커집니다. 같은 로트(색상 편차)를 나중에 구하기 어려우므로 여유분을 넉넉히 두는 것이 일반적입니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>시공할 면적(㎡)을 입력합니다. 벽 타일이면 벽 면적, 바닥이면 바닥 면적입니다.</li>
      <li>프리셋에서 타일 규격을 고르거나 가로·세로(mm)를 직접 입력합니다.</li>
      <li>줄눈 폭(보통 2~5mm)과 시공 방식별 로스율을 고르고 계산합니다.</li>
    </ol>`,
  faq: [
    { q: "줄눈 폭을 0으로 하면 어떻게 되나요?", a: "타일 크기만으로 ㎡당 장수를 계산합니다. 실제로는 2~5mm 줄눈이 들어가므로 장수가 조금 줄어드는 것이 정상입니다." },
    { q: "박스 단위로 파는데 장수만 나와도 되나요?", a: "제품 상세의 '박스당 ○장'으로 나누어 올림하면 박스 수가 됩니다. 박스 단위 구매 시 여유분이 더 생깁니다." },
    { q: "타일 접착제(압착 시멘트)는 얼마나 필요한가요?", a: "제품마다 소요량(㎏/㎡)이 달라 이 도구에서는 계산하지 않습니다. 접착제 포대에 표기된 ㎡당 소요량을 확인하세요." },
    { q: "로스율은 왜 필요한가요?", a: "가장자리 재단, 운반·시공 중 파손, 색상 편차 대비 여유분 때문입니다. 정시공 5~10%, 패턴 시공 15% 내외가 일반적 관행입니다." },
  ],
  note: PRACTICE_NOTE,
  related: [{ path: "flooring/", ic: "🪵", n: "장판·마루 계산기" }, { path: "wallpaper/", ic: "🧻", n: "도배 자재 계산기" }, TEC.pyeong, TEC.isagak],
  script: `import { tileCalc } from "__U__lib/calc.mjs";
const PRESETS = [
  { name: "직접 입력", w: 0, h: 0 },
  { name: "100×100 (모자이크·욕실벽)", w: 100, h: 100 },
  { name: "200×200", w: 200, h: 200 },
  { name: "300×300 (욕실 바닥)", w: 300, h: 300 },
  { name: "300×600 (욕실 벽)", w: 300, h: 600 },
  { name: "600×600 (폴리싱)", w: 600, h: 600 },
  { name: "600×1200 (대형 포세린)", w: 600, h: 1200 }
];
const $ = (id) => document.getElementById(id);
const sel = $("preset");
PRESETS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.name; sel.appendChild(o); });
sel.value = 3; $("tw").value = 300; $("th").value = 300;
sel.addEventListener("change", () => {
  const p = PRESETS[+sel.value];
  if (p.w) { $("tw").value = p.w; $("th").value = p.h; }
});
$("calcBtn").addEventListener("click", () => {
  const areaM2 = parseFloat($("area").value);
  const tileWmm = parseFloat($("tw").value);
  const tileHmm = parseFloat($("th").value);
  const groutMm = parseFloat($("grout").value) || 0;
  if (!isFinite(areaM2) || areaM2 <= 0 || !isFinite(tileWmm) || tileWmm <= 0 || !isFinite(tileHmm) || tileHmm <= 0) { hcToast("면적과 타일 규격을 입력하세요"); return; }
  const lossRate = parseFloat($("loss").value);
  const r = tileCalc({ areaM2, tileWmm, tileHmm, groutMm, lossRate });
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "타일 약 <span>" + hcFmt(r.tiles) + "장</span> <small>(" + tileWmm + "×" + tileHmm + "mm)</small>";
  $("resSub").textContent = "㎡당 " + hcFmt(r.perM2, 2) + "장 × " + hcFmt(areaM2, 2) + "㎡ = " + hcFmt(r.rawCount, 1) + "장 + 로스 " + Math.round(lossRate * 100) + "%";
  $("resFormula").textContent = "㎡당 장수 = 1,000,000 ÷ ((" + tileWmm + "+" + groutMm + ") × (" + tileHmm + "+" + groutMm + ")) · 총 장수 = 올림( ㎡당 장수 × 면적 × " + (1 + lossRate).toFixed(2) + " )";
  $("srcLine").innerHTML = "줄눈 폭·로스율: 업계 일반 관행(참고용, 시방서 우선) · 확인일 ${TILE_LOSS.checkedAt} <span class=\\"badge todo\\">확인 필요</span>";
  hcShowResultAd();
});`,
},

/* 5. 페인트 ---------------------------------------------------- */
{
  slug: "paint", emoji: "🎨", nav: "페인트 양 계산기",
  hubName: "페인트 양 계산기", hubDesc: "면적·도장 횟수·제품 도포율 → 필요 리터",
  title: "페인트 양 계산기 — 도포율·도장 횟수로 필요 리터 산출 | 홈캘크",
  ogTitle: "페인트 양 계산기 — 필요 리터",
  desc: "칠할 면적과 도장 횟수, 제품 라벨의 도포율(㎡/L)을 넣으면 필요한 페인트 리터와 4L·1L 캔 조합을 계산합니다. 도포율은 제품 표기 직접 입력이 우선입니다.",
  h1: "페인트 양 계산기",
  lead: "면적 × 도장 횟수 ÷ <strong>제품 도포율</strong>로 필요한 페인트 리터와 캔 조합을 계산합니다.",
  body: `  <div class="card">
    <h2>도장 조건 입력</h2>
    <div class="grid2">
      <label class="f">칠할 면적 (㎡)
        <input type="number" id="area" inputmode="decimal" step="any" min="0" value="40" />
      </label>
      <label class="f">도장 횟수 (회)
        <select id="coats"><option value="1">1회 (덧칠·보수)</option><option value="2" selected>2회 (일반)</option><option value="3">3회 (색상 변경·진한 색)</option></select>
      </label>
      <label class="f">제품 도포율 (㎡/L) <span class="hint">— 제품 라벨 값 우선</span>
        <input type="number" id="cov" inputmode="decimal" step="any" min="0.1" value="${PAINT_COVERAGE.value.defaultM2PerL}" />
      </label>
      <label class="f">여유율 <span class="hint">— 조정 가능</span>
        <select id="loss">
          <option value="0">0% (라벨 도포율 그대로)</option>
          <option value="0.05" selected>+5% (일반 여유)</option>
          <option value="0.1">+10% (거친 면·롤러 흡수)</option>
        </select>
      </label>
    </div>
    <p class="sub">벽 면적을 모르면 (벽 둘레 × 높이 − 문·창 면적)으로 구하세요. <a href="__U__wallpaper/">도배 계산기</a>의 면적 산식과 같습니다.</p>
    <button class="btn full" id="calcBtn" type="button">필요 리터 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>페인트 필요량은 <strong>제품 도포율</strong>에 좌우됩니다. 같은 1L라도 제품에 따라 8㎡에서 14㎡까지 차이가 나므로, 반드시 구매하려는 제품 캔에 적힌 "도포율 ○㎡/L(1회 도장 기준)"을 그대로 입력하는 것이 가장 정확합니다.</p>
    <p>도포율이 범위(예: 10~12㎡/L)로 적혀 있으면 작은 값을 넣는 편이 안전합니다. 흰색 위에 진한 색을 칠하거나 그 반대인 경우 3회 도장이 필요할 수 있습니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>칠할 면적(㎡)을 입력합니다. 천장까지 칠한다면 천장 면적도 더합니다.</li>
      <li>도장 횟수를 고릅니다. 일반적으로 2회 도장이 기본입니다.</li>
      <li>제품 라벨의 도포율(㎡/L)을 입력하고 계산합니다. 4L·1L 캔 조합이 함께 표시됩니다.</li>
    </ol>`,
  faq: [
    { q: "도포율이 라벨에 없으면 어떻게 하나요?", a: "수성 페인트 기준 1회 도장 8~14㎡/L 범위가 통상값입니다. 기본값 10㎡/L은 참고용이므로 제품 정보를 확인해 수정하는 것을 권장합니다." },
    { q: "젯소(프라이머)도 계산되나요?", a: "이 계산기는 마감 페인트 기준입니다. 젯소는 별도 제품 도포율로 다시 계산하세요. 보통 1회 도장분으로 잡습니다." },
    { q: "캔 조합은 어떻게 나오나요?", a: "계산된 리터를 4L 캔과 1L 캔 조합으로 올림해 제안합니다. 실제 판매 규격(0.9L·3.6L·18L 등)은 제품마다 다릅니다." },
    { q: "롤러·붓 도구도 필요한가요?", a: "네. 롤러, 트레이, 마스킹 테이프, 커버링 비닐 등 부자재는 별도이며 이 계산에는 포함되지 않습니다." },
  ],
  note: PRACTICE_NOTE,
  related: [{ path: "wallpaper/", ic: "🧻", n: "도배 자재 계산기" }, { path: "curtain/", ic: "🪟", n: "커튼 치수 계산기" }, TEC.pyeong, TEC.isagak],
  script: `import { paintCalc } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
$("calcBtn").addEventListener("click", () => {
  const areaM2 = parseFloat($("area").value);
  const coveragePerL = parseFloat($("cov").value);
  const coats = parseInt($("coats").value, 10);
  const lossRate = parseFloat($("loss").value);
  if (!isFinite(areaM2) || areaM2 <= 0 || !isFinite(coveragePerL) || coveragePerL <= 0) { hcToast("면적과 도포율을 입력하세요"); return; }
  const r = paintCalc({ areaM2, coats, coveragePerL, lossRate });
  const cans = (r.can4 ? r.can4 + "개의 4L 캔" : "") + (r.can4 && r.can1 ? " + " : "") + (r.can1 ? r.can1 + "개의 1L 캔" : "");
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "약 <span>" + hcFmt(r.litersUp, 1) + "L</span> <small>필요</small>";
  $("resSub").textContent = "면적 " + hcFmt(areaM2, 1) + "㎡ × " + coats + "회 ÷ " + coveragePerL + "㎡/L" + (lossRate ? " + 여유 " + Math.round(lossRate * 100) + "%" : "") + " = " + hcFmt(r.liters, 2) + "L · 캔 조합 예시: " + (cans || "1L 미만");
  $("resFormula").textContent = "필요 리터 = 면적 × 도장 횟수 ÷ 도포율(㎡/L) × (1 + 여유율)";
  $("srcLine").innerHTML = "도포율 기본값 ${PAINT_COVERAGE.value.defaultM2PerL}㎡/L은 통상 범위 ${PAINT_COVERAGE.value.range[0]}~${PAINT_COVERAGE.value.range[1]}㎡/L의 참고값입니다. <strong>구매 제품 라벨의 도포율을 직접 입력</strong>하세요 · 확인일 ${PAINT_COVERAGE.checkedAt} <span class=\\"badge todo\\">확인 필요</span>";
  hcShowResultAd();
});`,
},

/* 6. 커튼 ------------------------------------------------------ */
{
  slug: "curtain", emoji: "🪟", nav: "커튼 치수 계산기",
  hubName: "커튼 치수 계산기", hubDesc: "창 폭·주름 배수 → 원단 폭 수와 길이",
  title: "커튼 치수·원단량 계산기 — 주름 배수와 폭 수 | 홈캘크",
  ogTitle: "커튼 치수·원단량 계산기",
  desc: "창 폭과 주름 배수(1.5~2.5배), 원단 폭(110/140/150cm)을 넣으면 필요한 커튼 폭 수와 원단 길이를 계산합니다. 좌우 여유·상하 시접 조정 가능.",
  h1: "커튼 치수 계산기",
  lead: "창 폭 × <strong>주름 배수</strong>에 좌우 여유를 더해 필요한 원단 폭 수와 총 길이를 계산합니다.",
  body: `  <div class="card">
    <h2>창·원단 치수 입력</h2>
    <div class="grid2">
      <label class="f">창(또는 커튼봉) 폭 (cm)
        <input type="number" id="winW" inputmode="decimal" step="any" min="0" value="200" />
      </label>
      <label class="f">커튼 길이 (cm) <span class="hint">— 봉~바닥/창틀</span>
        <input type="number" id="len" inputmode="decimal" step="any" min="0" value="230" />
      </label>
      <label class="f">주름 배수 <span class="hint">— 조정 가능</span>
        <select id="full">
          <option value="1.5">1.5배 (약한 주름·절약형)</option>
          <option value="2" selected>2.0배 (일반)</option>
          <option value="2.5">2.5배 (풍성한 주름)</option>
        </select>
      </label>
      <label class="f">원단 폭 (cm)
        <select id="fabW"><option value="110">110cm</option><option value="140" selected>140cm</option><option value="150">150cm</option><option value="280">280cm (광폭)</option></select>
      </label>
      <label class="f">좌우 여유 (cm, 한쪽)
        <input type="number" id="side" inputmode="decimal" step="any" min="0" value="${CURTAIN_DEFAULTS.value.sideAllowCm}" />
      </label>
      <label class="f">상하 시접 (cm)
        <input type="number" id="hem" inputmode="decimal" step="any" min="0" value="${CURTAIN_DEFAULTS.value.hemAllowCm}" />
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">원단량 계산하기</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>커튼은 창 폭 그대로 만들면 주름이 서지 않습니다. 보통 창 폭의 1.5~2.5배 원단을 사용하는데, 이를 <strong>주름 배수(fullness)</strong>라고 합니다. 이 계산기는 필요한 총 폭을 구한 뒤 원단 폭으로 나눠 몇 폭이 필요한지, 그리고 시접을 포함한 총 원단 길이를 계산합니다.</p>
    <p>암막 커튼은 무게 때문에 2배 이상을 권하는 경우가 많고, 쉬어(속커튼)는 1.5~2배로도 충분합니다. 실제 제작은 봉·레일 방식(핀형/봉집형)에 따라 시접이 달라집니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>커튼봉 길이(또는 창 폭)를 cm로 입력합니다. 봉이 창보다 좌우로 길게 나오면 봉 기준이 정확합니다.</li>
      <li>커튼 길이(봉 고리 아래부터 바닥 또는 창틀 아래까지)를 입력합니다.</li>
      <li>주름 배수와 원단 폭을 고르면 필요한 폭 수와 총 원단 길이(m)가 나옵니다.</li>
    </ol>`,
  faq: [
    { q: "주름 배수는 얼마가 적당한가요?", a: "일반 커튼은 2배가 표준입니다. 원단이 두껍거나 예산을 아낄 때는 1.5배, 풍성한 느낌을 원하면 2.5배를 씁니다." },
    { q: "좌우 여유는 왜 필요한가요?", a: "커튼을 닫았을 때 빛샘을 막고 봉 끝까지 덮기 위해 한쪽 5~15cm 정도 여유를 둡니다." },
    { q: "바닥에 끌리게 하려면?", a: "봉 위치에서 바닥까지 길이에 2~5cm를 더해 '살짝 끌림' 연출을 합니다. 반대로 바닥에서 1~2cm 띄우면 청소가 편합니다." },
    { q: "원단 길이 계산에 무늬 맞춤이 반영되나요?", a: "아니요. 무늬(리피트) 맞춤이 필요한 원단은 폭마다 리피트 길이만큼 추가로 필요합니다. 제작처에 리피트 값을 확인하세요." },
  ],
  note: PRACTICE_NOTE,
  related: [{ path: "paint/", ic: "🎨", n: "페인트 양 계산기" }, { path: "furniture-fit/", ic: "🛋️", n: "가구 배치 시뮬레이터" }, TEC.pyeong, TEC.isagak],
  script: `import { curtainCalc } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
$("calcBtn").addEventListener("click", () => {
  const windowWcm = parseFloat($("winW").value);
  const lengthCm = parseFloat($("len").value);
  const fullness = parseFloat($("full").value);
  const fabricWcm = parseFloat($("fabW").value);
  const sideAllowCm = parseFloat($("side").value) || 0;
  const hemAllowCm = parseFloat($("hem").value) || 0;
  if (!isFinite(windowWcm) || windowWcm <= 0 || !isFinite(lengthCm) || lengthCm <= 0) { hcToast("창 폭과 커튼 길이를 입력하세요"); return; }
  const r = curtainCalc({ windowWcm, fullness, fabricWcm, sideAllowCm, lengthCm, hemAllowCm });
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "원단 <span>" + r.panels + "폭</span> · 총 <span>" + hcFmt(r.totalFabricM, 2) + "m</span>";
  $("resSub").textContent = "필요 총 폭 " + hcFmt(r.neededWidth, 0) + "cm (창 " + windowWcm + "cm × " + fullness + "배 + 좌우 " + sideAllowCm + "cm×2) ÷ 원단 폭 " + fabricWcm + "cm · 재단 길이 " + hcFmt(r.cutLengthCm, 0) + "cm(시접 포함) × " + r.panels + "폭";
  $("resFormula").textContent = "폭 수 = 올림( (창 폭 × 주름 배수 + 좌우 여유×2) ÷ 원단 폭 ) · 총 원단 = 폭 수 × (커튼 길이 + 상하 시접)";
  $("srcLine").innerHTML = "주름 배수·시접: 커튼 업계 일반 관행(참고용) · 확인일 ${CURTAIN_DEFAULTS.checkedAt} <span class=\\"badge practice\\">관행값</span>";
  hcShowResultAd();
});`,
},

/* 7. 가구 배치 시뮬레이터 --------------------------------------- */
{
  slug: "furniture-fit", emoji: "🛋️", nav: "가구 배치 시뮬레이터", wide: true,
  hubName: "가구 배치 시뮬레이터", hubDesc: "방 치수에 가구를 드래그로 배치, 이미지 저장·링크 공유",
  title: "가구 배치 시뮬레이터 — 방 치수에 가구 드래그 배치 | 홈캘크",
  ogTitle: "가구 배치 시뮬레이터 (모바일 터치 지원)",
  desc: "방 가로·세로(cm)를 넣고 침대·소파·책상 등 가구를 손가락이나 마우스로 끌어 배치해 보세요. 겹침·벽 넘침을 자동 판정하고 배치도를 PNG로 저장하거나 링크로 공유할 수 있습니다.",
  h1: "가구 배치 시뮬레이터",
  lead: "방 치수에 가구를 <strong>드래그</strong>해 배치해 보세요. 모바일 터치도 지원하며, 배치도를 이미지로 저장하거나 링크로 공유할 수 있습니다.",
  body: `  <div class="card">
    <h2>방 크기와 가구</h2>
    <div class="grid2">
      <label class="f">방 가로 (cm)
        <input type="number" id="roomW" inputmode="numeric" step="1" min="50" value="400" />
      </label>
      <label class="f">방 세로 (cm)
        <input type="number" id="roomH" inputmode="numeric" step="1" min="50" value="300" />
      </label>
      <label class="f">가구 프리셋 <span class="hint">— 치수는 추가 후 수정 가능</span>
        <select id="preset"></select>
      </label>
      <label class="f">가구 이름 <span class="hint">— 직접 입력 시 사용</span>
        <input type="text" id="customName" maxlength="12" placeholder="예: 피아노" />
      </label>
    </div>
    <div class="chips">
      <button class="chip" type="button" id="addBtn">＋ 가구 추가</button>
      <button class="chip" type="button" id="rotBtn">↻ 선택 회전</button>
      <button class="chip" type="button" id="delBtn">🗑 선택 삭제</button>
      <button class="chip" type="button" id="clrBtn">전체 지우기</button>
      <button class="chip" type="button" id="roomBtn">방 크기 적용</button>
    </div>
    <canvas class="canvas-box" id="cv" width="720" height="540" role="img" aria-label="방 평면도 — 가구를 끌어 배치합니다"></canvas>
    <p class="sub" id="hint">가구를 손가락이나 마우스로 끌어 옮기세요. 벽 밖으로는 나가지 않고, 서로 겹치면 빨간 테두리로 표시됩니다.</p>
    <div class="grid2" id="selBox" hidden>
      <label class="f">선택 가구 가로 (cm)
        <input type="number" id="selW" inputmode="numeric" step="1" min="5" />
      </label>
      <label class="f">선택 가구 세로 (cm)
        <input type="number" id="selH" inputmode="numeric" step="1" min="5" />
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">배치 요약 · 저장 / 공유</button>
${RESULT(`      <p class="big" id="resMain">—</p>
      <p class="sub" id="resSub"></p>
      <div class="formula" id="resFormula"></div>
      <div class="chips">
        <button class="chip" type="button" id="pngBtn">🖼 배치도 PNG 저장</button>
        <button class="chip" type="button" id="linkBtn">🔗 배치 링크 복사</button>
      </div>
      <p class="src" id="srcLine"></p>`)}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>이사 전 가장 궁금한 것은 "지금 쓰는 침대와 소파가 새 방에 들어갈까"입니다. 이 시뮬레이터는 방 가로·세로(cm)를 격자 평면도로 그리고, 가구를 실제 치수 비율로 올려 드래그 배치해 볼 수 있게 해 줍니다. 가구가 벽을 넘어가면 자동으로 벽 안쪽에 붙고, 가구끼리 겹치면 빨간 테두리로 알려 줍니다.</p>
    <p>프리셋 치수는 국내 유통 <strong>일반 치수(참고용)</strong>입니다. 실제 제품의 가로·세로를 재서 선택 후 직접 수정하면 정확도가 올라갑니다. 문이 열리는 반경, 서랍을 빼는 공간, 통로 폭(성인 통행 약 60cm 이상)도 함께 고려하세요.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>방 가로·세로를 cm로 입력하고 <strong>방 크기 적용</strong>을 누릅니다. (예: 3.6m × 3.0m → 360 × 300)</li>
      <li>프리셋에서 가구를 고르고 <strong>가구 추가</strong>. 추가된 가구를 드래그해 원하는 자리에 놓습니다.</li>
      <li>가구를 탭/클릭해 선택한 뒤 가로·세로를 실제 제품 치수로 수정하거나, 회전 버튼으로 90° 돌립니다.</li>
      <li><strong>배치 요약</strong>을 누르면 점유 면적·겹침 여부가 나오고, 배치도를 PNG로 저장하거나 링크를 복사해 공유할 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "휴대폰에서도 되나요?", a: "네. 터치 드래그를 지원합니다. 가구를 손가락으로 눌러 끌면 이동하고, 화면 밖으로는 나가지 않습니다." },
    { q: "배치를 저장할 수 있나요?", a: "배치 상태는 주소창 링크(#p=…)에 담깁니다. 링크 복사 버튼으로 주소를 복사해 두면 나중에 같은 배치를 그대로 열 수 있고, 가족에게 공유할 수도 있습니다. 서버에는 아무것도 저장되지 않습니다." },
    { q: "가구가 겹치면 어떻게 되나요?", a: "겹친 가구는 빨간 테두리로 표시되고 요약에 겹침 개수가 나옵니다. 맞닿기만 한 상태(간격 0)는 겹침으로 보지 않습니다." },
    { q: "통로는 얼마나 남겨야 하나요?", a: "성인 한 명이 지나가려면 약 60cm, 두 명이 교차하려면 90~110cm 정도를 확보하는 것이 일반적입니다. 서랍·문 여는 공간도 별도로 필요합니다." },
  ],
  note: `<p class="note">프리셋 치수는 국내 유통 일반 치수(참고용)이며 제품마다 다릅니다. 실제 가구의 가로·세로·높이를 재서 입력하세요. 천장 높이·문틀 폭 때문에 평면상 들어가도 반입이 어려울 수 있습니다.</p>`,
  related: [{ path: "pyeong/", ic: "📐", n: "평수 계산기" }, { path: "moving-check/", ic: "✅", n: "이사 체크리스트" }, TEC.isagak, TEC.pyeongPlus],
  script: `import { clampToRoom, rotateRect, anyCollision, m2ToPyeong } from "__U__lib/calc.mjs";
const PRESETS = ${J(FURNITURE_PRESETS.value)};
const $ = (id) => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");
let room = { w: 400, h: 300 };
let items = [];
let sel = -1, drag = null, scale = 1;

const enc = (s) => btoa(String.fromCharCode.apply(null, Array.from(new TextEncoder().encode(s))));
const dec = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

const psel = $("preset");
PRESETS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.name + " (" + p.w + "×" + p.h + ")"; psel.appendChild(o); });

function fitCanvas() {
  const box = cv.parentElement;
  const cs = getComputedStyle(box);
  const avail = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const cssW = Math.max(240, Math.min(avail, 860));
  const cssH = Math.max(160, Math.round(cssW * room.h / room.w));
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = cssW + "px";
  cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = cssW / room.w;
  draw();
}
function css(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function paint(c, W, H, s, withMark) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = css("--panel3", "#111");
  c.fillRect(0, 0, W, H);
  c.strokeStyle = css("--line2", "#2a2a2a");
  c.lineWidth = 1;
  for (let x = 0; x <= room.w; x += 50) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, H); c.stroke(); }
  for (let y = 0; y <= room.h; y += 50) { c.beginPath(); c.moveTo(0, y * s); c.lineTo(W, y * s); c.stroke(); }
  c.strokeStyle = css("--acc2", "#10b981");
  c.lineWidth = 2;
  c.strokeRect(1, 1, W - 2, H - 2);
  items.forEach((it, i) => {
    const bad = anyCollision(items, i);
    c.fillStyle = it.color;
    c.globalAlpha = 0.85;
    c.fillRect(it.x * s, it.y * s, it.w * s, it.h * s);
    c.globalAlpha = 1;
    c.lineWidth = i === sel ? 3 : 2;
    c.strokeStyle = bad ? "#f87171" : (i === sel ? "#ffffff" : "rgba(0,0,0,.45)");
    c.strokeRect(it.x * s, it.y * s, it.w * s, it.h * s);
    c.fillStyle = "#10241d";
    c.font = "600 11px -apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
    c.fillText(it.name, it.x * s + 5, it.y * s + 14);
    c.fillText(it.w + "×" + it.h, it.x * s + 5, it.y * s + 27);
  });
  c.fillStyle = css("--muted", "#6b7280");
  c.font = "11px -apple-system,'Noto Sans KR',sans-serif";
  c.fillText("가로 " + room.w + "cm × 세로 " + room.h + "cm · 격자 50cm", 6, H - 8);
  if (withMark) {
    const mark = ${J(SITE_ORIGIN.replace("https://", "") + "/furniture-fit")};
    c.fillStyle = "rgba(120,140,160,.9)";
    c.font = "13px -apple-system,'Noto Sans KR',sans-serif";
    c.fillText(mark, Math.max(6, W - c.measureText(mark).width - 8), 20);
  }
}
function draw() {
  paint(ctx, parseFloat(cv.style.width), parseFloat(cv.style.height), scale, false);
}
function toCm(clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const s = r.width > 0 ? r.width / room.w : scale;
  return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
}
function pickAt(x, y) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return i;
  }
  return -1;
}
function syncSel() {
  if (sel < 0) { $("selBox").hidden = true; return; }
  $("selBox").hidden = false;
  $("selW").value = items[sel].w;
  $("selH").value = items[sel].h;
}
function startAt(x, y) {
  const i = pickAt(x, y);
  sel = i;
  drag = i >= 0 ? { dx: x - items[i].x, dy: y - items[i].y } : null;
  syncSel(); draw();
}
function moveAt(x, y) {
  if (sel < 0 || !drag) return;
  const it = items[sel];
  const moved = clampToRoom({ x: x - drag.dx, y: y - drag.dy, w: it.w, h: it.h }, room);
  it.x = Math.round(moved.x); it.y = Math.round(moved.y);
  draw();
}
function endAt() { if (drag) { drag = null; saveHash(); } }

cv.addEventListener("mousedown", (e) => { const p = toCm(e.clientX, e.clientY); startAt(p.x, p.y); });
window.addEventListener("mousemove", (e) => { if (drag) { const p = toCm(e.clientX, e.clientY); moveAt(p.x, p.y); } });
window.addEventListener("mouseup", endAt);
cv.addEventListener("touchstart", (e) => {
  const t = e.touches[0]; if (!t) return;
  const p = toCm(t.clientX, t.clientY);
  startAt(p.x, p.y);
  if (sel >= 0) e.preventDefault();
}, { passive: false });
cv.addEventListener("touchmove", (e) => {
  const t = e.touches[0]; if (!t || !drag) return;
  const p = toCm(t.clientX, t.clientY);
  moveAt(p.x, p.y);
  e.preventDefault();
}, { passive: false });
cv.addEventListener("touchend", (e) => { endAt(); }, { passive: false });
cv.addEventListener("touchcancel", endAt, { passive: false });

$("addBtn").addEventListener("click", () => {
  const p = PRESETS[+psel.value];
  const nm = ($("customName").value || "").trim() || p.name;
  const it = { name: nm.slice(0, 12), x: 0, y: 0, w: p.w, h: p.h, color: p.color };
  const step = 20;
  for (let k = 0; k < 400; k++) {
    it.x = (k * step) % Math.max(1, room.w - it.w + step);
    it.y = Math.floor((k * step) / Math.max(1, room.w - it.w + step)) * step;
    const c = clampToRoom(it, room);
    it.x = c.x; it.y = c.y;
    items.push(it);
    if (!anyCollision(items, items.length - 1)) { items.pop(); break; }
    items.pop();
  }
  items.push(it);
  sel = items.length - 1;
  syncSel(); draw(); saveHash();
});
$("rotBtn").addEventListener("click", () => {
  if (sel < 0) { hcToast("먼저 가구를 선택하세요"); return; }
  const r = clampToRoom(rotateRect(items[sel]), room);
  items[sel] = r;
  syncSel(); draw(); saveHash();
});
$("delBtn").addEventListener("click", () => {
  if (sel < 0) { hcToast("먼저 가구를 선택하세요"); return; }
  items.splice(sel, 1); sel = -1; syncSel(); draw(); saveHash();
});
$("clrBtn").addEventListener("click", () => { items = []; sel = -1; syncSel(); draw(); saveHash(); });
$("roomBtn").addEventListener("click", () => {
  const w = parseInt($("roomW").value, 10), h = parseInt($("roomH").value, 10);
  if (!(w > 50) || !(h > 50)) { hcToast("방 크기를 cm 단위로 입력하세요 (예: 400)"); return; }
  room = { w: w, h: h };
  items = items.map((it) => clampToRoom(it, room));
  fitCanvas(); saveHash();
});
function onSize() {
  if (sel < 0) return;
  const w = parseInt($("selW").value, 10), h = parseInt($("selH").value, 10);
  if (w > 0) items[sel].w = w;
  if (h > 0) items[sel].h = h;
  items[sel] = clampToRoom(items[sel], room);
  draw(); saveHash();
}
$("selW").addEventListener("change", onSize);
$("selH").addEventListener("change", onSize);

function saveHash() {
  const s = { r: [room.w, room.h], i: items.map((it) => [it.name, Math.round(it.x), Math.round(it.y), it.w, it.h, it.color]) };
  try { history.replaceState(null, "", "#p=" + enc(JSON.stringify(s))); } catch (e) {}
}
function loadHash() {
  const m = (location.hash || "").match(/#p=(.+)$/);
  if (!m) return false;
  try {
    const s = JSON.parse(dec(m[1]));
    room = { w: s.r[0], h: s.r[1] };
    items = (s.i || []).map((a) => ({ name: a[0], x: a[1], y: a[2], w: a[3], h: a[4], color: a[5] }));
    $("roomW").value = room.w; $("roomH").value = room.h;
    return true;
  } catch (e) { return false; }
}
$("calcBtn").addEventListener("click", () => {
  const roomM2 = room.w * room.h / 10000;
  const useM2 = items.reduce((s, it) => s + it.w * it.h, 0) / 10000;
  let over = 0;
  items.forEach((it, i) => { if (anyCollision(items, i)) over++; });
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "방 <span>" + hcFmt(roomM2, 2) + "㎡</span> <small>(" + hcFmt(m2ToPyeong(roomM2), 1) + "평) · 가구 점유 " + hcFmt(roomM2 ? useM2 / roomM2 * 100 : 0, 0) + "%</small>";
  $("resSub").textContent = "가구 " + items.length + "개 · 점유 면적 " + hcFmt(useM2, 2) + "㎡ · 남는 바닥 " + hcFmt(Math.max(0, roomM2 - useM2), 2) + "㎡"
    + (over ? " · ⚠ 겹치는 가구 " + over + "개" : " · 겹침 없음");
  $("resFormula").textContent = items.length
    ? items.map((it) => it.name + " " + it.w + "×" + it.h + "cm @(" + Math.round(it.x) + "," + Math.round(it.y) + ")").join(" / ")
    : "가구를 추가하면 목록이 표시됩니다.";
  $("srcLine").innerHTML = "프리셋 치수: 국내 유통 일반 치수(참고용, 실제 제품 제원 확인) · 확인일 ${FURNITURE_PRESETS.checkedAt} <span class=\\"badge practice\\">관행값</span> · 배치는 링크(#p=)에만 담기며 서버 저장 없음";
  hcShowResultAd();
});
$("pngBtn").addEventListener("click", () => {
  const s2 = Math.min(3, Math.max(1, 1200 / room.w));
  const off = document.createElement("canvas");
  off.width = Math.round(room.w * s2);
  off.height = Math.round(room.h * s2);
  const c2 = off.getContext("2d");
  paint(c2, off.width, off.height, s2, true);
  const a = document.createElement("a");
  a.download = "homecalc-room-layout.png";
  a.href = off.toDataURL("image/png");
  document.body.appendChild(a); a.click(); a.remove();
  hcToast("배치도 이미지를 저장했습니다");
});
$("linkBtn").addEventListener("click", () => {
  saveHash();
  const url = location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => hcToast("배치 링크를 복사했습니다"), () => hcToast("복사 실패 — 주소창을 직접 복사하세요"));
  } else { hcToast("주소창의 링크를 복사해 공유하세요"); }
});
window.addEventListener("resize", fitCanvas);
if (!loadHash()) {
  const bed = PRESETS.find((p) => p.id === "bed-q");
  items.push({ name: bed.name, x: 0, y: 0, w: bed.w, h: bed.h, color: bed.color });
}
fitCanvas();
syncSel();`,
},

/* 8. 이사 체크리스트 -------------------------------------------- */
{
  slug: "moving-check", emoji: "✅", nav: "이사 체크리스트",
  hubName: "이사 체크리스트", hubDesc: "D-30부터 이사 후 전입신고까지, 체크 상태 저장",
  title: "이사 체크리스트 — D-30부터 전입신고까지 단계별 | 홈캘크",
  ogTitle: "이사 체크리스트 (D-30 ~ 이사 후)",
  desc: "이사 D-30, D-14, D-7, D-1, 당일, 이사 후 14일까지 해야 할 일을 단계별로 정리한 체크리스트입니다. 체크 상태는 이 브라우저에만 저장되며 전입신고·확정일자 등 공식 안내 링크를 함께 제공합니다.",
  h1: "이사 체크리스트",
  lead: "D-30부터 이사 후 전입신고까지 <strong>단계별 할 일</strong>을 체크하며 준비하세요. 체크 상태는 이 브라우저에만 저장됩니다.",
  body: `  <div class="card">
    <h2>준비 진행 상황</h2>
    <div class="prog" aria-hidden="true"><i id="progBar"></i></div>
    <p class="sub" id="progTxt">0 / 0 완료</p>
    <div id="list"></div>
    <div class="chips">
      <button class="chip" type="button" id="resetBtn">↺ 체크 초기화</button>
      <button class="chip" type="button" id="sumBtn">📋 진행 요약 보기</button>
    </div>
${RESULT(`      <p class="big" id="resMain">—</p>
      <p class="sub" id="resSub"></p>
      <div class="formula" id="resFormula"></div>
      <p class="src" id="srcLine"></p>`)}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>이사는 날짜가 정해지는 순간부터 할 일이 쏟아집니다. 이 체크리스트는 D-30(업체 비교·퇴거 통보)부터 이사 당일 계량기 검침, 이사 후 14일 이내 전입신고까지 순서대로 정리했습니다. 항목을 누르면 완료 처리되고 진행률이 표시됩니다.</p>
    <p class="note">✅ 체크 상태는 <strong>이 브라우저의 localStorage</strong>에만 저장됩니다. 서버로 전송하거나 계정에 저장하지 않으므로, 브라우저 데이터를 지우거나 다른 기기에서 열면 초기화됩니다.</p>
    <h2>공식 절차 안내 링크</h2>
    <ul>
${GOV_LINKS.value.map((g) => `      <li><a href="${g.url}" rel="noopener">${esc(g.name)}</a> — ${esc(g.org)}</li>`).join("\n")}
    </ul>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>이사 일정이 정해지면 D-30 단계부터 위에서 아래로 확인합니다.</li>
      <li>완료한 항목을 탭하면 체크되고 진행률 막대가 올라갑니다.</li>
      <li>다음 이사 때는 <strong>체크 초기화</strong>로 전부 되돌릴 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "체크한 내용이 다른 기기에서도 보이나요?", a: "아니요. 서버 저장이 없어 이 브라우저에만 남습니다. 시크릿 모드나 다른 기기에서는 새로 시작됩니다." },
    { q: "전입신고는 언제까지 해야 하나요?", a: "주민등록법상 전입한 날부터 14일 이내에 신고해야 합니다. 정부24에서 온라인으로도 가능합니다." },
    { q: "확정일자는 왜 받아야 하나요?", a: "임차인이 보증금 우선변제권을 확보하려면 전입신고와 함께 확정일자를 받아 두는 것이 안전합니다. 자세한 요건은 법령·전문가 상담으로 확인하세요." },
    { q: "장기수선충당금은 무엇인가요?", a: "아파트 관리비에 포함되어 임차인이 납부했지만 원칙적으로 소유자 부담인 항목으로, 퇴거 시 정산·반환을 요청하는 것이 일반적입니다. 계약 조건에 따라 다를 수 있습니다." },
  ],
  note: `<p class="note">체크리스트 항목은 일반적인 이사 준비 관행을 정리한 <strong>참고 자료</strong>입니다. 전입신고·확정일자 등 법정 절차의 요건과 기한은 위 공식 링크에서 확인하세요.</p>`,
  related: [{ path: "moving-cost/", ic: "🚚", n: "이사 견적 항목 계산기" }, { path: "furniture-fit/", ic: "🛋️", n: "가구 배치 시뮬레이터" }, TEC.isagak, TEC.moving],
  script: `const DATA = ${J(CHECKLIST.value)};
const KEY = "hc-moving-check";
const $ = (id) => document.getElementById(id);
let done = {};
try { done = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { done = {}; }
const total = DATA.reduce((s, p) => s + p.items.length, 0);
const list = $("list");
DATA.forEach((ph, pi) => {
  const wrap = document.createElement("div");
  wrap.className = "chk-phase";
  const h = document.createElement("h3");
  h.textContent = ph.phase;
  wrap.appendChild(h);
  ph.items.forEach((text, ii) => {
    const id = pi + "-" + ii;
    const lab = document.createElement("label");
    lab.className = "chk" + (done[id] ? " done" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!done[id];
    cb.addEventListener("change", () => {
      if (cb.checked) done[id] = 1; else delete done[id];
      lab.classList.toggle("done", cb.checked);
      try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
      render();
      summary();
    });
    const sp = document.createElement("span");
    sp.textContent = text;
    lab.appendChild(cb); lab.appendChild(sp);
    wrap.appendChild(lab);
  });
  list.appendChild(wrap);
});
function count() { return Object.keys(done).length; }
function render() {
  const c = count();
  $("progBar").style.width = (total ? c / total * 100 : 0) + "%";
  $("progTxt").textContent = c + " / " + total + " 완료 (" + Math.round(total ? c / total * 100 : 0) + "%)";
}
function summary() {
  const c = count();
  if (!c) return;
  $("resultBox").hidden = false;
  const remain = DATA.map((ph, pi) => {
    const left = ph.items.filter((_, ii) => !done[pi + "-" + ii]).length;
    return left ? ph.phase + " " + left + "건" : null;
  }).filter(Boolean);
  $("resMain").innerHTML = "진행률 <span>" + Math.round(c / total * 100) + "%</span> <small>(" + c + "/" + total + ")</small>";
  $("resSub").textContent = remain.length ? "남은 항목: " + remain.join(" · ") : "모든 항목을 완료했습니다. 이사 준비 끝!";
  $("resFormula").textContent = "체크 상태는 이 브라우저(localStorage)에만 저장되며 서버로 전송·저장하지 않습니다.";
  $("srcLine").innerHTML = "절차 항목의 근거는 위 공식 링크(정부24·우체국·인터넷등기소 등) 참조 · 확인일 ${CHECKLIST.checkedAt}";
  hcShowResultAd();
}
$("resetBtn").addEventListener("click", () => {
  done = {};
  try { localStorage.removeItem(KEY); } catch (e) {}
  list.querySelectorAll("input[type=checkbox]").forEach((cb) => { cb.checked = false; cb.parentElement.classList.remove("done"); });
  render();
  $("resultBox").hidden = true;
  hcToast("체크를 모두 초기화했습니다");
});
$("sumBtn").addEventListener("click", () => {
  if (!count()) { hcToast("완료한 항목을 먼저 체크하세요"); return; }
  summary();
});
render();
if (count()) summary();`,
},

/* 9. 이사 견적 항목 --------------------------------------------- */
{
  slug: "moving-cost", emoji: "🚚", nav: "이사 견적 항목 계산기",
  hubName: "이사 견적 항목 계산기", hubDesc: "짐 양·거리·층수·사다리차 → 항목별 참고 범위",
  title: "이사 비용 항목 계산기 — 톤수·거리·사다리차 참고 범위 | 홈캘크",
  ogTitle: "이사 비용 항목별 참고 범위 계산기",
  desc: "짐 양(톤), 포장이사 여부, 이사 거리, 사다리차, 엘리베이터 없는 층수, 에어컨 이전설치를 넣으면 항목별 비용 참고 범위를 더해 총 예상 범위를 보여줍니다. 업체 견적이 아닌 참고용입니다.",
  h1: "이사 견적 항목 계산기",
  lead: "짐 양·거리·층수·사다리차 등 <strong>항목별 시장 관행 범위</strong>를 더해 예상 구간을 보여줍니다. 업체 견적이 아닙니다.",
  body: `  <div class="card">
    <h2>이사 조건 입력</h2>
    <div class="grid2">
      <label class="f">짐 양 (차량 톤수)
        <select id="ton"></select>
      </label>
      <label class="f">이사 유형
        <select id="pack"><option value="0">일반이사(반포장)</option><option value="1" selected>포장이사</option></select>
      </label>
      <label class="f">이사 거리 (km) <span class="hint">— 30km 초과분 할증</span>
        <input type="number" id="dist" inputmode="decimal" step="any" min="0" value="15" />
      </label>
      <label class="f">사다리차 사용 개소 <span class="hint">— 출발/도착</span>
        <select id="ladder"><option value="0">사용 안 함</option><option value="1">1곳</option><option value="2">2곳(양쪽)</option></select>
      </label>
      <label class="f">엘리베이터 없는 층수 합계
        <input type="number" id="floors" inputmode="numeric" step="1" min="0" value="0" />
      </label>
      <label class="f">에어컨 이전설치
        <select id="ac"><option value="0">없음</option><option value="1">1대 (배관 추가비 별도)</option></select>
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">예상 범위 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>이사 요금은 <strong>자율 요금제</strong>라 공식 요금표가 없습니다. 같은 조건이어도 날짜(손 없는 날·월말·주말), 지역, 업체에 따라 크게 달라집니다. 이 계산기는 시장에서 통용되는 항목별 범위를 더해 "대략 이 정도 구간"을 잡아 주는 용도입니다.</p>
    <p class="note warn">⚠ 여기서 나온 금액은 <strong>업체 견적이 아니며</strong> 어떤 업체의 가격도 대표하지 않습니다. 실제 계약은 반드시 방문 견적을 3곳 이상 받아 비교하고, 분쟁 예방을 위해 <a href="${COST_ITEMS.standardTerms}" rel="noopener">공정거래위원회 이사화물 표준약관</a>을 확인하세요.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>짐 양을 차량 톤수로 고릅니다. (원룸 1톤, 투룸 2.5톤, 30평대 5~7.5톤이 일반적인 감)</li>
      <li>포장이사 여부, 이사 거리, 사다리차 사용 개소, 엘리베이터 없는 층수를 입력합니다.</li>
      <li>계산하면 항목별 최소~최대 범위와 합계 구간이 표시됩니다.</li>
    </ol>`,
  faq: [
    { q: "왜 금액이 범위로 나오나요?", a: "이사 요금에는 공식 고시가 없고 날짜·지역·업체별 편차가 크기 때문입니다. 단일 금액을 제시하면 오히려 오해를 줄 수 있어 범위로 표시합니다." },
    { q: "포장이사와 반포장의 차이는?", a: "포장이사는 짐 싸기부터 정리까지 업체가 하고, 반포장은 포장 일부를 직접 합니다. 포장이사는 통상 일반이사의 1.3~1.6배 수준으로 알려져 있습니다." },
    { q: "사다리차는 언제 필요한가요?", a: "엘리베이터가 없거나 짐이 들어가지 않는 경우 필요합니다. 출발지와 도착지 양쪽에 필요할 수 있어 개소로 계산합니다." },
    { q: "이 금액으로 계약해도 되나요?", a: "안 됩니다. 참고용 범위이며 실제 계약은 방문 견적 후 서면(표준약관 기준)으로 진행하세요. 파손 보상 조건도 계약서에서 확인해야 합니다." },
  ],
  note: `<p class="note warn">본 결과는 시장 관행 범위를 더한 <strong>참고용 추정</strong>이며 <strong>업체 견적이 아닙니다</strong>. 공식 요금표가 존재하지 않는 항목이므로 <span class="badge todo">확인 필요</span> 표시와 함께 제공합니다.</p>`,
  related: [{ path: "moving-check/", ic: "✅", n: "이사 체크리스트" }, { path: "furniture-fit/", ic: "🛋️", n: "가구 배치 시뮬레이터" }, TEC.moving, TEC.isagak],
  script: `import { movingCostEstimate } from "__U__lib/calc.mjs";
const C = ${J(COST_ITEMS.value)};
const $ = (id) => document.getElementById(id);
const tsel = $("ton");
C.baseByTon.forEach((b, i) => { const o = document.createElement("option"); o.value = i; o.textContent = b.label; tsel.appendChild(o); });
tsel.value = 2;
$("calcBtn").addEventListener("click", () => {
  const b = C.baseByTon[+tsel.value];
  const distanceKm = parseFloat($("dist").value) || 0;
  const ladderSides = parseInt($("ladder").value, 10) || 0;
  const noElevFloors = parseInt($("floors").value, 10) || 0;
  const packing = $("pack").value === "1";
  const acMove = $("ac").value === "1";
  const r = movingCostEstimate({
    base: b.range, packing: packing, packingMult: C.packingMultiplier,
    distanceKm: distanceKm, perKmOver30: C.distancePerKmOver30,
    ladderSides: ladderSides, ladderPer: C.ladderPerSide,
    noElevFloors: noElevFloors, perFloor: C.noElevatorPerFloor,
    acMove: acMove, acRange: C.acMove
  });
  const rows = [];
  const money = (a, z) => hcFmt(a) + "~" + hcFmt(z) + "원";
  rows.push((packing ? "포장이사 기본(" : "일반이사 기본(") + b.label + "): " + money(Math.round(packing ? b.range[0] * C.packingMultiplier[0] : b.range[0]), Math.round(packing ? b.range[1] * C.packingMultiplier[1] : b.range[1])));
  const over = Math.max(0, distanceKm - 30);
  if (over > 0) rows.push("장거리 할증(30km 초과 " + hcFmt(over, 1) + "km): " + money(Math.round(over * C.distancePerKmOver30[0]), Math.round(over * C.distancePerKmOver30[1])));
  if (ladderSides) rows.push("사다리차 " + ladderSides + "곳: " + money(ladderSides * C.ladderPerSide[0], ladderSides * C.ladderPerSide[1]));
  if (noElevFloors) rows.push("엘리베이터 없음 " + noElevFloors + "층: " + money(noElevFloors * C.noElevatorPerFloor[0], noElevFloors * C.noElevatorPerFloor[1]));
  if (acMove) rows.push("에어컨 이전설치: " + money(C.acMove[0], C.acMove[1]));
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "예상 <span>" + hcFmt(r.min) + " ~ " + hcFmt(r.max) + "원</span>";
  $("resSub").textContent = "업체 견적이 아니라 시장 관행 범위의 합계입니다. 날짜(손 없는 날·월말)와 지역에 따라 이 범위를 벗어날 수 있습니다.";
  $("resFormula").textContent = rows.join(" / ");
  $("srcLine").innerHTML = "항목별 범위: 시장 관행 참고치(공식 요금표 없음) <span class=\\"badge todo\\">확인 필요</span> · 분쟁 예방: <a href=\\"${COST_ITEMS.standardTerms}\\" rel=\\"noopener\\">공정거래위원회 이사화물 표준약관</a> · 확인일 ${COST_ITEMS.checkedAt}";
  hcShowResultAd();
});`,
},

/* 10. 조명 밝기 ------------------------------------------------- */
{
  slug: "lighting", emoji: "💡", nav: "조명 밝기 계산기",
  hubName: "조명 밝기 계산기", hubDesc: "방 용도별 권장 조도 → 필요 루멘·전구 개수",
  title: "조명 밝기(루멘) 계산기 — 방 크기·용도별 필요 lm | 홈캘크",
  ogTitle: "조명 밝기(루멘) 계산기",
  desc: "방 면적과 용도별 권장 조도(lx)로 필요한 총 광속(루멘)과 전구 개수를 광속법으로 계산합니다. 조명률·보수율 조정 가능, LED 방등·거실등 프리셋 제공.",
  h1: "조명 밝기 계산기",
  lead: "방 면적 × 권장 조도(lx)를 <strong>광속법</strong>으로 환산해 필요한 루멘(lm)과 전구 개수를 계산합니다.",
  body: `  <div class="card">
    <h2>공간 조건 입력</h2>
    <div class="grid2">
      <label class="f">면적
        <input type="number" id="area" inputmode="decimal" step="any" min="0" value="20" />
      </label>
      <label class="f">면적 단위
        <select id="unit"><option value="m2">㎡ (제곱미터)</option><option value="py">평</option></select>
      </label>
      <label class="f">공간 용도
        <select id="room"></select>
      </label>
      <label class="f">목표 조도 (lx) <span class="hint">— 직접 조정 가능</span>
        <input type="number" id="lux" inputmode="decimal" step="any" min="1" value="200" />
      </label>
      <label class="f">조명률 <span class="hint">— 0.5~0.7</span>
        <input type="number" id="util" inputmode="decimal" step="0.05" min="0.1" max="1" value="${UTILIZATION_DEFAULT.value.utilization}" />
      </label>
      <label class="f">보수율 <span class="hint">— 0.7~0.8</span>
        <input type="number" id="maint" inputmode="decimal" step="0.05" min="0.1" max="1" value="${UTILIZATION_DEFAULT.value.maintenance}" />
      </label>
      <label class="f">조명 기구 프리셋
        <select id="bulb"></select>
      </label>
      <label class="f">기구 1개 광속 (lm) <span class="hint">— 제품 표기 우선</span>
        <input type="number" id="lm" inputmode="decimal" step="any" min="1" value="4500" />
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">필요 밝기 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>조명은 와트(W)가 아니라 <strong>루멘(lm)</strong>으로 밝기를 봅니다. LED 시대에는 같은 10W라도 광속이 크게 다르기 때문입니다. 이 계산기는 조명 설계에서 쓰는 광속법(필요 광속 = 조도 × 면적 ÷ (조명률 × 보수율))으로 방 전체에 필요한 총 루멘과 기구 개수를 계산합니다.</p>
    <p>조명률은 기구 종류와 천장·벽 반사율에 따른 손실을, 보수율은 시간이 지나며 먼지·감광으로 밝기가 떨어지는 것을 보정하는 계수입니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>면적을 ㎡ 또는 평으로 입력합니다.</li>
      <li>공간 용도를 고르면 권장 조도 범위의 중간값이 자동으로 채워집니다. 밝게 쓰고 싶으면 값을 올리세요.</li>
      <li>기구 프리셋을 고르거나 제품에 적힌 광속(lm)을 입력하면 필요한 개수가 나옵니다.</li>
    </ol>`,
  faq: [
    { q: "권장 조도는 어디 기준인가요?", a: "KS A 3011(조도 기준)에서 통용되는 범위를 참고했습니다. 표준 원문은 유료 열람이라 이 사이트의 값은 통용 인용값이며 확인 필요 표시를 함께 둡니다." },
    { q: "거실등 하나로 충분한가요?", a: "면적이 넓으면 하나로는 균일도가 떨어집니다. 총 루멘을 맞추더라도 다운라이트·간접조명으로 나누어 배치하는 편이 눈이 편합니다." },
    { q: "책상 조명도 이걸로 계산하나요?", a: "책상면 조도(600~1000lx)는 방 전체 조명이 아니라 스탠드로 보강하는 것이 일반적입니다. 전반 조명은 200~300lx로 두고 국부 조명을 더하세요." },
    { q: "조명률·보수율을 모르면?", a: "일반 가정은 조명률 0.6, 보수율 0.8 정도로 두면 무난합니다. 천장이 어둡거나 높으면 조명률을 낮춰 잡으세요." },
  ],
  note: `<p class="note">권장 조도는 KS A 3011의 통용 인용값이며 원문 대조 확인이 필요한 항목입니다 <span class="badge todo">확인 필요</span>. 조명률·보수율은 설계 관행값(참고용)입니다.</p>`,
  related: [{ path: "pyeong/", ic: "📐", n: "평수 계산기" }, { path: "ac-size/", ic: "❄️", n: "에어컨 평수 계산기" }, TEC.elec, TEC.pyeong],
  script: `import { lightingCalc, pyeongToM2 } from "__U__lib/calc.mjs";
const ROOMS = ${J(ROOM_LUX.value)};
const BULBS = ${J(BULB_PRESETS.value)};
const $ = (id) => document.getElementById(id);
const rsel = $("room"), bsel = $("bulb");
ROOMS.forEach((r, i) => { const o = document.createElement("option"); o.value = i; o.textContent = r.name + " (" + r.lux[0] + "~" + r.lux[1] + "lx)"; rsel.appendChild(o); });
BULBS.forEach((b, i) => { const o = document.createElement("option"); o.value = i; o.textContent = b.name + " · " + b.lm + "lm"; bsel.appendChild(o); });
bsel.value = 2; $("lm").value = BULBS[2].lm;
function syncLux() { const r = ROOMS[+rsel.value]; $("lux").value = Math.round((r.lux[0] + r.lux[1]) / 2); }
rsel.addEventListener("change", syncLux);
bsel.addEventListener("change", () => { $("lm").value = BULBS[+bsel.value].lm; });
syncLux();
$("calcBtn").addEventListener("click", () => {
  const v = parseFloat($("area").value);
  const lux = parseFloat($("lux").value);
  const utilization = parseFloat($("util").value);
  const maintenance = parseFloat($("maint").value);
  const bulbLm = parseFloat($("lm").value);
  if (!isFinite(v) || v <= 0 || !isFinite(lux) || lux <= 0 || !isFinite(bulbLm) || bulbLm <= 0) { hcToast("면적·조도·광속을 입력하세요"); return; }
  if (!(utilization > 0) || !(maintenance > 0)) { hcToast("조명률과 보수율은 0보다 커야 합니다"); return; }
  const areaM2 = $("unit").value === "py" ? pyeongToM2(v) : v;
  const r = lightingCalc({ areaM2, lux, utilization, maintenance, bulbLm });
  const rm = ROOMS[+rsel.value];
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "필요 광속 <span>" + hcFmt(r.lumens) + "lm</span> <small>· 기구 " + r.bulbs + "개</small>";
  $("resSub").textContent = rm.name + " 권장 조도 " + rm.lux[0] + "~" + rm.lux[1] + "lx 중 " + lux + "lx 적용 · 면적 " + hcFmt(areaM2, 2) + "㎡ · 기구 " + hcFmt(bulbLm) + "lm 기준";
  $("resFormula").textContent = "필요 광속 = 조도 " + lux + "lx × 면적 " + hcFmt(areaM2, 2) + "㎡ ÷ (조명률 " + utilization + " × 보수율 " + maintenance + ")";
  $("srcLine").innerHTML = "권장 조도: KS A 3011 통용 인용값 <span class=\\"badge todo\\">확인 필요</span> · 조명률·보수율: 설계 관행값(참고용) · 확인일 ${ROOM_LUX.checkedAt} · <a href=\\"${ROOM_LUX.source}\\" rel=\\"noopener\\">e나라 표준인증</a>";
  hcShowResultAd();
});`,
},

/* 11. 에어컨 평수 ---------------------------------------------- */
{
  slug: "ac-size", emoji: "❄️", nav: "에어컨 평수 계산기",
  hubName: "에어컨 평수 계산기", hubDesc: "평수·층고 → 필요 냉방능력 kW 참고치",
  title: "에어컨 평수 계산기 — 필요 냉방능력(kW·BTU) 참고치 | 홈캘크",
  ogTitle: "에어컨 평수 계산기 — 필요 kW",
  desc: "방 평수와 용도(방·거실·사무실), 층고를 넣으면 필요한 냉방능력(kW)과 BTU 환산값을 참고치로 계산합니다. 제조사 평형 표기와 정격 냉방능력이 우선입니다.",
  h1: "에어컨 평수 계산기",
  lead: "평수 × 평당 냉방능력에 층고 보정을 더해 <strong>필요 냉방능력(kW)</strong>을 참고치로 계산합니다.",
  body: `  <div class="card">
    <h2>공간 조건 입력</h2>
    <div class="grid2">
      <label class="f">면적 (평)
        <input type="number" id="py" inputmode="decimal" step="any" min="0" value="10" />
      </label>
      <label class="f">공간 용도
        <select id="use">
          <option value="home">방·침실 (평당 ${COOLING_PER_PYEONG_KW.value.home}kW)</option>
          <option value="living" selected>거실·주방 겸용 (평당 ${COOLING_PER_PYEONG_KW.value.living}kW)</option>
          <option value="office">사무실·상가 (평당 ${COOLING_PER_PYEONG_KW.value.office}kW)</option>
        </select>
      </label>
      <label class="f">천장 높이 (m) <span class="hint">— 기준 ${CEILING_BASE_M.value}m</span>
        <input type="number" id="ceil" inputmode="decimal" step="0.1" min="1.5" value="${CEILING_BASE_M.value}" />
      </label>
      <label class="f">추가 보정
        <select id="extra">
          <option value="1">없음</option>
          <option value="1.1">햇빛 많음·서향 (+10%)</option>
          <option value="1.15">최상층·단열 취약 (+15%)</option>
          <option value="1.25">서향 + 최상층 (+25%)</option>
        </select>
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">필요 냉방능력 계산</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>에어컨 제품에 적힌 "○○평형"은 제조사가 정한 <strong>권장 사용 면적</strong>이고, 실제 성능 값은 제원표의 <strong>정격 냉방능력(kW)</strong>입니다. 이 계산기는 평수에 평당 필요 냉방능력을 곱하고 층고를 비례 보정해 대략 몇 kW짜리를 봐야 하는지 잡아 줍니다.</p>
    <p>평당 계수는 공적 고시가 아니라 제조사 평형 표기를 역산한 <strong>업계 관행값</strong>입니다. 단열·창 면적·거주 인원·주방 열원에 따라 필요 용량이 달라지므로 여유를 두고 고르세요.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>냉방할 공간의 평수를 입력합니다. (㎡만 안다면 <a href="__U__pyeong/">평수 계산기</a>에서 환산)</li>
      <li>방·거실·사무실 중 용도를 고르고, 천장이 높으면 층고를 실제 값으로 수정합니다.</li>
      <li>서향·최상층 등 조건이 있으면 추가 보정을 선택하고 계산합니다.</li>
    </ol>`,
  faq: [
    { q: "kW와 BTU는 어떤 관계인가요?", a: "1kW ≈ 3,412 BTU/h입니다. 국내 제품은 정격 냉방능력을 kW로 표기하고, 해외·창문형 제품은 BTU로 표기하는 경우가 많습니다." },
    { q: "'18평형' 에어컨은 18평 방에 쓰는 건가요?", a: "제조사 권장 면적 표기이며 단열 조건이 좋은 상황을 전제로 합니다. 서향·최상층·큰 창이 있다면 한 단계 큰 용량을 고려하세요." },
    { q: "용량이 크면 무조건 좋은가요?", a: "너무 크면 잦은 On/Off로 제습이 덜 되고 초기 비용도 올라갑니다. 필요 용량보다 약간 여유 있는 정도가 적당합니다." },
    { q: "전기요금은 어떻게 되나요?", a: "냉방능력이 아니라 소비전력(kW)과 사용 시간으로 결정됩니다. 에너지소비효율등급 라벨의 소비전력을 확인하세요." },
  ],
  note: `<p class="note">평당 냉방능력 계수는 공적 고시가 아닌 <strong>업계 관행값</strong>입니다 <span class="badge todo">확인 필요</span>. 제품 선택은 제조사 권장 면적과 정격 냉방능력(에너지소비효율등급 라벨)을 기준으로 하세요.</p>`,
  related: [{ path: "pyeong/", ic: "📐", n: "평수 계산기" }, { path: "lighting/", ic: "💡", n: "조명 밝기 계산기" }, TEC.elec, TEC.pyeongPlus],
  script: `import { acSizeCalc } from "__U__lib/calc.mjs";
const K = ${J(COOLING_PER_PYEONG_KW.value)};
const $ = (id) => document.getElementById(id);
$("calcBtn").addEventListener("click", () => {
  const pyeong = parseFloat($("py").value);
  const ceilingM = parseFloat($("ceil").value);
  const extra = parseFloat($("extra").value) || 1;
  if (!isFinite(pyeong) || pyeong <= 0 || !isFinite(ceilingM) || ceilingM <= 0) { hcToast("평수와 천장 높이를 입력하세요"); return; }
  const perPyeongKw = K[$("use").value];
  const r = acSizeCalc({ pyeong, perPyeongKw, ceilingM, baseCeilingM: ${CEILING_BASE_M.value} });
  const kw = r.kw * extra;
  $("resultBox").hidden = false;
  $("resMain").innerHTML = "필요 냉방능력 약 <span>" + hcFmt(kw, 1) + "kW</span> <small>(" + hcFmt(kw * 3412.14) + " BTU/h)</small>";
  $("resSub").textContent = "평당 " + perPyeongKw + "kW × " + pyeong + "평 × 층고 보정 " + hcFmt(r.factor, 2) + (extra !== 1 ? " × 추가 보정 " + hcFmt(extra, 2) : "") + " — 제품은 이 값 이상의 정격 냉방능력을 고르세요.";
  $("resFormula").textContent = "필요 kW = 평수 × 평당 계수 × (천장고 ÷ ${CEILING_BASE_M.value}m) × 보정 · 1kW ≈ 3,412 BTU/h";
  $("srcLine").innerHTML = "평당 계수: 제조사 평형 표기 역산의 업계 관행값 <span class=\\"badge todo\\">확인 필요</span> · 제품 정격 냉방능력은 <a href=\\"${EFFICIENCY_LABEL_INFO.source}\\" rel=\\"noopener\\">에너지소비효율등급 라벨</a> 확인 · 확인일 ${COOLING_PER_PYEONG_KW.checkedAt}";
  hcShowResultAd();
});`,
},

/* 12. 전월세 전환 ---------------------------------------------- */
{
  slug: "deposit-conv", emoji: "🏦", nav: "전월세 전환 계산기",
  hubName: "전월세 전환 계산기", hubDesc: "법정 전환율 상한으로 보증금↔월세 환산",
  title: "전월세 전환 계산기 — 법정 전환율 상한(기준금리+2%p) | 홈캘크",
  ogTitle: "전월세 전환 계산기 — 법정 상한 산식",
  desc: "보증금을 월세로, 월세를 보증금으로 환산합니다. 주택임대차보호법 제7조의2 전환율 상한(연 10%와 기준금리+2%p 중 낮은 값)을 적용하며 기준금리는 직접 입력합니다.",
  h1: "전월세 전환 계산기",
  lead: "보증금↔월세를 <strong>법정 전환율 상한</strong>(연 10%와 기준금리+2%p 중 낮은 값)으로 환산합니다.",
  body: `  <div class="card">
    <h2>전환 조건 입력</h2>
    <div class="grid2">
      <label class="f">한국은행 기준금리 (%) <span class="hint">— 직접 확인 후 입력</span>
        <input type="number" id="base" inputmode="decimal" step="0.05" min="0" value="${(BASE_RATE_EXAMPLE.value * 100).toFixed(2)}" />
      </label>
      <label class="f">적용 전환율
        <select id="mode"><option value="cap" selected>법정 상한 자동 계산</option><option value="manual">직접 입력</option></select>
      </label>
      <label class="f">직접 입력 전환율 (연 %)
        <input type="number" id="manual" inputmode="decimal" step="0.1" min="0" value="5.5" disabled />
      </label>
      <label class="f">계산 방향
        <select id="dir"><option value="d2m" selected>보증금 → 월세</option><option value="m2d">월세 → 보증금</option></select>
      </label>
      <label class="f" id="lblDep">월세로 돌릴 보증금 (만원)
        <input type="number" id="dep" inputmode="decimal" step="any" min="0" value="10000" />
      </label>
      <label class="f" id="lblMon">월세 (만원)
        <input type="number" id="mon" inputmode="decimal" step="any" min="0" value="50" disabled />
      </label>
    </div>
    <button class="btn full" id="calcBtn" type="button">전환 계산하기</button>
${STD_RESULT}
  </div>`,
  intro: `    <h2>소개</h2>
    <p>전세를 반전세로 돌리거나 월세를 보증금으로 낮출 때 쓰는 비율이 <strong>전월세 전환율</strong>입니다. 주택임대차보호법 제7조의2와 시행령 제9조는 이 비율의 <strong>상한</strong>을 정하고 있습니다.</p>
    <div class="formula">전환율 상한 = min( 연 10%, 한국은행 기준금리 + 2%p )<br />월세 = 전환할 보증금 × 전환율 ÷ 12 · 보증금 = 월세 × 12 ÷ 전환율</div>
    <p>기준금리는 수시로 바뀌므로 이 계산기는 값을 고정하지 않고 <strong>직접 입력</strong>받습니다. 현재 기준금리는 <a href="${BASE_RATE_EXAMPLE.source}" rel="noopener">한국은행 기준금리 추이</a>에서 확인하세요. 상한은 기존 계약을 전환할 때 적용되는 기준이며, 신규 계약의 조건은 당사자 합의로 정해집니다.</p>`,
  howto: `    <h2>사용법</h2>
    <ol>
      <li>한국은행 기준금리를 확인해 %로 입력합니다. (예: 2.5)</li>
      <li>계산 방향(보증금→월세 / 월세→보증금)을 고릅니다.</li>
      <li>금액을 만원 단위로 입력하면 법정 상한 전환율 기준 환산액이 나옵니다. 실제 계약 조건이 다르면 전환율을 직접 입력해 비교하세요.</li>
    </ol>`,
  faq: [
    { q: "전환율 상한은 어떤 법에 있나요?", a: "주택임대차보호법 제7조의2와 같은 법 시행령 제9조에 따라 연 10%와 한국은행 기준금리에 대통령령으로 정하는 이율(2%p)을 더한 비율 중 낮은 쪽이 상한입니다." },
    { q: "왜 기준금리를 직접 넣어야 하나요?", a: "기준금리는 한국은행 금융통화위원회 결정에 따라 수시로 바뀝니다. 잘못된 고정값이 계산 전체를 틀리게 만들 수 있어 직접 입력받고 확인 링크를 제공합니다." },
    { q: "상한을 넘는 월세로 계약해도 되나요?", a: "상한 규정은 기존 계약의 보증금을 월세로 전환하는 경우에 적용됩니다. 구체적인 적용 여부와 효력은 사안마다 달라 법률 전문가나 대한법률구조공단 등에 확인하세요." },
    { q: "실제 시장 전환율은 얼마인가요?", a: "지역·주택 유형에 따라 다르며 법정 상한보다 낮거나 높게 형성되기도 합니다. 한국부동산원 통계 등에서 지역별 실거래 전환율을 확인할 수 있습니다." },
  ],
  note: `<p class="note">본 계산은 법정 산식에 따른 <strong>참고용</strong>이며 법률 자문이 아닙니다. 기준금리는 <span class="badge todo">확인 필요</span> — 계산 전 <a href="${BASE_RATE_EXAMPLE.source}" rel="noopener">한국은행 발표</a>에서 현재 값을 확인해 입력하세요.</p>`,
  related: [{ path: "moving-cost/", ic: "🚚", n: "이사 견적 항목 계산기" }, { path: "pyeong/", ic: "📐", n: "평수 계산기" }, TEC.jeonse, TEC.moving],
  script: `import { legalCapRate, depositToMonthly, monthlyToDeposit } from "__U__lib/calc.mjs";
const CAP = ${J(LEGAL_CONVERSION_CAP.value)};
const $ = (id) => document.getElementById(id);
function syncDir() {
  const d2m = $("dir").value === "d2m";
  $("dep").disabled = !d2m;
  $("mon").disabled = d2m;
  $("lblDep").firstChild.nodeValue = d2m ? "월세로 돌릴 보증금 (만원)" : "환산될 보증금 (만원)";
  $("lblMon").firstChild.nodeValue = d2m ? "환산될 월세 (만원)" : "보증금으로 돌릴 월세 (만원)";
}
$("dir").addEventListener("change", syncDir);
$("mode").addEventListener("change", () => { $("manual").disabled = $("mode").value !== "manual"; });
syncDir();
$("calcBtn").addEventListener("click", () => {
  const basePct = parseFloat($("base").value);
  if (!isFinite(basePct) || basePct < 0) { hcToast("기준금리를 입력하세요"); return; }
  const cap = legalCapRate(basePct / 100, { fixedCap: CAP.fixedCap, spread: CAP.baseRateSpread });
  let rate = cap, how = "법정 상한";
  if ($("mode").value === "manual") {
    const m = parseFloat($("manual").value);
    if (!isFinite(m) || m <= 0) { hcToast("전환율을 입력하세요"); return; }
    rate = m / 100; how = "직접 입력";
  }
  const d2m = $("dir").value === "d2m";
  let msg = "", sub = "";
  if (d2m) {
    const dep = parseFloat($("dep").value);
    if (!isFinite(dep) || dep <= 0) { hcToast("보증금을 입력하세요"); return; }
    const monthly = depositToMonthly(dep * 10000, rate);
    $("mon").value = Math.round(monthly / 10000 * 100) / 100;
    msg = "월세 <span>" + hcFmt(monthly / 10000, 1) + "만원</span> <small>(" + hcFmt(monthly) + "원/월)</small>";
    sub = "보증금 " + hcFmt(dep) + "만원을 연 " + hcFmt(rate * 100, 2) + "% (" + how + ")로 전환 · 연 " + hcFmt(dep * 10000 * rate) + "원 ÷ 12개월";
  } else {
    const mon = parseFloat($("mon").value);
    if (!isFinite(mon) || mon <= 0) { hcToast("월세를 입력하세요"); return; }
    const dep = monthlyToDeposit(mon * 10000, rate);
    $("dep").value = Math.round(dep / 10000);
    msg = "보증금 <span>" + hcFmt(dep / 10000) + "만원</span> <small>(" + hcFmt(dep) + "원)</small>";
    sub = "월세 " + hcFmt(mon) + "만원을 연 " + hcFmt(rate * 100, 2) + "% (" + how + ")로 환산 · 연 " + hcFmt(mon * 12) + "만원 ÷ 전환율";
  }
  $("resultBox").hidden = false;
  $("resMain").innerHTML = msg;
  $("resSub").textContent = sub + " · 법정 상한: min(연 " + (CAP.fixedCap * 100) + "%, 기준금리 " + basePct + "% + " + (CAP.baseRateSpread * 100) + "%p) = 연 " + hcFmt(cap * 100, 2) + "%";
  $("resFormula").textContent = "월세 = 보증금 × 전환율 ÷ 12 · 보증금 = 월세 × 12 ÷ 전환율 · 전환율 상한 = min(10%, 기준금리+2%p)";
  $("srcLine").innerHTML = "산식 출처: <a href=\\"${LEGAL_CONVERSION_CAP.source}\\" rel=\\"noopener\\">주택임대차보호법 제7조의2·시행령 제9조</a> · 기준금리는 <a href=\\"${BASE_RATE_EXAMPLE.source}\\" rel=\\"noopener\\">한국은행</a> 발표값 직접 입력 <span class=\\"badge todo\\">확인 필요</span> · 확인일 ${LEGAL_CONVERSION_CAP.checkedAt}";
  hcShowResultAd();
});`,
},
];

/* ── 허브 ───────────────────────────────────────────────────── */
function hubPage() {
  const cards = TOOLS.map((t) =>
    `    <a class="tool-card" href="${t.slug}/"><div class="t"><span class="ic">${t.emoji}</span>${esc(t.hubName)}</div><div class="d">${esc(t.hubDesc)}</div></a>`).join("\n");
  return {
    path: "", emoji: "🏠", heroEmoji: "🏠📐", ld: "website",
    title: "홈캘크 HomeCalc — 집·인테리어·이사 계산기 12종",
    ogTitle: "홈캘크 HomeCalc — 집·인테리어·이사 계산기 허브",
    desc: "평수 변환, 도배·장판·타일·페인트 자재량, 커튼 치수, 가구 배치 시뮬레이터, 이사 체크리스트·견적 항목, 조명 밝기, 에어컨 평수, 전월세 전환까지 — 집에 관한 계산 12종 무료 도구.",
    h1: "집·인테리어·이사 계산기 허브",
    lead: "평수 변환부터 도배·타일 자재량, 가구 배치 시뮬레이터, 이사 준비, 전월세 전환까지 — 집에 관한 계산을 한곳에서. 설치·가입 없이 무료.",
    body: `  <nav class="tool-grid" aria-label="도구 목록">
${cards}
  </nav>`,
    intro: `    <h2>홈캘크 소개</h2>
    <p>홈캘크(HomeCalc)는 이사·인테리어·셀프 시공을 준비할 때 반복해서 검색하게 되는 계산을 모아 둔 무료 도구 모음입니다. 모든 계산은 브라우저 안에서만 실행되고, 어떤 입력값도 서버로 전송·저장하지 않습니다.</p>
    <p>자재량(도배 롤 수·타일 장수·페인트 리터)과 이사 비용 범위는 업계 일반 관행을 바탕으로 한 <strong>참고용</strong> 값입니다. 실제 시공·계약 전에는 반드시 실측 견적과 제품 라벨을 확인하세요. 각 도구 하단에 계산 근거와 출처, 확인일을 표시합니다.</p>
    <h2>평형별 페이지</h2>
    <p>자주 찾는 평형(10~60평)은 ㎡ 환산·전용면적 추정과 함께 별도 페이지로 정리했습니다.</p>
    <div class="chips">${PY_CHIPS}</div>`,
    howto: `    <h2>이렇게 활용하세요</h2>
    <ul>
      <li>이사 확정 → <a href="moving-check/">이사 체크리스트</a>로 일정 관리, <a href="moving-cost/">견적 항목 계산기</a>로 예상 범위 파악</li>
      <li>새집 계약 → <a href="pyeong/">평수 계산기</a>로 면적 감 잡고 <a href="furniture-fit/">가구 배치</a>로 기존 가구가 들어가는지 확인</li>
      <li>셀프 인테리어 → <a href="wallpaper/">도배</a>·<a href="flooring/">장판</a>·<a href="tile/">타일</a>·<a href="paint/">페인트</a>·<a href="curtain/">커튼</a> 자재량 계산</li>
      <li>입주 준비 → <a href="lighting/">조명 밝기</a>, <a href="ac-size/">에어컨 용량</a> 확인</li>
      <li>전월세 조건 비교 → <a href="deposit-conv/">전월세 전환 계산기</a></li>
    </ul>`,
    faq: [
      { q: "홈캘크는 어떤 사이트인가요?", a: "평수 변환, 도배·장판·타일·페인트 자재량, 커튼 치수, 가구 배치, 이사 준비, 조명·에어컨 용량, 전월세 전환 등 집과 관련된 계산 12종을 모은 무료 도구 허브입니다." },
      { q: "회원가입이나 서버 저장이 필요한가요?", a: "아니요. 모든 계산은 브라우저 안에서만 실행되며 서버로 전송·저장되지 않습니다. 이사 체크리스트 같은 기록형 도구는 이 기기의 localStorage에만 저장됩니다." },
      { q: "결과를 견적서로 써도 되나요?", a: "자재량·이사 비용 등은 업계 일반 관행을 바탕으로 한 참고용 계산입니다. 실제 시공·이사 계약 전에는 반드시 전문 업체의 실측 견적을 받으세요." },
      { q: "계산 근거는 어디서 확인하나요?", a: "각 도구의 결과 아래에 사용한 값의 출처와 확인일을 표시합니다. 공적 출처가 없는 관행값은 '확인 필요' 배지로 구분합니다." },
    ],
    relatedTitle: "TomatoEggCat의 다른 도구",
    related: [TEC.pyeong, TEC.pyeongPlus, TEC.moving, TEC.jeonse, TEC.isagak, TEC.elec],
  };
}

/* ── 평형별 롱테일 ──────────────────────────────────────────── */
const PY = PYEONG_PAGES.value;
function pyeongPage(entry, idx) {
  const p = entry.p;
  const m2 = p * M2_PER_PYEONG.value;
  const exLo = m2 * EXCLUSIVE_RATE_RANGE.value.min;
  const exHi = m2 * EXCLUSIVE_RATE_RANGE.value.max;
  const side = Math.sqrt(m2);
  const perim = 4 * side;
  const wallArea = perim * 2.3;
  const acKw = p * COOLING_PER_PYEONG_KW.value.living;
  const f1 = (n) => n.toFixed(1);
  const f2 = (n) => n.toFixed(2);
  const prev = PY[idx - 1], next = PY[idx + 1];
  const navLinks = [
    prev ? `<a class="chip" href="__U__pyeong/${prev.p}/">← ${prev.p}평</a>` : "",
    `<a class="chip" href="__U__pyeong/">평수 계산기</a>`,
    next ? `<a class="chip" href="__U__pyeong/${next.p}/">${next.p}평 →</a>` : "",
  ].filter(Boolean).join("");

  return {
    path: `pyeong/${p}/`, emoji: "📐", appName: `${p}평 ㎡ 변환`,
    title: `${p}평은 몇 제곱미터? — ${p}평 = ${f2(m2)}㎡ | 홈캘크`,
    ogTitle: `${p}평 = ${f2(m2)}㎡`,
    desc: `${p}평은 ${f2(m2)}㎡입니다(1평=3.305785㎡). 전용률 ${Math.round(EXCLUSIVE_RATE_RANGE.value.min * 100)}~${Math.round(EXCLUSIVE_RATE_RANGE.value.max * 100)}% 가정 시 전용면적 약 ${f1(exLo)}~${f1(exHi)}㎡. ${entry.note}`,
    h1: `${p}평은 몇 ㎡일까?`,
    lead: `<strong>${p}평 = ${f2(m2)}㎡</strong> (1평 = 400/121㎡ = 3.305785㎡)`,
    crumbs: [{ name: "평수 계산기", path: "pyeong/" }, { name: `${p}평`, path: `pyeong/${p}/` }],
    body: `  <div class="card">
    <h2>${p}평 환산표</h2>
    <p class="big">${p}평 <span>= ${f2(m2)}㎡</span></p>
    <div class="rt-wrap">
      <table class="rt">
        <thead><tr><th>구분</th><th>값</th><th>메모</th></tr></thead>
        <tbody>
          <tr><td>면적(㎡)</td><td>${f2(m2)}㎡</td><td>${p} × 3.305785</td></tr>
          <tr><td>전용면적 추정</td><td>${f1(exLo)} ~ ${f1(exHi)}㎡</td><td>전용률 ${Math.round(EXCLUSIVE_RATE_RANGE.value.min * 100)}~${Math.round(EXCLUSIVE_RATE_RANGE.value.max * 100)}% 가정(참고용)</td></tr>
          <tr><td>정사각형 환산</td><td>약 ${f1(side)}m × ${f1(side)}m</td><td>같은 면적의 정사각형 한 변</td></tr>
          <tr><td>벽 면적 참고</td><td>약 ${f1(wallArea)}㎡</td><td>둘레 ${f1(perim)}m × 천장 2.3m(개구부 제외 전)</td></tr>
          <tr><td>에어컨 참고</td><td>약 ${f1(acKw)}kW</td><td>거실 기준 평당 ${COOLING_PER_PYEONG_KW.value.living}kW(관행값)</td></tr>
        </tbody>
      </table>
    </div>
    <div class="chips">${navLinks}</div>
  </div>

  <div class="card">
    <h2>다른 평수도 변환하기</h2>
    <div class="grid2">
      <label class="f">평 (坪)
        <input type="number" id="inPy" inputmode="decimal" step="any" min="0" value="${p}" />
      </label>
      <label class="f">제곱미터 (㎡)
        <input type="number" id="inM2" inputmode="decimal" step="any" min="0" value="${m2.toFixed(4)}" />
      </label>
    </div>
    <p class="sub">어느 쪽이든 값을 바꾸면 반대쪽이 즉시 계산됩니다.</p>
${STD_RESULT}
  </div>`,
    intro: `    <h2>${p}평은 어떤 크기인가</h2>
    <p>${p}평은 <strong>${f2(m2)}㎡</strong>입니다. ${entry.note}</p>
    <p>같은 면적을 정사각형으로 펴면 한 변이 약 ${f1(side)}m인 공간입니다. 다만 실제 집은 방·거실·복도로 나뉘고 벽 두께가 있어 체감 크기는 평면 구조에 따라 달라집니다.</p>
    <h2>공급 ${p}평과 전용면적</h2>
    <p>부동산에서 말하는 "${p}평형"은 대개 <strong>공급면적</strong>(전용 + 주거공용) 기준입니다. 단지 전용률이 ${Math.round(EXCLUSIVE_RATE_RANGE.value.min * 100)}~${Math.round(EXCLUSIVE_RATE_RANGE.value.max * 100)}% 수준이라고 보면 전용면적은 약 <strong>${f1(exLo)}~${f1(exHi)}㎡</strong>로 추정됩니다. 정확한 값은 분양 카탈로그·건축물대장·등기부에서 확인하세요.</p>
    <h2>${p}평에서 자주 하는 계산</h2>
    <ul>
      <li><a href="__U__wallpaper/">도배</a> — 둘레 약 ${f1(perim)}m, 천장 2.3m로 잡으면 벽 면적 약 ${f1(wallArea)}㎡(개구부 제외 전)</li>
      <li><a href="__U__flooring/">장판·마루</a> — 바닥 ${f2(m2)}㎡ 기준으로 박스 수 계산</li>
      <li><a href="__U__ac-size/">에어컨</a> — 거실 기준 약 ${f1(acKw)}kW(관행 계수, 단열 조건에 따라 가감)</li>
      <li><a href="__U__furniture-fit/">가구 배치</a> — 방 치수를 cm로 넣어 침대·소파가 들어가는지 확인</li>
    </ul>`,
    howto: `    <h2>사용법</h2>
    <ol>
      <li>위 표에서 ${p}평의 ㎡ 환산값과 전용면적 추정 범위를 확인합니다.</li>
      <li>다른 평수가 필요하면 아래 변환기에 값을 넣습니다.</li>
      <li>자재·가구 계산이 필요하면 관련 도구로 이동합니다.</li>
    </ol>`,
    faq: [
      { q: `${p}평은 몇 ㎡인가요?`, a: `${p}평 = ${f2(m2)}㎡입니다. 1평 = 400/121㎡ = 3.305785㎡로 환산합니다.` },
      { q: `${p}평형의 전용면적은 얼마인가요?`, a: `공급 ${p}평(${f2(m2)}㎡) 기준으로 전용률 ${Math.round(EXCLUSIVE_RATE_RANGE.value.min * 100)}~${Math.round(EXCLUSIVE_RATE_RANGE.value.max * 100)}%를 적용하면 약 ${f1(exLo)}~${f1(exHi)}㎡로 추정됩니다. 단지마다 다르므로 실제 값은 건축물대장·분양 자료에서 확인해야 합니다.` },
      { q: `${p}평은 왜 ${f2(m2)}㎡로 딱 떨어지지 않나요?`, a: "1평이 400/121㎡라는 무한소수이기 때문입니다. 실무에서는 소수점 둘째 자리까지 반올림해 표기하는 경우가 많습니다." },
      { q: "평 표기는 공식 단위인가요?", a: "아닙니다. 계량에 관한 법률상 법정 단위는 ㎡이며 평은 거래 관행상 병기되는 관용 단위입니다." },
    ],
    note: `<p class="note">평↔㎡ 환산은 계량법 관용 환산(1평 = 400/121㎡)으로 정확하지만, <strong>평형↔전용면적 대응은 단지마다 다른 관행 설명</strong>이며 참고용입니다 <span class="badge practice">관행값</span>. 확인일 ${PYEONG_PAGES.checkedAt}</p>`,
    related: [{ path: "pyeong/", ic: "📐", n: "평수 계산기(전체)" }, { path: "furniture-fit/", ic: "🛋️", n: "가구 배치 시뮬레이터" }, TEC.pyeongPlus, TEC.elec],
    script: `import { pyeongToM2, m2ToPyeong } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
function show(py, m2, from) {
  $("resultBox").hidden = false;
  $("resMain").innerHTML = from === "py"
    ? hcFmt(py, 4) + "평 = <span>" + hcFmt(m2, 4) + "㎡</span>"
    : hcFmt(m2, 4) + "㎡ = <span>" + hcFmt(py, 4) + "평</span>";
  $("resSub").textContent = "전용률 " + Math.round(${EXCLUSIVE_RATE_RANGE.value.min} * 100) + "~" + Math.round(${EXCLUSIVE_RATE_RANGE.value.max} * 100) + "% 가정 시 전용면적 약 "
    + hcFmt(m2 * ${EXCLUSIVE_RATE_RANGE.value.min}, 1) + "~" + hcFmt(m2 * ${EXCLUSIVE_RATE_RANGE.value.max}, 1) + "㎡ (참고용)";
  $("resFormula").textContent = "㎡ = 평 × 3.305785 · 평 = ㎡ ÷ 3.305785";
  $("srcLine").innerHTML = ${J(UNIT_SRC)};
  hcShowResultAd();
}
$("inPy").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  if (!isFinite(v) || v < 0) return;
  const m2 = pyeongToM2(v);
  $("inM2").value = Math.round(m2 * 10000) / 10000;
  show(v, m2, "py");
});
$("inM2").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  if (!isFinite(v) || v < 0) return;
  const py = m2ToPyeong(v);
  $("inPy").value = Math.round(py * 10000) / 10000;
  show(py, v, "m2");
});`,
  };
}

/* ── 정책 페이지 ────────────────────────────────────────────── */
const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ld: "webpage",
    title: "개인정보처리방침 — 홈캘크 HomeCalc",
    desc: "홈캘크는 개인정보를 수집하지 않습니다. 모든 계산은 브라우저에서 처리되며, 광고 쿠키와 localStorage 사용에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    crumbs: [{ name: "개인정보처리방침", path: "privacy.html" }],
    body: `  <div class="card">
    <h2>1. 수집하는 개인정보</h2>
    <p class="sub">홈캘크는 회원가입 절차가 없으며 이름·연락처·이메일·주민등록번호 등 개인을 식별할 수 있는 정보를 일절 수집하지 않습니다. 면적·치수·금액 등 계산기에 입력하는 값은 브라우저 안에서만 처리되며 서버로 전송되거나 저장되지 않습니다.</p>
    <h2>2. 쿠키와 광고</h2>
    <p class="sub">본 사이트는 Google AdSense 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. <a href="https://adssettings.google.com" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 끌 수 있고, <a href="https://www.aboutads.info" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다.</p>
    <h2>3. 로컬 저장소(localStorage)</h2>
    <p class="sub">화면 테마 설정과 <a href="moving-check/">이사 체크리스트</a>의 체크 상태를 기억하기 위해 브라우저 localStorage에 값을 저장합니다. 이 값은 이용자의 기기에만 남고 서버로 전송되지 않으며, 브라우저 설정에서 삭제할 수 있습니다. 가구 배치 시뮬레이터의 배치 상태는 주소창 링크(#p=)에만 담기며 저장되지 않습니다.</p>
    <h2>4. 접속 분석</h2>
    <p class="sub">호스팅 사업자가 제공하는 기본 접속 통계(방문 수, 페이지 조회 수 등)가 집계될 수 있으며 이는 개인을 식별하지 않는 형태입니다.</p>
    <h2>5. 문의</h2>
    <p class="sub">개인정보 관련 문의는 <a href="https://tomatoeggcat.com/" rel="noopener">TomatoEggCat</a>을 통해 연락하실 수 있습니다.</p>
    <p class="note">시행일: ${TODAY}</p>
  </div>`,
    intro: `    <h2>요약</h2>
    <p>홈캘크의 모든 계산기는 브라우저 안에서 동작합니다. 입력한 면적·금액·치수는 어디에도 전송되지 않으며, 저장되는 값은 테마 설정과 체크리스트 진행 상태뿐입니다.</p>`,
    faq: [
      { q: "입력한 계산 값이 서버에 저장되나요?", a: "아니요. 모든 계산은 브라우저에서 실행되며 입력값은 전송·저장되지 않습니다." },
      { q: "체크리스트 기록은 어디에 남나요?", a: "이 브라우저의 localStorage에만 저장됩니다. 브라우저 데이터를 지우거나 다른 기기에서 열면 남아 있지 않습니다." },
      { q: "광고 쿠키를 거부할 수 있나요?", a: "네. Google 광고 설정에서 맞춤 광고를 비활성화하거나 www.aboutads.info에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다." },
    ],
    related: [{ path: "terms.html", ic: "📜", n: "이용약관" }, { path: "index.html", ic: "🏠", n: "홈캘크 홈" }],
  },
  {
    path: "terms.html", emoji: "📜", ld: "webpage",
    title: "이용약관 — 홈캘크 HomeCalc",
    desc: "홈캘크가 제공하는 자재량·비용·면적 계산 결과의 성격과 책임 범위, 저작권에 관한 안내입니다. 모든 결과는 참고용 추정치입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 추정치입니다.",
    crumbs: [{ name: "이용약관", path: "terms.html" }],
    body: `  <div class="card">
    <h2>1. 서비스의 성격</h2>
    <p class="sub">홈캘크는 면적·자재량·비용 등을 이용자가 입력한 값과 공개된 산식·업계 관행값에 근거해 계산해 주는 무료 도구입니다. 계산 결과는 <strong>참고용 추정치</strong>이며 실제 견적·계약 금액이나 시공 결과를 확정하거나 보증하지 않습니다.</p>
    <h2>2. 관행값과 출처</h2>
    <p class="sub">벽지 규격, 로스율, 페인트 도포율, 이사 비용 범위, 평당 냉방능력 등은 공적 고시가 없는 <strong>업계 일반 관행값</strong>입니다. 각 도구는 사용한 값의 성격(관행값/확인 필요)과 확인일을 함께 표시하며, 제품 라벨·시방서·업체 견적이 우선합니다.</p>
    <h2>3. 법령 관련 계산</h2>
    <p class="sub">전월세 전환 계산기는 주택임대차보호법 제7조의2 및 시행령 제9조의 산식을 참고용으로 구현한 것이며 <strong>법률 자문이 아닙니다</strong>. 구체적 사안의 적용 여부는 법률 전문가나 관계 기관에 확인하시기 바랍니다.</p>
    <h2>4. 책임의 한계</h2>
    <p class="sub">이용자가 계산 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다. 자재 구매·시공 계약·이사 계약 등 비용이 발생하는 결정은 반드시 실측 견적과 공식 자료로 확인하세요.</p>
    <h2>5. 저작권과 광고</h2>
    <p class="sub">본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 법령·표준 등 공공 자료의 권리는 각 기관에 있습니다. 본 사이트는 Google AdSense 광고를 게재하며 광고는 계산 결과 영역 아래에만 표시됩니다. 광고 내용에 대한 책임은 광고주에게 있습니다.</p>
    <p class="note">시행일: ${TODAY}</p>
  </div>`,
    intro: `    <h2>요약</h2>
    <p>홈캘크의 결과는 참고용입니다. 자재량은 제품 라벨, 비용은 업체 견적, 법령 사항은 전문가 확인이 우선합니다.</p>`,
    faq: [
      { q: "계산 결과를 견적서로 사용할 수 있나요?", a: "아니요. 참고용 추정치이며 업체 견적을 대신할 수 없습니다." },
      { q: "자재가 모자라면 보상받을 수 있나요?", a: "본 도구는 참고용 계산만 제공하며 구매·시공 결과에 대한 책임을 지지 않습니다. 여유율을 조정해 넉넉히 계산하시기 바랍니다." },
      { q: "전월세 전환 계산은 법률 자문인가요?", a: "아닙니다. 법정 산식을 참고용으로 구현한 것으로, 구체적 사안은 법률 전문가에게 확인해야 합니다." },
    ],
    related: [{ path: "privacy.html", ic: "🔒", n: "개인정보처리방침" }, { path: "index.html", ic: "🏠", n: "홈캘크 홈" }],
  },
];

/* ── 페이지 조립 ────────────────────────────────────────────── */
const pages = [];
pages.push(hubPage());
for (const t of TOOLS) {
  pages.push({
    path: `${t.slug}/`, emoji: t.emoji, heroEmoji: t.heroEmoji, wide: t.wide,
    title: t.title, ogTitle: t.ogTitle, desc: t.desc, appName: t.hubName,
    h1: t.h1, lead: t.lead,
    crumbs: [{ name: t.nav, path: `${t.slug}/` }],
    body: t.body, intro: t.intro, howto: t.howto, faq: t.faq, note: t.note,
    related: t.related, script: t.script,
  });
}
PY.forEach((e, i) => pages.push(pyeongPage(e, i)));
for (const p of POLICY) pages.push(p);

/* ── 쓰기 ───────────────────────────────────────────────────── */
let written = 0;
for (const p of pages) {
  const file = join(ROOT, p.path === "" ? "index.html" : p.path.endsWith("/") ? p.path + "index.html" : p.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(p), "utf8");
  written++;
}

/* sitemap.xml */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => {
  const pr = p.path === "" ? "1.0"
    : p.path.startsWith("pyeong/") && p.path !== "pyeong/" ? "0.6"
    : p.path.endsWith(".html") ? "0.3" : "0.8";
  return `  <url><loc>${SITE_ORIGIN}/${p.path}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${pr}</priority></url>`;
}).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap, "utf8");

/* robots.txt */
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, "utf8");

/* ── 리포트 ─────────────────────────────────────────────────── */
const known = new Set(pages.filter((p) => p.path.endsWith("/") && p.path).map((p) => p.path.split("/")[0]));
const RESERVED = new Set(["assets", "data", "lib", "tests", "node_modules"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

const DATASETS = {
  "materials.WALLPAPER_ROLLS": WALLPAPER_ROLLS, "materials.WALLPAPER_LOSS": WALLPAPER_LOSS,
  "materials.FLOORING_PRODUCTS": FLOORING_PRODUCTS, "materials.FLOORING_LOSS": FLOORING_LOSS,
  "materials.TILE_LOSS": TILE_LOSS, "materials.TILE_GROUT_DEFAULT_MM": TILE_GROUT_DEFAULT_MM,
  "materials.PAINT_COVERAGE": PAINT_COVERAGE, "materials.CURTAIN_DEFAULTS": CURTAIN_DEFAULTS,
  "lighting.ROOM_LUX": ROOM_LUX, "lighting.UTILIZATION_DEFAULT": UTILIZATION_DEFAULT, "lighting.BULB_PRESETS": BULB_PRESETS,
  "acsize.COOLING_PER_PYEONG_KW": COOLING_PER_PYEONG_KW, "acsize.CEILING_BASE_M": CEILING_BASE_M,
  "deposit.BASE_RATE_EXAMPLE": BASE_RATE_EXAMPLE, "moving.COST_ITEMS": COST_ITEMS,
};
const todos = Object.entries(DATASETS).filter(([, v]) => v.todo).map(([k]) => k);

console.log(`생성 완료: HTML ${written}개 (허브 1 · 도구 ${TOOLS.length} · 평형 롱테일 ${PY.length} · 정책 ${POLICY.length})`);
console.log(`sitemap.xml ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (todos.length) console.log(`TODO(확인 필요 배지 표시 중) ${todos.length}건: ${todos.join(", ")}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
