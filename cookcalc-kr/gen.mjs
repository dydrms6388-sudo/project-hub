// cookcalc-kr 정적 페이지 생성기 (Node 내장만 사용, 의존성 0)
// 실행: node cookcalc-kr/gen.mjs
// 생성물: index.html, 도구 12종, convert/·airfryer/·storage/ 롱테일,
//        privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DENSITY, DENSITY_UNITS } from "./data/density.mjs";
import { STORAGE } from "./data/storage.mjs";
import { AIRFRYER, OVEN_RULE } from "./data/airfryer.mjs";
import { CALORIES } from "./data/calories.mjs";
import { RICE_RATIO, COFFEE_RATIO, BRINE, KIMCHI, SYRUP, PANS } from "./data/misc.mjs";

const SITE_ORIGIN = "https://cookcalc-kr.vercel.app";
const SITE_NAME = "요리 계산기 허브";
const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 한글 → 로마자 슬러그 (URL·파일명 안전) ────────────────── */
const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","k","n","n","n","t","l","k","m","p","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","t"];
function romanize(str) {
  let out = "";
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const i = c - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
    } else if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase();
    else out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "") || "item";
}
function slugger() {
  const used = new Set();
  return (name) => {
    let s = romanize(name), n = 2;
    while (used.has(s)) s = romanize(name) + "-" + n++;
    used.add(s);
    return s;
  };
}
const dSlug = slugger(), aSlug = slugger(), sSlug = slugger();
const DENS = DENSITY.map((d) => ({ ...d, slug: dSlug(d.name) }));
const AIRS = AIRFRYER.map((a) => ({ ...a, slug: aSlug(a.name) }));
const STOR = STORAGE.map((s) => ({ ...s, slug: sSlug(s.name) }));

/* ── 공통 HTML 셸 ───────────────────────────────────────────── */
function shell(p) {
  const path = p.path;                       // "" | "storage/" | "convert/seoltang/" | "privacy.html"
  const depth = path.endsWith("/") ? path.split("/").filter(Boolean).length : 0;
  const U = "../".repeat(depth);
  const HOME = U || "./";
  const canonical = SITE_ORIGIN + "/" + path;

  const graph = [];
  if (p.app !== false) {
    graph.push({
      "@type": "SoftwareApplication", name: p.appName || p.h1, description: p.desc,
      applicationCategory: "UtilitiesApplication", operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" }, url: canonical,
    });
  }
  if (p.faq && p.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  const crumbs = [{ name: "홈", item: SITE_ORIGIN + "/" }].concat(p.crumbs || []);
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  });

  const crumbNav = `<nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">🍳 ${SITE_NAME}</a>` +
    (p.crumbs || []).map((c, i, arr) =>
      ` <span class="sep">›</span> ` + (i === arr.length - 1
        ? `<span>${esc(c.name)}</span>`
        : `<a href="${U}${c.rel}">${esc(c.name)}</a>`)).join("") + `</nav>`;

  const ad = p.ad === false ? "" : `
  <div class="ad-wrap" id="adWrap" hidden>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </div>`;

  const faqHtml = (p.faq || []).map((f) =>
    `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${esc(f.a)}</p></div>`).join("\n    ");

  const about = p.about === false ? "" : `
  <section class="about">
    ${p.intro || ""}
    ${p.howto || ""}
    ${faqHtml ? `<h2>자주 묻는 질문</h2>\n    ${faqHtml}` : ""}
    ${p.basis || ""}
    ${p.disclaimer || ""}
  </section>`;

  const rel = (p.related || []).map((r) =>
    r.url
      ? `<a class="rel" href="${r.url}" target="_blank" rel="noopener"><span class="e">${r.e}</span> ${esc(r.n)}</a>`
      : `<a class="rel" href="${U}${r.slug}/"><span class="e">${r.e}</span> ${esc(r.n)}</a>`).join("\n      ");
  const related = rel ? `
  <section class="related">
    <h2>관련 도구</h2>
    <div class="rel-grid">
      ${rel}
    </div>
  </section>` : "";

  const script = p.script ? `
<script type="module">
${p.script.replace(/__U__/g, U)}
initTheme(document.getElementById("themeBtn"));
</script>` : `
<script type="module">
import { initTheme } from "${U}assets/app.mjs";
initTheme(document.getElementById("themeBtn"));
</script>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />
<script>try{var t=localStorage.getItem('cc-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${esc(p.ogTitle || p.title)}" />
<meta property="og:description" content="${esc(p.desc)}" />
<meta property="og:url" content="${canonical}" />
<meta name="google-adsense-account" content="${ADS_CLIENT}" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
<link rel="stylesheet" href="${U}assets/style.css" />
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}
</script>
</head>
<body>
<div class="wrap">
  ${crumbNav}
  <div class="hero">
    <div class="emoji" aria-hidden="true">${p.emoji}</div>
    <h1>${esc(p.h1)}</h1>
    <p class="lead">${p.lead}</p>
  </div>
${p.body}
${ad}
${about}
${related}
  <footer>
    <p style="margin:0 0 8px">🍳 <a href="${HOME}">${SITE_NAME}</a></p>
    <p style="margin:0"><a href="${U}privacy.html">개인정보처리방침</a>·<a href="${U}terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a></p>
    <button class="theme" id="themeBtn" type="button">🌓 테마 전환</button>
  </footer>
</div>
${script}
</body>
</html>
`;
}

/* ── 공통 조각 ──────────────────────────────────────────────── */
const MEASURE_BASIS = `<h2>계량 기준과 데이터 출처</h2>
    <p class="note">이 사이트의 계량 기준은 <strong>1컵 = 200ml(한국 표준 계량컵) · 1큰술 = 15ml · 1작은술 = 5ml</strong> 입니다.
    미국 레시피의 1컵(240ml)과 다르므로 해외 레시피를 그대로 옮길 때는 주의하세요.
    재료별 g 환산은 밀도(g/ml)를 곱해 계산하며, 밀도값은 국내 계량 관행을 물 비중 대비로 정리한 <strong>근사값</strong>입니다
    (전 항목 출처·확인일 표기, 데이터 확인일 ${TODAY}). 눌러 담기·수북이 담기 등 담는 방법에 따라 ±10~20% 차이가 날 수 있어,
    제과·제빵처럼 정밀도가 필요한 작업은 <strong>저울 계량</strong>을 권합니다.</p>`;

const AIR_BASIS = `<h2>변환 규칙의 근거</h2>
    <p class="note">오븐 레시피를 에어프라이어로 옮길 때 쓰는 <strong>"온도 ${Math.abs(OVEN_RULE.tempDelta.value)}℃ 낮추고 시간 ${Math.round((1 - OVEN_RULE.timeFactor.value) * 100)}% 줄이기"</strong>는
    공식 규격이 아니라 널리 쓰이는 <span class="badge warn">${OVEN_RULE.label}</span>입니다. 에어프라이어는 좁은 공간에서 뜨거운 바람을 강하게 돌리므로
    같은 온도에서도 표면이 훨씬 빨리 익습니다. 기기 용량(3L·5L·7L), 예열 여부, 재료 두께와 양에 따라 결과가 달라지므로
    <strong>표시 시간의 70% 지점에서 한 번 열어 상태를 확인</strong>하고 조절하세요. (데이터 확인일 ${TODAY})</p>`;

const FOOD_SAFETY = `<p class="disclaimer">본 결과는 <strong>참고용</strong>이며 식품의 안전을 보증하지 않습니다.
    보관 기간은 구입 시 신선도·포장·냉장고 온도에 따라 크게 달라지므로 <strong>보관 상태에 따라 다름</strong>을 전제로 보시고,
    제품에 표시된 소비기한·유통기한이 있으면 표시를 우선하세요. 냄새·색·점액 등 이상이 있으면 기간과 무관하게 폐기하고,
    육류·가금류·달걀·해산물은 반드시 속까지 완전히 익혀 드세요. 자세한 기준은
    <a href="https://www.foodsafetykorea.go.kr" target="_blank" rel="noopener">식품안전나라</a>를 확인하세요.</p>`;

const DISC = (extra = "") => `<p class="disclaimer">본 계산 결과는 <strong>참고용 추정치</strong>입니다. ${extra}
    재료의 상태·계량 방법·기기 차이에 따라 실제 결과가 달라질 수 있으며, 진단·의료·영양 처방의 근거로 사용할 수 없습니다.</p>`;

const X = {
  air: { url: "https://tomatoeggcat.com/airfryer-time/", e: "🍟", n: "에어프라이어 시간표 (TomatoEggCat)" },
  fridge: { url: "https://tomatoeggcat.com/fridge-recipe/", e: "🧊", n: "냉장고 재료 레시피 (TomatoEggCat)" },
  cafe: { url: "https://tomatoeggcat.com/home-cafe-recipe/", e: "☕", n: "홈카페 레시피 (TomatoEggCat)" },
  season: { url: "https://tomatoeggcat.com/seasonal-food/", e: "🥬", n: "제철 음식 달력 (TomatoEggCat)" },
  naengpa: { url: "https://tomatoeggcat.com/naengpa/", e: "🍳", n: "냉장고 파먹기 (TomatoEggCat)" },
};

const CAT_ORDER = ["액체", "유지", "장류·소스", "당류", "소금·조미", "가루", "곡물"];
const densByCat = () => CAT_ORDER.map((c) => ({ cat: c, items: DENS.filter((d) => d.cat === c) })).filter((g) => g.items.length);
const AIR_CATS = ["냉동식품", "육류", "해산물", "채소·구황", "빵·간식"];
const STO_CATS = ["육류", "해산물", "유제품·달걀", "채소", "과일", "곡물·건조", "양념·소스", "조리식품"];

const IMP = `import { $, num, fmt, g, ml, show, kv, srcBox, segInit, initTheme, beep, mmss } from "__U__assets/app.mjs";`;

/* ── 도구 정의 ──────────────────────────────────────────────── */
const TOOLS = [
{
  slug: "unit-convert", emoji: "🥄", nav: "계량 단위 변환",
  hubName: "계량 단위 변환기", hubDesc: "재료를 고르면 밀도를 반영해 컵·큰술·작은술·ml·g를 한 번에 환산합니다. 설탕 1컵과 밀가루 1컵은 무게가 다릅니다.",
  title: "계량 단위 변환기 — 재료별 밀도로 컵·큰술·g 정확히 환산",
  ogTitle: "계량 단위 변환기 — 재료 밀도 반영",
  desc: "밀가루 1컵은 몇 g일까? 재료를 고르면 밀도를 반영해 컵(200ml)·큰술(15ml)·작은술(5ml)·ml·g를 한 번에 환산합니다. 재료 76종의 밀도표와 재료별 상세 페이지 제공.",
  h1: "계량 단위 변환기",
  lead: `설탕 1컵 160g, 밀가루 1컵 100g — <strong>같은 1컵도 재료마다 무게가 다릅니다.</strong> 재료를 고르고 환산하세요.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>재료와 수량 입력</h2>
    <label class="f">재료 <span class="u">(밀도표 ${DENS.length}종)</span>
      <select id="ing"></select>
    </label>
    <div class="grid2" style="margin-top:12px">
      <label class="f">수량
        <input type="number" id="qty" inputmode="decimal" min="0" step="0.25" value="1" />
      </label>
      <label class="f">단위
        <select id="unit">
          <option value="컵">컵 (200ml)</option>
          <option value="큰술">큰술 (15ml)</option>
          <option value="작은술">작은술 (5ml)</option>
          <option value="ml">ml</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
      </label>
    </div>
    <button class="btn" id="calcBtn">환산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>환산 결과</h2>
      <p class="big"><span id="fromOut"></span> = <span class="num" id="gramOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
      <p style="margin-top:12px"><a id="detailLink" href="#">이 재료의 상세 계량표 보기 →</a></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>왜 컵 계량은 사람마다 결과가 다를까</h2>
    <p>컵과 큰술은 <strong>부피</strong> 단위입니다. 같은 1컵(200ml)이라도 담기는 재료의 밀도가 다르면 무게가 달라집니다. 물 1컵은 200g이지만 설탕은 약 160g, 중력분 밀가루는 약 100g, 빵가루는 50g 남짓입니다. 여기에 밀가루를 눌러 담았는지 숟가락으로 퍼서 깎았는지에 따라 다시 10~20%가 달라집니다. 레시피는 컵으로 적혀 있는데 결과가 매번 다르다면 대부분 이 지점이 원인입니다.</p>
    <p>이 변환기는 재료별 밀도(g/ml)를 곱해 컵·큰술·작은술·ml·g를 한 번에 보여줍니다. 반대로 "설탕 250g은 몇 컵인가"처럼 무게에서 부피를 찾는 것도 됩니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>재료를 고릅니다(액체·유지·장류·당류·조미·가루·곡물 순으로 묶여 있습니다).</li>
      <li>가지고 있는 수량과 단위를 넣습니다 — g에서 컵으로도, 컵에서 g으로도 환산됩니다.</li>
      <li>결과 표에서 컵·큰술·작은술·ml·g 값을 한 번에 확인합니다.</li>
      <li>자주 쓰는 재료라면 아래 "상세 계량표"에서 1/4컵·1/2컵 단위까지 정리된 표를 볼 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "1컵이 200ml인가요, 240ml인가요?", a: "한국 계량컵은 200ml가 표준이고 미국 레시피의 1컵은 약 240ml입니다. 이 사이트는 200ml 기준으로 계산합니다. 해외 레시피를 옮길 때는 ml로 바꿔서 계산하는 편이 안전합니다." },
    { q: "밥숟가락으로 계량해도 되나요?", a: "일반적인 밥숟가락은 계량스푼 1큰술(15ml)보다 조금 작아 대략 10~12ml 정도인 경우가 많습니다. 국물 요리에서는 큰 차이가 없지만 제과·제빵이나 염도가 중요한 조리에서는 계량스푼이나 저울을 쓰는 편이 좋습니다." },
    { q: "밀가루 1컵이 100g이 아닌데요?", a: "밀가루는 담는 방법에 따라 편차가 가장 큰 재료입니다. 체 친 뒤 숟가락으로 퍼 담고 깎으면 95~105g, 컵으로 퍼서 눌러 담으면 130g을 넘기도 합니다. 이 사이트의 값은 깎아 담은 기준의 근사값입니다." },
    { q: "액체는 왜 g과 ml이 거의 같나요?", a: "물의 밀도가 1g/ml이기 때문입니다. 우유·식초·육수처럼 물이 대부분인 액체는 g과 ml이 거의 같고, 기름은 약 0.92배로 가벼우며 꿀·물엿은 1.4배로 무겁습니다." },
  ],
  basis: MEASURE_BASIS,
  disclaimer: DISC("밀도값은 계량 관행에 근거한 근사값이며 제품·상태에 따라 달라집니다."),
  script: `import { DENSITY_UNITS } from "__U__data/density.mjs";
import { findDensity, toGram, fromGram, round } from "__U__lib/cook.mjs";
${IMP}
const GROUPS = ${JSON.stringify(densByCat().map((g) => ({ cat: g.cat, items: g.items.map((d) => ({ n: d.name, v: d.value, s: d.slug, note: d.note })) })))};
const ALL = [];
const sel = $("ing");
for (const grp of GROUPS) {
  const og = document.createElement("optgroup");
  og.label = grp.cat;
  for (const it of grp.items) {
    ALL.push(it);
    const o = document.createElement("option");
    o.value = it.n; o.textContent = it.n;
    og.appendChild(o);
  }
  sel.appendChild(og);
}
sel.value = "밀가루";
$("calcBtn").addEventListener("click", () => {
  const it = ALL.find((x) => x.n === sel.value);
  const qty = num($("qty"), 0);
  const unit = $("unit").value;
  const gram = toGram(qty, unit, it.v);
  $("fromOut").textContent = it.n + " " + fmt(qty, 2) + unit;
  $("gramOut").textContent = g(gram);
  const rows = [];
  rows.push(["부피", ml(gram / it.v)]);
  rows.push(["컵 (200ml)", fmt(fromGram(gram, "컵", it.v), 2) + "컵"]);
  rows.push(["큰술 (15ml)", fmt(fromGram(gram, "큰술", it.v), 1) + "큰술"]);
  rows.push(["작은술 (5ml)", fmt(fromGram(gram, "작은술", it.v), 1) + "작은술"]);
  rows.push(["무게", g(gram)]);
  rows.push(["밀도", it.v + " g/ml"]);
  $("tableOut").innerHTML = kv(rows);
  $("noteOut").textContent = it.note ? "메모: " + it.note : "담는 방법(눌러 담기·수북이)에 따라 ±10~20% 차이가 날 수 있습니다.";
  const a = $("detailLink");
  a.href = "__U__convert/" + it.s + "/";
  a.textContent = it.n + " 상세 계량표 보기 →";
  $("srcOut").innerHTML = srcBox("계량 기준", [
    { text: "1컵 = " + DENSITY_UNITS.cup.ml + "ml · 1큰술 = " + DENSITY_UNITS.tbsp.ml + "ml · 1작은술 = " + DENSITY_UNITS.tsp.ml + "ml", checkedAt: DENSITY_UNITS.cup.checkedAt },
    { text: "밀도값 출처 — 자체 환산 기준(국내 계량 관행 근사, 참고용)", checkedAt: "${TODAY}" },
  ]);
  show("resultBox");
});`,
  related: [{ slug: "recipe-scale", e: "📝", n: "레시피 배수 계산기" }, { slug: "baking-pan", e: "🎂", n: "베이킹 팬 변환" }, X.fridge, X.season],
},
{
  slug: "recipe-scale", emoji: "📝", nav: "레시피 배수 계산",
  hubName: "레시피 배수 계산기", hubDesc: "재료 목록을 통째로 붙여넣으면 단위를 알아서 읽어 2배·0.5배로 전부 다시 계산합니다. 컵·큰술은 g까지 함께 표시.",
  title: "레시피 배수 계산기 — 재료 목록 붙여넣고 2인분↔4인분 변환",
  ogTitle: "레시피 배수 계산기 — 목록 통째로 환산",
  desc: "레시피 재료 목록을 그대로 붙여넣으면 큰술·컵·ml·g·개 단위를 자동으로 읽어 원하는 인분 수로 전부 환산합니다. 부피 단위 재료는 밀도를 반영한 g 무게도 함께 표시합니다.",
  h1: "레시피 배수 계산기",
  lead: `재료 목록을 <strong>통째로 붙여넣기</strong> → 2인분을 3인분으로, 4인분을 1인분으로 한 번에 환산합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>재료 목록 붙여넣기</h2>
    <label class="f">한 줄에 재료 하나씩
      <textarea id="src" spellcheck="false">돼지고기 300g
양파 1개
간장 3큰술
설탕 1+1/2큰술
다진마늘 1작은술
물 300ml
후춧가루 약간</textarea>
    </label>
    <div class="grid3" style="margin-top:12px">
      <label class="f">원래 인분
        <input type="number" id="from" inputmode="decimal" min="0.5" step="0.5" value="2" />
      </label>
      <label class="f">만들 인분
        <input type="number" id="to" inputmode="decimal" min="0.5" step="0.5" value="4" />
      </label>
      <label class="f">또는 배수 직접 입력
        <input type="number" id="mult" inputmode="decimal" min="0" step="0.1" placeholder="비우면 인분으로 계산" />
      </label>
    </div>
    <div class="chips" id="quick" role="group" aria-label="빠른 배수">
      <button type="button" class="chip" data-m="0.5">×0.5</button>
      <button type="button" class="chip" data-m="1.5">×1.5</button>
      <button type="button" class="chip" data-m="2">×2</button>
      <button type="button" class="chip" data-m="3">×3</button>
    </div>
    <button class="btn" id="calcBtn">배수 적용하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>환산 결과 <span class="pill" id="multOut"></span></h2>
      <div id="tableOut"></div>
      <p class="note">"약간·조금" 처럼 수량이 없는 표기는 배수를 적용하지 않고 그대로 둡니다. 소금·향신료는 배수대로 넣으면 짜거나 강해지기 쉬우니 <strong>먼저 70%만 넣고 맛을 보며 조절</strong>하세요.</p>
      <div class="stack">
        <button class="btn2" id="copyBtn" type="button">📋 결과 복사</button>
      </div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>배수 계산이 어긋나는 지점</h2>
    <p>레시피를 2배로 만들 때 모든 재료를 정직하게 2배 하면 실패하는 경우가 있습니다. 특히 <strong>소금·간장 같은 염분과 향신료</strong>는 양이 커질수록 체감 강도가 더 크게 올라가고, <strong>물</strong>은 냄비 면적이 그대로면 증발량이 비례하지 않아 오히려 남습니다. 반대로 밀가루·설탕·유지처럼 구조를 만드는 재료는 정확히 비례해야 합니다.</p>
    <p>이 도구는 목록을 통째로 읽어 수량·단위를 분리한 뒤 배수를 적용하고, 컵·큰술 같은 부피 단위는 밀도를 아는 재료에 한해 g 무게를 함께 보여줍니다. 양이 늘어날수록 계량스푼보다 저울이 편해지기 때문입니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>레시피의 재료 목록을 복사해 그대로 붙여넣습니다. "- " 같은 글머리 기호나 "1. " 번호는 자동으로 무시합니다.</li>
      <li>원래 인분과 만들 인분을 넣거나, 배수를 직접 입력합니다(×0.5, ×2 버튼도 있습니다).</li>
      <li>결과에서 재료별 새 수량을 확인합니다. 1/2·1/3 같은 분수는 분수로 다시 표기됩니다.</li>
      <li>"결과 복사"로 전체 목록을 클립보드에 담아 메모장이나 채팅에 붙여넣을 수 있습니다.</li>
    </ol>
    <p>인식하는 단위: 컵·큰술·작은술·스푼·ml·L·g·kg·개·알·장·대·쪽·톨·줌·봉지·캔·모·마리·조각 등. "1+1/2컵", "1과 1/2컵", "반 컵", "두 개" 같은 표기도 읽습니다.</p>`,
  faq: [
    { q: "인식하지 못한 줄은 어떻게 되나요?", a: "수량을 찾지 못한 줄은 원문 그대로 남기고 '수량 없음'으로 표시합니다. 제목 줄이나 '약간' 같은 표기가 여기에 해당하며, 배수를 적용하지 않습니다." },
    { q: "왜 소금은 배수대로 넣으면 안 되나요?", a: "짠맛은 농도로 느끼기 때문에 국물 양이 2배가 되면 소금도 2배가 맞지만, 볶음·구이처럼 표면에 붙는 조리에서는 재료 표면적이 2배로 늘지 않아 과하게 짜집니다. 먼저 70%만 넣고 맛을 보며 채우는 편이 안전합니다." },
    { q: "조리 시간도 배수로 늘려야 하나요?", a: "아닙니다. 양이 2배가 되어도 조리 시간이 2배가 되지는 않습니다. 다만 냄비에 재료가 많아지면 온도가 늦게 올라오므로 끓기 시작하는 시점이 늦어지고, 볶음은 한 번에 하지 말고 나눠 볶는 편이 좋습니다." },
    { q: "달걀 1.5개 같은 결과는 어떻게 하나요?", a: "달걀은 흰자·노른자를 풀어서 무게로 나누면 정확합니다. 큰 달걀 1개는 껍질을 제외하고 약 50~55g입니다. 반개가 필요하면 풀어서 절반 무게만 사용하세요." },
  ],
  basis: MEASURE_BASIS,
  disclaimer: DISC("자동 파싱은 표기 형태에 따라 인식하지 못하는 줄이 있을 수 있으니 결과를 확인 후 사용하세요."),
  script: `import { scaleList, fmtQty, round } from "__U__lib/cook.mjs";
${IMP}
let mult = null;
const chips = [...document.querySelectorAll("#quick .chip")];
chips.forEach((c) => c.addEventListener("click", () => {
  $("mult").value = c.dataset.m;
  run();
}));
function factor() {
  const m = parseFloat($("mult").value);
  if (isFinite(m) && m > 0) return m;
  const f = num($("from"), 1), t = num($("to"), 1);
  return f > 0 ? t / f : 1;
}
function run() {
  const k = factor();
  const rows = scaleList($("src").value, k);
  const html = [];
  const plain = [];
  for (const r of rows) {
    if (r.qty == null) {
      html.push('<div class="kv"><span>' + r.raw + '</span><b class="mut">수량 없음</b></div>');
      plain.push(r.raw);
      continue;
    }
    let right = fmtQty(r.qty) + r.unit;
    if (r.gram != null) right += ' <span class="mut">(' + fmt(r.gram, 1) + 'g)</span>';
    html.push('<div class="kv"><span>' + r.name + ' <span class="mut">' + fmtQty(r.qty / k) + r.unit + '</span></span><b>' + right + '</b></div>');
    plain.push(r.name + " " + fmtQty(r.qty) + r.unit + (r.gram != null ? " (" + fmt(r.gram, 1) + "g)" : ""));
  }
  $("tableOut").innerHTML = html.join("");
  $("multOut").textContent = "×" + fmtQty(round(k, 3));
  $("copyBtn").dataset.txt = plain.join("\\n");
  $("srcOut").innerHTML = srcBox("계량 기준", [
    { text: "1컵 = 200ml · 1큰술 = 15ml · 1작은술 = 5ml (한국 표준 계량)", checkedAt: "${TODAY}" },
    { text: "g 병기는 재료 밀도표(참고용 근사값)를 적용한 값", checkedAt: "${TODAY}" },
  ]);
  show("resultBox");
}
$("calcBtn").addEventListener("click", run);
$("copyBtn").addEventListener("click", () => {
  const txt = $("copyBtn").dataset.txt || "";
  navigator.clipboard.writeText(txt).then(() => { $("copyBtn").textContent = "✅ 복사됨"; setTimeout(() => { $("copyBtn").textContent = "📋 결과 복사"; }, 1500); });
});`,
  related: [{ slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, { slug: "baking-pan", e: "🎂", n: "베이킹 팬 변환" }, X.fridge, X.naengpa],
},
];

TOOLS.push({
  slug: "rice-water", emoji: "🍚", nav: "밥물 계산기",
  hubName: "밥물 계산기", hubDesc: "쌀 몇 컵에 물 얼마? 백미·현미·잡곡·찹쌀, 불림 여부, 압력밥솥·냄비까지 반영해 ml로 알려줍니다.",
  title: "밥물 계산기 — 쌀 컵수·불림 여부·밥솥 종류별 물 양(ml)",
  ogTitle: "밥물 계산기 — 쌀 컵수별 물 양",
  desc: "쌀 몇 컵에 물이 몇 ml인지 계산합니다. 백미·현미·잡곡·찹쌀별 비율, 불린 쌀과 안 불린 쌀, 압력밥솥·전기밥솥·냄비 보정까지 반영해 ml와 컵으로 알려줍니다.",
  h1: "밥물 계산기",
  lead: `쌀 종류·불림 여부·밥솥 종류를 넣으면 <strong>물 양을 ml로</strong> 알려드립니다. 냄비밥도 지원합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>조건 입력</h2>
    <div class="grid2">
      <label class="f">쌀 양 <span class="u">(컵 · 1컵 200ml ≈ ${RICE_RATIO.riceGPerCup}g)</span>
        <input type="number" id="cups" inputmode="decimal" min="0.5" step="0.5" value="2" />
      </label>
      <label class="f">밥솥 종류
        <select id="cooker">${RICE_RATIO.cookers.map((c) => `<option value="${c.key}"${c.key === "electric" ? " selected" : ""}>${c.name}</option>`).join("")}</select>
      </label>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">쌀 종류</span>
      <div class="seg" id="typeSeg" role="group" aria-label="쌀 종류">
        ${RICE_RATIO.types.map((t, i) => `<button type="button" data-v="${t.key}" aria-pressed="${i === 0 ? "true" : "false"}">${t.name}</button>`).join("\n        ")}
      </div>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">불림 여부</span>
      <div class="seg" id="soakSeg" role="group" aria-label="불림 여부">
        <button type="button" data-v="0" aria-pressed="true">안 불림 (바로 취사)</button>
        <button type="button" data-v="1" aria-pressed="false">30분 이상 불림</button>
      </div>
    </div>
    <button class="btn" id="calcBtn">밥물 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">물 <span class="num" id="waterOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>"쌀 손등 한 마디"가 맞을 때와 틀릴 때</h2>
    <p>손등 계량은 냄비 바닥 면적과 쌀 양이 함께 커질 때만 맞는 방법입니다. 1인분처럼 쌀이 적으면 물 높이가 상대적으로 높아져 질어지고, 넓은 냄비에서는 반대로 부족해집니다. 부피 비율로 계산하면 양이 달라져도 결과가 일정합니다.</p>
    <p>핵심 변수는 세 가지입니다. <strong>쌀 종류</strong>(현미·잡곡은 물을 더 먹습니다), <strong>불림 여부</strong>(불린 쌀은 이미 물을 머금고 있어 물을 줄입니다), <strong>조리 기구</strong>(압력밥솥은 증발이 적고 뚜껑 있는 냄비는 증발이 많습니다). 이 계산기는 셋을 곱해서 최종 물 양을 냅니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>쌀 양을 계량컵(200ml) 기준 컵 수로 넣습니다. 밥솥에 딸린 계량컵은 180ml인 경우가 많으니 주의하세요.</li>
      <li>쌀 종류와 불림 여부를 고릅니다.</li>
      <li>밥솥 종류를 고르면 증발량 보정이 적용됩니다.</li>
      <li>결과의 물 양(ml)을 계량컵이나 저울(1ml ≈ 1g)로 맞춰 넣습니다.</li>
    </ol>`,
  faq: [
    { q: "밥솥 계량컵과 계량컵이 다른가요?", a: "네. 전기밥솥에 딸려 오는 컵은 대개 180ml(쌀 약 150g)이고, 요리용 표준 계량컵은 200ml입니다. 이 계산기는 200ml 기준이므로 밥솥 컵으로 쟀다면 컵 수에 0.9를 곱해 넣으세요." },
    { q: "쌀을 씻은 뒤 물기를 빼야 하나요?", a: "네. 씻은 직후에는 쌀 표면과 사이사이에 물이 남아 있어 그대로 물을 부으면 양이 많아집니다. 체에 5~10분 받쳐 물기를 뺀 뒤 계량하는 편이 일정합니다." },
    { q: "찹쌀은 왜 물이 적나요?", a: "찹쌀은 아밀로펙틴 비율이 높아 같은 물에도 훨씬 차지고 질어집니다. 백미보다 물을 20% 정도 줄이고, 찰밥은 불려서 찌는 방식이 실패가 적습니다." },
    { q: "냄비밥은 어떻게 하나요?", a: "물 양은 계산기의 냄비 보정값(+15%)을 쓰고, 센 불에서 끓으면 약불로 12~13분, 불을 끄고 10분 뜸을 들입니다. 뚜껑을 자주 열면 증발이 늘어 물이 부족해집니다." },
  ],
  basis: `<h2>비율 기준</h2>
    <p class="note">밥물 비율은 <strong>국내 요리 관행값(참고용)</strong>이며 쌀의 도정일·품종·수분 함량에 따라 달라집니다(데이터 확인일 ${TODAY}).
    같은 조건에서 두세 번 지어 보고 취향에 맞게 ±5~10% 조정하세요. 햅쌀은 수분이 많아 물을 조금 줄이고, 묵은쌀은 조금 늘립니다.</p>`,
  disclaimer: DISC("밥물 비율은 취향과 쌀 상태에 따라 조정이 필요한 관행값입니다."),
  script: `import { RICE_RATIO } from "__U__data/misc.mjs";
import { riceWater, round } from "__U__lib/cook.mjs";
${IMP}
let type = "white", soaked = 0;
segInit($("typeSeg"), (v) => { type = v; });
segInit($("soakSeg"), (v) => { soaked = +v; });
$("calcBtn").addEventListener("click", () => {
  const t = RICE_RATIO.types.find((x) => x.key === type);
  const c = RICE_RATIO.cookers.find((x) => x.key === $("cooker").value);
  const cups = num($("cups"), 1);
  const r = riceWater(cups, t, c, !!soaked);
  $("waterOut").textContent = ml(r.waterMl);
  $("tableOut").innerHTML = kv([
    ["쌀", fmt(cups, 2) + "컵 (" + ml(r.riceMl) + " · 약 " + fmt(r.riceG) + "g)"],
    ["기본 비율", t.name + " " + (soaked ? "불림" : "안 불림") + " → 쌀 부피 × " + r.ratio],
    ["기구 보정", c.name + " × " + c.factor],
    ["물", ml(r.waterMl) + " (약 " + fmt(r.waterCups, 2) + "컵)"],
    ["물 무게로 재면", fmt(r.waterMl) + "g"],
  ]);
  $("noteOut").textContent = t.note + " · " + c.note;
  $("srcOut").innerHTML = srcBox("비율 출처", [
    { text: t.name + " 비율 — " + t.source, checkedAt: t.checkedAt },
    { text: c.name + " 보정 — " + c.source, checkedAt: c.checkedAt },
  ]);
  show("resultBox");
});`,
  related: [{ slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, { slug: "timer-multi", e: "⏲️", n: "동시 타이머" }, X.fridge, X.season],
});

const airList = () => AIR_CATS.map((c) => {
  const items = AIRS.filter((a) => a.cat === c);
  return `<h3 class="f" style="margin:18px 0 0;font-size:14px">${c} <span class="mut">(${items.length})</span></h3>
    <div class="linkgrid">${items.map((a) => `<a href="${a.slug}/" data-n="${esc(a.name)}">${esc(a.name)} <span class="mut">${a.value.temp}℃ ${a.value.time}분</span></a>`).join("")}</div>`;
}).join("\n    ");

TOOLS.push({
  slug: "airfryer", emoji: "🍟", nav: "에어프라이어 변환",
  hubName: "에어프라이어 변환기", hubDesc: "오븐 레시피의 온도·시간을 에어프라이어 기준으로 바꾸고, 재료 48종의 기본 온도·시간표를 함께 봅니다.",
  title: "에어프라이어 온도·시간 변환기 — 오븐 레시피를 그대로 옮기기",
  ogTitle: "에어프라이어 변환기 — 오븐 온도·시간 환산",
  desc: `오븐 레시피의 온도와 시간을 에어프라이어 기준으로 변환합니다(온도 20℃ 낮추고 시간 20% 단축 — 관행 규칙, 참고용). 냉동식품·육류·해산물·채소 등 재료 ${AIRS.length}종의 기본 온도·시간표도 함께 제공합니다.`,
  h1: "에어프라이어 변환기",
  lead: `오븐 레시피를 <strong>에어프라이어 온도·시간으로</strong> 바꾸고, 재료 ${AIRS.length}종 기본표를 함께 확인하세요.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>오븐 → 에어프라이어 변환</h2>
    <div class="grid2">
      <label class="f">오븐 온도 <span class="u">(℃)</span>
        <input type="number" id="temp" inputmode="decimal" min="80" max="280" step="5" value="200" />
      </label>
      <label class="f">오븐 시간 <span class="u">(분)</span>
        <input type="number" id="time" inputmode="decimal" min="1" step="1" value="25" />
      </label>
    </div>
    <p class="note">적용 규칙: 온도 ${Math.abs(OVEN_RULE.tempDelta.value)}℃ 낮추고 시간 ${Math.round((1 - OVEN_RULE.timeFactor.value) * 100)}% 단축 <span class="badge warn">${OVEN_RULE.label}</span></p>
    <button class="btn" id="calcBtn">에어프라이어 기준으로 변환</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>변환 결과</h2>
      <p class="big">에어프라이어 <span class="num" id="tempOut"></span></p>
      <div id="tableOut"></div>
      <p class="note">표시 시간의 70% 지점에서 한 번 열어 상태를 확인하고, 겉이 빨리 타면 온도를 10℃ 더 낮추세요. 육류·가금류는 속까지 완전히 익은 것을 확인한 뒤 드세요.</p>
    </div>
    <div id="srcOut"></div>
  </section>

  <section class="card">
    <h2>재료별 기본 온도·시간표 <span class="pill">${AIRS.length}종</span></h2>
    <label class="f">재료 검색
      <input type="search" id="q" placeholder="예: 감자, 삼겹살, 만두" autocomplete="off" />
    </label>
    <div id="listBox">
    ${airList()}
    </div>
    <p class="note" id="empty" hidden>검색 결과가 없습니다. 다른 이름으로 찾아보세요.</p>
  </section>`,
  intro: `<h2>오븐 시간을 그대로 쓰면 왜 탈까</h2>
    <p>에어프라이어는 작은 챔버 안에서 팬으로 뜨거운 공기를 강하게 순환시키는 <strong>소형 컨벡션 오븐</strong>입니다. 같은 온도라도 공기가 빠르게 움직이면 표면에서 열이 훨씬 잘 전달되기 때문에, 오븐 레시피의 온도·시간을 그대로 쓰면 겉은 타고 속은 덜 익는 일이 생깁니다. 그래서 관행적으로 <strong>온도를 20℃ 낮추고 시간을 20% 줄이는</strong> 규칙을 씁니다.</p>
    <p>이 규칙은 공식 규격이 아니라 경험칙입니다. 기기 용량이 작을수록(3~4L) 열이 더 세게 닿고, 바스켓에 재료를 가득 채우면 공기가 돌지 않아 오히려 오븐보다 오래 걸립니다. 한 겹으로 펼치고, 중간에 한 번 흔들어 주는 것이 시간보다 중요합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>오븐 레시피에 적힌 온도(℃)와 시간(분)을 입력합니다.</li>
      <li>변환된 온도와 시간 범위를 확인합니다. 범위로 나오는 이유는 기기 편차 때문입니다.</li>
      <li>아래 표에서 만들려는 재료를 검색해 기본 온도·시간과 비교합니다.</li>
      <li>재료 이름을 누르면 그 재료만 다룬 상세 페이지(예열·뒤집기·응용)로 이동합니다.</li>
    </ol>`,
  faq: [
    { q: "예열이 꼭 필요한가요?", a: "냉동식품처럼 오래 굽는 것은 예열 없이 넣어도 큰 차이가 없지만, 고기·생선처럼 표면을 빠르게 익혀야 하는 재료는 3~5분 예열하면 결과가 좋습니다. 예열했다면 표시 시간에서 1~2분 줄이세요." },
    { q: "종이호일을 깔아도 되나요?", a: "재료 아래에 눌러 깔고 가장자리가 팬에 닿지 않게 하면 사용할 수 있습니다. 다만 바닥을 완전히 덮으면 공기 순환이 막혀 아래쪽이 눅눅해지므로 구멍이 뚫린 제품을 쓰거나 필요한 부분만 까세요. 예열 중 빈 종이호일만 넣는 것은 위험합니다." },
    { q: "기름을 발라야 하나요?", a: "튀김옷이 있는 냉동식품은 대개 기름 없이도 됩니다. 채소·두부처럼 마른 재료는 기름을 아주 얇게 발라야 표면이 마르지 않고 바삭해집니다. 분무기로 뿌리면 양 조절이 쉽습니다." },
    { q: "시간표대로 했는데 덜 익었어요.", a: "재료 두께와 양이 표 기준보다 크면 시간이 더 필요합니다. 특히 바스켓을 가득 채우면 공기가 돌지 못해 시간이 1.5배까지 늘어납니다. 한 겹으로 펼치고, 부족하면 3분씩 추가하며 확인하세요." },
  ],
  basis: AIR_BASIS,
  disclaimer: DISC("온도·시간은 기기·용량·재료 두께에 따라 달라지는 관행값입니다. 육류·가금류는 반드시 속까지 완전히 익혀 드세요."),
  script: `import { OVEN_RULE } from "__U__data/airfryer.mjs";
import { ovenToAir } from "__U__lib/cook.mjs";
${IMP}
$("calcBtn").addEventListener("click", () => {
  const t = num($("temp"), 200), m = num($("time"), 20);
  const r = ovenToAir(t, m, OVEN_RULE);
  $("tempOut").textContent = r.temp + "℃ / " + r.minMin + "~" + r.minMax + "분";
  $("tableOut").innerHTML = kv([
    ["오븐 기준", t + "℃ · " + m + "분"],
    ["온도 변환", t + "℃ − " + Math.abs(OVEN_RULE.tempDelta.value) + "℃ → " + r.temp + "℃ (5℃ 단위 반올림)"],
    ["시간 변환", m + "분 × " + OVEN_RULE.timeFactor.value + " → 약 " + r.mid + "분"],
    ["권장 확인 시점", Math.max(1, Math.round(r.mid * 0.7)) + "분 (한 번 열어 확인·뒤집기)"],
  ]);
  $("srcOut").innerHTML = srcBox("변환 규칙 출처", [
    { text: "온도 " + OVEN_RULE.tempDelta.value + "℃ · 시간 × " + OVEN_RULE.timeFactor.value + " — " + OVEN_RULE.tempDelta.source + " [" + OVEN_RULE.label + "]", checkedAt: OVEN_RULE.tempDelta.checkedAt },
  ]);
  show("resultBox");
});
const q = $("q");
q.addEventListener("input", () => {
  const v = q.value.trim().toLowerCase();
  let hit = 0;
  for (const a of document.querySelectorAll("#listBox a")) {
    const on = !v || (a.dataset.n || "").toLowerCase().includes(v);
    a.style.display = on ? "" : "none";
    if (on) hit++;
  }
  for (const h of document.querySelectorAll("#listBox h3")) {
    const grid = h.nextElementSibling;
    const any = [...grid.querySelectorAll("a")].some((a) => a.style.display !== "none");
    h.style.display = any ? "" : "none";
    grid.style.display = any ? "" : "none";
  }
  $("empty").hidden = hit > 0;
});`,
  related: [{ slug: "timer-multi", e: "⏲️", n: "동시 타이머" }, { slug: "brine", e: "🧂", n: "염지 계산기" }, X.air, X.fridge],
});

const stoList = () => STO_CATS.map((c) => {
  const items = STOR.filter((s) => s.cat === c);
  return `<h3 class="f" style="margin:18px 0 0;font-size:14px">${c} <span class="mut">(${items.length})</span></h3>
    <div class="rowlist">${items.map((s) => `<div class="row" data-n="${esc(s.name)}"><span class="nm"><a href="${s.slug}/">${esc(s.name)}</a></span><span class="mut">${s.value.fridge ? "냉장 " + esc(s.value.fridge) : s.value.room ? "실온 " + esc(s.value.room) : "냉동 " + esc(s.value.frozen || "-")}</span></div>`).join("")}</div>`;
}).join("\n    ");

TOOLS.push({
  slug: "storage", emoji: "🧊", nav: "식재료 보관기간",
  hubName: "식재료 보관기간", hubDesc: `냉장·냉동·실온 보관기간을 재료 ${STOR.length}종에서 검색합니다. 산 날짜를 넣으면 남은 기간을 계산합니다.`,
  title: `식재료 보관기간 검색 — 냉장·냉동·실온 ${STOR.length}종`,
  ogTitle: "식재료 보관기간 — 냉장·냉동 며칠까지?",
  desc: `삼겹살은 냉장 며칠? 두부는 개봉 후 얼마나? 육류·해산물·채소·유제품 등 ${STOR.length}종의 실온·냉장·냉동 보관기간을 검색하고, 구입일을 넣으면 남은 기간을 계산합니다. 일반 권고 범위 기준의 참고용 정보입니다.`,
  h1: "식재료 보관기간",
  lead: `재료 이름으로 검색하면 <strong>실온·냉장·냉동</strong> 권장 기간을 보여줍니다. <span class="badge warn">보관 상태에 따라 다름</span>`,
  body: `
  <section class="card" aria-label="검색">
    <h2>재료 검색</h2>
    <label class="f">재료 이름
      <input type="search" id="q" placeholder="예: 삼겹살, 두부, 우유, 감자" autocomplete="off" />
    </label>
    <div class="grid2" style="margin-top:12px">
      <label class="f">구입·개봉일 <span class="u">(선택 — 남은 기간 계산)</span>
        <input type="date" id="buyDate" />
      </label>
      <label class="f">보관 방법
        <select id="place"><option value="fridge">냉장</option><option value="frozen">냉동</option><option value="room">실온</option></select>
      </label>
    </div>
    <button class="btn" id="calcBtn">남은 기간 계산</button>
    <p class="note" id="calcNote" style="margin-top:8px">검색어와 일치하는 재료가 있을 때 구입일 기준 남은 기간을 계산합니다.</p>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>보관 기간 <span class="pill" id="nameOut"></span></h2>
      <div id="tableOut"></div>
      <p class="note" id="tipOut"></p>
      <p id="linkOut" style="margin-top:10px"></p>
    </div>
    <div id="srcOut"></div>
  </section>

  <section class="card">
    <h2>전체 목록 <span class="pill">${STOR.length}종</span></h2>
    <div id="listBox">
    ${stoList()}
    </div>
    <p class="note" id="empty" hidden>검색 결과가 없습니다. 다른 이름으로 찾아보세요.</p>
  </section>`,
  intro: `<h2>"며칠까지 괜찮나"에 정답이 없는 이유</h2>
    <p>보관기간 표는 <strong>품질이 유지되는 일반적인 범위</strong>이지 안전을 보장하는 선이 아닙니다. 같은 삼겹살이라도 정육점에서 그날 썬 것과 며칠 진열된 것, 냉장고 문 쪽에 둔 것과 안쪽 최하단에 둔 것은 실제 수명이 크게 다릅니다. 냉장고 문 쪽은 여닫을 때마다 온도가 오르내려 가장 불리한 자리입니다.</p>
    <p>그래서 이 표는 기간을 <strong>판단의 출발점</strong>으로만 쓰시길 권합니다. 냉동은 세균 증식을 멈추므로 표시된 기간은 대개 "맛과 식감이 유지되는" 기간이고, 그 이후에도 안전상 문제가 없는 경우가 많지만 냉동상(수분 손실)으로 맛이 떨어집니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>재료 이름을 검색합니다. 아래 목록이 실시간으로 걸러집니다.</li>
      <li>구입일 또는 개봉일을 넣고 보관 방법을 고른 뒤 "남은 기간 계산"을 누릅니다.</li>
      <li>결과에서 실온·냉장·냉동 각각의 권장 기간과 보관 요령을 확인합니다.</li>
      <li>재료 이름을 누르면 그 재료만 다룬 상세 페이지로 이동합니다.</li>
    </ol>`,
  faq: [
    { q: "유통기한이 지났는데 먹어도 되나요?", a: "유통기한은 판매 가능 기한이고 소비기한은 섭취 가능 기한입니다. 2023년부터 국내 표시는 소비기한으로 바뀌었습니다. 표시가 있는 제품은 표시를 우선하고, 이 표는 포장에 기한 표시가 없는 신선식품이나 개봉 후 기간을 가늠할 때 쓰세요." },
    { q: "한 번 녹인 고기를 다시 얼려도 되나요?", a: "권장하지 않습니다. 해동 과정에서 온도가 올라가며 세균이 증식하고, 재냉동하면 조직이 망가져 맛도 떨어집니다. 냉장고에서 천천히 해동해 아직 차가운 상태라면 하루 안에 조리하는 편이 안전합니다." },
    { q: "냉동실에 넣으면 얼마나 오래 두어도 되나요?", a: "−18℃ 이하에서는 미생물이 증식하지 못하므로 안전 측면에서는 오래 갑니다. 다만 지방 산패와 냉동상으로 맛이 떨어지므로 이 표의 기간은 '품질 유지 기간'으로 보시고, 공기를 뺀 밀봉 포장으로 보관 기간을 늘리세요." },
    { q: "냉장고 어디에 두는 게 좋나요?", a: "가장 차가운 최하단 안쪽이 육류·생선 자리이고, 문 쪽은 온도 변화가 커 음료나 소스에 적합합니다. 채소는 전용 칸의 습도 유지가 중요하고, 달걀은 문 쪽 대신 안쪽 선반이 좋습니다." },
  ],
  basis: `<h2>데이터 기준</h2>
    <p class="note">보관기간은 <a href="https://www.foodsafety.gov/keep-food-safe/foodkeeper-app" target="_blank" rel="noopener">FoodKeeper</a>와
    <a href="https://www.foodsafetykorea.go.kr" target="_blank" rel="noopener">식품안전나라</a> 등에서 공통적으로 안내하는
    가정 보관 시 <strong>품질 유지 기간의 일반 권고 범위</strong>를 종합한 값입니다(전 항목 출처·확인일 표기, 데이터 확인일 ${TODAY}).
    <span class="badge warn">보관 상태에 따라 다름</span> — 냉장고 온도(0~4℃ 권장), 포장 상태, 구입 시 신선도에 따라 실제 기간은 크게 달라집니다.</p>`,
  disclaimer: FOOD_SAFETY,
  script: `import { STORAGE } from "__U__data/storage.mjs";
${IMP}
const DATA = STORAGE;
const SLUG = ${JSON.stringify(Object.fromEntries(STOR.map((s) => [s.name, s.slug])))};
const q = $("q");
function filter() {
  const v = q.value.trim().toLowerCase();
  let hit = 0;
  for (const row of document.querySelectorAll("#listBox .row")) {
    const on = !v || (row.dataset.n || "").toLowerCase().includes(v);
    row.style.display = on ? "" : "none";
    if (on) hit++;
  }
  for (const h of document.querySelectorAll("#listBox h3")) {
    const list = h.nextElementSibling;
    const any = [...list.querySelectorAll(".row")].some((r) => r.style.display !== "none");
    h.style.display = any ? "" : "none";
    list.style.display = any ? "" : "none";
  }
  $("empty").hidden = hit > 0;
}
q.addEventListener("input", filter);
function parseDays(s) {
  if (!s) return null;
  const m = String(s).match(/(\\d+)\\s*(?:~\\s*(\\d+))?\\s*(일|개월|주|년)/);
  if (!m) return null;
  const lo = +m[1], hi = m[2] ? +m[2] : +m[1];
  const mul = m[3] === "일" ? 1 : m[3] === "주" ? 7 : m[3] === "개월" ? 30 : 365;
  return { lo: lo * mul, hi: hi * mul };
}
$("calcBtn").addEventListener("click", () => {
  const v = q.value.trim();
  const item = DATA.find((d) => d.name === v) || DATA.find((d) => v && d.name.includes(v)) || null;
  if (!item) { $("calcNote").textContent = "일치하는 재료를 찾지 못했습니다. 목록에서 이름을 확인해 주세요."; return; }
  $("calcNote").textContent = "";
  $("nameOut").textContent = item.name;
  const rows = [
    ["실온", item.value.room || "권장하지 않음"],
    ["냉장", item.value.fridge || "해당 없음"],
    ["냉동", item.value.frozen || "권장하지 않음"],
  ];
  const place = $("place").value;
  const label = place === "fridge" ? "냉장" : place === "frozen" ? "냉동" : "실온";
  const span = parseDays(item.value[place]);
  const dv = $("buyDate").value;
  if (dv && span) {
    const days = Math.floor((Date.now() - new Date(dv + "T00:00:00").getTime()) / 86400000);
    const left = span.hi - days;
    rows.push([label + " 보관 경과", days + "일"]);
    rows.push([label + " 권장 잔여", left >= 0 ? "약 " + Math.max(0, span.lo - days) + "~" + left + "일" : "권장 기간 초과 (" + (-left) + "일)"]);
  } else if (dv) {
    rows.push([label + " 잔여 계산", "기간 표기를 숫자로 읽을 수 없어 생략"]);
  }
  $("tableOut").innerHTML = kv(rows);
  $("tipOut").textContent = (item.tip ? item.tip + " · " : "") + "보관 상태에 따라 다릅니다. 표시된 소비기한이 있으면 표시를 우선하세요.";
  const link = SLUG[item.name];
  $("linkOut").innerHTML = link ? '<a href="__U__storage/' + link + '/">' + item.name + ' 상세 보관법 →</a>' : "";
  $("srcOut").innerHTML = srcBox("데이터 출처", [{ text: item.source, checkedAt: item.checkedAt }]);
  show("resultBox");
});`,
  related: [{ slug: "calorie-plate", e: "🍽️", n: "한 끼 칼로리" }, { slug: "airfryer", e: "🍟", n: "에어프라이어 변환" }, X.fridge, X.naengpa, X.season],
});

TOOLS.push({
  slug: "kimchi-salt", emoji: "🥬", nav: "김치 절임 계산",
  hubName: "김치 절임 계산기", hubDesc: "배추 무게만 넣으면 절임물 양·굵은소금 양·켜켜이 뿌릴 소금·절임 시간을 계절별로 계산합니다.",
  title: "김치 절임 소금 계산기 — 배추 무게별 절임물·소금 양과 시간",
  ogTitle: "김치 절임 소금 계산기",
  desc: "배추 몇 kg에 굵은소금 얼마? 절임물 양, 소금 농도(8~10%), 켜켜이 뿌릴 소금, 여름·겨울 절임 시간을 배추 무게 기준으로 계산합니다. 꽃소금 사용 시 보정도 안내합니다.",
  h1: "김치 절임 계산기",
  lead: `배추 무게만 넣으면 <strong>절임물·소금 양·절임 시간</strong>을 계산합니다. 김장 실패의 절반은 절임에서 갈립니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>배추 무게 입력</h2>
    <div class="grid2">
      <label class="f">배추 총 무게 <span class="u">(kg · 다듬은 뒤)</span>
        <input type="number" id="kg" inputmode="decimal" min="0.5" step="0.5" value="10" />
      </label>
      <label class="f">절임물 소금 농도 <span class="u">(% · 8~10 권장)</span>
        <input type="number" id="pct" inputmode="decimal" min="5" max="15" step="0.5" value="${KIMCHI.brinePct.value}" />
      </label>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">소금 종류</span>
      <div class="seg" id="saltSeg" role="group" aria-label="소금 종류">
        <button type="button" data-v="coarse" aria-pressed="true">굵은소금(천일염)</button>
        <button type="button" data-v="fine" aria-pressed="false">꽃소금(가는 소금)</button>
      </div>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">계절</span>
      <div class="seg" id="seasonSeg" role="group" aria-label="계절">
        <button type="button" data-v="summer" aria-pressed="false">여름 (더울 때)</button>
        <button type="button" data-v="winter" aria-pressed="true">겨울 (김장철)</button>
      </div>
    </div>
    <button class="btn" id="calcBtn">절임 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>절임 계산 결과</h2>
      <p class="big">총 소금 <span class="num" id="saltOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>절임이 김치의 8할</h2>
    <p>배추 절임은 <strong>수분을 빼고 조직을 유연하게 만드는</strong> 과정입니다. 덜 절여지면 양념이 겉돌고 물이 생기며, 과하게 절여지면 짜고 물러집니다. 기준은 시간이 아니라 상태입니다 — 줄기 부분을 접었을 때 부러지지 않고 <strong>휘어지면</strong> 완료입니다.</p>
    <p>일반적인 방식은 8~10% 소금물에 담그고, 두꺼운 줄기 사이에는 소금을 따로 뿌리는 것입니다. 줄기와 잎의 두께가 다르기 때문에 물에만 담그면 줄기가 덜 절여집니다. 이 계산기는 배추 무게에서 절임물·소금물 소금·켜켜이 소금을 나눠 계산합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>다듬어서 4등분한 배추의 총 무게(kg)를 넣습니다. 20포기 김장이면 대략 40~60kg입니다.</li>
      <li>소금 종류를 고릅니다. 꽃소금은 같은 부피에서 짠맛이 강해 양을 약 20% 줄입니다.</li>
      <li>계절을 고르면 절임 시간이 달라집니다(여름은 짧게, 겨울은 길게).</li>
      <li>결과의 절임물·소금 양으로 절이고, 중간에 위아래를 한 번 뒤집습니다.</li>
    </ol>`,
  faq: [
    { q: "다 절여진 것을 어떻게 확인하나요?", a: "가장 두꺼운 줄기를 잘라 90도로 접어 봅니다. 뚝 부러지면 덜 절여진 것이고, 부드럽게 휘면 완료입니다. 시간은 참고일 뿐이며 배추 크기·온도에 따라 2~3시간 차이가 납니다." },
    { q: "절인 뒤 헹구면 소금이 빠지지 않나요?", a: "헹구는 것은 표면의 소금과 이물을 씻는 과정이라 조직 안의 염분은 크게 줄지 않습니다. 흐르는 물에 2~3번 헹구고 30분 이상 물기를 완전히 빼야 양념이 겉돌지 않습니다." },
    { q: "너무 짜게 절였으면 어떻게 하나요?", a: "찬물에 20~30분 담가 두면 염분이 어느 정도 빠집니다. 다만 조직이 물러질 수 있으니 오래 담그지 말고, 양념의 젓갈·소금을 줄여 균형을 맞추세요." },
    { q: "여름 김치도 같은 비율인가요?", a: "여름에는 온도가 높아 절임이 빨리 진행되므로 시간을 줄입니다. 소금 농도는 같게 두고 시간을 6~8시간으로 짧게 잡되, 중간에 상태를 더 자주 확인하세요." },
  ],
  basis: `<h2>기준값</h2>
    <p class="note">절임물은 배추 무게의 약 ${Math.round(KIMCHI.waterPerCabbage.value * 100)}%, 소금 농도 ${KIMCHI.brinePct.value}%(8~10% 관행), 켜켜이 뿌리는 소금은 배추 무게의 약 ${KIMCHI.sprinklePct.value}%를 기준으로 계산합니다.
    ${esc(KIMCHI.saltType)} (출처: 국내 김장 관행값 정리, 확인일 ${KIMCHI.brinePct.checkedAt}) — <span class="badge warn">참고용</span> 배추 크기·수분·기온에 따라 조정이 필요합니다.</p>`,
  disclaimer: DISC("절임 상태는 시간이 아니라 줄기가 휘는지로 판단하세요."),
  script: `import { KIMCHI } from "__U__data/misc.mjs";
${IMP}
let salt = "coarse", season = "winter";
segInit($("saltSeg"), (v) => { salt = v; });
segInit($("seasonSeg"), (v) => { season = v; });
$("calcBtn").addEventListener("click", () => {
  const kg = num($("kg"), 10);
  const cabbageG = kg * 1000;
  const pct = num($("pct"), KIMCHI.brinePct.value) / 100;
  const k = salt === "fine" ? 0.8 : 1;
  const waterG = cabbageG * KIMCHI.waterPerCabbage.value;
  const brineSalt = waterG * pct * k;
  const sprinkle = cabbageG * (KIMCHI.sprinklePct.value / 100) * k;
  const total = brineSalt + sprinkle;
  $("saltOut").textContent = fmt(total / 1000, 2) + "kg (" + fmt(total) + "g)";
  $("tableOut").innerHTML = kv([
    ["배추", fmt(kg, 1) + "kg"],
    ["절임물(물)", ml(waterG) + " (약 " + fmt(waterG / 1000, 1) + "L)"],
    ["절임물에 풀 소금", fmt(brineSalt) + "g · 농도 " + fmt(pct * 100, 1) + "%"],
    ["줄기에 켜켜이 뿌릴 소금", fmt(sprinkle) + "g"],
    ["총 소금", fmt(total) + "g"],
    ["소금 종류", salt === "fine" ? "꽃소금 (굵은소금 대비 20% 감량 적용)" : "굵은소금(천일염) 기준"],
    ["절임 시간", season === "summer" ? "여름 6~8시간" : "겨울 8~10시간"],
    ["중간 작업", "3~4시간 뒤 위아래 뒤집기 1회"],
  ]);
  $("noteOut").textContent = "줄기를 접었을 때 부러지지 않고 휘면 완료입니다. 헹군 뒤 30분 이상 물기를 빼세요. " + KIMCHI.time.value;
  $("srcOut").innerHTML = srcBox("기준값 출처", [
    { text: "절임물 비율·농도·시간 — " + KIMCHI.brinePct.source, checkedAt: KIMCHI.brinePct.checkedAt },
  ]);
  show("resultBox");
});`,
  related: [{ slug: "brine", e: "🧂", n: "염지 계산기" }, { slug: "storage", e: "🧊", n: "식재료 보관기간" }, X.season, X.fridge],
});

TOOLS.push({
  slug: "coffee-ratio", emoji: "☕", nav: "커피 비율 계산",
  hubName: "커피 비율 계산기", hubDesc: "핸드드립·프렌치프레스·콜드브루·에스프레소별 원두와 물의 양을 서로 역산합니다.",
  title: "커피 원두·물 비율 계산기 — 핸드드립·콜드브루 추출 비율",
  ogTitle: "커피 비율 계산기 — 원두↔물 역산",
  desc: "원두 20g이면 물 몇 ml? 핸드드립·프렌치프레스·에어로프레스·콜드브루·에스프레소별 추출 비율로 원두와 물의 양을 양방향 계산합니다. 잔 수 기준 계산도 지원합니다.",
  h1: "커피 비율 계산기",
  lead: `추출 방식만 고르면 <strong>원두 ↔ 물</strong>을 양방향으로 계산합니다. 매번 같은 맛을 내는 가장 쉬운 방법입니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>추출 조건</h2>
    <label class="f">추출 방식
      <select id="method">${COFFEE_RATIO.map((c, i) => `<option value="${c.key}"${i === 0 ? " selected" : ""}>${c.name} — 1:${c.ratio}</option>`).join("")}</select>
    </label>
    <div style="margin-top:12px">
      <span class="f" style="display:block">무엇을 알고 계신가요?</span>
      <div class="seg" id="modeSeg" role="group" aria-label="계산 방향">
        <button type="button" data-v="bean" aria-pressed="true">원두 양을 안다</button>
        <button type="button" data-v="water" aria-pressed="false">물 양을 안다</button>
      </div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <label class="f" id="beanWrap">원두 <span class="u">(g)</span>
        <input type="number" id="bean" inputmode="decimal" min="1" step="1" value="20" />
      </label>
      <label class="f" id="waterWrap" hidden>물 <span class="u">(ml)</span>
        <input type="number" id="water" inputmode="decimal" min="10" step="10" value="320" />
      </label>
      <label class="f">비율 미세 조정 <span class="u">(1 : n)</span>
        <input type="number" id="ratio" inputmode="decimal" min="1" step="0.5" value="16" />
      </label>
    </div>
    <button class="btn" id="calcBtn">계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>추출 계산 결과</h2>
      <p class="big"><span class="num" id="mainOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>비율 하나만 고정해도 맛이 안정된다</h2>
    <p>집에서 내린 커피 맛이 매번 다른 가장 큰 이유는 원두와 물의 비율이 들쭉날쭉하기 때문입니다. 분쇄도·물 온도·시간도 영향을 주지만, 그것들은 비율이 고정된 뒤에야 의미 있게 조정할 수 있습니다. 핸드드립의 표준은 <strong>1:16</strong>(원두 20g에 물 320ml)이고, 진하게 마시려면 1:15, 산미를 살리려면 1:17 쪽으로 움직입니다.</p>
    <p>주의할 점은 <strong>물 흡수량</strong>입니다. 원두는 자기 무게의 약 2배에 해당하는 물을 머금고 남기므로, 20g으로 320ml를 부으면 잔에 담기는 양은 약 280ml입니다. 이 계산기는 그 손실분도 함께 보여줍니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>추출 방식을 고릅니다. 방식별 기본 비율이 자동으로 채워집니다.</li>
      <li>원두 양을 알면 "원두 양을 안다", 물 양(또는 만들 커피 양)을 알면 반대로 고릅니다.</li>
      <li>필요하면 비율을 미세 조정합니다(진하게 = 숫자를 줄이고, 연하게 = 숫자를 늘림).</li>
      <li>결과에서 원두·물·예상 추출량을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "물 온도는 몇 도가 좋나요?", a: "일반적으로 90~94℃를 권합니다. 끓인 물을 30초~1분 두면 그 범위에 들어옵니다. 로스팅이 강한 원두는 88~90℃로 낮추면 쓴맛이 덜합니다." },
    { q: "콜드브루 원액은 그대로 마시나요?", a: "1:12 정도로 뽑은 원액은 상당히 진하므로 물이나 우유로 1:1~1:2 희석해 마시는 것이 일반적입니다. 냉장 보관하며 되도록 일주일 안에 드세요." },
    { q: "에스프레소 비율 1:2는 무슨 뜻인가요?", a: "원두 18g으로 추출액 36g을 받는다는 뜻입니다. 부피(ml)가 아니라 저울로 잰 무게 기준이며, 이 비율을 고정하면 머신이 달라도 맛의 방향을 맞추기 쉽습니다." },
    { q: "분쇄도는 어떻게 정하나요?", a: "추출 시간이 기준입니다. 핸드드립 2분 30초~3분 30초, 프렌치프레스 4분이 목표이고, 너무 빨리 내려가면 더 곱게, 느리면 더 굵게 갑니다. 비율은 그대로 두고 분쇄도만 바꾸세요." },
  ],
  basis: `<h2>비율 기준</h2>
    <p class="note">방식별 추출 비율은 널리 쓰이는 <strong>관행 범위</strong>입니다(출처: 자체 정리, 확인일 ${TODAY}).
    원두 상태·분쇄도·취향에 따라 조정하는 값이며 <span class="badge warn">참고용</span>입니다.</p>`,
  disclaimer: DISC("추출 비율은 취향에 따라 조정하는 관행값입니다."),
  script: `import { COFFEE_RATIO } from "__U__data/misc.mjs";
${IMP}
let mode = "bean";
const sel = $("method");
function syncRatio() {
  const c = COFFEE_RATIO.find((x) => x.key === sel.value);
  $("ratio").value = c.ratio;
}
sel.addEventListener("change", syncRatio);
segInit($("modeSeg"), (v) => {
  mode = v;
  $("beanWrap").hidden = v !== "bean";
  $("waterWrap").hidden = v === "bean";
});
$("calcBtn").addEventListener("click", () => {
  const c = COFFEE_RATIO.find((x) => x.key === sel.value);
  const r = num($("ratio"), c.ratio);
  let bean, water;
  if (mode === "bean") { bean = num($("bean"), 20); water = bean * r; }
  else { water = num($("water"), 320); bean = water / r; }
  const absorbed = c.key === "espresso" ? 0 : bean * 2;
  const yieldMl = Math.max(0, water - absorbed);
  $("mainOut").textContent = mode === "bean" ? "물 " + ml(water) : "원두 " + fmt(bean, 1) + "g";
  $("tableOut").innerHTML = kv([
    ["추출 방식", c.name],
    ["적용 비율", "1 : " + fmt(r, 1) + " (기본 " + c.range + ")"],
    ["원두", fmt(bean, 1) + "g"],
    ["물", ml(water) + " (물 1ml ≈ 1g)"],
    [c.key === "espresso" ? "추출액" : "원두가 머금는 물", c.key === "espresso" ? fmt(water, 1) + "g" : "약 " + ml(absorbed)],
    ["예상 잔 분량", c.key === "espresso" ? fmt(water, 1) + "g (샷)" : "약 " + ml(yieldMl)],
  ]);
  $("noteOut").textContent = c.note;
  $("srcOut").innerHTML = srcBox("비율 출처", [{ text: c.name + " " + c.range + " — " + c.source, checkedAt: c.checkedAt }]);
  show("resultBox");
});
syncRatio();`,
  related: [{ slug: "sugar-syrup", e: "🍯", n: "과일청 비율 계산" }, { slug: "timer-multi", e: "⏲️", n: "동시 타이머" }, X.cafe, X.season],
});

TOOLS.push({
  slug: "brine", emoji: "🧂", nav: "염지 계산기",
  hubName: "염지(브라인) 계산기", hubDesc: "닭·돼지고기 무게를 넣으면 습식·건식 염지의 물·소금·설탕 양과 부위별 시간을 계산합니다.",
  title: "염지 계산기 — 습식·건식 브라인 소금·설탕 양과 시간",
  ogTitle: "염지(브라인) 계산기",
  desc: "닭가슴살·삼겹살을 촉촉하게 만드는 염지 계산기. 고기 무게를 넣으면 습식 브라인의 물·소금·설탕 양과 건식 염지의 소금 비율, 부위별 권장 시간을 계산합니다.",
  h1: "염지 계산기",
  lead: `고기 무게만 넣으면 <strong>물·소금·설탕 양과 염지 시간</strong>을 계산합니다. 퍽퍽한 닭가슴살의 해법입니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>고기와 방식 선택</h2>
    <div class="grid2">
      <label class="f">고기 무게 <span class="u">(g)</span>
        <input type="number" id="meat" inputmode="decimal" min="50" step="50" value="600" />
      </label>
      <label class="f">부위 <span class="u">(권장 시간 참고)</span>
        <select id="cut">${BRINE.times.map((t, i) => `<option value="${i}">${t.name}</option>`).join("")}</select>
      </label>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">염지 방식</span>
      <div class="seg" id="wSeg" role="group" aria-label="염지 방식">
        <button type="button" data-v="wet" aria-pressed="true">습식 (소금물에 담그기)</button>
        <button type="button" data-v="dry" aria-pressed="false">건식 (표면에 문지르기)</button>
      </div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <label class="f">소금 비율 <span class="u">(% · 습식=물 대비, 건식=고기 대비)</span>
        <input type="number" id="saltPct" inputmode="decimal" min="0.5" step="0.1" value="${BRINE.wet.saltPct.value}" />
      </label>
      <label class="f">설탕 비율 <span class="u">(% · 0이면 생략)</span>
        <input type="number" id="sugarPct" inputmode="decimal" min="0" step="0.1" value="${BRINE.wet.sugarPct.value}" />
      </label>
    </div>
    <button class="btn" id="calcBtn">염지 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>염지 계산 결과</h2>
      <p class="big"><span class="num" id="mainOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>염지가 하는 일</h2>
    <p>소금물에 담근 고기는 단순히 간이 배는 것이 아닙니다. 소금이 근육 단백질의 구조를 느슨하게 만들어 <strong>수분을 더 많이 붙잡게</strong> 하고, 그 결과 가열 과정에서 빠져나가는 육즙이 줄어듭니다. 닭가슴살처럼 지방이 적어 조금만 오래 익혀도 퍽퍽해지는 부위에서 차이가 가장 큽니다.</p>
    <p>습식은 물에 소금을 풀어 담그는 방식으로 실패가 적고, 건식은 고기 표면에 소금을 직접 문질러 냉장고에서 재우는 방식으로 물이 섞이지 않아 풍미가 진해집니다. 굽기 전에는 표면 물기를 완전히 닦아야 갈색이 제대로 납니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>고기 무게(g)와 부위를 고릅니다.</li>
      <li>습식/건식을 선택하면 기본 비율이 자동으로 바뀝니다.</li>
      <li>결과의 물·소금·설탕 양을 섞어 고기가 잠기도록 담그거나(습식), 표면에 고루 문지릅니다(건식).</li>
      <li>냉장고에서 권장 시간만큼 두고, 꺼낸 뒤 표면을 헹구고 물기를 닦아 조리합니다.</li>
    </ol>`,
  faq: [
    { q: "너무 오래 담그면 어떻게 되나요?", a: "권장 시간을 크게 넘기면 짜지고 조직이 물러져 햄 같은 식감이 됩니다. 얇은 닭가슴살을 하룻밤 담그는 것은 과합니다. 부위가 얇을수록 시간을 짧게 잡으세요." },
    { q: "염지 후 헹궈야 하나요?", a: "습식은 표면 염분을 씻어내기 위해 가볍게 헹구고 키친타월로 물기를 완전히 제거합니다. 건식은 소금이 대부분 흡수되므로 헹구지 않고 표면만 닦아도 됩니다." },
    { q: "설탕은 왜 넣나요?", a: "짠맛의 균형을 잡고 가열 시 표면 갈변(캐러멜화)을 도와 색과 향이 좋아집니다. 다만 설탕이 많으면 타기 쉬우니 소금의 절반 정도로 제한하고, 센 불 구이에서는 줄이세요." },
    { q: "냉장고 밖에서 염지해도 되나요?", a: "안 됩니다. 실온 염지는 세균이 증식하기 좋은 조건입니다. 반드시 냉장(0~4℃)에서 진행하고, 사용한 염지액은 재사용하지 말고 버리세요." },
  ],
  basis: `<h2>기준값</h2>
    <p class="note">습식은 물 = 고기 무게와 동량, 소금 = 물 무게의 ${BRINE.wet.saltPct.value}%(5~7% 관행), 설탕 = ${BRINE.wet.sugarPct.value}%,
    건식은 소금 = 고기 무게의 ${BRINE.dry.saltPct.value}%(1~1.5%)를 기본으로 합니다(출처: 자체 정리, 확인일 ${BRINE.wet.saltPct.checkedAt}).
    <span class="badge warn">참고용</span> 부위 두께와 취향에 따라 조정하세요.</p>`,
  disclaimer: FOOD_SAFETY,
  script: `import { BRINE } from "__U__data/misc.mjs";
${IMP}
let way = "wet";
function preset() {
  $("saltPct").value = way === "wet" ? BRINE.wet.saltPct.value : BRINE.dry.saltPct.value;
  $("sugarPct").value = way === "wet" ? BRINE.wet.sugarPct.value : BRINE.dry.sugarPct.value;
}
segInit($("wSeg"), (v) => { way = v; preset(); });
$("calcBtn").addEventListener("click", () => {
  const meat = num($("meat"), 600);
  const sp = num($("saltPct"), 6) / 100, up = num($("sugarPct"), 3) / 100;
  const cut = BRINE.times[+$("cut").value];
  const rows = [["고기", fmt(meat) + "g"], ["방식", way === "wet" ? "습식 브라인" : "건식 염지"]];
  let main;
  if (way === "wet") {
    const water = meat * BRINE.wet.waterPerMeat.value;
    const salt = water * sp, sugar = water * up;
    main = "소금 " + fmt(salt, 1) + "g + 물 " + ml(water);
    rows.push(["물", ml(water) + " (고기와 동량, 잠길 만큼)"]);
    rows.push(["소금", fmt(salt, 1) + "g (물의 " + fmt(sp * 100, 1) + "%)"]);
    if (up > 0) rows.push(["설탕", fmt(sugar, 1) + "g (물의 " + fmt(up * 100, 1) + "%)"]);
    rows.push(["총 염지액", ml(water) + " + 소금·설탕"]);
  } else {
    const salt = meat * sp, sugar = meat * up;
    main = "소금 " + fmt(salt, 1) + "g";
    rows.push(["소금", fmt(salt, 1) + "g (고기의 " + fmt(sp * 100, 1) + "%)"]);
    if (up > 0) rows.push(["설탕", fmt(sugar, 1) + "g (고기의 " + fmt(up * 100, 1) + "%)"]);
    rows.push(["방법", "표면에 고루 문지른 뒤 랩 없이 냉장 (표면이 마르며 풍미 ↑)"]);
  }
  rows.push(["권장 시간", cut.name + " · " + cut.time]);
  rows.push(["보관 온도", "냉장 0~4℃ (실온 염지 금지)"]);
  $("mainOut").textContent = main;
  $("tableOut").innerHTML = kv(rows);
  $("noteOut").textContent = "염지 후 표면 물기를 완전히 닦아야 겉이 제대로 갈색으로 구워집니다. 사용한 염지액은 재사용하지 말고 버리세요.";
  $("srcOut").innerHTML = srcBox("기준값 출처", [
    { text: (way === "wet" ? "습식 비율 — " + BRINE.wet.saltPct.note : "건식 비율 — " + BRINE.dry.saltPct.note) + " / " + BRINE.wet.saltPct.source, checkedAt: BRINE.wet.saltPct.checkedAt },
    { text: cut.name + " 권장 시간 " + cut.time + " — " + cut.source, checkedAt: cut.checkedAt },
  ]);
  show("resultBox");
});`,
  related: [{ slug: "airfryer", e: "🍟", n: "에어프라이어 변환" }, { slug: "kimchi-salt", e: "🥬", n: "김치 절임 계산" }, X.air, X.fridge],
});

TOOLS.push({
  slug: "sugar-syrup", emoji: "🍯", nav: "과일청 비율",
  hubName: "과일청·설탕 시럽 계산기", hubDesc: "과일 무게에 맞는 설탕 양과 필요한 유리병 용량, 저당 비율의 보관 주의사항까지 계산합니다.",
  title: "과일청 설탕 비율 계산기 — 매실청·레몬청 설탕 양과 병 용량",
  ogTitle: "과일청 설탕 비율 계산기",
  desc: "과일 1kg에 설탕 얼마? 1:1 표준 비율과 1:0.8 저당 비율로 설탕 양을 계산하고, 발효 가스 여유를 포함한 필요 유리병 용량까지 알려줍니다. 저당 청의 보관 주의사항도 함께 안내합니다.",
  h1: "과일청 비율 계산기",
  lead: `과일 무게를 넣으면 <strong>설탕 양과 필요한 병 용량</strong>을 계산합니다. 저당 청은 보관 조건이 달라집니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>과일과 비율</h2>
    <div class="grid2">
      <label class="f">과일 무게 <span class="u">(g · 손질 후)</span>
        <input type="number" id="fruit" inputmode="decimal" min="100" step="100" value="1000" />
      </label>
      <label class="f">설탕 비율 <span class="u">(과일 1에 대한 설탕)</span>
        <input type="number" id="ratio" inputmode="decimal" min="0.5" max="1.5" step="0.05" value="1" />
      </label>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">비율 프리셋</span>
      <div class="seg" id="pSeg" role="group" aria-label="비율 프리셋">
        <button type="button" data-v="1" aria-pressed="true">${SYRUP.standard.name}</button>
        <button type="button" data-v="0.8" aria-pressed="false">${SYRUP.lowSugar.name}</button>
      </div>
    </div>
    <button class="btn" id="calcBtn">계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">설탕 <span class="num" id="sugarOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>설탕은 단맛이 아니라 보존료다</h2>
    <p>과일청에서 설탕은 맛을 내는 재료이면서 동시에 <strong>보존 장치</strong>입니다. 설탕 농도가 높으면 삼투압으로 미생물이 자라지 못해 실온에서도 오래 갑니다. 그래서 전통적인 비율이 과일:설탕 = 1:1입니다.</p>
    <p>요즘 흔한 1:0.8, 1:0.5 같은 저당 청은 덜 달고 산뜻하지만 그만큼 <strong>곰팡이·발효 위험이 올라갑니다</strong>. 저당으로 만들 때는 반드시 냉장 숙성·냉장 보관하고, 표면에 뜬 과일이 공기에 노출되지 않도록 눌러 주며, 되도록 빨리 소비하세요.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>손질을 마친(꼭지·씨 제거, 물기 완전 제거) 과일 무게를 넣습니다.</li>
      <li>비율 프리셋에서 1:1 또는 저당 1:0.8을 고르거나 직접 조정합니다.</li>
      <li>결과의 설탕 양을 과일과 켜켜이 담고, 맨 위는 설탕으로 덮습니다.</li>
      <li>필요한 병 용량을 확인해 넉넉한 크기의 소독한 유리병을 준비합니다.</li>
    </ol>`,
  faq: [
    { q: "병은 어떻게 소독하나요?", a: "끓는 물에 5분 이상 소독하거나, 열탕이 어려운 큰 병은 도수 높은 술로 내부를 닦고 완전히 말립니다. 물기가 남으면 곰팡이의 시작점이 되므로 완전 건조가 핵심입니다." },
    { q: "왜 병을 가득 채우면 안 되나요?", a: "숙성 중 발효로 가스가 생겨 내용물이 밀려 올라옵니다. 재료 부피의 1.5~1.6배 용량 병을 쓰고, 가끔 뚜껑을 열어 가스를 빼 주세요." },
    { q: "설탕이 잘 안 녹아요.", a: "하루 한 번 위아래를 뒤집어 섞어 주면 2~3일 안에 대부분 녹습니다. 바닥에 굳어 있으면 국자로 저어 주세요. 완전히 녹기 전까지는 곰팡이가 생기기 쉬운 시기입니다." },
    { q: "얼마나 숙성하나요?", a: "재료에 따라 다르지만 실온 1~2주 뒤 건더기를 걸러 내고 냉장에서 1개월 이상 두면 맛이 안정됩니다. 매실은 100일 숙성이 관행이지만 씨의 성분 때문에 걸러 내는 시점을 지키는 것이 좋습니다." },
  ],
  basis: `<h2>기준값</h2>
    <p class="note">표준 1:1, 저당 1:0.8, 병 용량 = (과일g + 설탕g) × ${SYRUP.jarFactor.value}ml(발효 가스 여유 포함)를 기준으로 계산합니다
    (출처: 자체 정리 관행값, 확인일 ${SYRUP.standard.checkedAt}). <span class="badge warn">참고용</span> — 저당 비율은 보관 위험이 올라가므로 냉장 보관을 전제로 하세요.</p>`,
  disclaimer: FOOD_SAFETY,
  script: `import { SYRUP } from "__U__data/misc.mjs";
${IMP}
segInit($("pSeg"), (v) => { $("ratio").value = v; });
$("calcBtn").addEventListener("click", () => {
  const fruit = num($("fruit"), 1000);
  const r = num($("ratio"), 1);
  const sugar = fruit * r;
  const jar = (fruit + sugar) * SYRUP.jarFactor.value;
  const low = r < 0.95;
  $("sugarOut").textContent = fmt(sugar) + "g";
  $("tableOut").innerHTML = kv([
    ["과일 (손질 후)", fmt(fruit) + "g"],
    ["설탕", fmt(sugar) + "g (1 : " + fmt(r, 2) + ")"],
    ["총 재료 무게", fmt(fruit + sugar) + "g"],
    ["필요한 병 용량", "약 " + fmt(Math.ceil(jar / 100) * 100) + "ml 이상"],
    ["보관", low ? "냉장 숙성·냉장 보관 필수" : "실온 숙성 가능 · 걸러 낸 뒤 냉장 권장"],
    ["맨 위 마감", "설탕으로 덮어 과일이 공기에 닿지 않게"],
  ]);
  $("noteOut").textContent = low ? SYRUP.lowSugar.note : SYRUP.standard.note;
  $("srcOut").innerHTML = srcBox("기준값 출처", [
    { text: (low ? SYRUP.lowSugar.note : SYRUP.standard.note) + " — " + SYRUP.standard.source, checkedAt: SYRUP.standard.checkedAt },
    { text: "병 용량 계수 " + SYRUP.jarFactor.value + " — " + SYRUP.jarFactor.note, checkedAt: SYRUP.jarFactor.checkedAt },
  ]);
  show("resultBox");
});`,
  related: [{ slug: "coffee-ratio", e: "☕", n: "커피 비율 계산" }, { slug: "storage", e: "🧊", n: "식재료 보관기간" }, X.season, X.cafe],
});

TOOLS.push({
  slug: "baking-pan", emoji: "🎂", nav: "베이킹 팬 변환",
  hubName: "베이킹 팬 변환 계산기", hubDesc: "1호 원형 레시피를 2호나 사각팬으로 옮길 때 재료를 몇 배로 해야 하는지 부피 기준으로 계산합니다.",
  title: "베이킹 팬 크기 변환 계산기 — 부피 기준 재료 배수 환산",
  ogTitle: "베이킹 팬 변환 계산기 — 부피 기준",
  desc: "원형 1호 레시피를 2호 팬으로, 원형을 사각팬으로 옮길 때 재료를 몇 배로 해야 할까? 팬의 실제 부피(원형 πr²h, 사각 w×l×h)를 기준으로 배수를 계산하고 재료 목록까지 한 번에 환산합니다.",
  h1: "베이킹 팬 변환 계산기",
  lead: `지름이 아니라 <strong>부피</strong>로 계산해야 맞습니다. 15cm → 18cm는 1.2배가 아니라 <strong>1.44배</strong>입니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>팬 선택</h2>
    <div class="grid2">
      <label class="f">원래 레시피의 팬
        <select id="from">${PANS.map((p, i) => `<option value="${p.key}"${i === 0 ? " selected" : ""}>${p.name}</option>`).join("")}<option value="custom">직접 입력</option></select>
      </label>
      <label class="f">사용할 팬
        <select id="to">${PANS.map((p, i) => `<option value="${p.key}"${i === 1 ? " selected" : ""}>${p.name}</option>`).join("")}<option value="custom">직접 입력</option></select>
      </label>
    </div>
    <details class="adv" id="customBox">
      <summary>직접 입력 — 팬 치수 (cm)</summary>
      <div class="grid3" style="margin-top:10px">
        <label class="f">원래 팬 지름/가로
          <input type="number" id="fa" inputmode="decimal" min="1" step="0.5" value="15" />
        </label>
        <label class="f">원래 팬 세로 <span class="u">(사각만)</span>
          <input type="number" id="fb" inputmode="decimal" min="0" step="0.5" value="0" />
        </label>
        <label class="f">원래 팬 높이
          <input type="number" id="fh" inputmode="decimal" min="1" step="0.5" value="7" />
        </label>
        <label class="f">새 팬 지름/가로
          <input type="number" id="ta" inputmode="decimal" min="1" step="0.5" value="18" />
        </label>
        <label class="f">새 팬 세로 <span class="u">(사각만)</span>
          <input type="number" id="tb" inputmode="decimal" min="0" step="0.5" value="0" />
        </label>
        <label class="f">새 팬 높이
          <input type="number" id="th" inputmode="decimal" min="1" step="0.5" value="7" />
        </label>
      </div>
      <p class="note">세로를 0으로 두면 원형(지름 기준)으로 계산합니다.</p>
    </details>
    <label class="f" style="margin-top:14px">재료 목록 <span class="u">(선택 — 붙여넣으면 함께 환산)</span>
      <textarea id="src" spellcheck="false" style="min-height:110px">박력분 100g
설탕 90g
달걀 2개
버터 90g
우유 2큰술</textarea>
    </label>
    <button class="btn" id="calcBtn">팬 변환 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>변환 결과</h2>
      <p class="big">재료 배수 <span class="num" id="ratioOut"></span></p>
      <div id="tableOut"></div>
      <p class="note" id="noteOut"></p>
    </div>
    <div class="card" id="listCard" hidden>
      <h2>재료 환산</h2>
      <div id="listOut"></div>
      <p class="note">달걀처럼 개수로 세는 재료는 소수가 나오면 무게로 나누세요(큰 달걀 1개 ≈ 50~55g, 껍질 제외).</p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>지름 1.2배는 부피 1.44배</h2>
    <p>팬을 바꿀 때 흔한 실수는 지름 비율을 그대로 재료 배수로 쓰는 것입니다. 원형 팬의 부피는 <strong>π × 반지름² × 높이</strong>이므로 지름이 15cm에서 18cm로 1.2배가 되면 부피는 1.2²= <strong>1.44배</strong>가 됩니다. 1.2배로 반죽을 만들면 높이가 낮은 케이크가 나옵니다.</p>
    <p>이 계산기는 원형과 사각을 같은 부피 기준으로 비교하므로, 1호 원형 레시피를 15cm 정사각 팬이나 파운드팬으로 옮기는 것도 계산됩니다. 반죽 높이를 그대로 유지하고 싶다면 팬 높이도 함께 맞춰 입력하세요.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>원래 레시피가 쓰는 팬과 실제로 사용할 팬을 고릅니다(목록에 없으면 "직접 입력").</li>
      <li>재료 목록을 붙여넣으면 배수가 적용된 목록이 함께 나옵니다.</li>
      <li>결과의 배수를 재료에 곱합니다. 반죽 양이 늘면 굽는 시간도 조정이 필요합니다.</li>
      <li>큰 팬으로 갈수록 온도를 10℃ 정도 낮추고 시간을 늘리는 편이 속까지 잘 익습니다.</li>
    </ol>`,
  faq: [
    { q: "굽는 시간은 얼마나 바꿔야 하나요?", a: "반죽의 높이가 비슷하면 시간 변화가 크지 않지만, 팬이 커져 반죽이 두꺼워지면 시간이 늘어납니다. 대체로 온도를 10℃ 낮추고 시간을 10~20% 늘린 뒤 꼬치로 확인하는 방식이 안전합니다." },
    { q: "팬 높이까지 반죽을 채워도 되나요?", a: "보통 팬 높이의 60~70%까지만 채웁니다. 베이킹파우더나 달걀 거품으로 부풀기 때문에 가득 채우면 넘칩니다. 이 계산기의 부피는 팬 전체 부피이므로 실제 반죽은 그 60~70%로 보세요." },
    { q: "시폰팬처럼 가운데 구멍이 있으면요?", a: "가운데 기둥 부피만큼 빠지므로 실제 용량은 계산값보다 10~15% 적습니다. 정확히 하려면 팬에 물을 채워 ml를 재는 것이 가장 확실합니다." },
    { q: "국내 호수 표기는 무슨 뜻인가요?", a: "원형 케이크 팬의 관행 표기로 1호가 지름 15cm, 2호가 18cm, 3호가 21cm입니다. 제조사에 따라 ±1cm 차이가 있을 수 있으니 실제 치수를 재는 편이 정확합니다." },
  ],
  basis: `<h2>계산 기준</h2>
    <p class="note">원형 팬 부피 = π × (지름/2)² × 높이, 사각 팬 부피 = 가로 × 세로 × 높이(단위 cm, 1cm³ = 1ml)로 계산합니다.
    팬 프리셋 치수는 국내 호수 관행값(출처: 자체 정리, 확인일 ${TODAY})이며 제조사별로 차이가 있을 수 있습니다 <span class="badge warn">참고용</span>.</p>`,
  disclaimer: DISC("팬 실제 용량은 물을 채워 ml로 재는 것이 가장 정확합니다."),
  script: `import { PANS } from "__U__data/misc.mjs";
import { panVolume, scaleList, fmtQty, round } from "__U__lib/cook.mjs";
${IMP}
function pick(which) {
  const key = $(which).value;
  if (key !== "custom") return PANS.find((p) => p.key === key);
  const a = num($(which === "from" ? "fa" : "ta"), 15);
  const b = num($(which === "from" ? "fb" : "tb"), 0);
  const h = num($(which === "from" ? "fh" : "th"), 7);
  return b > 0
    ? { name: "직접 입력 " + a + "×" + b + "×" + h + "cm", shape: "rect", w: a, l: b, h: h }
    : { name: "직접 입력 원형 지름 " + a + "cm", shape: "round", d: a, h: h };
}
function syncCustom() {
  $("customBox").open = $("from").value === "custom" || $("to").value === "custom";
}
$("from").addEventListener("change", syncCustom);
$("to").addEventListener("change", syncCustom);
$("calcBtn").addEventListener("click", () => {
  const a = pick("from"), b = pick("to");
  const va = panVolume(a), vb = panVolume(b);
  const k = vb / va;
  $("ratioOut").textContent = "×" + fmt(k, 2);
  $("tableOut").innerHTML = kv([
    ["원래 팬", a.name],
    ["원래 팬 부피", ml(va)],
    ["사용할 팬", b.name],
    ["사용할 팬 부피", ml(vb)],
    ["재료 배수", "×" + fmt(k, 3)],
    ["권장 반죽량", "팬 부피의 60~70% → 약 " + ml(vb * 0.65)],
  ]);
  $("noteOut").textContent = k > 1.15 ? "팬이 커졌습니다. 온도를 10℃ 낮추고 시간을 10~20% 늘린 뒤 꼬치로 확인하세요."
    : k < 0.87 ? "팬이 작아졌습니다. 반죽이 넘치지 않도록 60~70%만 채우고 남은 반죽은 머핀틀에 나눠 구우세요."
    : "부피 차이가 크지 않아 굽는 조건은 거의 그대로 두어도 됩니다.";
  const rows = scaleList($("src").value, k);
  const html = [];
  for (const r of rows) {
    if (r.qty == null) { html.push('<div class="kv"><span>' + r.raw + '</span><b class="mut">수량 없음</b></div>'); continue; }
    let right = fmtQty(r.qty) + r.unit;
    if (r.gram != null) right += ' <span class="mut">(' + fmt(r.gram, 1) + 'g)</span>';
    html.push('<div class="kv"><span>' + r.name + ' <span class="mut">' + fmtQty(r.qty / k) + r.unit + '</span></span><b>' + right + '</b></div>');
  }
  $("listOut").innerHTML = html.join("");
  $("listCard").hidden = html.length === 0;
  $("srcOut").innerHTML = srcBox("계산 기준", [
    { text: "원형 πr²h · 사각 w×l×h (1cm³ = 1ml)", checkedAt: "${TODAY}" },
    { text: "팬 프리셋 치수 — 국내 호수 관행값(참고용)", checkedAt: "${TODAY}" },
  ]);
  show("resultBox");
});
syncCustom();`,
  related: [{ slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, { slug: "recipe-scale", e: "📝", n: "레시피 배수 계산" }, X.cafe, X.fridge],
});

TOOLS.push({
  slug: "calorie-plate", emoji: "🍽️", nav: "한 끼 칼로리",
  hubName: "한 끼 칼로리 계산기", hubDesc: `음식 ${CALORIES.length}종에서 골라 담으면 한 끼 총 열량과 목표 대비 비율을 보여줍니다.`,
  title: `한 끼 칼로리 계산기 — 음식 ${CALORIES.length}종 골라 담아 합산`,
  ogTitle: "한 끼 칼로리 계산기 — 골라 담아 합산",
  desc: `오늘 점심은 몇 kcal? 밥·면·국·반찬·분식·간식 등 ${CALORIES.length}종의 1회 제공량 열량을 골라 담아 합산하고, 한 끼 목표 열량 대비 비율을 보여줍니다. 재미·참고용 정보입니다.`,
  h1: "한 끼 칼로리 계산기",
  lead: `먹은 음식을 <strong>골라 담기만</strong> 하면 한 끼 합계가 나옵니다. 목표 대비 비율도 함께 봅니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>음식 담기</h2>
    <label class="f">음식 검색·선택
      <input type="search" id="q" placeholder="예: 김치찌개, 라면, 아메리카노" autocomplete="off" />
    </label>
    <div id="sugg" class="chips"></div>
    <div class="grid2" style="margin-top:12px">
      <label class="f">한 끼 목표 열량 <span class="u">(kcal)</span>
        <input type="number" id="target" inputmode="decimal" min="100" step="50" value="700" />
      </label>
      <label class="f">인분 배수 <span class="u">(1인분 = 1)</span>
        <input type="number" id="mult" inputmode="decimal" min="0.25" step="0.25" value="1" />
      </label>
    </div>
    <div class="rowlist" id="plate"></div>
    <button class="btn" id="calcBtn">합계 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>합계</h2>
      <p class="big">한 끼 <span class="num" id="sumOut"></span></p>
      <div class="bar"><span id="barIn" style="width:0%"></span></div>
      <p class="note" id="pctOut"></p>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>칼로리 표를 어떻게 쓰면 좋을까</h2>
    <p>같은 김치찌개라도 고기 양과 기름에 따라 열량이 두 배 가까이 차이 납니다. 그래서 이 표의 값은 <strong>일반적인 1회 제공량의 근사</strong>이고, 정확한 수치가 아니라 <strong>상대적인 비교</strong>에 쓰는 것이 맞습니다. 어제 점심과 오늘 점심 중 어느 쪽이 무거웠는지, 라면 대신 국수를 고르면 얼마나 차이 나는지를 가늠하는 용도입니다.</p>
    <p>또 하나, 열량만으로 식사의 좋고 나쁨을 판단할 수는 없습니다. 같은 500kcal라도 단백질과 채소가 들어간 한 끼와 과자 한 봉지는 포만감과 영양이 전혀 다릅니다. 이 계산기는 <strong>재미·참고용</strong>이며 의료·영양 처방의 근거가 아닙니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>검색창에 음식 이름을 입력하면 아래에 후보가 나옵니다. 눌러서 접시에 담습니다.</li>
      <li>여러 개를 담을 수 있고, 각 항목의 ✕를 눌러 뺄 수 있습니다.</li>
      <li>많이 먹었다면 인분 배수를 1.5나 2로 올립니다.</li>
      <li>합계와 목표 대비 비율을 확인합니다. 성인 한 끼 목표는 대략 600~800kcal 사이로 잡는 경우가 많습니다.</li>
    </ol>`,
  faq: [
    { q: "표시 열량이 실제와 다른 것 같아요.", a: "1회 제공량 기준의 근사값이라 조리법·가게·양에 따라 30% 이상 차이가 날 수 있습니다. 정확한 값이 필요하면 제품 포장의 영양성분 표시나 식약처 식품영양성분 데이터베이스를 확인하세요." },
    { q: "하루 권장 열량은 얼마인가요?", a: "성별·나이·활동량에 따라 다릅니다. 일반적으로 성인 남성 2,400~2,600kcal, 여성 1,900~2,100kcal 범위를 기준으로 안내하지만, 개인의 상황에 따라 달라지므로 전문가 상담이 필요합니다." },
    { q: "다이어트에 쓸 수 있나요?", a: "대략적인 방향을 잡는 데에는 도움이 되지만, 이 도구는 재미·참고용입니다. 체중 감량이나 질환 관리를 위한 식단은 의사·영양사와 상의하세요." },
    { q: "음식이 목록에 없어요.", a: "확실하지 않은 값은 싣지 않았기 때문입니다. 비슷한 음식으로 가늠하거나 제품 포장의 영양성분 표시를 참고하세요." },
  ],
  basis: `<h2>데이터 기준</h2>
    <p class="note">열량 값은 <a href="https://various.foodsafetykorea.go.kr/nutrient/" target="_blank" rel="noopener">식품의약품안전처 식품영양성분 데이터베이스</a> 공개 자료 기준의
    <strong>일반적인 1회 제공량 근사값</strong>입니다(전 항목 출처·확인일 표기, 데이터 확인일 ${TODAY}).
    조리법·가게·제품에 따라 차이가 크므로 <span class="badge warn">참고용</span>으로만 사용하세요.</p>`,
  disclaimer: `<p class="disclaimer">본 계산 결과는 <strong>재미·참고용</strong>이며 의학적·영양학적 진단이나 처방이 아닙니다.
    열량은 조리법과 양에 따라 크게 달라지므로 정확한 값은 제품 표시를 확인하시고, 체중·질환 관리를 위한 식단은 의사·영양사와 상의하세요.</p>`,
  script: `import { CALORIES } from "__U__data/calories.mjs";
${IMP}
const plate = [];
const q = $("q"), sugg = $("sugg");
function renderSugg() {
  const v = q.value.trim().toLowerCase();
  const list = (v ? CALORIES.filter((c) => c.name.toLowerCase().includes(v)) : CALORIES).slice(0, 18);
  sugg.innerHTML = "";
  for (const c of list) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.textContent = c.name + " " + c.value + "kcal";
    b.addEventListener("click", () => { plate.push(c); renderPlate(); });
    sugg.appendChild(b);
  }
}
function renderPlate() {
  $("plate").innerHTML = "";
  plate.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "row";
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = c.name + " (" + c.serving + ")";
    const val = document.createElement("span");
    val.textContent = c.value + "kcal";
    const x = document.createElement("button");
    x.type = "button"; x.className = "x"; x.textContent = "✕";
    x.addEventListener("click", () => { plate.splice(i, 1); renderPlate(); });
    row.appendChild(nm); row.appendChild(val); row.appendChild(x);
    $("plate").appendChild(row);
  });
}
q.addEventListener("input", renderSugg);
renderSugg();
$("calcBtn").addEventListener("click", () => {
  const m = num($("mult"), 1);
  const total = plate.reduce((s, c) => s + c.value, 0) * m;
  const target = num($("target"), 700);
  $("sumOut").textContent = fmt(total) + "kcal";
  const pct = target > 0 ? (total / target) * 100 : 0;
  $("barIn").style.width = Math.min(100, pct) + "%";
  $("pctOut").textContent = "한 끼 목표 " + fmt(target) + "kcal 대비 " + fmt(pct) + "%" + (pct > 100 ? " (초과)" : "");
  $("tableOut").innerHTML = kv(plate.map((c) => [c.name + " (" + c.serving + ")", fmt(c.value * m) + "kcal"]).concat([["합계", fmt(total) + "kcal"]]));
  $("srcOut").innerHTML = srcBox("데이터 출처", [{ text: CALORIES[0].source, checkedAt: CALORIES[0].checkedAt }]);
  show("resultBox");
});`,
  related: [{ slug: "storage", e: "🧊", n: "식재료 보관기간" }, { slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, X.fridge, X.naengpa],
});

TOOLS.push({
  slug: "timer-multi", emoji: "⏲️", nav: "동시 타이머",
  hubName: "요리 동시 타이머", hubDesc: "여러 개의 타이머를 동시에 돌리고 끝나면 소리로 알립니다. 라면·계란·에어프라이어 프리셋 포함.",
  title: "요리 동시 타이머 — 여러 개를 한 화면에서, 알림음 포함",
  ogTitle: "요리 동시 타이머 — 여러 개 동시 실행",
  desc: "라면 끓이면서 계란 삶고 에어프라이어까지 — 여러 타이머를 한 화면에서 동시에 돌리고 끝나면 알림음으로 알려 줍니다. 설치 없이 브라우저에서 바로 사용하며 자주 쓰는 프리셋을 제공합니다.",
  h1: "요리 동시 타이머",
  lead: `타이머 <strong>여러 개를 한 화면에서</strong> 동시에. 끝나면 소리로 알려 드립니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>타이머 추가</h2>
    <div class="grid3">
      <label class="f">이름
        <input type="text" id="tname" value="라면" maxlength="20" />
      </label>
      <label class="f">분
        <input type="number" id="tmin" inputmode="numeric" min="0" max="180" step="1" value="4" />
      </label>
      <label class="f">초
        <input type="number" id="tsec" inputmode="numeric" min="0" max="59" step="5" value="30" />
      </label>
    </div>
    <div class="chips" id="preset" role="group" aria-label="프리셋">
      <button type="button" class="chip" data-n="라면" data-s="270">라면 4:30</button>
      <button type="button" class="chip" data-n="반숙 계란" data-s="420">반숙 계란 7:00</button>
      <button type="button" class="chip" data-n="완숙 계란" data-s="720">완숙 계란 12:00</button>
      <button type="button" class="chip" data-n="파스타" data-s="480">파스타 8:00</button>
      <button type="button" class="chip" data-n="에어프라이어" data-s="900">에어프라이어 15:00</button>
      <button type="button" class="chip" data-n="밥 뜸들이기" data-s="600">뜸 10:00</button>
      <button type="button" class="chip" data-n="핸드드립" data-s="180">핸드드립 3:00</button>
      <button type="button" class="chip" data-n="프렌치프레스" data-s="240">프렌치프레스 4:00</button>
    </div>
    <button class="btn" id="addBtn">타이머 시작</button>
    <p class="note">알림음은 브라우저의 WebAudio로 직접 만들어 재생합니다(외부 파일·서버 없음). 화면을 켜 둔 상태에서 가장 정확하며, 절전으로 화면이 꺼지면 알림이 늦어질 수 있습니다.</p>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>실행 중인 타이머</h2>
      <div id="timers"></div>
      <div class="stack">
        <button class="btn2" id="soundTest" type="button">🔔 알림음 테스트</button>
        <button class="btn2" id="clearBtn" type="button">🗑️ 끝난 타이머 정리</button>
      </div>
    </div>
  </section>`,
  intro: `<h2>주방에서 타이머가 하나로 부족한 이유</h2>
    <p>실제 조리는 거의 항상 동시 작업입니다. 면을 삶는 4분 30초 동안 계란을 7분 타이머로 올리고, 그 사이 에어프라이어가 15분을 돌립니다. 휴대폰 기본 타이머는 하나만 되는 경우가 많아 매번 다시 맞추다 시간을 놓칩니다.</p>
    <p>이 타이머는 여러 개를 한 화면에 세로로 쌓아 두고 각각 독립적으로 돌립니다. 끝나면 화면 표시가 바뀌고 알림음이 세 번 울립니다. 설치가 필요 없고 입력한 내용은 서버로 전송되지 않습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>프리셋 버튼을 누르면 이름과 시간이 자동으로 채워집니다(직접 입력도 됩니다).</li>
      <li>"타이머 시작"을 누르면 목록에 추가되고 바로 카운트다운이 시작됩니다.</li>
      <li>각 타이머는 일시정지·+1분·삭제를 개별로 조작할 수 있습니다.</li>
      <li>처음 한 번은 "알림음 테스트"를 눌러 소리가 나는지 확인하세요. 브라우저 정책상 사용자가 화면을 한 번 눌러야 소리가 재생됩니다.</li>
    </ol>`,
  faq: [
    { q: "소리가 안 나요.", a: "브라우저는 사용자가 화면을 한 번이라도 누르기 전에는 소리를 재생하지 않습니다. '알림음 테스트'를 한 번 누르면 이후 알림이 정상적으로 울립니다. 기기 음소거 여부도 확인하세요." },
    { q: "다른 앱을 보고 있어도 되나요?", a: "브라우저가 백그라운드로 가면 타이머 갱신 주기가 느려질 수 있지만, 이 타이머는 종료 시각을 기준으로 계산하므로 돌아왔을 때 남은 시간이 정확합니다. 다만 알림음은 화면이 꺼져 있으면 울리지 않을 수 있습니다." },
    { q: "타이머 개수 제한이 있나요?", a: "제한은 없지만 화면에서 관리하기 좋은 수는 4~5개입니다. 끝난 타이머는 '끝난 타이머 정리'로 한 번에 지울 수 있습니다." },
    { q: "새로고침하면 사라지나요?", a: "네. 이 도구는 아무 데이터도 저장하지 않으므로 새로고침하면 초기화됩니다. 조리 중에는 탭을 닫지 마세요." },
  ],
  basis: `<h2>프리셋 기준</h2>
    <p class="note">프리셋 시간(라면 4분 30초, 반숙 계란 7분 등)은 <strong>일반적인 관행값</strong>입니다(확인일 ${TODAY}).
    계란 크기·물 양·화력·기기에 따라 달라지므로 <span class="badge warn">참고용</span>으로 쓰고 취향에 맞게 조절하세요.</p>`,
  disclaimer: DISC("타이머 정확도는 브라우저·기기 상태에 따라 달라질 수 있습니다."),
  script: `${IMP}
const list = [];
document.querySelectorAll("#preset .chip").forEach((c) => c.addEventListener("click", () => {
  $("tname").value = c.dataset.n;
  const s = +c.dataset.s;
  $("tmin").value = Math.floor(s / 60);
  $("tsec").value = s % 60;
}));
function render() {
  const box = $("timers");
  box.innerHTML = "";
  list.forEach((t, i) => {
    const left = t.paused ? t.remain : Math.max(0, (t.endAt - Date.now()) / 1000);
    const done = left <= 0.05;
    const el = document.createElement("div");
    el.className = "timer" + (done ? " done" : "");
    const nm = document.createElement("div");
    nm.className = "tname"; nm.textContent = t.name + (done ? " — 완료!" : t.paused ? " (일시정지)" : "");
    const tl = document.createElement("div");
    tl.className = "tleft"; tl.textContent = mmss(left);
    const row = document.createElement("div");
    row.className = "trow";
    const mk = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn2"; b.textContent = label; b.addEventListener("click", fn); return b; };
    if (!done) {
      row.appendChild(mk(t.paused ? "▶ 계속" : "⏸ 일시정지", () => {
        if (t.paused) { t.endAt = Date.now() + t.remain * 1000; t.paused = false; }
        else { t.remain = Math.max(0, (t.endAt - Date.now()) / 1000); t.paused = true; }
        render();
      }));
      row.appendChild(mk("+1분", () => { if (t.paused) t.remain += 60; else t.endAt += 60000; render(); }));
    }
    row.appendChild(mk("삭제", () => { list.splice(i, 1); render(); }));
    el.appendChild(nm); el.appendChild(tl); el.appendChild(row);
    box.appendChild(el);
    if (done && !t.rung) { t.rung = true; beep(3); }
  });
}
$("addBtn").addEventListener("click", () => {
  const secs = Math.round(num($("tmin"), 0) * 60 + num($("tsec"), 0));
  if (secs <= 0) return;
  list.push({ name: ($("tname").value || "타이머").slice(0, 20), endAt: Date.now() + secs * 1000, remain: secs, paused: false, rung: false });
  show("resultBox");
  render();
});
$("soundTest").addEventListener("click", () => beep(1));
$("clearBtn").addEventListener("click", () => {
  for (let i = list.length - 1; i >= 0; i--) {
    const left = list[i].paused ? list[i].remain : (list[i].endAt - Date.now()) / 1000;
    if (left <= 0.05) list.splice(i, 1);
  }
  render();
});
setInterval(() => { if (list.length) render(); }, 250);`,
  related: [{ slug: "airfryer", e: "🍟", n: "에어프라이어 변환" }, { slug: "rice-water", e: "🍚", n: "밥물 계산기" }, X.air, X.cafe],
});

/* ── 롱테일 1: 재료별 계량 상세 (convert/<slug>/) ───────────── */
const CUP = DENSITY_UNITS.cup.ml, TBSP = DENSITY_UNITS.tbsp.ml, TSP = DENSITY_UNITS.tsp.ml;
const r1 = (n) => Math.round(n * 10) / 10;
const CAT_TIP = {
  "액체": "액체는 눈금 있는 계량컵을 눈높이에서 읽는 것이 가장 정확합니다. 점도가 있는 액체는 컵 벽에 남는 양이 있어 실제로 들어가는 양이 조금 적어집니다.",
  "유지": "기름류는 물보다 가벼워 같은 부피에서 무게가 적게 나갑니다. 고체 상태의 유지는 부피 계량이 부정확하므로 저울을 쓰는 편이 확실합니다.",
  "장류·소스": "장류는 물보다 무거워 같은 큰술이라도 g이 큽니다. 스푼에 눌러 담는지 흘러넘치게 담는지에 따라 차이가 커서, 염도가 중요한 조리에서는 저울 계량을 권합니다.",
  "당류": "설탕류는 입자 크기에 따라 밀도가 달라집니다. 슈가파우더는 매우 가볍고 꿀·물엿은 물보다 무겁습니다. 점성이 있는 당류는 스푼에 기름을 살짝 바르면 잘 떨어집니다.",
  "소금·조미": "소금과 가루 조미료는 입자 크기에 따라 같은 부피의 무게가 크게 달라집니다. 굵은소금과 꽃소금은 같은 1큰술이라도 짠맛이 다르므로 바꿔 쓸 때 주의하세요.",
  "가루": "가루류는 담는 방법의 영향이 가장 큽니다. 체 친 뒤 숟가락으로 퍼 담고 칼등으로 깎는 방식이 가장 재현성이 좋고, 컵으로 퍼서 눌러 담으면 20~30%까지 많아집니다.",
  "곡물": "곡물은 낟알 사이 공간 때문에 밀도가 일정한 편이지만 품종·수분에 따라 조금씩 달라집니다. 쌀은 밥솥 계량컵(180ml)과 요리용 계량컵(200ml)이 다르니 주의하세요.",
};
function convertPage(d) {
  const gCup = r1(CUP * d.value), gTbsp = r1(TBSP * d.value), gTsp = r1(TSP * d.value);
  const rows = [
    ["1컵 (200ml)", gCup + "g"],
    ["3/4컵 (150ml)", r1(gCup * 0.75) + "g"],
    ["1/2컵 (100ml)", r1(gCup / 2) + "g"],
    ["1/3컵 (약 67ml)", r1(gCup / 3) + "g"],
    ["1/4컵 (50ml)", r1(gCup / 4) + "g"],
    ["1큰술 (15ml)", gTbsp + "g"],
    ["1/2큰술 (7.5ml)", r1(gTbsp / 2) + "g"],
    ["1작은술 (5ml)", gTsp + "g"],
    ["1/2작은술 (2.5ml)", r1(gTsp / 2) + "g"],
    ["100ml", r1(100 * d.value) + "g"],
  ];
  const back = [
    ["100g", r1(100 / d.value / CUP * 100) / 100 + "컵 (" + r1(100 / d.value) + "ml)"],
    ["200g", r1(200 / d.value / CUP * 100) / 100 + "컵 (" + r1(200 / d.value) + "ml)"],
    ["500g", r1(500 / d.value / CUP * 100) / 100 + "컵 (" + r1(500 / d.value) + "ml)"],
    ["1kg", r1(1000 / d.value / CUP * 100) / 100 + "컵 (" + r1(1000 / d.value) + "ml)"],
  ];
  const tbl = (arr) => `<div>${arr.map((r) => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>`;
  return {
    path: `convert/${d.slug}/`, emoji: "🥄",
    title: `${d.name} 1컵은 몇 g? — 컵·큰술·작은술 g 환산표`,
    ogTitle: `${d.name} 계량 환산표 — 1컵 ${gCup}g`,
    desc: `${d.name} 1컵(200ml)은 약 ${gCup}g, 1큰술은 약 ${gTbsp}g, 1작은술은 약 ${gTsp}g입니다. 밀도 ${d.value}g/ml 기준으로 1/4컵부터 1kg 역환산까지 정리한 ${d.name} 계량표입니다.`,
    h1: `${d.name} 계량 환산표`,
    appName: `${d.name} 계량 환산기`,
    lead: `<strong>${d.name} 1컵 = 약 ${gCup}g</strong> · 1큰술 = 약 ${gTbsp}g · 1작은술 = 약 ${gTsp}g`,
    crumbs: [
      { name: "재료별 계량표", item: `${SITE_ORIGIN}/convert/`, rel: "convert/" },
      { name: d.name, item: `${SITE_ORIGIN}/convert/${d.slug}/` },
    ],
    body: `
  <section class="card" aria-label="입력">
    <h2>${esc(d.name)} 수량 환산</h2>
    <div class="grid2">
      <label class="f">수량
        <input type="number" id="qty" inputmode="decimal" min="0" step="0.25" value="1" />
      </label>
      <label class="f">단위
        <select id="unit">
          <option value="컵">컵 (200ml)</option>
          <option value="큰술">큰술 (15ml)</option>
          <option value="작은술">작은술 (5ml)</option>
          <option value="ml">ml</option>
          <option value="g">g</option>
        </select>
      </label>
    </div>
    <button class="btn" id="calcBtn">${esc(d.name)} 환산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>환산 결과</h2>
      <p class="big"><span id="fromOut"></span> = <span class="num" id="gramOut"></span></p>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>

  <section class="card">
    <h2>${esc(d.name)} 부피 → 무게 환산표</h2>
    ${tbl(rows)}
    <h2 style="margin-top:18px">무게 → 부피 (역환산)</h2>
    ${tbl(back)}
    <p class="note">밀도 ${d.value} g/ml 기준 · 1컵 200ml · 1큰술 15ml · 1작은술 5ml${d.note ? ` · ${esc(d.note)}` : ""}</p>
  </section>`,
    intro: `<h2>${esc(d.name)}는 1컵에 몇 g일까</h2>
    <p>${esc(d.name)}의 밀도는 약 <strong>${d.value} g/ml</strong>입니다. 물(1.0)과 비교하면 ${d.value > 1.05 ? "무거운 편" : d.value < 0.95 ? "가벼운 편" : "거의 비슷한 수준"}이며, 그래서 한국 표준 계량컵 1컵(200ml)에 담으면 약 <strong>${gCup}g</strong>이 됩니다. 레시피에 "${esc(d.name)} 1컵"이라고 적혀 있는데 저울로 계량하고 싶다면 이 값을 쓰면 됩니다.</p>
    <p>${CAT_TIP[d.cat]}</p>`,
    howto: `<h2>이 표를 쓰는 법</h2>
    <ol>
      <li>레시피가 컵·큰술로 적혀 있고 저울을 쓰고 싶다면 위쪽 "부피 → 무게" 표를 봅니다.</li>
      <li>${esc(d.name)}를 g으로 사 왔는데 몇 컵인지 알고 싶다면 아래쪽 역환산 표를 봅니다.</li>
      <li>표에 없는 수량은 위의 계산기에 직접 넣으면 바로 환산됩니다.</li>
      <li>${d.cat === "가루" || d.cat === "소금·조미" ? "가루류는 담는 방법에 따라 ±20%까지 차이 나므로, 정밀한 베이킹에서는 저울을 권합니다." : "제과·제빵처럼 비율이 중요한 작업에서는 저울 계량이 가장 확실합니다."}</li>
    </ol>`,
    faq: [
      { q: `${d.name} 1큰술은 몇 g인가요?`, a: `약 ${gTbsp}g입니다(1큰술 = 15ml, 밀도 ${d.value} g/ml 기준). 계량스푼이 아닌 밥숟가락으로 뜨면 대개 10~12ml 정도라 이보다 적게 들어갑니다.` },
      { q: `${d.name} 100g은 몇 컵인가요?`, a: `약 ${back[0][1]}입니다. 반대로 1컵은 약 ${gCup}g입니다.` },
      { q: "표의 값과 실제 무게가 다릅니다.", a: `이 표의 밀도는 평평하게 깎아 담은 기준의 근사값입니다. ${d.note ? d.note + " " : ""}담는 방법, 제품, 온도에 따라 ±10~20% 차이가 날 수 있으니 정확한 값이 필요하면 저울을 쓰세요.` },
      { q: "미국 레시피의 1컵과 같나요?", a: `아닙니다. 한국 계량컵은 200ml, 미국은 약 240ml입니다. 미국 레시피의 ${d.name} 1컵은 약 ${r1(240 * d.value)}g에 해당합니다.` },
    ],
    basis: MEASURE_BASIS,
    disclaimer: DISC("밀도값은 계량 관행에 근거한 근사값입니다."),
    script: `import { toGram, fromGram } from "__U__lib/cook.mjs";
${IMP}
const D = ${d.value}, NAME = ${JSON.stringify(d.name)};
$("calcBtn").addEventListener("click", () => {
  const qty = num($("qty"), 1), unit = $("unit").value;
  const gram = toGram(qty, unit, D);
  $("fromOut").textContent = NAME + " " + fmt(qty, 2) + unit;
  $("gramOut").textContent = g(gram);
  $("tableOut").innerHTML = kv([
    ["부피", ml(gram / D)],
    ["컵 (200ml)", fmt(fromGram(gram, "컵", D), 2) + "컵"],
    ["큰술 (15ml)", fmt(fromGram(gram, "큰술", D), 1) + "큰술"],
    ["작은술 (5ml)", fmt(fromGram(gram, "작은술", D), 1) + "작은술"],
    ["무게", g(gram)],
  ]);
  $("srcOut").innerHTML = srcBox("계량 기준", [
    { text: NAME + " 밀도 " + D + " g/ml — ${esc(d.source)}", checkedAt: "${d.checkedAt}" },
  ]);
  show("resultBox");
});`,
    related: [{ slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, { slug: "recipe-scale", e: "📝", n: "레시피 배수 계산" }, X.fridge, X.season],
  };
}

function convertIndexPage() {
  const groups = densByCat().map((grp) => `<h3 class="f" style="margin:18px 0 0;font-size:14px">${grp.cat} <span class="mut">(${grp.items.length})</span></h3>
    <div class="linkgrid">${grp.items.map((d) => `<a href="${d.slug}/">${esc(d.name)} <span class="mut">1컵 ${r1(CUP * d.value)}g</span></a>`).join("")}</div>`).join("\n    ");
  return {
    path: "convert/", emoji: "📚", ad: false,
    title: `재료별 계량 환산표 — 1컵·1큰술 몇 g인지 ${DENS.length}종 정리`,
    ogTitle: "재료별 계량 환산표 — 1컵은 몇 g?",
    desc: `밀가루·설탕·간장·꿀 등 재료 ${DENS.length}종의 1컵(200ml)·1큰술·1작은술 무게를 한눈에 정리했습니다. 재료를 누르면 1/4컵부터 1kg 역환산까지 담은 상세 계량표로 이동합니다.`,
    h1: "재료별 계량 환산표",
    appName: "재료별 계량 환산표",
    lead: `재료 <strong>${DENS.length}종</strong>의 1컵 무게를 한눈에. 이름을 누르면 상세 환산표가 열립니다.`,
    crumbs: [{ name: "재료별 계량표", item: `${SITE_ORIGIN}/convert/` }],
    body: `
  <section class="card">
    <h2>보는 방법</h2>
    <p class="note">표시된 값은 한국 표준 계량컵 1컵(200ml)에 평평하게 깎아 담았을 때의 근사 무게입니다. 같은 1컵이라도 재료마다 무게가 다른 이유는 밀도가 다르기 때문입니다. 재료 이름을 누르면 1/4컵·1/2컵·1큰술·1작은술과 g→컵 역환산까지 정리된 페이지로 이동합니다.</p>
    ${groups}
  </section>`,
    intro: `<h2>왜 재료마다 1컵 무게가 다를까</h2>
    <p>컵은 부피 단위이므로 담기는 재료의 밀도에 따라 무게가 달라집니다. 물 1컵은 200g이지만 식용유는 184g, 설탕은 160g, 밀가루는 100g, 빵가루는 50g입니다. 꿀과 물엿처럼 물보다 무거운 재료는 280g에 이릅니다. 레시피를 정확히 재현하려면 이 차이를 알고 있어야 합니다.</p>
    <p>특히 <strong>가루류</strong>는 같은 재료라도 담는 방법에 따라 20~30%까지 달라집니다. 제과·제빵에서 컵 계량이 자꾸 실패하는 이유가 여기에 있고, 그래서 베이킹 레시피는 대부분 g으로 적습니다.</p>`,
    howto: `<h2>이럴 때 씁니다</h2>
    <ul>
      <li>레시피는 컵으로 적혀 있는데 저울로 정확히 재고 싶을 때</li>
      <li>설탕 500g을 샀는데 몇 컵인지 알고 싶을 때</li>
      <li>미국·일본 레시피의 컵 단위를 한국 계량컵으로 옮길 때</li>
      <li>계량컵 없이 큰술·작은술만으로 대체하고 싶을 때</li>
    </ul>`,
    faq: [
      { q: "가장 많이 쓰이는 값은 무엇인가요?", a: "밀가루 1컵 약 100g, 설탕 1컵 약 160g, 쌀 1컵 약 165g, 물·우유 1컵 약 200g입니다. 간장 1큰술은 약 17g, 고추장 1큰술은 약 19~20g입니다." },
      { q: "이 표만 보고 베이킹해도 되나요?", a: "가능은 하지만 권하지 않습니다. 가루류는 담는 방법에 따른 편차가 커서, 정밀한 배합이 필요한 제과·제빵에서는 저울 계량이 훨씬 안정적입니다." },
      { q: "목록에 없는 재료는 어떻게 하나요?", a: "확실하지 않은 값은 싣지 않았습니다. 성질이 비슷한 재료(예: 다른 종류의 가루)의 값을 참고하거나, 저울로 직접 1컵을 재어 보세요." },
    ],
    basis: MEASURE_BASIS,
    disclaimer: DISC("밀도값은 계량 관행에 근거한 근사값입니다."),
    related: [{ slug: "unit-convert", e: "🥄", n: "계량 단위 변환기" }, { slug: "recipe-scale", e: "📝", n: "레시피 배수 계산" }, { slug: "baking-pan", e: "🎂", n: "베이킹 팬 변환" }, X.fridge, X.season],
  };
}

/* ── 롱테일 2: 재료별 에어프라이어 (airfryer/<slug>/) ───────── */
const AIR_CAT_TIP = {
  "냉동식품": "냉동식품은 해동하지 않고 냉동 상태 그대로 넣는 것이 원칙입니다. 해동하면 물기가 생겨 눅눅해집니다. 바스켓에 한 겹으로 펼치고 중간에 한 번 흔들어 주세요.",
  "육류": "육류는 겉이 익은 것과 속까지 익은 것이 다릅니다. 두꺼운 부위는 가장 두꺼운 곳을 갈라 확인하고, 가금류는 반드시 속까지 완전히 익혀 드세요. 기름이 많이 나오는 부위는 바닥에 물을 조금 붓거나 종이호일을 쓰면 연기를 줄일 수 있습니다.",
  "해산물": "생선은 물기를 완전히 닦고 종이호일 위에 올려야 살이 바스켓에 붙지 않습니다. 오래 익히면 금방 퍽퍽해지므로 표시 시간보다 짧게 시작해 확인하며 늘리세요.",
  "채소·구황": "채소는 기름을 아주 얇게 버무려야 표면이 마르지 않고 겉이 바삭해집니다. 고구마·감자처럼 두꺼운 것은 젓가락이 쑥 들어가는지로 확인하세요.",
  "빵·간식": "빵류는 수분이 적어 금방 탑니다. 표시 시간이 짧고, 눈에 보이는 색 변화로 판단하는 편이 정확합니다.",
};
function airfryerPage(a) {
  const v = a.value;
  const [lo, hi] = String(v.time).split("~").map((x) => parseInt(x, 10));
  const hiV = isFinite(hi) ? hi : lo;
  const ovenTemp = v.temp + Math.abs(OVEN_RULE.tempDelta.value);
  const ovenTime = Math.round(((lo + hiV) / 2) / OVEN_RULE.timeFactor.value);
  return {
    path: `airfryer/${a.slug}/`, emoji: "🍟",
    title: `${a.name} 에어프라이어 온도·시간 — ${v.temp}℃ ${v.time}분`,
    ogTitle: `${a.name} 에어프라이어 ${v.temp}℃ ${v.time}분`,
    desc: `${a.name}는 에어프라이어 ${v.temp}℃에서 ${v.time}분이 기본입니다${v.flip ? " (중간에 한 번 뒤집기·흔들기)" : ""}. 오븐 기준 환산, 확인 시점, 실패를 줄이는 요령을 정리했습니다. 기기·양에 따라 달라지는 관행값이므로 참고용으로 사용하세요.`,
    h1: `${a.name} 에어프라이어`,
    appName: `${a.name} 에어프라이어 시간 계산기`,
    lead: `<strong>${v.temp}℃ · ${v.time}분</strong>${v.flip ? " · 중간에 한 번 뒤집기" : " · 뒤집지 않아도 됨"} <span class="badge warn">${OVEN_RULE.label}</span>`,
    crumbs: [
      { name: "에어프라이어 변환", item: `${SITE_ORIGIN}/airfryer/`, rel: "airfryer/" },
      { name: a.name, item: `${SITE_ORIGIN}/airfryer/${a.slug}/` },
    ],
    body: `
  <section class="card">
    <h2>${esc(a.name)} 기본 조리 조건</h2>
    <div>
      <div class="kv"><span>온도</span><b>${v.temp}℃</b></div>
      <div class="kv"><span>시간</span><b>${esc(v.time)}분</b></div>
      <div class="kv"><span>중간 뒤집기</span><b>${v.flip ? "필요 (한 번 뒤집거나 흔들기)" : "필요 없음"}</b></div>
      <div class="kv"><span>확인 시점</span><b>약 ${Math.max(1, Math.round(((lo + hiV) / 2) * 0.7))}분</b></div>
      <div class="kv"><span>분류</span><b>${esc(a.cat)}</b></div>
    </div>
    ${a.note ? `<p class="note">${esc(a.note)}</p>` : ""}
  </section>

  <section class="card" aria-label="입력">
    <h2>내 오븐 레시피를 이 기준으로 환산</h2>
    <div class="grid2">
      <label class="f">오븐 온도 <span class="u">(℃)</span>
        <input type="number" id="temp" inputmode="decimal" min="80" max="280" step="5" value="${ovenTemp}" />
      </label>
      <label class="f">오븐 시간 <span class="u">(분)</span>
        <input type="number" id="time" inputmode="decimal" min="1" step="1" value="${ovenTime}" />
      </label>
    </div>
    <button class="btn" id="calcBtn">에어프라이어 기준으로 변환</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>변환 결과</h2>
      <p class="big">에어프라이어 <span class="num" id="tempOut"></span></p>
      <div id="tableOut"></div>
      <p class="note">${esc(a.name)}의 기본값(${v.temp}℃ ${esc(v.time)}분)과 비교해 보고, 차이가 크면 재료 두께와 양을 확인하세요.</p>
    </div>
    <div id="srcOut"></div>
  </section>`,
    intro: `<h2>${esc(a.name)}, 왜 이 온도·이 시간인가</h2>
    <p>${esc(a.name)}의 기본 조건은 <strong>${v.temp}℃ / ${esc(v.time)}분</strong>입니다. ${v.temp >= 190 ? "비교적 높은 온도를 쓰는 이유는 겉면을 빠르게 마르게 해 바삭한 표면을 만들기 위해서입니다." : v.temp <= 165 ? "낮은 온도를 쓰는 이유는 겉이 타기 전에 속이 익어야 하기 때문입니다." : "180℃는 겉면 갈변과 속 익힘의 균형이 잘 맞는 구간이라 가장 많이 쓰입니다."} ${v.flip ? "중간에 한 번 뒤집거나 흔들어야 아래쪽 면이 눅눅해지지 않습니다." : "뒤집지 않아도 되는 재료지만, 바스켓 가장자리와 가운데의 익는 정도가 다르면 위치를 바꿔 주세요."}</p>
    <p>${AIR_CAT_TIP[a.cat]}</p>`,
    howto: `<h2>${esc(a.name)} 조리 순서</h2>
    <ol>
      <li>${a.cat === "냉동식품" ? "냉동 상태 그대로" : "재료의 물기를 닦고"} 바스켓에 <strong>한 겹으로</strong> 펼칩니다. 겹치면 시간이 크게 늘어납니다.</li>
      <li>${v.temp}℃로 맞추고 ${esc(v.time)}분을 설정합니다. 예열을 했다면 1~2분 줄입니다.</li>
      <li>${Math.max(1, Math.round(((lo + hiV) / 2) * 0.7))}분쯤 열어 상태를 확인${v.flip ? "하고 뒤집거나 흔들어 줍니다" : "합니다"}.</li>
      <li>${a.cat === "육류" || a.cat === "해산물" ? "가장 두꺼운 부분을 갈라 속까지 완전히 익었는지 확인한 뒤 꺼냅니다." : "원하는 색이 나면 꺼내고, 부족하면 3분씩 추가합니다."}</li>
    </ol>`,
    faq: [
      { q: `${a.name}는 예열이 필요한가요?`, a: `${a.cat === "냉동식품" ? "냉동식품은 예열 없이 넣어도 결과 차이가 크지 않습니다. 예열했다면 시간을 1~2분 줄이세요." : "3~5분 예열하면 표면이 더 빨리 마르며 결과가 좋아집니다. 예열했다면 표시 시간에서 1~2분 줄이세요."}` },
      { q: `${a.name} 양을 두 배로 하면 시간도 두 배인가요?`, a: "아닙니다. 다만 바스켓이 가득 차면 공기가 순환하지 못해 시간이 1.3~1.5배까지 늘어납니다. 두 번에 나눠 조리하는 편이 결과가 좋습니다." },
      { q: "오븐 레시피를 그대로 써도 되나요?", a: `에어프라이어는 열풍이 강해 같은 온도에서 더 빨리 익습니다. 오븐 ${ovenTemp}℃ ${ovenTime}분 레시피가 이 페이지 기준 ${v.temp}℃ ${esc(v.time)}분에 해당합니다(온도 ${Math.abs(OVEN_RULE.tempDelta.value)}℃ 낮추고 시간 ${Math.round((1 - OVEN_RULE.timeFactor.value) * 100)}% 단축 — 관행 규칙, 참고용).` },
      { q: "표시 시간대로 했는데 덜 익었습니다.", a: `기기 용량(3L·5L·7L), 재료 두께, 넣은 양에 따라 달라지는 관행값이기 때문입니다. 3분씩 추가하며 확인하시고, ${a.cat === "육류" || a.cat === "해산물" ? "육류·가금류는 반드시 속까지 완전히 익혀 드세요." : "겉이 먼저 타면 온도를 10℃ 낮추고 시간을 늘리세요."}` },
    ],
    basis: AIR_BASIS,
    disclaimer: DISC("온도·시간은 기기·용량·재료 두께에 따라 달라지는 관행값입니다. 육류·가금류는 반드시 속까지 완전히 익혀 드세요."),
    script: `import { OVEN_RULE } from "__U__data/airfryer.mjs";
import { ovenToAir } from "__U__lib/cook.mjs";
${IMP}
$("calcBtn").addEventListener("click", () => {
  const t = num($("temp"), 200), m = num($("time"), 20);
  const r = ovenToAir(t, m, OVEN_RULE);
  $("tempOut").textContent = r.temp + "℃ / " + r.minMin + "~" + r.minMax + "분";
  $("tableOut").innerHTML = kv([
    ["오븐 기준", t + "℃ · " + m + "분"],
    ["에어프라이어 온도", r.temp + "℃"],
    ["에어프라이어 시간", r.minMin + "~" + r.minMax + "분 (중앙값 " + r.mid + "분)"],
    ["${esc(a.name)} 기본값", "${v.temp}℃ · ${esc(v.time)}분"],
    ["확인 시점", Math.max(1, Math.round(r.mid * 0.7)) + "분"],
  ]);
  $("srcOut").innerHTML = srcBox("데이터 출처", [
    { text: "${esc(a.name)} 기본 온도·시간 — ${esc(a.source)} [${OVEN_RULE.label}]", checkedAt: "${a.checkedAt}" },
    { text: "오븐 변환 규칙 " + OVEN_RULE.tempDelta.value + "℃ · ×" + OVEN_RULE.timeFactor.value, checkedAt: OVEN_RULE.tempDelta.checkedAt },
  ]);
  show("resultBox");
});`,
    related: [{ slug: "airfryer", e: "🍟", n: "에어프라이어 변환기" }, { slug: "timer-multi", e: "⏲️", n: "동시 타이머" }, X.air, X.fridge, X.naengpa],
  };
}

/* ── 롱테일 3: 재료별 보관법 (storage/<slug>/) ─────────────── */
const STO_CAT_TIP = {
  "육류": "육류는 냉장고에서 가장 차가운 최하단 안쪽에 두고, 핏물이 다른 식품에 닿지 않도록 밀폐 용기나 접시를 받쳐 보관합니다. 오래 두려면 1회분씩 소분해 공기를 뺀 뒤 냉동하세요.",
  "해산물": "해산물은 구입 당일 손질해 물기를 제거하고 밀봉하는 것이 가장 중요합니다. 등푸른 생선은 지방 산패가 빨라 냉동 기간도 흰살생선보다 짧게 잡습니다.",
  "유제품·달걀": "유제품은 온도 변화에 민감해 문 쪽보다 안쪽 선반이 좋습니다. 달걀은 씻지 말고 뾰족한 쪽을 아래로 두면 더 오래 갑니다.",
  "채소": "채소는 대부분 습도 유지가 관건입니다. 키친타월로 감싸 지퍼백에 넣으면 수분이 조절돼 무르는 속도가 느려집니다. 감자·양파·고구마는 냉장하지 말고 서늘하고 어두운 곳에 따로 두세요.",
  "과일": "과일은 에틸렌 가스를 내뿜는 것(사과·바나나)과 그에 민감한 것을 분리해 보관합니다. 후숙이 필요한 과일은 실온에서 익힌 뒤 냉장으로 옮기세요.",
  "곡물·건조": "건조 식품은 습기와 벌레가 적입니다. 밀폐 용기에 담아 서늘하고 어두운 곳에 두고, 여름에는 냉장 보관이 안전합니다.",
  "양념·소스": "개봉 전에는 실온에서도 오래 가지만, 개봉 후에는 대부분 냉장이 원칙입니다. 뚜껑 주변에 묻은 내용물이 곰팡이의 시작점이 되므로 닦아서 보관하세요.",
  "조리식품": "조리한 음식은 빨리 식혀 2시간 안에 냉장에 넣는 것이 원칙입니다. 넓은 용기에 나눠 담으면 빨리 식습니다. 다시 데울 때는 속까지 뜨겁게 데우세요.",
};
function storagePage(s) {
  const v = s.value;
  const line = (k, val) => `<div class="kv"><span>${k}</span><b>${val ? esc(val) : "권장하지 않음"}</b></div>`;
  const main = v.fridge ? `냉장 ${v.fridge}` : v.room ? `실온 ${v.room}` : `냉동 ${v.frozen}`;
  return {
    path: `storage/${s.slug}/`, emoji: "🧊",
    title: `${s.name} 보관기간 — 냉장·냉동 며칠까지? (${main})`,
    ogTitle: `${s.name} 보관기간 — ${main}`,
    desc: `${s.name}의 권장 보관기간은 ${v.room ? `실온 ${v.room}, ` : ""}${v.fridge ? `냉장 ${v.fridge}` : "냉장 해당 없음"}${v.frozen ? `, 냉동 ${v.frozen}` : ""}입니다. 보관 요령과 상한 것을 알아보는 방법까지 정리했습니다. 보관 상태에 따라 다르므로 참고용으로 사용하세요.`,
    h1: `${s.name} 보관기간`,
    appName: `${s.name} 보관기간 계산기`,
    lead: `<strong>${esc(main)}</strong> <span class="badge warn">보관 상태에 따라 다름</span>`,
    crumbs: [
      { name: "식재료 보관기간", item: `${SITE_ORIGIN}/storage/`, rel: "storage/" },
      { name: s.name, item: `${SITE_ORIGIN}/storage/${s.slug}/` },
    ],
    body: `
  <section class="card">
    <h2>${esc(s.name)} 권장 보관기간</h2>
    <div>
      ${line("실온", v.room)}
      ${line("냉장 (0~4℃)", v.fridge)}
      ${line("냉동 (−18℃ 이하)", v.frozen)}
      <div class="kv"><span>분류</span><b>${esc(s.cat)}</b></div>
    </div>
    ${s.tip ? `<p class="note">${esc(s.tip)}</p>` : ""}
  </section>

  <section class="card" aria-label="입력">
    <h2>남은 기간 계산</h2>
    <div class="grid2">
      <label class="f">구입·개봉일
        <input type="date" id="buyDate" />
      </label>
      <label class="f">보관 방법
        <select id="place">
          ${v.fridge ? `<option value="fridge">냉장</option>` : ""}
          ${v.frozen ? `<option value="frozen">냉동</option>` : ""}
          ${v.room ? `<option value="room">실온</option>` : ""}
        </select>
      </label>
    </div>
    <button class="btn" id="calcBtn">남은 기간 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big"><span class="num" id="leftOut"></span></p>
      <div id="tableOut"></div>
      <p class="note">기간이 남아 있어도 냄새·색·점액 등 이상이 있으면 폐기하세요. 표시된 소비기한이 있으면 표시를 우선합니다.</p>
    </div>
    <div id="srcOut"></div>
  </section>`,
    intro: `<h2>${esc(s.name)}는 얼마나 두어도 될까</h2>
    <p>${esc(s.name)}의 일반적인 권장 보관기간은 ${v.fridge ? `냉장에서 <strong>${esc(v.fridge)}</strong>` : "냉장 보관 대상이 아니며"}${v.frozen ? `, 냉동에서 <strong>${esc(v.frozen)}</strong>` : ""}입니다${v.room ? `. 실온 보관은 ${esc(v.room)}까지가 기준입니다` : ""}. 이 값은 안전을 보장하는 선이 아니라 <strong>품질이 유지되는 일반 권고 범위</strong>입니다. 구입 시점의 신선도, 포장 상태, 냉장고 온도에 따라 실제 기간은 크게 달라집니다.</p>
    <p>${STO_CAT_TIP[s.cat]}</p>`,
    howto: `<h2>${esc(s.name)} 보관 요령</h2>
    <ol>
      <li>${s.tip ? esc(s.tip) : "구입 후 되도록 빨리 밀폐 용기나 지퍼백에 옮겨 공기 접촉을 줄입니다."}</li>
      <li>${v.frozen ? "오래 둘 것은 1회 사용량으로 소분해 공기를 뺀 뒤 냉동하고, 날짜를 적어 두세요." : "냉동을 권하지 않는 품목이므로 표시된 기간 안에 소비하는 편이 좋습니다."}</li>
      <li>냉장고 온도는 0~4℃가 권장 범위입니다. 문 쪽은 온도 변화가 커 상하기 쉬운 식품에는 적합하지 않습니다.</li>
      <li>기간이 남았더라도 냄새·색·점액·곰팡이 등 이상이 있으면 폐기하세요.</li>
    </ol>`,
    faq: [
      { q: `${s.name}는 냉동해도 되나요?`, a: v.frozen ? `네, 냉동 시 약 ${v.frozen}까지 품질이 유지됩니다. 공기를 뺀 밀봉 포장이 냉동상을 줄이는 데 가장 효과적입니다.` : "권장하지 않습니다. 조직이나 맛이 크게 손상되는 품목이라 표시된 기간 안에 소비하는 편이 좋습니다." },
      { q: `${s.name} 보관기간이 지났는데 먹어도 되나요?`, a: "표의 기간은 품질 유지 기준의 일반 권고이며 안전을 보장하지 않습니다. 기간이 지났다면 냄새와 색, 표면 상태를 확인하고 조금이라도 이상하면 폐기하세요. 포장에 소비기한이 표시돼 있으면 그 표시를 우선합니다." },
      { q: "냉장고 어디에 두는 게 좋나요?", a: `${s.cat === "육류" || s.cat === "해산물" ? "가장 차가운 최하단 안쪽이 적합합니다. 다른 식품에 즙이 닿지 않도록 받침을 두세요." : s.cat === "채소" || s.cat === "과일" ? "전용 칸(야채실)의 습도 유지가 중요합니다. 키친타월로 감싸 지퍼백에 넣으면 오래 갑니다." : "온도 변화가 적은 안쪽 선반이 좋습니다. 문 쪽은 여닫을 때마다 온도가 오르내립니다."}` },
      { q: "기간이 다른 자료도 있던데요?", a: "보관기간은 기관·자료마다 범위를 다르게 제시합니다. 이 사이트는 FoodKeeper와 식품안전나라 등에서 공통적으로 안내하는 범위를 종합했으며, 보수적으로 판단하실 것을 권합니다." },
    ],
    basis: `<h2>데이터 기준</h2>
    <p class="note">${esc(s.name)}의 보관기간은 가정 보관 시 품질 유지 기간의 <strong>일반 권고 범위</strong>입니다
    (출처: <a href="https://www.foodsafety.gov/keep-food-safe/foodkeeper-app" target="_blank" rel="noopener">FoodKeeper</a> ·
    <a href="https://www.foodsafetykorea.go.kr" target="_blank" rel="noopener">식품안전나라</a> 종합, 확인일 ${s.checkedAt}).
    <span class="badge warn">보관 상태에 따라 다름</span></p>`,
    disclaimer: FOOD_SAFETY,
    script: `${IMP}
const SPAN = ${JSON.stringify({ room: v.room, fridge: v.fridge, frozen: v.frozen })};
function parseDays(s) {
  if (!s) return null;
  const m = String(s).match(/(\\d+)\\s*(?:~\\s*(\\d+))?\\s*(일|개월|주|년)/);
  if (!m) return null;
  const lo = +m[1], hi = m[2] ? +m[2] : +m[1];
  const mul = m[3] === "일" ? 1 : m[3] === "주" ? 7 : m[3] === "개월" ? 30 : 365;
  return { lo: lo * mul, hi: hi * mul };
}
$("calcBtn").addEventListener("click", () => {
  const place = $("place").value;
  const label = place === "fridge" ? "냉장" : place === "frozen" ? "냉동" : "실온";
  const raw = SPAN[place];
  const span = parseDays(raw);
  const dv = $("buyDate").value;
  const rows = [["보관 방법", label], ["권장 기간", raw || "해당 없음"]];
  if (!dv) {
    $("leftOut").textContent = label + " " + (raw || "해당 없음");
    rows.push(["남은 기간", "구입·개봉일을 입력하면 계산됩니다"]);
  } else if (!span) {
    $("leftOut").textContent = label + " " + (raw || "해당 없음");
    rows.push(["남은 기간", "기간 표기를 숫자로 읽을 수 없어 생략"]);
  } else {
    const days = Math.floor((Date.now() - new Date(dv + "T00:00:00").getTime()) / 86400000);
    const left = span.hi - days;
    $("leftOut").textContent = left >= 0 ? "약 " + Math.max(0, span.lo - days) + "~" + left + "일 남음" : "권장 기간 " + (-left) + "일 초과";
    rows.push(["경과", days + "일"]);
    rows.push(["권장 잔여", left >= 0 ? "약 " + Math.max(0, span.lo - days) + "~" + left + "일" : "초과 (" + (-left) + "일)"]);
  }
  $("tableOut").innerHTML = kv(rows);
  $("srcOut").innerHTML = srcBox("데이터 출처", [{ text: "${esc(s.source)}", checkedAt: "${s.checkedAt}" }]);
  show("resultBox");
});`,
    related: [{ slug: "storage", e: "🧊", n: "식재료 보관기간 검색" }, { slug: "calorie-plate", e: "🍽️", n: "한 끼 칼로리" }, X.fridge, X.naengpa, X.season],
  };
}

/* ── 허브 · 정책 페이지 ─────────────────────────────────────── */
function hubPage() {
  const cards = TOOLS.map((t) => `<a class="tool" href="${t.slug}/"><div class="t-e">${t.emoji}</div><div class="t-n">${t.hubName}</div><div class="t-d">${t.hubDesc}</div></a>`).join("\n      ");
  return {
    path: "", emoji: "🍳", ad: false,
    title: "요리 계산기 허브 — 계량 변환·밥물·에어프라이어·보관기간",
    ogTitle: "요리 계산기 허브 — 주방에서 바로 쓰는 계산기 12종",
    desc: "밀가루 1컵은 몇 g? 쌀 2컵에 물은? 오븐 200℃는 에어프라이어로? 계량 단위 변환, 레시피 배수, 밥물, 에어프라이어 변환, 식재료 보관기간, 염지·김치 절임·커피 비율·베이킹 팬까지 주방에서 바로 쓰는 무료 계산기 모음입니다.",
    h1: "요리 계산기",
    appName: "요리 계산기 허브",
    lead: `계량·시간·비율 — 요리하다 막히는 <strong>숫자 문제</strong>를 주방에서 바로 해결합니다.`,
    crumbs: [],
    body: `
  <div class="tool-grid">
      ${cards}
      <a class="tool" href="convert/"><div class="t-e">📚</div><div class="t-n">재료별 계량 환산표</div><div class="t-d">재료 ${DENS.length}종의 1컵·1큰술 무게를 한눈에. 재료별 상세 환산표로 이동합니다.</div></a>
  </div>`,
    intro: `<h2>레시피에서 가장 자주 막히는 것은 숫자다</h2>
    <p>요리를 망치는 원인은 대개 재료가 아니라 <strong>숫자</strong>입니다. "밀가루 1컵"이 몇 g인지 몰라 눈대중으로 담고, 2인분 레시피를 4인분으로 늘리다 소금만 그대로 두고, 오븐 레시피를 에어프라이어에 그대로 넣어 태웁니다. 이 사이트의 계산기들은 그 순간에 필요한 숫자 하나를 정확히 내주는 데 집중합니다.</p>
    <p>모든 계산은 <strong>브라우저 안에서만</strong> 이뤄집니다. 입력한 값은 서버로 전송되거나 저장되지 않고, 이름·연락처 같은 개인정보는 아예 받지 않습니다. 설치할 것도 로그인할 것도 없습니다.</p>
    <p>또 하나의 원칙은 <strong>모르는 값은 지어내지 않는다</strong>는 것입니다. 밀도표·보관기간표·에어프라이어 시간표의 모든 항목에는 출처와 확인일을 붙였고, 확신이 없는 재료는 아예 싣지 않았습니다. 보관기간은 "보관 상태에 따라 다름", 에어프라이어 변환은 "관행 규칙, 참고용"임을 그대로 표시합니다.</p>`,
    howto: `<h2>이런 질문에 답합니다</h2>
    <ul>
      <li>밀가루 1컵은 몇 g일까? 설탕 250g은 몇 컵일까?</li>
      <li>2인분 레시피를 5인분으로 늘리면 재료가 각각 얼마가 될까?</li>
      <li>쌀 3컵에 물은 몇 ml? 현미밥과 잡곡밥은?</li>
      <li>오븐 200℃ 25분 레시피를 에어프라이어로 옮기면?</li>
      <li>삼겹살은 냉장 며칠, 냉동 몇 달까지 두어도 될까?</li>
      <li>배추 10kg 김장에 굵은소금은 몇 g?</li>
      <li>닭가슴살을 촉촉하게 만드는 염지 비율은?</li>
      <li>원두 20g에 물은 몇 ml? 콜드브루 원액은?</li>
      <li>1호 케이크 레시피를 2호 팬으로 옮기면 재료는 몇 배?</li>
      <li>라면·계란·에어프라이어 타이머를 동시에 돌리려면?</li>
    </ul>`,
    faq: [
      { q: "계량 기준이 어떻게 되나요?", a: "한국 표준인 1컵 200ml, 1큰술 15ml, 1작은술 5ml를 기준으로 합니다. 미국 레시피의 1컵(약 240ml)과 다르므로 해외 레시피를 옮길 때는 ml로 바꿔 계산하시는 편이 안전합니다." },
      { q: "데이터는 어디서 가져왔나요?", a: "밀도값은 국내 계량 관행을 정리한 근사값, 보관기간은 FoodKeeper·식품안전나라의 일반 권고 범위 종합, 칼로리는 식약처 식품영양성분 데이터베이스 기준의 1회 제공량 근사값입니다. 각 항목에 출처와 확인일을 표기했습니다." },
      { q: "개인정보를 입력해야 하나요?", a: "아닙니다. 모든 계산은 브라우저 안에서만 이뤄지며 입력값은 서버로 전송되거나 저장되지 않습니다. 이름·연락처·이메일 등 개인정보는 수집하지 않습니다." },
      { q: "결과를 그대로 믿어도 되나요?", a: "참고용입니다. 계량은 담는 방법에 따라 ±10~20%, 에어프라이어 시간은 기기에 따라 크게 달라집니다. 보관기간은 안전을 보장하는 선이 아니라 품질 유지 기간의 권고 범위이며, 칼로리는 재미·참고용으로 의학적 판단의 근거가 아닙니다." },
      { q: "왜 어떤 재료는 목록에 없나요?", a: "확신이 없는 값은 넣지 않는다는 원칙 때문입니다. 통견과류나 잎채소처럼 부피 계량 자체가 정의하기 어려운 재료, 자료마다 편차가 큰 항목은 제외했습니다." },
    ],
    basis: MEASURE_BASIS,
    disclaimer: DISC("식품 안전과 관련된 판단은 반드시 식품안전나라 등 공식 자료를 함께 확인하세요."),
    related: [X.fridge, X.air, X.naengpa, X.cafe, X.season],
  };
}

const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ad: false, app: false,
    title: "개인정보처리방침 — 요리 계산기 허브",
    desc: "본 사이트는 개인정보를 수집하지 않습니다. 모든 계산은 브라우저에서 처리되며, 광고 제공을 위한 쿠키 사용에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    crumbs: [{ name: "개인정보처리방침", item: `${SITE_ORIGIN}/privacy.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 수집하는 개인정보</h2>
    <p>본 사이트는 회원가입 절차가 없으며 이름·연락처·이메일·주민등록번호 등 개인을 식별할 수 있는 정보를 일절 수집하지 않습니다. 계산기에 입력하는 재료·수량·날짜 등의 값은 브라우저 안에서만 처리되며 서버로 전송되거나 저장되지 않습니다.</p>
    <h2>2. 쿠키와 광고</h2>
    <p>본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다. 광고는 계산 결과가 표시된 뒤 결과 하단에만 노출됩니다.</p>
    <h2>3. 로컬 저장소</h2>
    <p>화면 테마(밝은/어두운) 설정을 기억하기 위해 브라우저의 localStorage에 값 하나를 저장합니다. 이 값은 개인을 식별하지 않으며 브라우저 설정에서 삭제할 수 있습니다.</p>
    <h2>4. 접속 분석</h2>
    <p>호스팅 사업자가 제공하는 기본적인 접속 통계(방문 수, 페이지 조회 수 등)가 집계될 수 있으며, 이는 개인을 식별하지 않는 형태입니다.</p>
    <h2>5. 문의</h2>
    <p>개인정보 관련 문의는 <a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a>을 통해 연락하실 수 있습니다.</p>
    <p class="note">시행일: ${TODAY}</p>
  </section>`,
    about: false,
  },
  {
    path: "terms.html", emoji: "📜", ad: false, app: false,
    title: "이용약관 — 요리 계산기 허브",
    desc: "본 사이트가 제공하는 계량·보관기간·조리 시간 계산 결과의 성격과 책임 범위, 저작권에 관한 안내입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 정보입니다.",
    crumbs: [{ name: "이용약관", item: `${SITE_ORIGIN}/terms.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 서비스의 성격</h2>
    <p>본 사이트는 요리에 필요한 계량 환산, 비율 계산, 조리 시간 변환, 식재료 보관기간 조회 등을 제공하는 무료 도구입니다. 모든 결과는 <strong>참고용 정보</strong>이며 특정한 조리 결과나 식품의 안전을 보증하지 않습니다.</p>
    <h2>2. 식품 안전에 관한 고지</h2>
    <p>보관기간은 가정 보관 시 품질 유지 기간의 일반 권고 범위이며 <strong>보관 상태에 따라 크게 달라집니다</strong>. 에어프라이어 온도·시간은 공식 규격이 아닌 <strong>관행 규칙</strong>입니다. 육류·가금류·해산물·달걀은 반드시 속까지 완전히 익혀 드시고, 이상이 있는 식품은 기간과 무관하게 폐기하시기 바랍니다. 공식 기준은 <a href="https://www.foodsafetykorea.go.kr" target="_blank" rel="noopener">식품안전나라</a>에서 확인하세요.</p>
    <h2>3. 건강·영양에 관한 고지</h2>
    <p>칼로리 등 영양 관련 정보는 <strong>재미·참고용</strong>이며 의학적 진단이나 영양 처방이 아닙니다. 체중 관리나 질환과 관련된 식단은 의사·영양사 등 전문가와 상의하시기 바랍니다.</p>
    <h2>4. 책임의 한계</h2>
    <p>이용자가 본 사이트의 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다.</p>
    <h2>5. 저작권</h2>
    <p>본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 인용한 공공 데이터의 권리는 각 기관에 있습니다.</p>
    <h2>6. 광고</h2>
    <p>본 사이트는 Google AdSense 광고를 게재하며, 광고 내용에 대한 책임은 광고주에게 있습니다. 광고는 계산 결과 화면 하단에만 표시됩니다.</p>
    <p class="note">시행일: ${TODAY}</p>
  </section>`,
    about: false,
  },
];

/* ── 페이지 조립 ────────────────────────────────────────────── */
const pages = [];
pages.push(hubPage());
for (const t of TOOLS) {
  pages.push({
    path: `${t.slug}/`, emoji: t.emoji, title: t.title, ogTitle: t.ogTitle, desc: t.desc,
    h1: t.h1, appName: t.hubName, lead: t.lead,
    crumbs: [{ name: t.nav, item: `${SITE_ORIGIN}/${t.slug}/` }],
    body: t.body, intro: t.intro, howto: t.howto, faq: t.faq,
    basis: t.basis, disclaimer: t.disclaimer, script: t.script,
    related: t.related,
  });
}
pages.push(convertIndexPage());
for (const d of DENS) pages.push(convertPage(d));
for (const a of AIRS) pages.push(airfryerPage(a));
for (const s of STOR) pages.push(storagePage(s));
for (const p of POLICY) pages.push(p);

/* ── 쓰기 ───────────────────────────────────────────────────── */
let written = 0;
for (const p of pages) {
  const file = join(ROOT, p.path === "" ? "index.html" : p.path.endsWith("/") ? p.path + "index.html" : p.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(p), "utf8");
  written++;
}

/* sitemap */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => {
  const loc = SITE_ORIGIN + "/" + p.path;
  const depth = p.path.endsWith("/") ? p.path.split("/").filter(Boolean).length : 0;
  const pr = p.path === "" ? "1.0" : p.path.endsWith(".html") ? "0.3" : depth >= 2 ? "0.5" : "0.8";
  return `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${pr}</priority></url>`;
}).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap, "utf8");

/* robots */
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, "utf8");

/* 고아 폴더 경고 */
const known = new Set(pages.filter((p) => p.path.endsWith("/") && p.path).map((p) => p.path.split("/")[0]));
const RESERVED = new Set(["assets", "data", "lib", "tests", "node_modules", "convert"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

console.log(`생성 완료: HTML ${written}개 (허브 1 · 도구 ${TOOLS.length} · 계량 롱테일 ${DENS.length} · 에어프라이어 롱테일 ${AIRS.length} · 보관 롱테일 ${STOR.length} · 목록 1 · 정책 ${POLICY.length})`);
console.log(`sitemap.xml: ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
