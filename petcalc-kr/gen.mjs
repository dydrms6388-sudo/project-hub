#!/usr/bin/env node
// PetCalc 정적 사이트 생성기 — 의존성 0, Node 표준 모듈만 사용.
// 공통 HTML 셸 1개 + 페이지 설정 배열로 전 페이지(도구·가이드·롱테일)를 생성한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_NAME, ADSENSE_CLIENT, CROSS_LINKS } from "./data/site.mjs";
import { DOG_AGE_TABLE, CAT_AGE_RULE } from "./data/ages.mjs";
import { RER_FORMULA, MER_FACTORS } from "./data/feeding.mjs";
import { DOG_SCHEDULE, CAT_SCHEDULE, HEARTWORM } from "./data/vaccine.mjs";
import { DOG_GESTATION, CAT_HEAT } from "./data/repro.mjs";
import { COST_ITEMS, COST_META } from "./data/costs.mjs";
import { DOG_CANEAT } from "./data/caneat-dog.mjs";
import { CAT_CANEAT } from "./data/caneat-cat.mjs";
import { BREEDS, BREED_META, SIZE_LABEL } from "./data/breeds.mjs";

const SITE_ORIGIN = "https://petcalc-kr.vercel.app";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES = [];
const T0 = Date.now();
let WARN = 0;

/* ---------------- 유틸 ---------------- */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const J = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const depthOf = (dir) => (dir === "" ? 0 : dir.split("/").length);
const relOf = (dir) => "../".repeat(depthOf(dir));
const canonOf = (dir) => SITE_ORIGIN + "/" + (dir ? dir + "/" : "");

const VERDICT = {
  ok: { word: "가능", cls: "ok", label: "먹어도 되는 편" },
  caution: { word: "주의", cls: "caution", label: "조건부·소량만" },
  danger: { word: "금지", cls: "danger", label: "먹이면 안 됨" },
};

const HEALTH_NOTE =
  '<p class="notice warn"><b>참고용이며 진단이 아닙니다.</b> 이 페이지의 계산·정보는 일반적인 기준을 안내할 뿐이며, 개체의 건강 상태를 판단하지 않습니다. 증상이 있거나 결정을 내려야 한다면 반드시 <b>수의사와 상담하세요</b>.</p>';
const INDIV_NOTE =
  '<p class="notice">같은 나이·체중이라도 품종, 중성화 여부, 활동량, 지병에 따라 결과가 달라집니다. <b>개체차가 있습니다</b> — 수치는 출발점으로만 쓰세요.</p>';

function adBlock(visible) {
  return (
    '<div class="ad-wrap"' + (visible ? "" : " hidden data-pending") + '>\n' +
    '  <ins class="adsbygoogle" style="display:block" data-ad-client="' + ADSENSE_CLIENT +
    '" data-ad-format="auto" data-full-width-responsive="true"></ins>\n' +
    "</div>"
  );
}

/* 관련 도구(외부 절대 URL) + 사이트 내부 도구 링크 */
function relatedBlock(dir, extKeys, inner) {
  const rel = relOf(dir);
  const ext = extKeys
    .map((k) => CROSS_LINKS[k])
    .filter(Boolean)
    .map((l) => '<a class="rel" href="' + l.url + '" rel="noopener"><span class="ic">' + l.ic + "</span><span>" + esc(l.name) + "</span></a>")
    .join("\n      ");
  const int = (inner || [])
    .map((t) => '<a class="rel" href="' + rel + t.href + '"><span class="ic">' + t.ic + "</span><span>" + esc(t.name) + "</span></a>")
    .join("\n      ");
  return (
    '<nav class="related">\n' +
    "  <h2>관련 도구</h2>\n" +
    '  <div class="rel-grid">\n      ' + [int, ext].filter(Boolean).join("\n      ") + "\n  </div>\n</nav>"
  );
}

function faqHtml(faq) {
  if (!faq || !faq.length) return "";
  return (
    "<h2>자주 묻는 질문</h2>\n" +
    faq
      .map((f) => '<div class="qa"><p class="q">Q. ' + esc(f.q) + '</p><p class="a">' + f.a + "</p></div>")
      .join("\n")
  );
}

function jsonLd(o) {
  return '<script type="application/ld+json">' + J(o) + "</script>";
}

/* ---------------- 공통 셸 ---------------- */
function buildPage(cfg) {
  const {
    dir, title, desc, h1, emoji, lead,
    crumbs = [], health = false, individual = false,
    bodyHtml = "", aboutHtml = "", faq = [], script = "",
    ad = "none", related, kind = "tool", appCategory = "UtilitiesApplication",
    datePublished = "2026-08-19",
  } = cfg;
  const rel = relOf(dir);
  const canon = canonOf(dir);

  const crumbHtml =
    '<nav class="crumb" aria-label="breadcrumb">' +
    crumbs
      .map((c, i) =>
        (i ? '<span class="sep">›</span>' : "") +
        (c.href ? '<a href="' + rel + c.href + '">' + esc(c.name) + "</a>" : '<span class="c-cur">' + esc(c.name) + "</span>")
      )
      .join("") +
    "</nav>";

  const bc = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.href === undefined ? canon : SITE_ORIGIN + "/" + c.href.replace(/index\.html$/, ""),
    })),
  };

  const primary =
    kind === "tool"
      ? {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: title,
          description: desc,
          url: canon,
          applicationCategory: appCategory,
          operatingSystem: "Web",
          inLanguage: "ko",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN + "/" },
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: h1,
          description: desc,
          url: canon,
          inLanguage: "ko",
          datePublished,
          dateModified: datePublished,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
        };

  const faqLd = faq.length
    ? jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: String(f.a).replace(/<[^>]+>/g, "") },
        })),
      })
    : "";

  const adsHead = ad !== "none"
    ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
      ADSENSE_CLIENT + '" crossorigin="anonymous"></script>'
    : "";

  const html =
`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="${rel}assets/style.css">
${adsHead}
${jsonLd(primary)}
${faqLd}
${jsonLd(bc)}
</head>
<body>
<main class="wrap">
${crumbHtml}
<header class="hero">
  <div class="emoji" aria-hidden="true">${emoji}</div>
  <h1>${esc(h1)}</h1>
  <p class="lead">${lead}</p>
</header>
${health ? HEALTH_NOTE : ""}
${individual ? INDIV_NOTE : ""}
${bodyHtml}
${ad === "eager" ? adBlock(true) : ad === "lazy" ? adBlock(false) : ""}
<section class="about">
${aboutHtml}
${faqHtml(faq)}
</section>
${related || ""}
<footer>
  <a href="${rel}index.html">홈</a>·
  <a href="${rel}privacy/index.html">개인정보처리방침</a>·
  <a href="${rel}terms/index.html">이용약관</a>
  <p>© ${SITE_NAME} · 모든 계산은 브라우저에서만 이뤄지며 서버로 전송되지 않습니다.</p>
</footer>
</main>
<script src="${rel}assets/app.js"></script>
${script ? "<script>\n" + script + "\n</script>" : ""}
${ad === "eager" ? "<script>window.pcShowAd&&window.pcShowAd();</script>" : ""}
</body>
</html>
`;
  const outDir = path.join(ROOT, dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  PAGES.push(dir);
  if (/광고 영역|REPLACE_/.test(html)) {
    console.warn("경고: 금지 문자열 포함 →", dir || "(root)");
    WARN++;
  }
  return html;
}

/* ---------------- 공통 조각 ---------------- */
const HOME = { name: "홈", href: "index.html" };
const cr = (...rest) => [HOME, ...rest];
const src1 = (label, url, checkedAt) =>
  '<p class="src">출처: ' + esc(label) + ' — <a href="' + url + '" rel="nofollow noopener" target="_blank">' + url + "</a> (확인일 " + checkedAt + ")</p>";

/* ---------------- 1) 강아지 나이 계산기 ---------------- */
buildPage({
  dir: "dog-age",
  title: "강아지 나이 계산기 — 체구별 사람 나이 환산 | PetCalc",
  desc: "우리 강아지 나이를 사람 나이로 환산합니다. 단순 ×7이 아니라 소형·중형·대형 체구별 환산표(AKC 기준)를 사용해 생활 단계까지 함께 알려드립니다.",
  h1: "강아지 나이 계산기",
  emoji: "🐕",
  lead: "생년월일 또는 나이와 체구를 넣으면 사람 나이로 환산합니다. 단순 ×7 공식보다 정확한 체구별 환산표를 씁니다.",
  crumbs: cr({ name: "강아지 나이 계산기" }),
  health: true,
  individual: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>강아지 정보</h2>
  <div class="field"><label for="bd">생년월일 <span class="hint">(모르면 비우고 아래 나이만 입력)</span></label><input type="date" id="bd"></div>
  <div class="field"><label for="ag">나이(년) <span class="hint">예: 3.5 = 3년 6개월</span></label><input type="number" id="ag" step="0.1" min="0" max="30" inputmode="decimal" placeholder="3.5"></div>
  <div class="field"><label>체구 <span class="hint">성견 기준 몸무게</span></label>
    <div class="seg" id="sz">
      <button type="button" data-v="small" aria-pressed="true">소형견<br>9.5kg 미만</button>
      <button type="button" data-v="medium" aria-pressed="false">중형견<br>9.5~22kg</button>
      <button type="button" data-v="large" aria-pressed="false">대형견<br>23kg 이상</button>
    </div>
  </div>
  <button class="btn" id="go" type="button">사람 나이로 환산하기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>환산 결과</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <p class="src" id="warn"></p>
</section>`,
  script: `(function(){
var T=` + J({ small: DOG_AGE_TABLE.small, medium: DOG_AGE_TABLE.medium, large: DOG_AGE_TABLE.large }) + `;
var L=` + J(DOG_AGE_TABLE.sizeLabels) + `;
var size='small';
pcSeg('sz',function(v){size=v;});
function human(y){
  var t=T[size];
  if(y<1) return Math.round(15*y);
  if(y>=16){var step=t[16]-t[15];return Math.round(t[16]+(y-16)*step);}
  var lo=Math.floor(y),hi=lo+1;
  return Math.round(t[lo]+(t[hi]-t[lo])*(y-lo));
}
function stage(y){
  if(y<1) return '퍼피(성장기)';
  if(y<2) return '청년기';
  var sr = size==='large'?6:(size==='medium'?8:10);
  if(y<sr) return '성견(안정기)';
  return '노령기 — 반기 건강검진 권장';
}
function ageFromBirth(v){
  var b=new Date(v+'T00:00:00');
  if(isNaN(b.getTime())) return NaN;
  var now=new Date();
  var d=(now-b)/86400000;
  return d<0?NaN:d/365.25;
}
pcQ('go').addEventListener('click',function(){
  var bv=pcQ('bd').value, y=NaN, from='';
  if(bv){ y=ageFromBirth(bv); from='생년월일 기준'; }
  if(!isFinite(y)){ y=pcNum('ag'); from='입력한 나이 기준'; }
  if(!isFinite(y)||y<=0||y>30){ alert('나이 또는 생년월일을 확인해 주세요. (0~30년)'); return; }
  var h=human(y);
  pcQ('big').innerHTML='사람 나이로 약 <b>'+h+'세</b>';
  var yy=Math.floor(y), mm=Math.round((y-yy)*12);
  if(mm===12){yy+=1;mm=0;}
  pcQ('lines').innerHTML=
    '<div class="res-line"><span class="k">강아지 나이</span><span class="v">'+yy+'년 '+mm+'개월 ('+from+')</span></div>'+
    '<div class="res-line"><span class="k">체구 분류</span><span class="v">'+L[size]+'</span></div>'+
    '<div class="res-line"><span class="k">생활 단계</span><span class="v">'+stage(y)+'</span></div>'+
    '<div class="res-line"><span class="k">1년 뒤</span><span class="v">사람 나이 약 '+human(Math.min(30,y+1))+'세</span></div>';
  pcQ('warn').textContent='같은 나이라도 품종·중성화 여부·체형에 따라 노화 속도가 다릅니다. 초대형견은 대형견보다 더 빨리 노화하는 경향이 있습니다.';
  pcShow('res');
});
})();`,
  aboutHtml: `<h2>강아지 나이, 왜 ×7이 아닌가요?</h2>
<p>“개 나이 ×7 = 사람 나이”는 계산하기 쉬워 널리 퍼졌지만 실제 노화 곡선과는 맞지 않습니다. 강아지는 첫 1년에 사람의 약 15세에 해당하는 성장을 하고, 두 번째 해에 다시 9세 정도가 더해집니다. 그 뒤부터는 <b>체구가 클수록 매년 더 빠르게</b> 나이를 먹습니다. 그래서 이 계산기는 체구를 나눠 환산합니다.</p>
<h3>체구별 환산표</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>강아지 나이</th><th>소형견</th><th>중형견</th><th>대형견</th></tr></thead><tbody>
${[1, 2, 4, 6, 8, 10, 12, 14, 16]
  .map((y) => `<tr><td>${y}살</td><td>${DOG_AGE_TABLE.small[y]}세</td><td>${DOG_AGE_TABLE.medium[y]}세</td><td>${DOG_AGE_TABLE.large[y]}세</td></tr>`)
  .join("")}
</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>생년월일을 알면 날짜만 넣으세요. 모르면 대략적인 나이(년)를 숫자로 입력합니다.</li>
<li>성견 기준 몸무게로 체구를 고릅니다. 아직 성장 중이라면 그 품종의 예상 성견 체중으로 고르세요.</li>
<li>결과의 ‘생활 단계’를 보고 검진 주기와 사료(퍼피/성견/노령) 단계를 점검하세요.</li>
</ol>
<h2>노령기 신호 체크</h2>
<ul>
<li>산책을 예전만큼 반기지 않거나 계단을 피한다</li>
<li>밤에 서성이거나 부르는 소리에 반응이 느려졌다</li>
<li>체중이 이유 없이 줄거나 늘었다, 물 마시는 양이 늘었다</li>
</ul>
<p>이런 변화는 나이 탓으로만 넘기지 말고 검진에서 확인하는 것이 좋습니다.</p>
${src1(DOG_AGE_TABLE.note, DOG_AGE_TABLE.source, DOG_AGE_TABLE.checkedAt)}`,
  faq: [
    { q: "강아지 1살은 사람 나이로 몇 살인가요?", a: "체구와 관계없이 약 15세로 봅니다. 두 살이 되면 약 24세, 그 이후부터 체구별로 매년 4~5세씩 더해집니다." },
    { q: "생년월일을 모르면 어떻게 하나요?", a: "입양 시 추정 월령이나 치아·활동성으로 병원에서 추정한 나이를 년 단위(예: 3.5)로 입력하세요. 추정값이라도 생활 단계 판단에는 충분합니다." },
    { q: "초대형견도 대형견으로 고르면 되나요?", a: "네, 이 표에서는 대형견을 고르면 됩니다. 다만 40kg을 크게 넘는 초대형견은 표보다 더 빨리 노화하는 경향이 있어, 결과보다 한두 살 위로 생각하는 편이 안전합니다." },
    { q: "노령견 검진은 얼마나 자주 받나요?", a: "일반적으로 성견은 연 1회, 노령기에 들어서면 6개월마다 검진을 권합니다. 구체적인 주기는 지병 여부에 따라 수의사와 상의하세요." },
  ],
  related: relatedBlock("dog-age", ["petAge", "petMeal", "dogPersonality"], [
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    { name: "예방접종 스케줄", href: "vaccine/index.html", ic: "💉" },
  ]),
});

/* ---------------- 2) 고양이 나이 계산기 ---------------- */
buildPage({
  dir: "cat-age",
  title: "고양이 나이 계산기 — 사람 나이 환산과 생활 단계 | PetCalc",
  desc: "고양이 나이를 사람 나이로 환산합니다. 1살=15세, 2살=24세, 이후 매년 +4세 기준(International Cat Care)으로 계산하고 키튼·성묘·노묘 생활 단계를 함께 안내합니다.",
  h1: "고양이 나이 계산기",
  emoji: "🐈",
  lead: "고양이의 나이 또는 생년월일을 넣으면 사람 나이와 생활 단계(키튼~노묘)를 알려드립니다.",
  crumbs: cr({ name: "고양이 나이 계산기" }),
  health: true,
  individual: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>고양이 정보</h2>
  <div class="field"><label for="bd">생년월일 <span class="hint">(모르면 비우고 아래 나이만 입력)</span></label><input type="date" id="bd"></div>
  <div class="field"><label for="ag">나이(년) <span class="hint">예: 0.5 = 6개월</span></label><input type="number" id="ag" step="0.1" min="0" max="30" inputmode="decimal" placeholder="4"></div>
  <button class="btn" id="go" type="button">사람 나이로 환산하기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>환산 결과</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <p class="src" id="warn"></p>
</section>`,
  script: `(function(){
var R=` + J({ y1: CAT_AGE_RULE.year1, y2: CAT_AGE_RULE.year2, per: CAT_AGE_RULE.perYearAfter }) + `;
function human(y){
  if(y<1) return Math.round(R.y1*y);
  if(y<2) return Math.round(R.y1+(R.y2-R.y1)*(y-1));
  return Math.round(R.y2+(y-2)*R.per);
}
function stage(y){
  if(y<0.5) return '키튼(젖떼기~성장 초기)';
  if(y<1) return '키튼 후반 — 중성화 시기 상담';
  if(y<3) return '주니어(활동량 최고조)';
  if(y<7) return '성묘(안정기)';
  if(y<11) return '중년묘 — 체중·신장 수치 확인';
  return '노묘 — 6개월마다 검진 권장';
}
function ageFromBirth(v){var b=new Date(v+'T00:00:00');if(isNaN(b.getTime()))return NaN;var d=(new Date()-b)/86400000;return d<0?NaN:d/365.25;}
pcQ('go').addEventListener('click',function(){
  var bv=pcQ('bd').value,y=NaN,from='';
  if(bv){y=ageFromBirth(bv);from='생년월일 기준';}
  if(!isFinite(y)){y=pcNum('ag');from='입력한 나이 기준';}
  if(!isFinite(y)||y<=0||y>30){alert('나이 또는 생년월일을 확인해 주세요. (0~30년)');return;}
  var h=human(y),yy=Math.floor(y),mm=Math.round((y-yy)*12);
  if(mm===12){yy+=1;mm=0;}
  pcQ('big').innerHTML='사람 나이로 약 <b>'+h+'세</b>';
  pcQ('lines').innerHTML=
    '<div class="res-line"><span class="k">고양이 나이</span><span class="v">'+yy+'년 '+mm+'개월 ('+from+')</span></div>'+
    '<div class="res-line"><span class="k">생활 단계</span><span class="v">'+stage(y)+'</span></div>'+
    '<div class="res-line"><span class="k">1년 뒤</span><span class="v">사람 나이 약 '+human(Math.min(30,y+1))+'세</span></div>'+
    '<div class="res-line"><span class="k">3년 뒤</span><span class="v">사람 나이 약 '+human(Math.min(30,y+3))+'세</span></div>';
  pcQ('warn').textContent='실내묘와 외출묘, 중성화 여부, 치과·신장 관리 상태에 따라 실제 노화 속도는 크게 달라집니다.';
  pcShow('res');
});
})();`,
  aboutHtml: `<h2>고양이 나이 환산 기준</h2>
<p>고양이는 첫 1년에 사람의 약 15세만큼, 두 번째 해에 다시 9세만큼 성장합니다. 즉 <b>2살 고양이는 사람으로 약 24세</b>이고, 그 뒤로는 1년에 약 4세씩 나이를 먹습니다. 강아지와 달리 체구에 따른 차이는 크지 않아 하나의 기준을 사용합니다.</p>
<div class="rt-wrap"><table class="rt"><thead><tr><th>고양이 나이</th><th>사람 나이</th><th>생활 단계</th></tr></thead><tbody>
<tr><td>6개월</td><td>약 8세</td><td>키튼</td></tr>
<tr><td>1살</td><td>15세</td><td>키튼 후반</td></tr>
<tr><td>2살</td><td>24세</td><td>주니어</td></tr>
<tr><td>5살</td><td>36세</td><td>성묘</td></tr>
<tr><td>10살</td><td>56세</td><td>중년묘</td></tr>
<tr><td>15살</td><td>76세</td><td>노묘</td></tr>
<tr><td>20살</td><td>96세</td><td>초고령묘</td></tr>
</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>생년월일을 알면 날짜를, 모르면 추정 나이를 년 단위로 입력합니다(6개월이면 0.5).</li>
<li>결과의 생활 단계에 맞춰 사료 단계와 검진 주기를 점검합니다.</li>
<li>7살이 넘었다면 연 1회 이상 혈액·소변 검사로 신장 수치를 확인하는 것이 좋습니다.</li>
</ol>
<h2>노묘에게 흔히 나타나는 변화</h2>
<ul>
<li>물을 많이 마시고 소변량이 늘었다 → 신장·갑상선·당뇨 확인 필요</li>
<li>높은 곳에 잘 올라가지 않는다 → 관절염 가능성(고양이는 절뚝임이 잘 드러나지 않습니다)</li>
<li>그루밍을 덜 해 털이 엉킨다, 체중이 서서히 준다</li>
</ul>
${src1(CAT_AGE_RULE.note, CAT_AGE_RULE.source, CAT_AGE_RULE.checkedAt)}`,
  faq: [
    { q: "고양이 1살은 사람 나이로 몇 살인가요?", a: "약 15세입니다. 사람으로 치면 청소년기에 해당해 활동량이 가장 많은 시기입니다." },
    { q: "고양이도 품종에 따라 노화 속도가 다른가요?", a: "강아지만큼 큰 차이는 없습니다. 다만 특정 품종은 심장·신장 질환 소인이 있어 같은 나이라도 검진 항목이 달라질 수 있습니다." },
    { q: "몇 살부터 노묘 사료로 바꾸나요?", a: "보통 7~11살을 중년, 11살 이상을 노묘로 봅니다. 체중과 신장 수치를 함께 보고 수의사와 상의해 바꾸는 것이 좋습니다." },
    { q: "실내묘가 더 오래 사나요?", a: "일반적으로 실내에서 지내는 고양이가 사고·감염 위험이 적어 더 오래 사는 것으로 알려져 있습니다. 대신 비만과 운동 부족 관리가 필요합니다." },
  ],
  related: relatedBlock("cat-age", ["petAge", "petSafe", "petMeal"], [
    { name: "고양이가 먹어도 되는 음식", href: "cat/can-eat/index.html", ic: "🥣" },
    { name: "첫 고양이 준비 체크리스트", href: "guide/first-cat-checklist/index.html", ic: "📋" },
  ]),
});

/* ---------------- 3) 사료 급여량 계산기 ---------------- */
const facRows = (sp) =>
  MER_FACTORS[sp].map((f) => `<tr><td>${esc(f.label)}</td><td>× ${f.factor}</td><td>${esc(f.note || "-")}</td></tr>`).join("");

buildPage({
  dir: "food-amount",
  title: "사료 급여량 계산기 — RER·MER 하루 칼로리와 그램 | PetCalc",
  desc: "체중과 생활 단계로 강아지·고양이의 하루 필요 열량(RER 70×체중^0.75, MER 계수)을 계산하고, 사료 100g당 칼로리를 넣으면 하루·끼니당 급여량(g)까지 환산합니다.",
  h1: "사료 급여량 계산기",
  emoji: "🍚",
  lead: "표준 수의영양학 공식(RER = 70 × 체중^0.75)으로 하루 필요 열량을 구하고, 사료 칼로리를 넣으면 그램으로 바꿔 드립니다.",
  crumbs: cr({ name: "사료 급여량 계산기" }),
  health: true,
  individual: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>기본 정보</h2>
  <div class="field"><label>종류</label>
    <div class="seg" id="sp">
      <button type="button" data-v="dog" aria-pressed="true">🐕 강아지</button>
      <button type="button" data-v="cat" aria-pressed="false">🐈 고양이</button>
    </div>
  </div>
  <div class="field"><label for="w">체중(kg) <span class="hint">감량/증량 중이면 목표(이상) 체중</span></label><input type="number" id="w" step="0.1" min="0.3" max="120" inputmode="decimal" placeholder="5.2"></div>
  <div class="field"><label for="st">생활 단계 · 상태</label><select id="st"></select></div>
  <div class="row2">
    <div class="field"><label for="kc">사료 100g당 kcal <span class="hint">선택</span></label><input type="number" id="kc" step="1" min="50" max="800" inputmode="numeric" placeholder="예: 360"></div>
    <div class="field"><label for="me">하루 급여 횟수</label><input type="number" id="me" step="1" min="1" max="6" inputmode="numeric" value="2"></div>
  </div>
  <button class="btn" id="go" type="button">하루 급여량 계산</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>계산 결과</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <p class="src" id="warn"></p>
</section>`,
  script: `(function(){
var F=` + J({ dog: MER_FACTORS.dog, cat: MER_FACTORS.cat }) + `;
var sp='dog';
function fill(){
  var s=pcQ('st'); s.innerHTML='';
  F[sp].forEach(function(f){
    var o=document.createElement('option');
    o.value=f.factor; o.textContent=f.label+' (× '+f.factor+')';
    s.appendChild(o);
  });
  s.selectedIndex = sp==='dog'?2:1;
}
pcSeg('sp',function(v){sp=v;fill();});
fill();
function rer(w){return 70*Math.pow(w,0.75);}
pcQ('go').addEventListener('click',function(){
  var w=pcNum('w');
  if(!isFinite(w)||w<=0||w>120){alert('체중을 확인해 주세요. (0.3~120kg)');return;}
  var f=parseFloat(pcQ('st').value);
  var R=rer(w), M=R*f;
  var kc=pcNum('kc'), me=pcNum('me'); if(!isFinite(me)||me<1){me=2;}
  pcQ('big').innerHTML='하루 <b>'+pcFmt(Math.round(M))+' kcal</b>';
  var h='<div class="res-line"><span class="k">RER (휴식기 에너지 요구량)</span><span class="v">'+pcFmt(Math.round(R))+' kcal</span></div>'+
    '<div class="res-line"><span class="k">적용 계수</span><span class="v">× '+f+'</span></div>'+
    '<div class="res-line"><span class="k">MER (하루 유지 열량)</span><span class="v">'+pcFmt(Math.round(M))+' kcal</span></div>';
  if(isFinite(kc)&&kc>0){
    var g=M/kc*100;
    h+='<div class="res-line"><span class="k">하루 급여량</span><span class="v">약 '+pcFmt(g,0)+' g</span></div>'+
       '<div class="res-line"><span class="k">1끼당 ('+me+'회 기준)</span><span class="v">약 '+pcFmt(g/me,0)+' g</span></div>'+
       '<div class="res-line"><span class="k">간식 허용량 (10% 이내)</span><span class="v">'+pcFmt(Math.round(M*0.1))+' kcal 이하</span></div>';
  } else {
    h+='<div class="res-line"><span class="k">그램 환산</span><span class="v">사료 100g당 kcal를 입력하면 표시됩니다</span></div>';
  }
  pcQ('lines').innerHTML=h;
  pcQ('warn').textContent='계산값은 출발점입니다. 2~4주 간격으로 체중과 체형(BCS)을 확인해 10%씩 조절하고, 질병·임신·수유 중이라면 반드시 수의사 지침을 따르세요.';
  pcShow('res');
});
})();`,
  aboutHtml: `<h2>RER과 MER이 뭔가요?</h2>
<p><b>RER(Resting Energy Requirement)</b>은 아무것도 하지 않고 쉬고 있을 때 필요한 최소 열량입니다. 표준 공식은 <code>RER = 70 × (체중kg)<sup>0.75</sup></code>입니다. 여기에 나이·중성화 여부·활동량에 따른 계수를 곱한 값이 <b>MER(하루 유지 열량)</b>이고, 실제 급여 기준이 됩니다.</p>
<p>예를 들어 체중 5kg이면 RER은 약 234kcal이고, 중성화한 성견(× 1.6)이라면 하루 약 375kcal가 기준이 됩니다.</p>
<h3>강아지 계수표</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>상태</th><th>계수</th><th>비고</th></tr></thead><tbody>${facRows("dog")}</tbody></table></div>
<h3>고양이 계수표</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>상태</th><th>계수</th><th>비고</th></tr></thead><tbody>${facRows("cat")}</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>종류를 고르고 <b>현재 체중</b>을 입력합니다. 감량·증량 중이라면 목표 체중을 넣어야 계산이 맞습니다.</li>
<li>중성화 여부와 활동량에 맞는 생활 단계를 고릅니다.</li>
<li>사료 봉투 뒷면의 “100g당 kcal”(또는 kcal/kg ÷ 10)를 입력하면 그램으로 환산됩니다.</li>
<li>2~4주 뒤 체중을 다시 재고 변화가 없으면 10% 범위에서 조절합니다.</li>
</ol>
<h2>주의할 점</h2>
<ul>
<li>간식·영양제는 하루 총 열량의 <b>10% 이내</b>로 유지하고, 그만큼 사료를 줄여야 합니다.</li>
<li>감량은 주당 체중의 1~2%가 안전한 속도입니다. 급격한 절식은 특히 고양이에게 지방간 위험이 있습니다.</li>
<li>신장병·심장병·당뇨 등 처방식을 먹는 경우 이 계산보다 <b>수의사 지침이 우선</b>합니다.</li>
</ul>
${src1(RER_FORMULA.value + " / MER 계수표", RER_FORMULA.source, RER_FORMULA.checkedAt)}
${src1("WSAVA Global Nutrition Guidelines", MER_FACTORS.meta.source, MER_FACTORS.meta.checkedAt)}`,
  faq: [
    { q: "사료 봉투의 권장량과 왜 다른가요?", a: "봉투 권장량은 평균적인 활동량을 가정한 넓은 범위입니다. 중성화한 실내 반려동물은 그보다 적게 필요한 경우가 많아, 계산값과 체중 변화를 함께 보고 조절하는 것이 좋습니다." },
    { q: "kcal/kg만 적혀 있으면 어떻게 하나요?", a: "10으로 나누면 100g당 kcal가 됩니다. 예를 들어 3,600kcal/kg이면 100g당 360kcal입니다." },
    { q: "하루 몇 번 나눠 주는 게 좋나요?", a: "성견·성묘는 보통 2회, 어린 개체는 3~4회로 나눕니다. 대형견은 식후 위염전 위험 때문에 한 번에 많은 양을 주지 않는 편이 좋습니다." },
    { q: "습식과 건식을 섞으면 어떻게 계산하나요?", a: "각각의 100g당 kcal로 열량을 따로 계산해 더하면 됩니다. 습식은 수분이 많아 100g당 칼로리가 낮은 편입니다." },
  ],
  related: relatedBlock("food-amount", ["petMeal", "slimPet", "petAge"], [
    { name: "체중 기록·그래프", href: "weight-log/index.html", ic: "📈" },
    { name: "강아지 사료 기본 가이드", href: "guide/dog-food-basics/index.html", ic: "📘" },
  ]),
});

/* ---------------- 4) 예방접종 스케줄 ---------------- */
const schedRows = (arr) =>
  arr.map((s) => `<tr><td>${esc(s.name)}</td><td>생후 ${s.weeks}주~</td><td>${esc(s.note)}</td></tr>`).join("");

buildPage({
  dir: "vaccine",
  title: "예방접종 스케줄 계산기 — 강아지·고양이 백신 날짜와 .ics | PetCalc",
  desc: "생년월일만 넣으면 강아지·고양이 코어 백신(종합·광견병) 권장 시기를 날짜로 바꿔 표로 보여주고, 심장사상충 월별 예방 일정을 포함한 캘린더(.ics) 파일을 내려받을 수 있습니다.",
  h1: "예방접종 스케줄 계산기",
  emoji: "💉",
  lead: "생년월일을 넣으면 접종 권장 시기를 실제 날짜로 계산합니다. 심장사상충 월별 예방까지 캘린더(.ics)로 받아 가세요.",
  crumbs: cr({ name: "예방접종 스케줄" }),
  health: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>기본 정보</h2>
  <div class="field"><label>종류</label>
    <div class="seg" id="sp">
      <button type="button" data-v="dog" aria-pressed="true">🐕 강아지</button>
      <button type="button" data-v="cat" aria-pressed="false">🐈 고양이</button>
    </div>
  </div>
  <div class="field"><label for="bd">생년월일 <span class="hint">추정일이라도 괜찮습니다</span></label><input type="date" id="bd"></div>
  <div class="field"><label for="hm">심장사상충 예방 캘린더</label>
    <select id="hm"><option value="12">12개월치 만들기(연중 예방 권장)</option><option value="6">6개월치만</option><option value="0">넣지 않기</option></select>
  </div>
  <button class="btn" id="go" type="button">스케줄 만들기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>권장 스케줄</h2>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>항목</th><th>권장 시기</th><th>예상 날짜</th></tr></thead><tbody id="tb"></tbody></table></div>
  <p class="src">병원·지역·제품에 따라 차수와 간격이 다를 수 있습니다. 실제 접종일은 담당 수의사 안내를 따르세요.</p>
  <button class="btn sub" id="ics" type="button">📅 캘린더(.ics) 내려받기</button>
</section>`,
  script: `(function(){
var S=` + J({ dog: DOG_SCHEDULE, cat: CAT_SCHEDULE }) + `;
var sp='dog', ev=[];
pcSeg('sp',function(v){sp=v;});
pcQ('go').addEventListener('click',function(){
  var bv=pcQ('bd').value;
  if(!bv){alert('생년월일을 입력해 주세요.');return;}
  var b=new Date(bv+'T00:00:00');
  if(isNaN(b.getTime())){alert('날짜 형식을 확인해 주세요.');return;}
  var list=S[sp].slice().sort(function(a,c){return a.weeks-c.weeks;});
  var rows='', today=new Date(); today.setHours(0,0,0,0);
  ev=[];
  list.forEach(function(it){
    var d=pcAddDays(b,it.weeks*7), ds=pcDate(d);
    var past = d<today ? ' <span class="badge ok">지난 시기</span>' : '';
    rows+='<tr><td>'+it.name+(it.core?'':' <span class="badge caution">선택</span>')+'</td><td>생후 '+it.weeks+'주</td><td>'+ds+past+'</td></tr>';
    ev.push({date:ds,title:'['+(sp==='dog'?'강아지':'고양이')+'] '+it.name,desc:it.note});
  });
  var hm=parseInt(pcQ('hm').value,10)||0;
  if(hm>0){
    var start=pcAddDays(b,8*7);
    if(start<today) start=new Date(today.getTime());
    for(var i=0;i<hm;i++){
      var d2=new Date(start.getTime()); d2.setMonth(d2.getMonth()+i);
      var ds2=pcDate(d2);
      ev.push({date:ds2,title:'심장사상충 예방 '+(i+1)+'회차',desc:'` + HEARTWORM.value.replace(/'/g, "") + `'});
      if(i<3) rows+='<tr><td>심장사상충 예방 '+(i+1)+'회차</td><td>매월 1회</td><td>'+ds2+'</td></tr>';
    }
    rows+='<tr><td>심장사상충 예방(이후)</td><td>매월 1회 · '+hm+'개월치</td><td>.ics 파일에 모두 포함</td></tr>';
  }
  pcQ('tb').innerHTML=rows;
  pcShow('res');
});
pcQ('ics').addEventListener('click',function(){
  if(!ev.length){alert('먼저 스케줄을 만들어 주세요.');return;}
  ev.sort(function(a,b){return a.date<b.date?-1:1;});
  pcIcs('petcalc-'+sp+'-vaccine.ics',ev);
});
})();`,
  aboutHtml: `<h2>기본 접종 스케줄</h2>
<p>어린 강아지·고양이는 어미에게 받은 이행 항체가 남아 있어 한 번의 접종으로는 충분한 면역이 생기지 않습니다. 그래서 2~4주 간격으로 여러 차례 접종하고, <b>마지막 차수는 생후 16주 이후</b>에 맞추는 것이 권장됩니다.</p>
<h3>강아지</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>항목</th><th>권장 시기</th><th>메모</th></tr></thead><tbody>${schedRows(DOG_SCHEDULE)}</tbody></table></div>
<h3>고양이</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>항목</th><th>권장 시기</th><th>메모</th></tr></thead><tbody>${schedRows(CAT_SCHEDULE)}</tbody></table></div>
<h2>심장사상충은 왜 매달인가요?</h2>
<p>심장사상충 예방약은 지난 한 달 사이 감염된 유충을 없애는 방식으로 작용합니다. 그래서 <b>한 달에 한 번, 날짜를 지켜</b> 투여하는 것이 중요하고, 미국심장사상충학회는 연중 예방을 권장합니다. 예방을 중단했다가 다시 시작할 때는 감염 검사를 먼저 받는 것이 안전합니다.</p>
<h2>사용법</h2>
<ol>
<li>종류를 고르고 생년월일(추정일 가능)을 입력합니다.</li>
<li>표에서 각 접종의 예상 날짜를 확인합니다. 이미 지난 시기는 표시됩니다.</li>
<li>“캘린더(.ics) 내려받기”를 눌러 구글 캘린더·애플 캘린더에 가져오면 알림을 받을 수 있습니다.</li>
</ol>
${src1("WSAVA Vaccination Guidelines", DOG_SCHEDULE[0].source, DOG_SCHEDULE[0].checkedAt)}
${src1("American Heartworm Society — " + HEARTWORM.value, HEARTWORM.source, HEARTWORM.checkedAt)}`,
  faq: [
    { q: "접종 간격을 놓쳤어요. 처음부터 다시 맞아야 하나요?", a: "대부분은 처음부터 다시 시작하지 않고 남은 차수를 이어서 맞습니다. 다만 간격이 많이 벌어졌다면 병원에서 상태를 보고 판단하므로 담당 수의사와 상의하세요." },
    { q: "광견병 접종은 의무인가요?", a: "국내에서는 생후 3개월 이상 개가 광견병 예방접종 대상입니다. 지자체별 무료·할인 접종 사업이 있으니 관할 지자체 공고를 확인해 보세요." },
    { q: "실내에서만 지내는 고양이도 접종이 필요한가요?", a: "네. 사람의 옷·신발로 바이러스가 들어올 수 있어 코어 백신은 권장됩니다. 백혈병(FeLV) 같은 비코어 백신은 외출·동거묘 여부에 따라 상담 후 결정합니다." },
    { q: "접종 후 무엇을 지켜봐야 하나요?", a: "당일에는 목욕과 격한 운동을 피하고, 얼굴 부종·구토·심한 무기력·호흡 곤란이 보이면 즉시 병원에 연락하세요." },
  ],
  related: relatedBlock("vaccine", ["petVetCost", "petAge", "petSafe"], [
    { name: "강아지 나이 계산기", href: "dog-age/index.html", ic: "🐕" },
    { name: "수의사 상담이 필요한 순간", href: "vet-consult/index.html", ic: "🏥" },
  ]),
});

/* ---------------- 5) 체중 기록 ---------------- */
buildPage({
  dir: "weight-log",
  title: "반려동물 체중 기록 그래프 — 브라우저 저장·CSV 내보내기 | PetCalc",
  desc: "강아지·고양이 체중을 날짜별로 기록해 변화 그래프로 확인합니다. 기록은 서버로 전송되지 않고 브라우저에만 저장되며, CSV 내보내기와 전체 삭제를 지원합니다. BCS(체형 점수) 확인법도 함께 안내합니다.",
  h1: "체중 기록 · 변화 그래프",
  emoji: "📈",
  lead: "체중을 날짜별로 남기면 그래프로 흐름을 보여줍니다. 기록은 이 브라우저에만 저장되고 서버로 전송되지 않습니다.",
  crumbs: cr({ name: "체중 기록" }),
  health: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>기록 추가</h2>
  <div class="row2">
    <div class="field"><label for="d">날짜</label><input type="date" id="d"></div>
    <div class="field"><label for="w">체중(kg)</label><input type="number" id="w" step="0.01" min="0.1" max="120" inputmode="decimal" placeholder="5.20"></div>
  </div>
  <div class="field"><label for="nm">이름 <span class="hint">여러 마리를 따로 기록할 때 사용</span></label><input type="text" id="nm" maxlength="20" placeholder="예: 콩이"></div>
  <button class="btn" id="add" type="button">기록 추가</button>
  <p class="src">이름·날짜·체중만 저장합니다. 개인정보(연락처·주소 등)는 입력하지 마세요.</p>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>체중 변화</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <svg class="chart" id="ch" viewBox="0 0 640 280" role="img" aria-label="체중 변화 그래프"></svg>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>날짜</th><th>이름</th><th>체중</th><th>변화</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
  <p style="margin-top:12px"><button class="btn sub" id="csv" type="button">⬇ CSV 내보내기</button> <button class="btn danger" id="clr" type="button">전체 삭제</button></p>
</section>`,
  script: `(function(){
var KEY='petcalc-weight-v1';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return [];}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){alert('브라우저 저장 공간을 사용할 수 없습니다.');}}
var data=load();
pcQ('d').value=pcDate(new Date());
function chart(rows){
  var el=pcQ('ch'); var W=640,H=280,P=44;
  if(rows.length<2){el.innerHTML='<text x="20" y="140" fill="currentColor" font-size="15">기록이 2개 이상 쌓이면 그래프가 그려집니다.</text>';return;}
  var xs=rows.map(function(r){return new Date(r.d+'T00:00:00').getTime();});
  var ys=rows.map(function(r){return r.w;});
  var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs);
  var y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
  if(y1-y0<0.2){y0=y0-0.2;y1=y1+0.2;} else {var pad=(y1-y0)*0.15;y0-=pad;y1+=pad;}
  if(x1===x0){x1=x0+86400000;}
  function px(t){return P+(W-P-14)*((t-x0)/(x1-x0));}
  function py(v){return H-P-(H-P-18)*((v-y0)/(y1-y0));}
  var s='';
  for(var i=0;i<=3;i++){
    var v=y0+(y1-y0)*i/3, y=py(v);
    s+='<line x1="'+P+'" y1="'+y.toFixed(1)+'" x2="'+(W-14)+'" y2="'+y.toFixed(1)+'" stroke="currentColor" stroke-opacity="0.15"/>';
    s+='<text x="4" y="'+(y+4).toFixed(1)+'" font-size="12" fill="currentColor" fill-opacity="0.6">'+v.toFixed(1)+'</text>';
  }
  var pts=rows.map(function(r,i){return px(xs[i]).toFixed(1)+','+py(ys[i]).toFixed(1);}).join(' ');
  s+='<polyline points="'+pts+'" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" style="color:#10b981"/>';
  rows.forEach(function(r,i){s+='<circle cx="'+px(xs[i]).toFixed(1)+'" cy="'+py(ys[i]).toFixed(1)+'" r="3.5" fill="#10b981"/>';});
  s+='<text x="'+P+'" y="'+(H-14)+'" font-size="12" fill="currentColor" fill-opacity="0.6">'+rows[0].d+'</text>';
  s+='<text x="'+(W-14)+'" y="'+(H-14)+'" font-size="12" text-anchor="end" fill="currentColor" fill-opacity="0.6">'+rows[rows.length-1].d+'</text>';
  el.innerHTML=s;
}
function render(){
  if(!data.length){pcQ('res').hidden=true;return;}
  data.sort(function(a,b){return a.d<b.d?-1:(a.d>b.d?1:0);});
  var last=data[data.length-1], first=data[0];
  var diff=last.w-first.w;
  pcQ('big').innerHTML='최근 체중 <b>'+last.w.toFixed(2)+' kg</b> <small>('+last.d+')</small>';
  pcQ('lines').innerHTML=
    '<div class="res-line"><span class="k">기록 수</span><span class="v">'+data.length+'개</span></div>'+
    '<div class="res-line"><span class="k">첫 기록</span><span class="v">'+first.w.toFixed(2)+' kg ('+first.d+')</span></div>'+
    '<div class="res-line"><span class="k">전체 변화</span><span class="v">'+(diff>=0?'+':'')+diff.toFixed(2)+' kg ('+(first.w?((diff/first.w)*100).toFixed(1):'0')+'%)</span></div>';
  var tb='';
  for(var i=data.length-1;i>=0;i--){
    var r=data[i], prev=i>0?data[i-1]:null;
    var dv=prev?(r.w-prev.w):0;
    tb+='<tr><td>'+r.d+'</td><td>'+(r.n||'-')+'</td><td>'+r.w.toFixed(2)+' kg</td><td>'+(prev?((dv>=0?'+':'')+dv.toFixed(2)):'-')+'</td>'+
        '<td><button class="btn sub" data-i="'+i+'" type="button">삭제</button></td></tr>';
  }
  pcQ('tb').innerHTML=tb;
  chart(data);
  pcShow('res');
}
pcQ('add').addEventListener('click',function(){
  var d=pcQ('d').value, w=pcNum('w'), n=(pcQ('nm').value||'').slice(0,20);
  if(!d){alert('날짜를 선택해 주세요.');return;}
  if(!isFinite(w)||w<=0||w>120){alert('체중을 확인해 주세요. (0.1~120kg)');return;}
  data.push({d:d,w:w,n:n});
  save(data); pcQ('w').value=''; render();
});
pcQ('tb').addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('button'):null;
  if(!b||!b.hasAttribute('data-i'))return;
  data.splice(parseInt(b.getAttribute('data-i'),10),1);
  save(data); render();
  if(!data.length) pcQ('res').hidden=true;
});
pcQ('csv').addEventListener('click',function(){
  var rows=[['date','name','weight_kg']].concat(data.map(function(r){return [r.d,(r.n||'').replace(/[",]/g,' '),r.w];}));
  pcDownload('petcalc-weight.csv','\\ufeff'+rows.map(function(r){return r.join(',');}).join('\\r\\n'),'text/csv');
});
pcQ('clr').addEventListener('click',function(){
  if(!confirm('저장된 체중 기록을 모두 삭제할까요? 되돌릴 수 없습니다.'))return;
  data=[]; try{localStorage.removeItem(KEY);}catch(e){}
  pcQ('tb').innerHTML=''; pcQ('res').hidden=true;
});
render();
})();`,
  aboutHtml: `<h2>체중은 가장 빠른 건강 신호입니다</h2>
<p>반려동물은 아픈 것을 잘 숨깁니다. 체중은 보호자가 집에서 확인할 수 있는 가장 객관적인 지표로, <b>3개월 사이 5% 이상</b>의 원인 모를 변화는 검진이 필요한 신호로 봅니다. 특히 고양이는 몇 백 그램의 감소도 의미가 큽니다.</p>
<h3>집에서 정확히 재는 법</h3>
<ol>
<li>보호자가 먼저 체중계에 올라가 무게를 잽니다.</li>
<li>반려동물을 안고 다시 잰 뒤 두 값을 뺍니다.</li>
<li>같은 요일·같은 시간대(예: 아침 식사 전)에 재면 비교가 정확합니다.</li>
</ol>
<h2>BCS(체형 점수) 확인법</h2>
<p>체중 숫자만으로는 마른지 살쪘는지 알기 어렵습니다. 세계적으로 쓰이는 9점 척도 BCS를 손으로 확인해 보세요.</p>
<div class="rt-wrap"><table class="rt"><thead><tr><th>점수</th><th>상태</th><th>손으로 만졌을 때</th></tr></thead><tbody>
<tr><td>1~3</td><td>저체중</td><td>갈비뼈·등뼈·골반이 쉽게 보이고 지방층이 거의 없음</td></tr>
<tr><td>4~5</td><td>이상적</td><td>가볍게 누르면 갈비뼈가 만져지고, 위에서 봤을 때 허리 굴곡이 보임</td></tr>
<tr><td>6~7</td><td>과체중</td><td>지방 때문에 갈비뼈가 잘 만져지지 않고 허리 굴곡이 사라짐</td></tr>
<tr><td>8~9</td><td>비만</td><td>배가 처지고 등·꼬리 밑에 지방이 두껍게 잡힘</td></tr>
</tbody></table></div>
<p>이상적인 상태는 <b>보이지는 않지만 만져지는</b> 갈비뼈입니다. BCS가 6 이상이면 급여량을 다시 계산해 보세요.</p>
<h2>저장과 개인정보</h2>
<ul>
<li>기록은 <b>이 브라우저(localStorage)에만</b> 저장되며 <b>서버로 전송되지 않습니다</b>.</li>
<li>다른 기기·시크릿 모드에서는 보이지 않고, 브라우저 데이터를 지우면 함께 사라집니다.</li>
<li>백업이 필요하면 CSV 내보내기를 사용하세요. “전체 삭제”를 누르면 저장분이 즉시 지워집니다.</li>
</ul>`,
  faq: [
    { q: "기록이 다른 기기에서도 보이나요?", a: "아니요. 서버에 저장하지 않기 때문에 기록한 브라우저에서만 보입니다. 옮기려면 CSV로 내보낸 뒤 새 기기에서 다시 입력하세요." },
    { q: "여러 마리를 함께 기록할 수 있나요?", a: "이름 칸에 각각의 이름을 적으면 표에서 구분됩니다. 그래프는 전체 기록을 시간순으로 함께 그리므로, 정확한 비교가 필요하면 CSV로 내보내 이름별로 보세요." },
    { q: "얼마나 자주 재는 게 좋나요?", a: "건강한 성견·성묘는 월 1회, 감량 중이거나 지병이 있으면 2주에 한 번이 적당합니다. 성장기 어린 개체는 주 1회를 권합니다." },
    { q: "체중이 갑자기 줄었어요.", a: "식욕이 있는데도 체중이 줄면 갑상선·당뇨·신장·소화기 문제일 수 있습니다. 이 도구는 진단을 하지 않으므로 수의사 진료를 받으세요." },
  ],
  related: relatedBlock("weight-log", ["slimPet", "petMeal", "petVetCost"], [
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    { name: "양육비 계산기", href: "pet-cost/index.html", ic: "💰" },
  ]),
});

/* ---------------- 6) 임신·출산 예정일 ---------------- */
buildPage({
  dir: "pregnancy",
  title: "강아지 임신 계산기 — 교배일로 보는 출산 예정일 | PetCalc",
  desc: "교배일을 넣으면 평균 63일 기준 출산 예정일과 58~68일 범위, 초음파·X-ray 확인 시기 등 주요 시점을 날짜로 계산합니다. 캘린더(.ics) 내려받기도 지원합니다.",
  h1: "강아지 임신·출산 예정일 계산기",
  emoji: "🐾",
  lead: "교배일 기준 평균 63일. 예정일과 함께 초음파·X-ray 확인 시기, 산실 준비 시점을 날짜로 알려드립니다.",
  crumbs: cr({ name: "임신·출산 예정일" }),
  health: true,
  individual: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>교배일 입력</h2>
  <div class="field"><label for="md">교배일 <span class="hint">여러 번이면 첫 교배일</span></label><input type="date" id="md"></div>
  <button class="btn" id="go" type="button">출산 예정일 계산</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>예상 일정</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>시점</th><th>경과일</th><th>날짜</th></tr></thead><tbody id="tb"></tbody></table></div>
  <button class="btn sub" id="ics" type="button">📅 캘린더(.ics) 내려받기</button>
  <p class="src">임신 여부는 계산이 아니라 병원 검사(초음파·릴랙신 호르몬)로 확인해야 합니다.</p>
</section>`,
  script: `(function(){
var M=` + J(DOG_GESTATION.milestones.map((m) => ({ day: m.day, label: m.label }))) + `;
var AVG=` + DOG_GESTATION.avgDays.value + `, LO=` + DOG_GESTATION.rangeDays.value[0] + `, HI=` + DOG_GESTATION.rangeDays.value[1] + `;
var ev=[];
pcQ('go').addEventListener('click',function(){
  var v=pcQ('md').value;
  if(!v){alert('교배일을 선택해 주세요.');return;}
  var b=new Date(v+'T00:00:00');
  if(isNaN(b.getTime())){alert('날짜를 확인해 주세요.');return;}
  var due=pcAddDays(b,AVG);
  var today=new Date();today.setHours(0,0,0,0);
  var gone=Math.floor((today-b)/86400000);
  pcQ('big').innerHTML='출산 예정일 <b>'+pcDate(due)+'</b>';
  pcQ('lines').innerHTML=
    '<div class="res-line"><span class="k">평균 임신 기간</span><span class="v">'+AVG+'일</span></div>'+
    '<div class="res-line"><span class="k">정상 범위</span><span class="v">'+pcDate(pcAddDays(b,LO))+' ~ '+pcDate(pcAddDays(b,HI))+' ('+LO+'~'+HI+'일)</span></div>'+
    (gone>=0?'<div class="res-line"><span class="k">오늘 기준 경과</span><span class="v">'+gone+'일차 · 예정일까지 '+(AVG-gone)+'일</span></div>':'');
  var rows='';ev=[];
  M.forEach(function(m){
    var d=pcAddDays(b,m.day);
    rows+='<tr><td>'+m.label+'</td><td>'+m.day+'일</td><td>'+pcDate(d)+'</td></tr>';
    ev.push({date:pcDate(d),title:'[임신 '+m.day+'일차] '+m.label,desc:'교배일 '+v+' 기준 계산'});
  });
  rows+='<tr><td>출산 예정일(평균 '+AVG+'일)</td><td>'+AVG+'일</td><td>'+pcDate(due)+'</td></tr>';
  ev.push({date:pcDate(due),title:'출산 예정일',desc:'교배일 '+v+' 기준 평균 '+AVG+'일'});
  pcQ('tb').innerHTML=rows;
  pcShow('res');
});
pcQ('ics').addEventListener('click',function(){
  if(!ev.length){alert('먼저 계산해 주세요.');return;}
  pcIcs('petcalc-pregnancy.ics',ev);
});
})();`,
  aboutHtml: `<h2>강아지 임신 기간</h2>
<p>개의 임신 기간은 교배일 기준 <b>평균 약 ${DOG_GESTATION.avgDays.value}일</b>이고, 정상 범위는 ${DOG_GESTATION.rangeDays.value[0]}~${DOG_GESTATION.rangeDays.value[1]}일입니다. 교배일과 실제 배란일이 며칠 어긋날 수 있어 예정일에는 오차가 생깁니다. 병원에서 배란일(프로게스테론 검사)을 확인했다면 그 기준이 훨씬 정확합니다.</p>
<h3>주요 확인 시점</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>경과일</th><th>무엇을 하나</th></tr></thead><tbody>
${DOG_GESTATION.milestones.map((m) => `<tr><td>${m.day}일</td><td>${esc(m.label)}</td></tr>`).join("")}
</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>첫 교배일을 입력합니다.</li>
<li>예정일과 정상 범위, 병원 방문이 필요한 시점을 확인합니다.</li>
<li>캘린더로 내려받아 초음파·X-ray 예약을 미리 잡아 두세요.</li>
</ol>
<h2>출산 임박 신호와 위험 신호</h2>
<ul>
<li><b>임박</b>: 체온이 평소보다 1℃가량 떨어짐, 안절부절못하며 바닥을 파는 행동, 식욕 저하</li>
<li><b>즉시 병원</b>: 진통이 2시간 이상 이어지는데 새끼가 나오지 않음 · 초록빛 분비물 후 30분 이상 진행 없음 · 심한 출혈 · 축 늘어짐</li>
</ul>
<p class="notice warn">난산은 응급 상황입니다. 조금이라도 이상하면 기다리지 말고 야간 진료가 가능한 병원에 바로 연락하세요.</p>
${src1(DOG_GESTATION.note, DOG_GESTATION.avgDays.source, DOG_GESTATION.avgDays.checkedAt)}`,
  faq: [
    { q: "임신 여부는 언제 확인할 수 있나요?", a: "초음파는 보통 교배 후 25~35일, 릴랙신 호르몬 검사는 25~30일 이후에 확인이 가능합니다. 태아 수는 45일 이후 X-ray로 세는 것이 정확합니다." },
    { q: "예정일보다 며칠 빨리 낳아도 괜찮나요?", a: "58~68일 범위 안이면 정상 범위로 봅니다. 다만 56일 이전 출산은 미숙아 위험이 있어 즉시 진료가 필요합니다." },
    { q: "임신 중 사료는 어떻게 바꾸나요?", a: "보통 임신 후반부(5~6주 이후)부터 열량과 단백질 요구가 크게 늘어 성장기용 사료로 바꾸고 양을 나눠 급여합니다. 구체적인 양은 수의사와 상의하세요." },
    { q: "계획하지 않은 교배였습니다. 어떻게 하나요?", a: "가능한 한 빨리 병원에 연락해 상담하세요. 시기와 건강 상태에 따라 선택지가 다르며, 이 페이지에서 판단할 문제가 아닙니다." },
  ],
  related: relatedBlock("pregnancy", ["petVetCost", "petAge", "petMeal"], [
    { name: "고양이 발정 주기 계산기", href: "heat-cycle/index.html", ic: "🌙" },
    { name: "수의사 상담이 필요한 순간", href: "vet-consult/index.html", ic: "🏥" },
  ]),
});

/* ---------------- 7) 고양이 발정 주기 ---------------- */
buildPage({
  dir: "heat-cycle",
  title: "고양이 발정 주기 계산기 — 다음 발정 예상일 | PetCalc",
  desc: "마지막 발정 시작일을 넣으면 다음 발정 예상 시기를 계산합니다. 발정은 평균 7일(3~14일) 지속되고 임신하지 않으면 2~3주 간격으로 반복됩니다. 중성화 상담 안내도 함께 제공합니다.",
  h1: "고양이 발정 주기 계산기",
  emoji: "🌙",
  lead: "마지막 발정 시작일로 다음 발정 시기를 예측합니다. 개체차가 매우 큰 영역이라 참고용으로만 사용하세요.",
  crumbs: cr({ name: "발정 주기 계산기" }),
  health: true,
  individual: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>마지막 발정 정보</h2>
  <div class="field"><label for="ld">마지막 발정 시작일</label><input type="date" id="ld"></div>
  <div class="row2">
    <div class="field"><label for="du">지속 일수 <span class="hint">기본 7일</span></label><input type="number" id="du" min="3" max="14" step="1" value="7" inputmode="numeric"></div>
    <div class="field"><label for="iv">반복 간격(일) <span class="hint">14~21</span></label><input type="number" id="iv" min="10" max="30" step="1" value="18" inputmode="numeric"></div>
  </div>
  <button class="btn" id="go" type="button">다음 발정 예상하기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>예상 일정</h2>
  <p class="big" id="big"></p>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>회차</th><th>예상 시작</th><th>예상 종료</th></tr></thead><tbody id="tb"></tbody></table></div>
  <p class="src">계절·일조 시간·개체차에 따라 실제 주기는 크게 달라집니다. 이 표는 확률적 예상일 뿐입니다.</p>
</section>`,
  script: `(function(){
pcQ('go').addEventListener('click',function(){
  var v=pcQ('ld').value;
  if(!v){alert('마지막 발정 시작일을 선택해 주세요.');return;}
  var b=new Date(v+'T00:00:00');
  if(isNaN(b.getTime())){alert('날짜를 확인해 주세요.');return;}
  var du=pcNum('du'); if(!isFinite(du)||du<3||du>14) du=7;
  var iv=pcNum('iv'); if(!isFinite(iv)||iv<10||iv>30) iv=18;
  var rows='', next=null;
  for(var i=1;i<=6;i++){
    var s=pcAddDays(b,iv*i), e=pcAddDays(s,du-1);
    if(i===1) next=s;
    rows+='<tr><td>'+i+'회차</td><td>'+pcDate(s)+'</td><td>'+pcDate(e)+'</td></tr>';
  }
  pcQ('big').innerHTML='다음 발정 예상 <b>'+pcDate(next)+'</b> 무렵';
  pcQ('tb').innerHTML=rows;
  pcShow('res');
});
})();`,
  aboutHtml: `<h2>고양이 발정, 어떤 주기인가요?</h2>
<p>고양이는 <b>계절성 다발정 동물</b>입니다. 일조 시간이 길어지는 시기에 발정이 반복되며, 실내 조명 아래 사는 고양이는 계절과 무관하게 반복되기도 합니다. 발정은 평균 약 ${CAT_HEAT.estrusDays.avg}일(${CAT_HEAT.estrusDays.value[0]}~${CAT_HEAT.estrusDays.value[1]}일) 지속되고, 교배·임신이 이뤄지지 않으면 보통 ${CAT_HEAT.intervalDays.value[0]}~${CAT_HEAT.intervalDays.value[1]}일 간격으로 다시 시작됩니다.</p>
<h3>발정 행동 신호</h3>
<ul>
<li>평소와 다른 큰 울음소리를 길게 반복한다</li>
<li>바닥에 몸을 비비고 엉덩이를 들며 뒷발을 구른다</li>
<li>애정 표현이 급격히 늘거나 탈출을 시도한다</li>
<li>소변 마킹이 생기기도 한다 (개체차 큼)</li>
</ul>
<p>발정 중에는 통증이 아니라 호르몬 변화에 따른 행동이지만, 반복되는 발정은 자궁축농증·유선 종양 위험과도 관련이 있어 중성화 상담을 권합니다.</p>
<h2>사용법</h2>
<ol>
<li>마지막 발정이 <b>시작된</b> 날짜를 입력합니다.</li>
<li>평소 지속 일수와 반복 간격을 알고 있다면 조정합니다(기본 7일 / 18일).</li>
<li>다음 6회의 예상 구간을 확인해 병원 예약이나 외출 관리를 계획하세요.</li>
</ol>
<p class="notice">첫 발정은 이르면 생후 ${CAT_HEAT.firstHeatMonths.value[0]}개월부터 올 수 있습니다. 아직 어리다고 임신이 안 되는 것이 아니므로 외출·탈출 관리에 주의하세요.</p>
${src1(CAT_HEAT.note, CAT_HEAT.estrusDays.source, CAT_HEAT.estrusDays.checkedAt)}`,
  faq: [
    { q: "발정이 끝났는데 며칠 만에 또 시작해요.", a: "정상적인 패턴입니다. 임신하지 않으면 보통 2~3주 간격으로 반복되며, 시즌 중에는 거의 이어지는 것처럼 느껴지기도 합니다." },
    { q: "중성화는 언제 하나요?", a: "일반적으로 성 성숙 전후에 권장되지만, 적정 시기는 체중·건강 상태·품종에 따라 달라 수의사와 상담해 결정합니다." },
    { q: "발정 중 수술해도 되나요?", a: "발정기에는 생식기 혈관이 발달해 출혈 위험이 커지므로 보통 발정이 끝난 뒤로 미룹니다. 병원 판단에 따르세요." },
    { q: "수컷 고양이도 발정 주기가 있나요?", a: "수컷은 정해진 주기가 없고, 발정 난 암컷의 신호에 반응해 울음·마킹·탈출 시도가 늘어납니다." },
  ],
  related: relatedBlock("heat-cycle", ["petVetCost", "petSafe", "petAge"], [
    { name: "고양이 나이 계산기", href: "cat-age/index.html", ic: "🐈" },
    { name: "첫 고양이 준비 체크리스트", href: "guide/first-cat-checklist/index.html", ic: "📋" },
  ]),
});

/* ---------------- 8) 양육비 계산기 ---------------- */
buildPage({
  dir: "pet-cost",
  title: "반려동물 양육비 계산기 — 월·연간·평생 비용 추산 | PetCalc",
  desc: "사료·간식·위생용품·미용·예방·검진 등 항목별 금액을 직접 고쳐 월 양육비와 연간·평생 예상 비용을 계산합니다. 기본값은 KB 한국 반려동물 보고서의 월평균 양육비를 참고한 편집용 수치입니다.",
  h1: "반려동물 양육비 계산기",
  emoji: "💰",
  lead: "항목별 금액을 우리 집 기준으로 고치면 월·연간·남은 기간 총액을 계산합니다.",
  crumbs: cr({ name: "양육비 계산기" }),
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>월 지출 항목 <span class="hint">(원 단위, 직접 수정)</span></h2>
  ${COST_ITEMS.map(
    (c) =>
      `<div class="field"><label for="c_${c.key}">${esc(c.label)}</label><input type="number" id="c_${c.key}" min="0" step="1000" inputmode="numeric" value="${c.monthly}"></div>`
  ).join("\n  ")}
  <div class="row2">
    <div class="field"><label for="yr">앞으로 함께할 기간(년)</label><input type="number" id="yr" min="1" max="25" step="1" value="10" inputmode="numeric"></div>
    <div class="field"><label for="init">초기 비용 <span class="hint">중성화·용품 등</span></label><input type="number" id="init" min="0" step="10000" inputmode="numeric" value="500000"></div>
  </div>
  <button class="btn" id="go" type="button">양육비 계산하기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>계산 결과</h2>
  <p class="big" id="big"></p>
  <div id="lines"></div>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>항목</th><th>월</th><th>연</th><th>비중</th></tr></thead><tbody id="tb"></tbody></table></div>
  <p class="src">치료비·수술비 등 예기치 못한 지출은 포함되어 있지 않습니다. 실제 지출은 이보다 커질 수 있습니다.</p>
</section>`,
  script: `(function(){
var K=` + J(COST_ITEMS.map((c) => ({ key: c.key, label: c.label }))) + `;
pcQ('go').addEventListener('click',function(){
  var tot=0, vals=[];
  K.forEach(function(k){
    var v=pcNum('c_'+k.key); if(!isFinite(v)||v<0) v=0;
    vals.push({label:k.label,v:v}); tot+=v;
  });
  var yr=pcNum('yr'); if(!isFinite(yr)||yr<1) yr=1;
  var init=pcNum('init'); if(!isFinite(init)||init<0) init=0;
  var year=tot*12, life=year*yr+init;
  pcQ('big').innerHTML='월 <b>'+pcFmt(tot)+'원</b>';
  pcQ('lines').innerHTML=
    '<div class="res-line"><span class="k">연간 예상</span><span class="v">'+pcFmt(year)+'원</span></div>'+
    '<div class="res-line"><span class="k">'+yr+'년 합계 (초기 비용 포함)</span><span class="v">'+pcFmt(life)+'원</span></div>'+
    '<div class="res-line"><span class="k">하루 평균</span><span class="v">'+pcFmt(Math.round(tot*12/365))+'원</span></div>'+
    '<div class="res-line"><span class="k">의료 적립 권장(월 지출의 20%)</span><span class="v">'+pcFmt(Math.round(tot*0.2))+'원/월</span></div>';
  vals.sort(function(a,b){return b.v-a.v;});
  pcQ('tb').innerHTML=vals.map(function(x){
    return '<tr><td>'+x.label+'</td><td>'+pcFmt(x.v)+'원</td><td>'+pcFmt(x.v*12)+'원</td><td>'+(tot?((x.v/tot)*100).toFixed(0):'0')+'%</td></tr>';
  }).join('');
  pcShow('res');
});
})();`,
  aboutHtml: `<h2>양육비는 어디에 얼마나 드나요?</h2>
<p>정기적으로 나가는 돈은 사료·간식·위생용품·미용·예방약·정기검진 정도로 나뉩니다. 여기에 예기치 못한 <b>치료비</b>가 얹히는데, 이 부분이 가장 큰 변동 요인입니다. 기본값은 국내 조사에서 보고된 월평균 양육비를 참고해 넣은 <b>편집용 숫자</b>이므로, 실제 영수증을 보며 고쳐 쓰는 것이 정확합니다.</p>
<h3>기본값의 근거</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>항목</th><th>기본값(월)</th></tr></thead><tbody>
${COST_ITEMS.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.monthly.toLocaleString("ko-KR")}원</td></tr>`).join("")}
</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>최근 3개월 영수증·카드 내역을 보고 항목별 금액을 고칩니다.</li>
<li>남은 예상 기간(년)을 넣으면 총액이 나옵니다. 나이 계산기로 기대 수명을 확인해 보세요.</li>
<li>결과의 “의료 적립 권장”처럼 매달 일정액을 따로 모아 두면 갑작스러운 수술비 부담을 줄일 수 있습니다.</li>
</ol>
<h2>지출을 줄이는 현실적인 순서</h2>
<ul>
<li><b>비만 예방</b>이 가장 큰 절약입니다. 관절·당뇨·심장 문제의 치료비를 줄여 줍니다.</li>
<li>예방(심장사상충·구충)은 아끼면 오히려 치료비가 커지는 대표적인 항목입니다.</li>
<li>사료는 가격보다 하루 급여 열량 기준으로 비교해야 실제 단가를 알 수 있습니다.</li>
<li>정기검진으로 조기에 발견하면 치료 기간과 비용이 크게 줄어드는 경우가 많습니다.</li>
</ul>
<p class="notice">이 페이지는 특정 보험·금융 상품을 비교하거나 추천하지 않습니다. 상품 가입 여부는 스스로 판단하시고, 필요하면 담당 수의사와 진료 계획을 먼저 상의하세요.</p>
${src1(COST_META.note, COST_META.source, COST_META.checkedAt)}`,
  faq: [
    { q: "치료비는 왜 기본값에 없나요?", a: "치료비는 나이·질환·병원에 따라 편차가 너무 커서 평균값을 넣으면 오히려 오해를 줍니다. 대신 결과에 표시되는 ‘의료 적립’을 참고해 매달 따로 모아 두는 방식을 권합니다." },
    { q: "강아지와 고양이 중 어느 쪽이 더 드나요?", a: "일반적으로 미용·산책용품이 필요한 강아지 쪽 고정비가 큰 편이고, 고양이는 모래·화장실 관련 비용이 꾸준히 듭니다. 결국 개체의 건강 상태가 총액을 좌우합니다." },
    { q: "다묘·다견 가정은 어떻게 계산하나요?", a: "사료·모래처럼 마릿수에 비례하는 항목은 곱해서 넣고, 미용·검진은 각각 계산해 합산하세요. 마릿수만큼 단순 배가 되지는 않습니다." },
    { q: "계산 결과가 저장되나요?", a: "아니요. 입력값은 브라우저 화면에서만 쓰이고 서버로 전송되거나 저장되지 않습니다." },
  ],
  related: relatedBlock("pet-cost", ["petVetCost", "petMeal", "slimPet"], [
    { name: "체중 기록·그래프", href: "weight-log/index.html", ic: "📈" },
    { name: "예방접종 스케줄", href: "vaccine/index.html", ic: "💉" },
  ]),
});

/* ---------------- 9) 이름 짓기 ---------------- */
const NAME_POOL = {
  soft: { label: "한글 감성", ic: "🌱", items: ["콩이","별이","봄이","달이","솜이","하늘","구름","바다","노을","이슬","보리","밤이","산이","여울","아침","새벽","가온","다온","라온","하루","소리","미르","나래","초롱","방울","소담","도담","단비","가람","누리","서리","은솔","한울","해온","별하","윤슬"] },
  food: { label: "먹을거리", ic: "🍡", items: ["두부","모찌","단호박","감자","고구마","만두","초코","크림","라떼","쿠키","참깨","젤리","완두","호두","우유","바닐라","카스테라","곶감","누룽지","김밥","단팥","브라우니","슈크림","떡볶이","마카롱","치즈","시루","팥빙","곤약","미숫가루"] },
  nature: { label: "자연", ic: "🌿", items: ["바람","안개","은하","별빛","초원","이끼","단풍","솔이","자갈","물결","눈꽃","햇살","무지개","여름","겨울","도토리","솔방울","파도","모래","산호","수풀","안개꽃","청산","백호","노루","하양","까망","노랑","오로라","보름"] },
  global: { label: "외국풍", ic: "✈️", items: ["루나","코코","벨라","밀로","오레오","시나몬","모카","레오","티나","하니","미미","쿠퍼","올리브","헤이즐","재즈","마일로","라라","노아","니코","소피","루비","재스퍼","피치","토토","포포","올리","마루","키키","바닐","체리"] },
};
const NAME_PRE = ["몽","보","꼬","토","두","루","모","쫑","방","나","다","소","하","미","코","포","단","봉","쿠","동"];
const NAME_SUF = ["실이","리","미","봉이","순이","동이","결이","롱이","삐","니","치","뽕이","동","꼬미","달이"];

buildPage({
  dir: "name-gen",
  title: "반려동물 이름 짓기 — 한글·먹을거리·자연·외국풍 이름 추천 | PetCalc",
  desc: "강아지·고양이 이름을 스타일별로 추천합니다. 한글 감성, 먹을거리, 자연, 외국풍 사전과 글자 조합 방식 중에서 고르면 매번 새로운 후보 8개를 보여 줍니다.",
  h1: "반려동물 이름 짓기",
  emoji: "✨",
  lead: "스타일을 고르고 버튼을 누르면 이름 후보 8개를 뽑아 드립니다. 마음에 드는 이름은 눌러서 복사하세요.",
  crumbs: cr({ name: "이름 짓기" }),
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>스타일 고르기</h2>
  <div class="field"><label>사전</label>
    <div class="seg" id="st">
      <button type="button" data-v="all" aria-pressed="true">전체</button>
      ${Object.entries(NAME_POOL).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="false">${v.ic} ${esc(v.label)}</button>`).join("\n      ")}
      <button type="button" data-v="mix" aria-pressed="false">🔤 글자 조합</button>
    </div>
  </div>
  <div class="field"><label for="ex">피하고 싶은 글자 <span class="hint">선택 · 예: 코</span></label><input type="text" id="ex" maxlength="10" placeholder="입력한 글자가 들어간 이름은 제외합니다"></div>
  <button class="btn" id="go" type="button">이름 뽑기</button>
</section>
<section class="card result" id="res" hidden aria-live="polite">
  <h2>이름 후보</h2>
  <div class="chip-list" id="out"></div>
  <p class="src" id="msg">이름을 누르면 복사됩니다. 마음에 들 때까지 다시 뽑아 보세요.</p>
  <button class="btn sub" id="again" type="button">🎲 다시 뽑기</button>
</section>`,
  script: `(function(){
var P=` + J(Object.fromEntries(Object.entries(NAME_POOL).map(([k, v]) => [k, v.items]))) + `;
var PRE=` + J(NAME_PRE) + `, SUF=` + J(NAME_SUF) + `;
var mode='all';
pcSeg('st',function(v){mode=v;});
function pick(){
  var ex=(pcQ('ex').value||'').trim();
  var pool=[];
  if(mode==='mix'){
    for(var i=0;i<PRE.length;i++) for(var j=0;j<SUF.length;j++) pool.push(PRE[i]+SUF[j]);
  } else if(mode==='all'){
    Object.keys(P).forEach(function(k){pool=pool.concat(P[k]);});
  } else { pool=P[mode].slice(); }
  if(ex){ pool=pool.filter(function(n){ for(var i=0;i<ex.length;i++){ if(ex[i]!==' '&&n.indexOf(ex[i])>=0) return false; } return true; }); }
  var out=[];
  var copy=pool.slice();
  while(out.length<8&&copy.length){
    var i=Math.floor(Math.random()*copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  pcQ('out').innerHTML=out.map(function(n){return '<button type="button" class="chip" data-n="'+n+'">'+n+'</button>';}).join('');
  pcQ('msg').textContent = out.length? '이름을 누르면 복사됩니다. 마음에 들 때까지 다시 뽑아 보세요.' : '조건에 맞는 이름이 없습니다. 제외 글자를 줄여 보세요.';
  pcShow('res');
}
pcQ('go').addEventListener('click',pick);
pcQ('again').addEventListener('click',pick);
pcQ('out').addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('button'):null;
  if(!b||!b.getAttribute('data-n'))return;
  var n=b.getAttribute('data-n');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(n).then(function(){pcQ('msg').textContent='"'+n+'" 복사했습니다.';},function(){pcQ('msg').textContent='복사에 실패했습니다. 직접 입력해 주세요.';});
  } else { pcQ('msg').textContent='이 브라우저는 자동 복사를 지원하지 않습니다: '+n; }
});
})();`,
  aboutHtml: `<h2>부르기 좋은 이름의 조건</h2>
<ul>
<li><b>2~3글자</b>가 부르기 쉽고 반려동물이 알아듣기 좋습니다.</li>
<li>“안 돼”, “이리 와” 같은 <b>지시어와 소리가 겹치지 않게</b> 하세요. 훈련이 훨씬 수월해집니다.</li>
<li>받침이 적고 모음이 또렷한 이름이 멀리서도 잘 전달됩니다.</li>
<li>병원 접수나 산책 중에 부를 이름이라는 점도 한 번 생각해 보세요.</li>
</ul>
<h2>사전 구성</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>스타일</th><th>느낌</th><th>예시</th></tr></thead><tbody>
${Object.entries(NAME_POOL)
  .map(([, v]) => `<tr><td>${v.ic} ${esc(v.label)}</td><td>${esc(v.items.length)}개 수록</td><td>${esc(v.items.slice(0, 5).join(", "))} …</td></tr>`)
  .join("")}
<tr><td>🔤 글자 조합</td><td>앞말 ${NAME_PRE.length}개 × 뒷말 ${NAME_SUF.length}개</td><td>${esc(NAME_PRE[0] + NAME_SUF[0])}, ${esc(NAME_PRE[3] + NAME_SUF[2])} …</td></tr>
</tbody></table></div>
<h2>사용법</h2>
<ol>
<li>원하는 스타일을 고릅니다. “전체”는 모든 사전에서 섞어 뽑습니다.</li>
<li>가족 이름과 겹치는 글자가 있다면 제외 글자에 넣으세요.</li>
<li>후보를 눌러 복사한 뒤, 며칠 불러 보고 반응이 좋은 이름을 고르면 좋습니다.</li>
</ol>
<p class="notice">이 도구는 재미와 아이디어를 주기 위한 것입니다. 이름 추천에는 어떤 의학적·성격적 의미도 없습니다.</p>`,
  faq: [
    { q: "이름을 도중에 바꿔도 되나요?", a: "가능합니다. 새 이름을 부를 때마다 간식·칭찬을 함께 주면 보통 며칠에서 몇 주 안에 반응하게 됩니다." },
    { q: "형제·자매 이름은 어떻게 짓나요?", a: "같은 사전에서 두 개를 뽑아 어감을 맞추면 자연스럽습니다. 다만 두 이름의 소리가 너무 비슷하면 부를 때 헷갈리므로 첫소리를 다르게 하는 편이 좋습니다." },
    { q: "등록 이름과 부르는 이름이 달라도 되나요?", a: "동물등록증에 적는 이름과 집에서 부르는 애칭이 달라도 문제는 없습니다. 다만 병원 기록과 등록 정보는 같게 관리하는 편이 편합니다." },
    { q: "이 결과는 저장되나요?", a: "아니요. 뽑은 이름은 화면에만 표시되고 어디에도 저장되지 않습니다." },
  ],
  related: relatedBlock("name-gen", ["dogPersonality", "petAge", "petSafe"], [
    { name: "견종 정보 백과", href: "breed/index.html", ic: "📚" },
    { name: "강아지 나이 계산기", href: "dog-age/index.html", ic: "🐕" },
  ]),
});

/* ---------------- 10) 수의사 상담 안내 (약 용량 계산기 대체) ---------------- */
buildPage({
  dir: "vet-consult",
  title: "반려동물 약, 계산기로 정하지 마세요 — 수의사 상담 안내 | PetCalc",
  desc: "PetCalc은 반려동물 약 용량 계산기를 제공하지 않습니다. 체중만으로 용량을 정할 수 없는 이유와 응급 신호, 병원에 갈 때 준비할 정보, 절대 주면 안 되는 사람 약을 정리했습니다.",
  h1: "약 용량은 계산기가 아니라 수의사에게",
  emoji: "🏥",
  kind: "article",
  lead: "이 사이트는 투약 용량 계산기를 제공하지 않습니다. 대신 언제 병원에 가야 하는지, 무엇을 준비해야 하는지를 정리했습니다.",
  crumbs: cr({ name: "수의사 상담 안내" }),
  health: true,
  ad: "eager",
  bodyHtml: `<section class="card">
  <h2>왜 약 용량 계산기를 만들지 않나요?</h2>
  <p style="color:var(--tx2);font-size:15px;margin:0 0 12px">체중은 용량을 정하는 여러 변수 중 하나일 뿐입니다. 같은 체중이라도 다음에 따라 안전한 용량이 완전히 달라집니다.</p>
  <ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    <li>간·신장 기능(대사와 배설 속도)</li>
    <li>나이(어린 개체·노령 개체는 대사 능력이 다름)</li>
    <li>임신·수유 여부</li>
    <li>함께 먹고 있는 다른 약과의 상호작용</li>
    <li>품종별 약물 감수성(예: 콜리 계열의 MDR1 변이)</li>
    <li>제형·농도의 차이 (같은 성분이라도 제품마다 다름)</li>
  </ul>
  <p class="notice warn" style="margin-top:14px"><b>계산기로 뽑은 숫자에 근거해 투약하는 것은 위험합니다.</b> 용량 착오는 반려동물에게 치명적일 수 있습니다.</p>
</section>
<section class="card">
  <h2>지금 바로 병원에 연락해야 하는 신호</h2>
  <ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    <li>호흡이 가쁘거나 혀·잇몸이 창백·보라색이다</li>
    <li>쓰러졌다, 경련한다, 의식이 흐리다</li>
    <li>배가 부풀고 헛구역질을 반복한다(대형견의 위염전 의심)</li>
    <li>소변을 보지 못한다(특히 수컷 고양이 — 응급입니다)</li>
    <li>중독 의심 물질(초콜릿·자일리톨·양파·백합·사람 약 등)을 먹었다</li>
    <li>12시간 이상 아무것도 먹지 않고 물도 마시지 않는다(고양이는 특히 위험)</li>
    <li>구토·설사에 피가 섞여 있거나 하루 이상 이어진다</li>
  </ul>
</section>
<section class="card">
  <h2>병원에 갈 때 준비하면 좋은 정보</h2>
  <ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    <li>정확한 <b>체중</b>과 최근 변화(체중 기록 도구를 쓰면 편합니다)</li>
    <li>증상이 시작된 <b>시각</b>과 빈도(구토 몇 회, 언제부터)</li>
    <li>먹은 것: 사료 종류, 간식, 사람 음식, 주운 것 — <b>포장지나 사진</b>이 있으면 가장 좋습니다</li>
    <li>복용 중인 약·영양제 목록</li>
    <li>가능하면 <b>영상 촬영</b>: 경련·기침·절뚝임은 진료실에서 재현되지 않는 경우가 많습니다</li>
    <li>대소변 상태(사진 또는 채취한 검체)</li>
  </ul>
</section>
<section class="card">
  <h2>사람 약은 절대 임의로 주지 마세요</h2>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>약</th><th>위험</th></tr></thead><tbody>
  <tr><td>아세트아미노펜(타이레놀 등)</td><td>고양이에게 특히 치명적 — 적혈구 손상과 간 손상. 개에게도 위험합니다.</td></tr>
  <tr><td>이부프로펜·나프록센 등 소염진통제</td><td>위장 궤양·천공, 급성 신부전을 일으킬 수 있습니다.</td></tr>
  <tr><td>아스피린</td><td>출혈 경향·위장 손상. 자가 판단 투여는 금물입니다.</td></tr>
  <tr><td>사람용 감기약·코막힘약</td><td>슈도에페드린 등은 심박·혈압을 급격히 올립니다.</td></tr>
  <tr><td>사람용 연고·안약</td><td>핥아 먹으면 성분에 따라 중독될 수 있습니다.</td></tr>
  </tbody></table></div>
  <p class="src">사람 약을 잘못 먹었다면 증상이 없더라도 즉시 병원에 연락하세요. 시간이 지날수록 처치가 어려워집니다.</p>
</section>`,
  aboutHtml: `<h2>대신 이렇게 준비하세요</h2>
<ol>
<li><b>야간·응급 진료가 가능한 병원</b> 두 곳의 연락처를 냉장고나 휴대폰에 저장해 두세요.</li>
<li>이동장에 적응시켜 두면 응급 상황에서 이동 시간이 크게 줄어듭니다.</li>
<li>정기검진 기록(혈액검사 수치)을 사진으로 보관하면 다른 병원에서도 빠르게 판단할 수 있습니다.</li>
<li>먹으면 안 되는 음식 목록을 미리 확인해 집 안 위험 요소를 정리해 두세요.</li>
</ol>
<h2>이 사이트가 제공하는 것과 제공하지 않는 것</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>제공합니다</th><th>제공하지 않습니다</th></tr></thead><tbody>
<tr><td>나이·급여량·일정 같은 <b>계산과 기록</b></td><td>약 용량 계산, 처방 정보</td></tr>
<tr><td>공개 지침에 근거한 <b>일반 정보</b></td><td>증상 진단, 질병 확정</td></tr>
<tr><td>수의사와 상담할 때 쓸 <b>준비 자료</b></td><td>보험·금융 상품 비교나 추천</td></tr>
</tbody></table></div>
<p class="notice warn">모든 판단의 마지막 단계는 <b>수의사 진료</b>입니다. 이 페이지의 정보는 진료를 대신하지 않습니다.</p>`,
  faq: [
    { q: "체중당 용량이 인터넷에 나와 있던데요?", a: "같은 성분이라도 제품 농도, 개체의 간·신장 상태, 함께 먹는 약에 따라 안전 범위가 달라집니다. 공개된 수치를 그대로 적용하는 것은 위험하며, 반드시 진료를 통해 처방받으세요." },
    { q: "밤에 갑자기 아픈데 어디로 가야 하나요?", a: "미리 저장해 둔 야간 응급 동물병원에 전화로 상황을 먼저 알리고 이동하세요. 전화로 알리면 도착 즉시 처치를 준비해 둘 수 있습니다." },
    { q: "중독 물질을 먹었을 때 토하게 해도 되나요?", a: "직접 토하게 하는 것은 위험할 수 있습니다(부식성 물질·의식 저하 시 특히). 임의로 시도하지 말고 병원 지시를 먼저 받으세요." },
    { q: "이 사이트의 계산 결과를 병원에 보여줘도 되나요?", a: "체중 기록이나 급여량 계산은 상담 자료로 유용합니다. 다만 진단·처방의 근거가 아니라 참고 자료라는 점을 함께 알려 주세요." },
  ],
  related: relatedBlock("vet-consult", ["petVetCost", "petSafe", "petAge"], [
    { name: "먹어도 되는 음식 찾기", href: "can-eat/index.html", ic: "🥗" },
    { name: "체중 기록·그래프", href: "weight-log/index.html", ic: "📈" },
  ]),
});

/* ---------------- 11) can-eat 통합 검색 도구 ---------------- */
const CE = { dog: DOG_CANEAT, cat: CAT_CANEAT };
const ceLite = (sp) => CE[sp].items.map((i) => ({ s: i.slug, n: i.name, v: i.verdict, m: i.summary }));
const countBy = (sp, v) => CE[sp].items.filter((i) => i.verdict === v).length;

buildPage({
  dir: "can-eat",
  title: "강아지·고양이 먹어도 되는 음식 검색 — 가능·주의·금지 | PetCalc",
  desc: `강아지 ${DOG_CANEAT.items.length}가지, 고양이 ${CAT_CANEAT.items.length}가지 사람 음식을 가능·주의·금지로 정리했습니다. 재료 이름으로 검색하면 이유와 근거 출처까지 바로 확인할 수 있습니다.`,
  h1: "먹어도 되는 음식 검색",
  emoji: "🥗",
  lead: `재료 이름을 검색해 보세요. 강아지 ${DOG_CANEAT.items.length}종 · 고양이 ${CAT_CANEAT.items.length}종을 가능/주의/금지로 정리했습니다.`,
  crumbs: cr({ name: "먹어도 되는 음식" }),
  health: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>검색</h2>
  <div class="field"><label>대상</label>
    <div class="seg" id="sp">
      <button type="button" data-v="dog" aria-pressed="true">🐕 강아지</button>
      <button type="button" data-v="cat" aria-pressed="false">🐈 고양이</button>
    </div>
  </div>
  <div class="field"><label for="q">재료 이름 <span class="hint">예: 포도, 닭가슴살</span></label><input type="text" id="q" placeholder="재료 이름을 입력하세요" autocomplete="off"></div>
  <div class="field"><label>결론으로 좁히기</label>
    <div class="seg" id="vd">
      <button type="button" data-v="all" aria-pressed="true">전체</button>
      <button type="button" data-v="ok" aria-pressed="false">가능</button>
      <button type="button" data-v="caution" aria-pressed="false">주의</button>
      <button type="button" data-v="danger" aria-pressed="false">금지</button>
    </div>
  </div>
</section>
<section class="result" id="res">
  <div class="card">
    <h2>결과 <span class="hint" id="cnt"></span></h2>
    <div id="out"></div>
  </div>
</section>`,
  script: `(function(){
var D=` + J({ dog: ceLite("dog"), cat: ceLite("cat") }) + `;
var W=` + J(VERDICT) + `;
var REL='../';
var sp='dog', vd='all';
function render(){
  var q=(pcQ('q').value||'').trim();
  var list=D[sp].filter(function(i){
    if(vd!=='all'&&i.v!==vd) return false;
    if(q&&i.n.indexOf(q)<0&&i.s.indexOf(q.toLowerCase())<0) return false;
    return true;
  });
  var order={danger:0,caution:1,ok:2};
  list.sort(function(a,b){return order[a.v]-order[b.v]||a.n.localeCompare(b.n,'ko');});
  pcQ('cnt').textContent='· '+list.length+'개';
  if(!list.length){ pcQ('out').innerHTML='<p class="src">검색 결과가 없습니다. 다른 이름으로 찾아보거나, 확실하지 않은 음식은 주지 말고 수의사에게 문의하세요.</p>'; return; }
  pcQ('out').innerHTML=list.map(function(i){
    return '<a class="rel" style="margin-bottom:8px" href="'+REL+sp+'/can-eat/'+i.s+'/index.html">'+
      '<span class="badge '+W[i.v].cls+'">'+W[i.v].word+'</span>'+
      '<span><b>'+i.n+'</b><br><span style="font-size:12.5px;color:var(--muted2)">'+i.m+'</span></span></a>';
  }).join('');
}
pcSeg('sp',function(v){sp=v;render();});
pcSeg('vd',function(v){vd=v;render();});
pcQ('q').addEventListener('input',render);
render();
if(window.pcShowAd) window.pcShowAd();
})();`,
  aboutHtml: `<h2>가능·주의·금지는 어떻게 나눴나요?</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>표시</th><th>뜻</th></tr></thead><tbody>
<tr><td><span class="badge ok">가능</span></td><td>손질·조리 조건을 지키면 간식으로 줄 수 있는 음식</td></tr>
<tr><td><span class="badge caution">주의</span></td><td>독성은 없지만 양·부위·조리법에 조건이 붙거나, 개체에 따라 문제가 되는 음식</td></tr>
<tr><td><span class="badge danger">금지</span></td><td>소량으로도 중독·응급을 일으킬 수 있어 주면 안 되는 음식</td></tr>
</tbody></table></div>
<p>수록 기준은 “개수”가 아니라 “확실함”입니다. 수의학적으로 결론이 갈리는 항목은 넣지 않았습니다.</p>
<h3>수록 현황</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>대상</th><th>가능</th><th>주의</th><th>금지</th><th>합계</th></tr></thead><tbody>
<tr><td>🐕 강아지</td><td>${countBy("dog", "ok")}</td><td>${countBy("dog", "caution")}</td><td>${countBy("dog", "danger")}</td><td>${DOG_CANEAT.items.length}</td></tr>
<tr><td>🐈 고양이</td><td>${countBy("cat", "ok")}</td><td>${countBy("cat", "caution")}</td><td>${countBy("cat", "danger")}</td><td>${CAT_CANEAT.items.length}</td></tr>
</tbody></table></div>
<p><a href="../dog/can-eat/index.html">강아지 전체 목록 보기</a> · <a href="../cat/can-eat/index.html">고양이 전체 목록 보기</a></p>
<h2>공통 원칙 4가지</h2>
<ol>
<li><b>간식은 하루 총 열량의 10% 이내.</b> 나머지는 균형 잡힌 사료로 채워야 합니다.</li>
<li><b>양념은 전부 빼세요.</b> 소금·마늘·양파 양념이 든 음식은 재료 자체가 안전해도 위험해집니다.</li>
<li><b>처음 주는 음식은 소량부터.</b> 12~24시간 동안 구토·설사·가려움이 없는지 확인합니다.</li>
<li><b>씨·심·뼈·껍질은 제거.</b> 중독이 아니라 폐색으로 응급 수술을 하는 경우가 많습니다.</li>
</ol>
<p class="notice warn">이미 먹은 뒤 증상이 있다면 검색보다 <b>병원 연락이 먼저</b>입니다. 먹은 종류·양·시각을 기록해 두세요.</p>
${src1(DOG_CANEAT.meta.note, DOG_CANEAT.meta.source, DOG_CANEAT.meta.checkedAt)}
${src1(CAT_CANEAT.meta.note, CAT_CANEAT.meta.source, CAT_CANEAT.meta.checkedAt)}`,
  faq: [
    { q: "목록에 없는 음식은 줘도 되나요?", a: "수록되지 않았다는 것은 “안전이 확인됐다”는 뜻이 아니라 “확실한 근거를 찾지 못했다”는 뜻입니다. 확실하지 않으면 주지 않는 쪽이 안전하고, 필요하면 수의사에게 확인하세요." },
    { q: "조금 먹었는데 괜찮아 보이면 지켜봐도 되나요?", a: "초콜릿·자일리톨·양파·포도처럼 금지로 표시된 음식은 증상이 늦게 나타납니다. 증상이 없어도 먹은 양과 시각을 알려 병원 판단을 받으세요." },
    { q: "강아지에게 괜찮은데 고양이에게 위험한 음식도 있나요?", a: "네. 고양이는 완전 육식동물이라 대사 방식이 달라 같은 음식도 결론이 다를 수 있습니다. 대상 탭을 꼭 맞게 선택해 확인하세요." },
    { q: "사료에 들어 있는 재료인데 왜 주의인가요?", a: "사료에는 가공·배합 과정에서 안전한 형태와 양으로 들어갑니다. 집에서 통째로 주는 것과는 조건이 다릅니다." },
  ],
  related: relatedBlock("can-eat", ["petSafe", "petMeal", "petVetCost"], [
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    { name: "수의사 상담 안내", href: "vet-consult/index.html", ic: "🏥" },
  ]),
});

/* ---------------- 12) can-eat 종별 목록 + 롱테일 상세 ---------------- */
const SPK = { dog: "강아지", cat: "고양이" };
["dog", "cat"].forEach((sp) => {
  const items = CE[sp].items;
  const ko = SPK[sp];
  const listByVerdict = (v) =>
    items
      .filter((i) => i.verdict === v)
      .map((i) => `<a class="chip ${v}" href="${i.slug}/index.html">${esc(i.name)}</a>`)
      .join("\n      ");

  buildPage({
    dir: `${sp}/can-eat`,
    title: `${ko}가 먹어도 되는 음식 전체 목록 ${items.length}가지 | PetCalc`,
    desc: `${ko}에게 줄 수 있는 음식과 절대 주면 안 되는 음식을 가능 ${countBy(sp, "ok")}종·주의 ${countBy(sp, "caution")}종·금지 ${countBy(sp, "danger")}종으로 정리했습니다. 재료를 눌러 이유와 출처를 확인하세요.`,
    h1: `${ko}가 먹어도 되는 음식 목록`,
    emoji: sp === "dog" ? "🐕" : "🐈",
    kind: "article",
    lead: `${ko} 기준으로 정리한 사람 음식 ${items.length}가지. 재료를 누르면 이유·주의점·출처를 볼 수 있습니다.`,
    crumbs: cr({ name: "먹어도 되는 음식", href: "can-eat/index.html" }, { name: `${ko} 목록` }),
    health: true,
    ad: "eager",
    bodyHtml: `<section class="card">
  <h2><span class="badge danger">금지</span> 절대 주면 안 되는 음식 (${countBy(sp, "danger")})</h2>
  <div class="chip-list">
      ${listByVerdict("danger")}
  </div>
</section>
<section class="card">
  <h2><span class="badge caution">주의</span> 조건을 지켜야 하는 음식 (${countBy(sp, "caution")})</h2>
  <div class="chip-list">
      ${listByVerdict("caution")}
  </div>
</section>
<section class="card">
  <h2><span class="badge ok">가능</span> 간식으로 줄 수 있는 음식 (${countBy(sp, "ok")})</h2>
  <div class="chip-list">
      ${listByVerdict("ok")}
  </div>
</section>`,
    aboutHtml: `<h2>${ko}에게 사람 음식을 줄 때 지킬 것</h2>
<ul>
<li>간식·사람 음식은 <b>하루 총 열량의 10% 이내</b>로 제한합니다.</li>
<li>소금·설탕·기름·양념은 모두 빼고, 조리는 삶기·찌기로 합니다.</li>
<li>새로운 음식은 <b>한 번에 한 가지</b>만, 소량으로 시작해 반응을 봅니다.</li>
<li>씨·심·뼈·껍질은 제거합니다. 폐색은 중독만큼 흔한 응급 원인입니다.</li>
${sp === "cat"
  ? "<li>고양이는 완전 육식동물이라 채소·과일이 <b>영양상 필수는 아닙니다</b>. 호기심 수준의 소량이면 충분합니다.</li>"
  : "<li>알레르기가 있는 강아지도 많습니다. 가려움·귀 염증이 반복되면 급여 목록을 수의사와 점검하세요.</li>"}
</ul>
<p><a href="../../can-eat/index.html">재료 이름으로 검색하기</a> · <a href="../../${sp === "dog" ? "cat" : "dog"}/can-eat/index.html">${sp === "dog" ? "고양이" : "강아지"} 목록 보기</a></p>
${src1(CE[sp].meta.note, CE[sp].meta.source, CE[sp].meta.checkedAt)}`,
    faq: [
      { q: `${ko}에게 가장 위험한 음식은 무엇인가요?`, a: `이 목록의 금지 항목은 모두 소량으로도 문제가 될 수 있습니다. 그중에서도 ${sp === "dog" ? "초콜릿, 포도·건포도, 양파·마늘, 자일리톨" : "양파·마늘, 백합, 초콜릿, 포도"}은 응급으로 이어지는 대표적인 원인입니다.` },
      { q: "목록에 없는 재료는 어떻게 확인하나요?", a: "확실한 근거가 있는 항목만 수록했기 때문에 목록에 없는 음식은 “안전 확인됨”이 아닙니다. 판단이 서지 않으면 주지 말고 병원에 문의하세요." },
      { q: "익히면 안전해지는 음식도 있나요?", a: "감자·고기·생선처럼 가열로 위험이 줄어드는 것도 있지만, 양파·마늘은 익혀도 독성이 사라지지 않습니다. 항목별 설명을 확인하세요." },
      { q: "얼마나 자주 줘도 되나요?", a: "가능으로 표시된 음식도 매일 주는 주식이 아니라 간식입니다. 주 2~3회, 소량이면 충분합니다." },
    ],
    related: relatedBlock(`${sp}/can-eat`, ["petSafe", "petMeal", "petVetCost"], [
      { name: "재료 검색하기", href: "can-eat/index.html", ic: "🥗" },
      { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    ]),
  });

  // 롱테일 상세 페이지
  items.forEach((it, idx) => {
    const V = VERDICT[it.verdict];
    const others = items.filter((x) => x.slug !== it.slug);
    const near = [];
    for (let k = 1; near.length < 8 && k <= others.length; k++) {
      near.push(others[(idx + k) % others.length]);
    }
    const chips = near
      .map((x) => `<a class="chip ${x.verdict}" href="../${x.slug}/index.html">${esc(x.name)} · ${VERDICT[x.verdict].word}</a>`)
      .join("\n    ");

    buildPage({
      dir: `${sp}/can-eat/${it.slug}`,
      title: `${ko}가 ${it.name} 먹어도 되나요? — ${V.word} | PetCalc`,
      desc: `${ko}와 ${it.name}: ${it.summary}. ${String(it.reason).slice(0, 70)}… 이유와 대처법, 근거 출처를 확인하세요.`,
      h1: `${ko}가 ${it.name} 먹어도 되나요?`,
      emoji: sp === "dog" ? "🐕" : "🐈",
      kind: "article",
      lead: esc(it.summary),
      crumbs: cr(
        { name: "먹어도 되는 음식", href: "can-eat/index.html" },
        { name: `${ko} 목록`, href: `${sp}/can-eat/index.html` },
        { name: it.name }
      ),
      health: true,
      ad: "eager",
      bodyHtml: `<div class="verdict ${V.cls}">
  <div class="v-word">${V.word}</div>
  <div class="v-sub">${ko} · ${esc(it.name)} — ${esc(V.label)}</div>
</div>
<section class="card">
  <h2>왜 그런가요?</h2>
  <p style="color:var(--tx2);font-size:15px;margin:0 0 12px">${esc(it.reason)}</p>
  <div class="res-line"><span class="k">결론</span><span class="v"><span class="badge ${V.cls}">${V.word}</span></span></div>
  <div class="res-line"><span class="k">한 줄 요약</span><span class="v">${esc(it.summary)}</span></div>
  <div class="res-line"><span class="k">이렇게 하세요</span><span class="v">${esc(it.tip)}</span></div>
</section>
${
  it.verdict === "danger"
    ? `<section class="card"><h2>이미 먹었다면</h2>
<ol style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
<li>먹은 <b>양·시각·형태</b>를 적어 두고, 남은 포장지가 있으면 챙깁니다.</li>
<li>임의로 토하게 하지 말고 <b>병원에 먼저 전화</b>해 지시를 받습니다.</li>
<li>증상이 없어도 연락하세요. 중독 증상은 몇 시간 뒤에 나타나는 경우가 많습니다.</li>
</ol>
<p class="src">가까운 야간 응급 동물병원 번호를 미리 저장해 두면 대응이 빨라집니다.</p></section>`
    : `<section class="card"><h2>줄 때 지킬 것</h2>
<ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
<li>양념(소금·설탕·기름·마늘·양파)은 모두 빼고 조리합니다.</li>
<li>처음에는 아주 소량만 주고 12~24시간 반응을 봅니다.</li>
<li>간식은 하루 총 열량의 10% 이내로 제한합니다.</li>
<li>씨·심·껍질·뼈는 제거해 폐색 위험을 없앱니다.</li>
</ul></section>`
}`,
      aboutHtml: `<h2>다른 재료도 확인해 보세요</h2>
<div class="chip-list">
    ${chips}
</div>
<p style="margin-top:14px"><a href="../index.html">${ko} 전체 목록 보기</a> · <a href="../../../can-eat/index.html">재료 이름으로 검색</a>${
        CE[sp === "dog" ? "cat" : "dog"].items.some((x) => x.slug === it.slug)
          ? ` · <a href="../../../${sp === "dog" ? "cat" : "dog"}/can-eat/${it.slug}/index.html">${sp === "dog" ? "고양이" : "강아지"}는 어떨까?</a>`
          : ""
      }</p>
<h2>기억할 점</h2>
<p>같은 음식이라도 <b>양·조리법·개체 상태</b>에 따라 결과가 달라집니다. 지병(신장·췌장·심장 질환)이 있거나 약을 먹고 있다면 사람 음식은 수의사와 상의한 뒤 결정하세요.</p>
${src1(`${ko} · ${it.name} 판단 근거`, it.source, it.checkedAt)}`,
      faq: [
        { q: `${ko}가 ${it.name} 먹어도 되나요?`, a: `결론은 <b>${V.word}</b>입니다. ${esc(it.summary)}.` },
        {
          q: it.verdict === "danger" ? `${it.name}을(를) 조금 먹었는데 괜찮을까요?` : `${it.name}은(는) 얼마나 줘도 되나요?`,
          a:
            it.verdict === "danger"
              ? "안전한 양이 정해져 있지 않습니다. 증상이 없더라도 먹은 양과 시각을 확인해 병원에 문의하세요."
              : "간식으로 하루 총 열량의 10%를 넘지 않는 선에서 소량만 주세요. 처음이라면 한 조각으로 시작해 반응을 확인합니다.",
        },
        { q: `${it.name}을(를) 줄 때 무엇을 조심하나요?`, a: esc(it.tip) },
        { q: "이 정보는 어디에 근거하나요?", a: `공개된 수의학 지침·중독 정보 자료를 근거로 정리했으며, 이 항목의 출처는 페이지 하단에 링크로 표시했습니다(확인일 ${it.checkedAt}). 다만 개체 상태에 따른 판단은 수의사 진료가 필요합니다.` },
      ],
      related: relatedBlock(`${sp}/can-eat/${it.slug}`, ["petSafe", "petMeal", "petVetCost"], [
        { name: "먹어도 되는 음식 검색", href: "can-eat/index.html", ic: "🥗" },
        { name: "수의사 상담 안내", href: "vet-consult/index.html", ic: "🏥" },
      ]),
    });
  });
});

/* ---------------- 13) 견종 백과 (허브 + 롱테일) ---------------- */
const breedRow = (b) =>
  `<tr><td><a href="${b.slug}/index.html">${esc(b.name)}</a></td><td>${SIZE_LABEL[b.size]}</td><td>${b.weightKg[0]}~${b.weightKg[1]}kg</td><td>${b.lifespan[0]}~${b.lifespan[1]}년</td></tr>`;

buildPage({
  dir: "breed",
  title: `견종 정보 백과 ${BREEDS.length}종 — 체중·평균 수명·주의 질환 | PetCalc`,
  desc: `말티즈·푸들·포메라니안부터 골든 리트리버까지 잘 알려진 견종 ${BREEDS.length}종의 체중 범위, 평균 수명, 성향, 호발 질환을 정리했습니다. 견종을 골라 상세 정보를 확인하세요.`,
  h1: "견종 정보 백과",
  emoji: "📚",
  lead: `잘 알려진 견종 ${BREEDS.length}종의 체중·수명·성향·주의할 질환을 한눈에. 견종 이름을 눌러 상세 페이지로 이동하세요.`,
  crumbs: cr({ name: "견종 백과" }),
  health: true,
  ad: "lazy",
  bodyHtml: `<section class="card">
  <h2>견종 찾기</h2>
  <div class="field"><label for="q">견종 이름 <span class="hint">한글 또는 영문</span></label><input type="text" id="q" placeholder="예: 말티즈, poodle" autocomplete="off"></div>
  <div class="field"><label>크기</label>
    <div class="seg" id="sz">
      <button type="button" data-v="all" aria-pressed="true">전체</button>
      <button type="button" data-v="small" aria-pressed="false">소형견</button>
      <button type="button" data-v="medium" aria-pressed="false">중형견</button>
      <button type="button" data-v="large" aria-pressed="false">대형견</button>
    </div>
  </div>
</section>
<section class="result" id="res">
  <div class="card">
    <h2>목록 <span class="hint" id="cnt"></span></h2>
    <div class="chip-list" id="out"></div>
  </div>
</section>`,
  script: `(function(){
var B=` + J(BREEDS.map((b) => ({ s: b.slug, n: b.name, e: b.nameEn, z: b.size, w: b.weightKg, l: b.lifespan }))) + `;
var L=` + J(SIZE_LABEL) + `;
var sz='all';
function render(){
  var q=(pcQ('q').value||'').trim().toLowerCase();
  var list=B.filter(function(b){
    if(sz!=='all'&&b.z!==sz) return false;
    if(q&&b.n.toLowerCase().indexOf(q)<0&&b.e.toLowerCase().indexOf(q)<0) return false;
    return true;
  });
  pcQ('cnt').textContent='· '+list.length+'종';
  pcQ('out').innerHTML = list.length
    ? list.map(function(b){return '<a class="chip" href="'+b.s+'/index.html">'+b.n+' <span style="color:var(--muted)">'+L[b.z]+' · '+b.l[0]+'~'+b.l[1]+'년</span></a>';}).join('')
    : '<p class="src">검색 결과가 없습니다. 다른 이름으로 찾아보세요.</p>';
}
pcSeg('sz',function(v){sz=v;render();});
pcQ('q').addEventListener('input',render);
render();
if(window.pcShowAd) window.pcShowAd();
})();`,
  aboutHtml: `<h2>견종 정보를 어떻게 읽어야 하나요?</h2>
<p>여기 적힌 체중·수명은 견종 표준에서 이야기하는 <b>일반적인 범위</b>입니다. 실제로는 혈통, 중성화 여부, 식단, 운동량, 치과 관리에 따라 개체별로 크게 달라집니다. “호발 질환”도 그 견종에서 상대적으로 자주 보고된다는 뜻이지, 반드시 걸린다는 의미가 아닙니다.</p>
<h3>전체 목록</h3>
<div class="rt-wrap"><table class="rt"><thead><tr><th>견종</th><th>크기</th><th>체중</th><th>평균 수명</th></tr></thead><tbody>
${BREEDS.slice().sort((a, b) => a.name.localeCompare(b.name, "ko")).map(breedRow).join("")}
</tbody></table></div>
<h2>입양 전 확인하면 좋은 것</h2>
<ul>
<li><b>운동량</b>: 보더콜리·허스키처럼 하루 운동이 많이 필요한 견종은 생활 패턴과 맞아야 합니다.</li>
<li><b>미용 비용</b>: 푸들·비숑처럼 털이 계속 자라는 견종은 4~8주마다 미용비가 듭니다.</li>
<li><b>호발 질환</b>: 미리 알면 조기 검진과 생활 관리(계단 제한, 체중 관리)로 위험을 줄일 수 있습니다.</li>
<li><b>기후</b>: 단두종과 이중모 견종은 한국 여름에 특히 취약합니다.</li>
</ul>
${src1(BREED_META.note, BREED_META.source, BREED_META.checkedAt)}`,
  faq: [
    { q: "믹스견은 어떻게 참고하나요?", a: "체형이 비슷한 견종 두세 개를 함께 보고 중간값으로 생각하면 도움이 됩니다. 체구는 성견 체중을 기준으로 판단하세요." },
    { q: "평균 수명은 얼마나 믿을 수 있나요?", a: "견종 표준의 일반 범위이며, 실제 수명은 체중 관리·치과 관리·정기검진에 크게 좌우됩니다. 특히 비만 예방은 수명과 직결됩니다." },
    { q: "호발 질환이 있으면 입양하지 말아야 하나요?", a: "그렇지 않습니다. 알고 대비하면 조기 발견과 관리가 쉬워집니다. 해당 질환의 초기 신호를 익혀 두는 것이 더 중요합니다." },
    { q: "여기 없는 견종은 어디서 확인하나요?", a: "근거 자료가 확실한 견종만 수록했습니다. 목록에 없다면 담당 수의사나 공신력 있는 견종 단체 자료를 참고하세요." },
  ],
  related: relatedBlock("breed", ["dogPersonality", "petAge", "petMeal"], [
    { name: "강아지 나이 계산기", href: "dog-age/index.html", ic: "🐕" },
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
  ]),
});

BREEDS.forEach((b, i) => {
  const near = [];
  const pool = BREEDS.filter((x) => x.slug !== b.slug);
  const same = pool.filter((x) => x.size === b.size);
  const rest = pool.filter((x) => x.size !== b.size);
  [...same, ...rest].slice(0, 8).forEach((x) => near.push(x));
  const chips = near.map((x) => `<a class="chip" href="../${x.slug}/index.html">${esc(x.name)}</a>`).join("\n    ");
  const midW = ((b.weightKg[0] + b.weightKg[1]) / 2).toFixed(1);
  const rerMid = Math.round(70 * Math.pow((b.weightKg[0] + b.weightKg[1]) / 2, 0.75));

  buildPage({
    dir: `breed/${b.slug}`,
    title: `${b.name} 특징 정리 — 체중 ${b.weightKg[0]}~${b.weightKg[1]}kg · 평균 수명 ${b.lifespan[0]}~${b.lifespan[1]}년 | PetCalc`,
    desc: `${b.name}(${b.nameEn})의 크기, 체중 범위, 평균 수명, 성향과 관리 포인트, 자주 보고되는 질환을 정리했습니다. ${esc(b.traits)}`,
    h1: `${b.name} 특징과 관리 포인트`,
    emoji: "🐶",
    kind: "article",
    lead: esc(b.traits),
    crumbs: cr({ name: "견종 백과", href: "breed/index.html" }, { name: b.name }),
    health: true,
    ad: "eager",
    bodyHtml: `<section class="card">
  <h2>기본 정보</h2>
  <div class="res-line"><span class="k">영문명</span><span class="v">${esc(b.nameEn)}</span></div>
  <div class="res-line"><span class="k">크기 분류</span><span class="v">${SIZE_LABEL[b.size]}</span></div>
  <div class="res-line"><span class="k">체중 범위</span><span class="v">${b.weightKg[0]} ~ ${b.weightKg[1]} kg</span></div>
  <div class="res-line"><span class="k">평균 수명</span><span class="v">${b.lifespan[0]} ~ ${b.lifespan[1]} 년</span></div>
  <div class="res-line"><span class="k">중간 체중 기준 RER</span><span class="v">약 ${rerMid} kcal/일 (${midW}kg)</span></div>
</section>
<section class="card">
  <h2>성향과 관리</h2>
  <p style="color:var(--tx2);font-size:15px;margin:0 0 10px"><b>성향</b> — ${esc(b.traits)}</p>
  <p style="color:var(--tx2);font-size:15px;margin:0"><b>관리 포인트</b> — ${esc(b.care)}</p>
</section>
<section class="card">
  <h2>자주 보고되는 질환</h2>
  <ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    ${b.concerns.map((c) => `<li>${esc(c)}</li>`).join("\n    ")}
  </ul>
  <p class="src">해당 견종에서 상대적으로 자주 보고되는 질환일 뿐, 반드시 발생한다는 뜻이 아닙니다. 진단은 수의사만 할 수 있습니다.</p>
</section>`,
    aboutHtml: `<h2>${b.name}와(과) 함께 쓰면 좋은 계산</h2>
<ul>
<li><a href="../../dog-age/index.html">강아지 나이 계산기</a> — 체구를 <b>${SIZE_LABEL[b.size]}</b>으로 선택하면 됩니다.</li>
<li><a href="../../food-amount/index.html">사료 급여량 계산기</a> — 체중 ${midW}kg 기준 RER은 약 ${rerMid}kcal이며, 여기에 중성화·활동량 계수를 곱한 값이 하루 목표 열량입니다.</li>
<li><a href="../../weight-log/index.html">체중 기록</a> — 표준 체중 범위(${b.weightKg[0]}~${b.weightKg[1]}kg) 안에서 유지되는지 확인해 보세요.</li>
</ul>
<h2>비슷하거나 함께 많이 찾는 견종</h2>
<div class="chip-list">
    ${chips}
</div>
<p style="margin-top:14px"><a href="../index.html">견종 백과 전체 목록</a></p>
${src1(`${b.name} (${b.nameEn}) 견종 표준 정보`, b.source, b.checkedAt)}
${src1("견종별 호발 질환 일반 정보", b.sourceDisease, b.checkedAt)}`,
    faq: [
      { q: `${b.name}의 평균 수명은 어느 정도인가요?`, a: `일반적으로 ${b.lifespan[0]}~${b.lifespan[1]}년으로 봅니다. 체중 관리와 치과 관리, 정기검진 여부에 따라 개체별 차이가 큽니다.` },
      { q: `${b.name}의 적정 체중은 몇 kg인가요?`, a: `견종 표준상 ${b.weightKg[0]}~${b.weightKg[1]}kg 범위입니다. 다만 숫자보다 체형(BCS)이 중요하며, 갈비뼈가 보이지 않지만 가볍게 만져지는 상태가 이상적입니다.` },
      { q: `${b.name}를 키울 때 가장 신경 쓸 점은?`, a: esc(b.care) },
      { q: `${b.name}가 잘 걸리는 병이 있나요?`, a: `${b.concerns.join(", ")} 등이 상대적으로 자주 보고됩니다. 예방보다 조기 발견이 중요하므로 정기검진에서 관련 항목을 챙기세요.` },
    ],
    related: relatedBlock(`breed/${b.slug}`, ["dogPersonality", "petAge", "petMeal"], [
      { name: "견종 백과", href: "breed/index.html", ic: "📚" },
      { name: "강아지가 먹어도 되는 음식", href: "dog/can-eat/index.html", ic: "🥗" },
    ]),
  });
});

/* ---------------- 14) 콘텐츠 가이드 ---------------- */
buildPage({
  dir: "guide/dog-food-basics",
  title: "강아지 사료 기본 가이드 — 하루 몇 kcal, 몇 g, 몇 번? | PetCalc",
  desc: "강아지 사료 급여의 기본을 정리했습니다. RER·MER로 하루 열량 정하기, 사료 라벨 읽는 법, 급여 횟수, 간식 10% 규칙, 사료 바꾸는 7~10일 전환법까지 순서대로 설명합니다.",
  h1: "강아지 사료 기본 가이드",
  emoji: "📘",
  kind: "article",
  lead: "얼마나, 몇 번, 어떻게 줄지 정하는 기본 순서를 정리했습니다. 계산은 급여량 계산기와 함께 보세요.",
  crumbs: cr({ name: "가이드", href: "index.html" }, { name: "강아지 사료 기본" }),
  health: true,
  individual: true,
  ad: "eager",
  bodyHtml: `<section class="card">
  <h2>3분 요약</h2>
  <ol style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    <li>하루 필요 열량 = <b>70 × 체중(kg)<sup>0.75</sup> × 생활 단계 계수</b></li>
    <li>사료 봉투의 <b>100g당 kcal</b>로 나눠 그램으로 환산</li>
    <li>성견은 하루 <b>2회</b>로 나눠 급여, 어린 강아지는 3~4회</li>
    <li>간식은 하루 총 열량의 <b>10% 이내</b>, 그만큼 사료를 줄이기</li>
    <li>사료를 바꿀 때는 <b>7~10일</b>에 걸쳐 비율을 옮기기</li>
  </ol>
  <p style="margin-top:14px"><a class="btn sub" href="../../food-amount/index.html">급여량 계산기로 계산하기 →</a></p>
</section>`,
  aboutHtml: `<h2>1. 하루 열량부터 정합니다</h2>
<p>사료량은 “몇 컵”이 아니라 <b>열량</b>에서 출발합니다. 쉬고 있을 때 필요한 열량(RER)은 <code>70 × 체중<sup>0.75</sup></code>이고, 여기에 생활 단계 계수를 곱한 값(MER)이 하루 목표입니다. 예를 들어 중성화한 8kg 성견이라면 RER 약 333kcal에 1.6을 곱해 하루 약 533kcal가 기준이 됩니다.</p>
<h2>2. 사료 라벨 읽기</h2>
<ul>
<li><b>kcal/kg 또는 100g당 kcal</b>: 열량을 그램으로 바꿀 때 쓰는 가장 중요한 숫자입니다. kcal/kg을 10으로 나누면 100g당 값이 됩니다.</li>
<li><b>급여 권장량 표</b>: 넓은 범위를 제시하므로 시작점으로만 쓰고, 체중 변화로 조정합니다.</li>
<li><b>단계 표시(퍼피/성견/전연령)</b>: 성장기에는 성장기용을 써야 칼슘·인 균형이 맞습니다.</li>
<li><b>보증성분</b>: 조단백·조지방은 최소값, 조섬유·수분은 최대값입니다. 제품 간 비교는 같은 수분 기준으로 해야 정확합니다.</li>
</ul>
<h2>3. 몇 번에 나눠 줄까요?</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>시기</th><th>급여 횟수</th><th>메모</th></tr></thead><tbody>
<tr><td>생후 2~4개월</td><td>하루 3~4회</td><td>저혈당 예방을 위해 자주 나눠 줍니다</td></tr>
<tr><td>생후 4~12개월</td><td>하루 2~3회</td><td>성장 속도에 맞춰 양을 조절합니다</td></tr>
<tr><td>성견</td><td>하루 2회</td><td>대형견은 한 번에 많은 양을 피합니다</td></tr>
<tr><td>노령견</td><td>하루 2~3회</td><td>소화 부담을 줄이려면 나눠 급여</td></tr>
</tbody></table></div>
<h2>4. 간식 10% 규칙</h2>
<p>간식·훈련용 보상·사람 음식은 모두 합쳐 하루 총 열량의 10%를 넘지 않게 합니다. 하루 500kcal가 목표라면 간식은 50kcal까지이고, 그만큼 사료를 줄여야 총량이 맞습니다. 훈련량이 많은 날에는 사료 알갱이 일부를 보상으로 쓰는 방법이 편리합니다.</p>
<h2>5. 사료 바꾸기 (7~10일 전환)</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>일차</th><th>새 사료</th><th>기존 사료</th></tr></thead><tbody>
<tr><td>1~2일</td><td>25%</td><td>75%</td></tr>
<tr><td>3~4일</td><td>50%</td><td>50%</td></tr>
<tr><td>5~6일</td><td>75%</td><td>25%</td></tr>
<tr><td>7일 이후</td><td>100%</td><td>-</td></tr>
</tbody></table></div>
<p>설사·구토가 생기면 이전 비율로 하루 이틀 되돌린 뒤 더 천천히 진행합니다. 위장이 예민한 개는 14일에 걸쳐 바꾸기도 합니다.</p>
<h2>6. 자주 하는 실수</h2>
<ul>
<li>계량컵을 눈대중으로 쓰기 — <b>주방 저울</b>로 그램을 재는 편이 훨씬 정확합니다.</li>
<li>봉투 권장량을 그대로 유지하며 체중 변화를 보지 않기</li>
<li>사람 음식으로 “조금씩” 채우다 하루 총 열량이 20~30% 초과되기</li>
<li>감량한다며 하루 두 끼를 한 끼로 줄이기 — 총량을 줄이되 횟수는 유지하는 편이 낫습니다.</li>
</ul>
<p class="notice warn">신장·심장·췌장 질환, 알레르기, 당뇨가 있는 경우에는 이 일반 지침보다 <b>처방식과 수의사 지침이 우선</b>합니다.</p>
${src1(RER_FORMULA.value, RER_FORMULA.source, RER_FORMULA.checkedAt)}
${src1("WSAVA Global Nutrition Guidelines", MER_FACTORS.meta.source, MER_FACTORS.meta.checkedAt)}`,
  faq: [
    { q: "사료를 계량컵으로 줘도 되나요?", a: "가능하지만 알갱이 크기와 담는 방식에 따라 오차가 10~20%까지 납니다. 감량 중이거나 소형견이라면 저울로 그램을 재는 편이 안전합니다." },
    { q: "자율 급식(하루 종일 두기)은 어떤가요?", a: "먹는 양을 알 수 없어 비만과 식욕 저하를 놓치기 쉽습니다. 정해진 시간에 정해진 양을 주고 15~20분 뒤 치우는 방식을 권합니다." },
    { q: "습식 사료를 섞어도 되나요?", a: "됩니다. 다만 각각의 100g당 kcal로 열량을 따로 계산해 합산해야 총량이 맞습니다. 습식은 수분이 많아 같은 무게라도 열량이 낮습니다." },
    { q: "체중이 그대로인데 살이 쪄 보여요.", a: "근육이 줄고 지방이 늘면 체중은 같아도 체형이 달라집니다. 체중 기록과 함께 BCS(체형 점수)를 함께 확인하세요." },
  ],
  related: relatedBlock("guide/dog-food-basics", ["petMeal", "slimPet", "petAge"], [
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    { name: "강아지가 먹어도 되는 음식", href: "dog/can-eat/index.html", ic: "🥗" },
  ]),
});

buildPage({
  dir: "guide/first-cat-checklist",
  title: "첫 고양이 준비 체크리스트 — 데려오기 전·후 할 일 | PetCalc",
  desc: "처음 고양이를 맞이할 때 필요한 준비물, 화장실 개수 규칙, 첫 병원 방문과 접종·중성화 일정, 집 안 위험물 제거, 적응 기간에 하지 말아야 할 일을 순서대로 정리했습니다.",
  h1: "첫 고양이 준비 체크리스트",
  emoji: "📋",
  kind: "article",
  lead: "데려오기 전 준비물부터 첫 2주 적응, 병원 일정까지 순서대로 확인하세요.",
  crumbs: cr({ name: "가이드", href: "index.html" }, { name: "첫 고양이 체크리스트" }),
  health: true,
  ad: "eager",
  bodyHtml: `<section class="card">
  <h2>데려오기 전 준비물</h2>
  <div class="rt-wrap"><table class="rt"><thead><tr><th>준비물</th><th>기준</th></tr></thead><tbody>
  <tr><td>화장실</td><td><b>고양이 수 + 1개</b>. 몸길이 1.5배 크기, 뚜껑 없는 형태부터 시작</td></tr>
  <tr><td>모래</td><td>기존에 쓰던 종류로 시작해 바꾸려면 천천히 섞어 전환</td></tr>
  <tr><td>사료·물그릇</td><td>화장실과 떨어진 곳에. 얕고 넓은 그릇이 수염 부담이 적음</td></tr>
  <tr><td>이동장</td><td>위가 열리는 형태가 병원에서 꺼내기 편함. 평소 집처럼 열어 두기</td></tr>
  <tr><td>스크래처</td><td>세로형·가로형 각각 두고 선호를 확인</td></tr>
  <tr><td>숨을 곳</td><td>박스·캣터널 등. 첫 며칠은 숨는 것이 정상</td></tr>
  <tr><td>수직 공간</td><td>캣타워나 선반. 고양이는 높이로 안정감을 얻음</td></tr>
  </tbody></table></div>
</section>
<section class="card">
  <h2>집 안 위험물 먼저 치우기</h2>
  <ul style="color:var(--tx2);font-size:14.5px;padding-left:20px;margin:0">
    <li><b>백합·원추리</b> 등 백합속 식물 — 꽃가루만으로도 급성 신부전 위험. 집에 두지 않습니다.</li>
    <li>실·끈·머리끈·낚싯줄 — 삼키면 장을 잘라 응급 수술이 필요할 수 있습니다.</li>
    <li>사람 약(특히 아세트아미노펜), 방향제·에센셜 오일, 부동액</li>
    <li>세탁기·건조기 문 열어 두기, 방충망 고정, 베란다 추락 방지</li>
    <li>양파·마늘이 든 음식과 초콜릿을 식탁에 두지 않기</li>
  </ul>
  <p style="margin-top:12px"><a href="../../cat/can-eat/index.html">고양이가 먹으면 안 되는 음식 목록 보기 →</a></p>
</section>`,
  aboutHtml: `<h2>첫 2주 적응 순서</h2>
<ol>
<li><b>1~3일차</b>: 작은 방 하나에서만 지내게 합니다. 화장실·물·사료·숨을 곳을 모두 그 방에 두고, 억지로 안지 않습니다.</li>
<li><b>4~7일차</b>: 밥 먹을 때 같은 공간에 조용히 있어 주며 존재에 익숙해지게 합니다. 낚싯대 장난감으로 짧게 놀아 줍니다.</li>
<li><b>2주차</b>: 문을 열어 집 전체를 탐색하게 합니다. 이때도 숨을 곳은 남겨 둡니다.</li>
</ol>
<p>먹지 않고 숨어만 있는 상태가 <b>24시간 이상</b> 이어지면 병원에 연락하세요. 고양이는 굶는 기간이 길어지면 간에 무리가 갑니다.</p>
<h2>병원 일정</h2>
<div class="rt-wrap"><table class="rt"><thead><tr><th>시기</th><th>할 일</th></tr></thead><tbody>
<tr><td>데려온 뒤 3~7일 이내</td><td>첫 건강검진, 기생충·전염병(FIV/FeLV) 확인 상담</td></tr>
<tr><td>생후 6~16주</td><td>종합백신(FVRCP) 2~4주 간격 접종, 마지막 차수는 16주 이후</td></tr>
<tr><td>수의사 상담 후</td><td>광견병 등 추가 접종, 심장사상충 월별 예방 시작</td></tr>
<tr><td>성 성숙 전후</td><td>중성화 시기 상담 (체중·건강 상태에 따라 결정)</td></tr>
</tbody></table></div>
<p><a href="../../vaccine/index.html">생년월일로 접종 일정 계산하기 →</a></p>
<h2>사료와 물</h2>
<ul>
<li>기존에 먹던 사료를 먼저 유지하고, 바꾸려면 <b>7~10일</b>에 걸쳐 섞어 전환합니다.</li>
<li>고양이는 물을 적게 마시는 편이라 물그릇을 여러 곳에 두고, 습식 사료를 병행하면 수분 섭취에 도움이 됩니다.</li>
<li>하루 필요 열량은 <a href="../../food-amount/index.html">급여량 계산기</a>에서 확인할 수 있습니다.</li>
</ul>
<h2>하지 말아야 할 것</h2>
<ul>
<li>첫날부터 목욕시키기 — 스트레스가 큽니다. 필요할 때만, 그리고 적응 후에 합니다.</li>
<li>손으로 놀아 주기 — 손을 사냥감으로 학습하면 나중에 무는 습관이 됩니다.</li>
<li>혼내기 — 고양이는 처벌로 학습하지 않고 사람을 피하게 됩니다. 환경을 바꿔 주는 방식이 효과적입니다.</li>
<li>화장실 위치를 자주 바꾸기 — 배변 실수의 흔한 원인입니다.</li>
</ul>
<p class="notice warn">배뇨를 힘들어하거나 화장실을 들락거리는데 소변이 나오지 않으면 <b>즉시 병원</b>으로 가세요. 특히 수컷 고양이의 요도 폐색은 응급입니다.</p>`,
  faq: [
    { q: "화장실은 정말 마릿수+1개가 필요한가요?", a: "권장 기준입니다. 개수가 부족하면 배변 실수나 참는 습관이 생길 수 있습니다. 공간이 좁다면 최소한 서로 다른 위치에 두 개를 두세요." },
    { q: "며칠째 숨어만 있는데 괜찮나요?", a: "며칠 숨는 것은 흔합니다. 다만 24시간 이상 먹지 않거나, 소변·대변이 전혀 없으면 병원에 연락해야 합니다." },
    { q: "기존 고양이가 있는데 어떻게 소개하나요?", a: "냄새 교환 → 문 사이로 짧은 만남 → 짧은 대면 순서로 1~4주에 걸쳐 천천히 진행합니다. 처음부터 같은 공간에 두는 것은 피하세요." },
    { q: "중성화는 꼭 해야 하나요?", a: "발정 스트레스와 일부 생식기 질환 위험을 줄여 일반적으로 권장됩니다. 시기와 방법은 체중·건강 상태를 보고 수의사와 결정하세요." },
  ],
  related: relatedBlock("guide/first-cat-checklist", ["petSafe", "petAge", "petVetCost"], [
    { name: "고양이 나이 계산기", href: "cat-age/index.html", ic: "🐈" },
    { name: "예방접종 스케줄", href: "vaccine/index.html", ic: "💉" },
  ]),
});

/* ---------------- 15) 가이드 목록 · 약관 · 개인정보 ---------------- */
buildPage({
  dir: "guide",
  title: "반려동물 가이드 — 사료·첫 입양 준비 | PetCalc",
  desc: "강아지 사료 급여의 기본과 첫 고양이 준비 체크리스트 등 계산기와 함께 보면 좋은 안내 글 모음입니다.",
  h1: "반려동물 가이드",
  emoji: "📚",
  kind: "article",
  lead: "계산기 결과를 실제 생활에 적용할 때 참고할 안내 글입니다.",
  crumbs: cr({ name: "가이드" }),
  ad: "none",
  bodyHtml: `<div class="tool-grid">
  <a class="tool" href="dog-food-basics/index.html"><div class="t-ic">📘</div><div class="t-name">강아지 사료 기본 가이드</div><div class="t-desc">하루 열량 정하기, 라벨 읽는 법, 급여 횟수, 사료 전환 7~10일</div></a>
  <a class="tool" href="first-cat-checklist/index.html"><div class="t-ic">📋</div><div class="t-name">첫 고양이 준비 체크리스트</div><div class="t-desc">준비물, 화장실 개수, 위험물 제거, 첫 2주 적응과 병원 일정</div></a>
</div>`,
  aboutHtml: `<h2>가이드를 쓰는 순서</h2>
<ol>
<li>계산기로 숫자를 먼저 확인합니다(나이·급여량·일정).</li>
<li>가이드에서 그 숫자를 실제 생활에 어떻게 적용할지 확인합니다.</li>
<li>변화가 필요하면 2~4주 단위로 조정하고, 체중 기록으로 결과를 확인합니다.</li>
</ol>`,
  faq: [
    { q: "가이드 내용은 어디에 근거하나요?", a: "공개된 수의영양·예방의학 지침과 공신력 있는 단체 자료를 참고했고, 각 글 하단에 출처 링크와 확인일을 표시했습니다." },
    { q: "우리 아이에게 바로 적용해도 되나요?", a: "일반적인 기준이므로 지병이 있거나 처방식을 먹는 경우에는 수의사 지침이 우선입니다." },
  ],
  related: relatedBlock("guide", ["petMeal", "petAge", "petSafe"], [
    { name: "사료 급여량 계산기", href: "food-amount/index.html", ic: "🍚" },
    { name: "먹어도 되는 음식 검색", href: "can-eat/index.html", ic: "🥗" },
  ]),
});

buildPage({
  dir: "privacy",
  title: "개인정보처리방침 | PetCalc 반려동물 계산기",
  desc: "PetCalc은 이름·연락처 등 개인정보를 수집하지 않습니다. 입력값은 브라우저에서만 처리되며, 체중 기록은 이용자 기기(localStorage)에만 저장됩니다. 광고 쿠키에 관한 안내를 포함합니다.",
  h1: "개인정보처리방침",
  emoji: "🔒",
  kind: "article",
  lead: "무엇을 수집하지 않는지, 저장은 어디에 되는지 명확히 밝힙니다.",
  crumbs: cr({ name: "개인정보처리방침" }),
  ad: "none",
  bodyHtml: "",
  aboutHtml: `<h2>1. 수집하지 않는 정보</h2>
<p>PetCalc은 회원가입이 없으며 <b>이름·전화번호·주민등록번호·이메일·주소 등 개인을 식별할 수 있는 정보를 수집하지 않습니다</b>. 계산기에 입력하는 체중·나이·날짜 등은 브라우저 안에서만 계산에 쓰이고 서버로 전송되지 않습니다.</p>
<h2>2. 브라우저 저장(localStorage)</h2>
<p>체중 기록 도구는 이용자가 입력한 날짜·체중·별명을 <b>이용자의 브라우저 저장 공간에만</b> 보관합니다. 운영자는 이 데이터에 접근할 수 없습니다. 브라우저 데이터를 삭제하거나 도구의 “전체 삭제” 버튼을 누르면 즉시 사라집니다.</p>
<h2>3. 광고와 쿠키</h2>
<p>이 사이트는 Google AdSense 광고를 게재합니다. Google을 포함한 제3자 광고 제공자는 쿠키를 사용해 이용자의 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com/" rel="nofollow noopener" target="_blank">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있고, <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info</a>에서도 관련 설정을 변경할 수 있습니다.</p>
<h2>4. 접속 기록</h2>
<p>사이트가 배포된 호스팅 서비스는 서비스 운영·보안 목적으로 접속 로그(IP·접속 시각·브라우저 정보 등)를 자체 정책에 따라 처리할 수 있습니다. 운영자는 이 로그를 이용해 개인을 식별하려 시도하지 않습니다.</p>
<h2>5. 아동의 개인정보</h2>
<p>이 사이트는 만 14세 미만 아동을 대상으로 하지 않으며, 어떤 연령대의 개인정보도 별도로 수집하지 않습니다.</p>
<h2>6. 정책 변경</h2>
<p>정책이 바뀌면 이 페이지에 변경 내용을 반영합니다. 최종 업데이트: 2026-08-19.</p>`,
  faq: [
    { q: "입력한 체중이 서버에 저장되나요?", a: "저장되지 않습니다. 모든 계산은 브라우저에서 실행되며, 체중 기록만 이용자 기기의 localStorage에 남습니다." },
    { q: "저장된 기록을 지우려면 어떻게 하나요?", a: "체중 기록 도구의 “전체 삭제” 버튼을 누르거나 브라우저의 사이트 데이터 삭제 기능을 사용하면 즉시 삭제됩니다." },
  ],
  related: relatedBlock("privacy", ["petAge"], [{ name: "이용약관", href: "terms/index.html", ic: "📄" }]),
});

buildPage({
  dir: "terms",
  title: "이용약관 | PetCalc 반려동물 계산기",
  desc: "PetCalc 이용약관입니다. 제공 정보는 참고용이며 수의학적 진단·처방을 대신하지 않습니다. 책임의 한계와 저작권, 외부 링크에 관한 안내를 포함합니다.",
  h1: "이용약관",
  emoji: "📄",
  kind: "article",
  lead: "이 사이트의 정보를 어떤 범위에서 쓸 수 있는지 안내합니다.",
  crumbs: cr({ name: "이용약관" }),
  ad: "none",
  bodyHtml: "",
  aboutHtml: `<h2>1. 서비스의 성격</h2>
<p>PetCalc은 반려동물 관련 계산과 일반 정보를 제공하는 무료 도구입니다. 제공되는 모든 내용은 <b>참고용</b>이며, 수의학적 진단·치료·처방을 대신하지 않습니다.</p>
<h2>2. 의료적 판단에 관한 고지</h2>
<p>계산 결과와 정보는 공개된 지침을 바탕으로 한 일반적 기준이며, 개별 동물의 상태를 반영하지 않습니다. 건강에 관한 결정은 반드시 <b>수의사와 상담</b>한 뒤 내려야 합니다. 이 사이트는 약물 용량을 계산하거나 처방 정보를 제공하지 않습니다.</p>
<h2>3. 책임의 한계</h2>
<p>운영자는 정보의 정확성을 위해 노력하지만, 내용의 완전성이나 특정 목적에의 적합성을 보증하지 않습니다. 이용자가 이 사이트의 정보를 이용해 내린 판단과 그 결과에 대해 운영자는 법이 허용하는 범위에서 책임을 지지 않습니다.</p>
<h2>4. 저작권</h2>
<p>사이트의 텍스트·구성·코드에 대한 권리는 운영자에게 있습니다. 인용 시 출처와 링크를 함께 표시해 주세요. 각 데이터의 근거가 되는 외부 자료의 권리는 해당 기관에 있습니다.</p>
<h2>5. 외부 링크</h2>
<p>출처 표기와 관련 도구 안내를 위해 외부 사이트로 연결되는 링크가 있습니다. 외부 사이트의 내용과 정책에 대해서는 운영자가 책임지지 않습니다.</p>
<h2>6. 광고</h2>
<p>이 사이트는 광고 수익으로 운영됩니다. 광고 내용은 광고 제공자가 결정하며, 운영자가 특정 상품이나 서비스를 보증하지 않습니다. 반려동물 보험을 포함한 금융상품을 비교하거나 추천하지 않습니다.</p>
<h2>7. 약관 변경</h2>
<p>약관이 변경되면 이 페이지에 반영합니다. 최종 업데이트: 2026-08-19.</p>`,
  faq: [
    { q: "계산 결과를 병원에 제출해도 되나요?", a: "상담 자료로 활용하는 것은 좋지만, 진단이나 처방의 근거로는 사용할 수 없습니다." },
    { q: "내용을 블로그에 인용해도 되나요?", a: "출처와 페이지 링크를 함께 표시하면 인용할 수 있습니다. 전체 복제는 허용되지 않습니다." },
  ],
  related: relatedBlock("terms", ["petAge"], [{ name: "개인정보처리방침", href: "privacy/index.html", ic: "🔒" }]),
});

/* ---------------- 16) 허브 홈 ---------------- */
const TOOL_CARDS = [
  { href: "dog-age/index.html", ic: "🐕", n: "강아지 나이 계산기", d: "체구별 환산표로 사람 나이와 생활 단계를 계산" },
  { href: "cat-age/index.html", ic: "🐈", n: "고양이 나이 계산기", d: "1살=15세 기준 환산과 키튼~노묘 단계 안내" },
  { href: "food-amount/index.html", ic: "🍚", n: "사료 급여량 계산기", d: "RER·MER로 하루 kcal와 급여 그램까지" },
  { href: "vaccine/index.html", ic: "💉", n: "예방접종 스케줄", d: "생년월일로 접종일 계산 + 심장사상충 .ics" },
  { href: "weight-log/index.html", ic: "📈", n: "체중 기록·그래프", d: "브라우저 저장, CSV 내보내기, BCS 안내" },
  { href: "can-eat/index.html", ic: "🥗", n: "먹어도 되는 음식", d: `강아지 ${DOG_CANEAT.items.length}종·고양이 ${CAT_CANEAT.items.length}종 가능/주의/금지` },
  { href: "breed/index.html", ic: "📚", n: "견종 정보 백과", d: `${BREEDS.length}종의 체중·수명·호발 질환` },
  { href: "pregnancy/index.html", ic: "🐾", n: "임신·출산 예정일", d: "교배일 기준 63일과 확인 시점 일정" },
  { href: "heat-cycle/index.html", ic: "🌙", n: "발정 주기 계산기", d: "고양이 다음 발정 시기 예상" },
  { href: "pet-cost/index.html", ic: "💰", n: "양육비 계산기", d: "항목별 편집으로 월·연간·평생 비용" },
  { href: "name-gen/index.html", ic: "✨", n: "이름 짓기", d: "한글·먹을거리·자연·외국풍 사전에서 추천" },
  { href: "vet-consult/index.html", ic: "🏥", n: "수의사 상담 안내", d: "약 용량은 계산하지 않습니다 · 응급 신호 정리" },
];

buildPage({
  dir: "",
  title: "PetCalc — 강아지·고양이 계산기 모음 (나이·사료량·접종·체중)",
  desc: `반려동물 계산기 ${TOOL_CARDS.length}종을 한곳에. 강아지·고양이 나이 환산, RER·MER 사료 급여량, 예방접종 스케줄과 .ics, 체중 기록 그래프, 먹어도 되는 음식 ${DOG_CANEAT.items.length + CAT_CANEAT.items.length}종, 견종 ${BREEDS.length}종 정보까지 모두 무료로 제공합니다.`,
  h1: "PetCalc 반려동물 계산기",
  emoji: "🐾",
  lead: "나이·사료량·접종 일정·체중 기록까지. 설치도 가입도 없이 브라우저에서 바로 계산합니다.",
  crumbs: [{ name: "홈" }],
  health: true,
  ad: "none",
  bodyHtml: `<div class="tool-grid">
${TOOL_CARDS.map((t) => `  <a class="tool" href="${t.href}"><div class="t-ic">${t.ic}</div><div class="t-name">${esc(t.n)}</div><div class="t-desc">${esc(t.d)}</div></a>`).join("\n")}
</div>
<section class="card">
  <h2>많이 찾는 음식</h2>
  <div class="chip-list">
${DOG_CANEAT.items.filter((i) => i.verdict === "danger").slice(0, 6).map((i) => `    <a class="chip danger" href="dog/can-eat/${i.slug}/index.html">강아지 ${esc(i.name)}</a>`).join("\n")}
${CAT_CANEAT.items.filter((i) => i.verdict === "danger").slice(0, 4).map((i) => `    <a class="chip danger" href="cat/can-eat/${i.slug}/index.html">고양이 ${esc(i.name)}</a>`).join("\n")}
${DOG_CANEAT.items.filter((i) => i.verdict === "ok").slice(0, 4).map((i) => `    <a class="chip ok" href="dog/can-eat/${i.slug}/index.html">강아지 ${esc(i.name)}</a>`).join("\n")}
  </div>
  <p style="margin-top:12px"><a href="dog/can-eat/index.html">강아지 전체 목록</a> · <a href="cat/can-eat/index.html">고양이 전체 목록</a></p>
</section>
<section class="card">
  <h2>많이 찾는 견종</h2>
  <div class="chip-list">
${BREEDS.slice(0, 12).map((b) => `    <a class="chip" href="breed/${b.slug}/index.html">${esc(b.name)}</a>`).join("\n")}
  </div>
  <p style="margin-top:12px"><a href="breed/index.html">견종 백과 전체 보기</a></p>
</section>
<section class="card">
  <h2>가이드</h2>
  <div class="tool-grid">
    <a class="tool" href="guide/dog-food-basics/index.html"><div class="t-ic">📘</div><div class="t-name">강아지 사료 기본 가이드</div><div class="t-desc">열량 계산부터 사료 전환까지 순서대로</div></a>
    <a class="tool" href="guide/first-cat-checklist/index.html"><div class="t-ic">📋</div><div class="t-name">첫 고양이 준비 체크리스트</div><div class="t-desc">준비물·위험물·첫 2주 적응·병원 일정</div></a>
  </div>
</section>`,
  aboutHtml: `<h2>PetCalc은 어떤 사이트인가요?</h2>
<p>반려동물을 키우며 자주 찾게 되는 계산과 확인을 한곳에 모은 무료 도구 모음입니다. 모든 계산은 <b>브라우저에서만</b> 이뤄지고 입력값은 서버로 전송되지 않습니다. 가입도, 앱 설치도 필요 없습니다.</p>
<h2>이 사이트가 지키는 원칙</h2>
<ul>
<li><b>진단하지 않습니다.</b> 건강 관련 페이지에는 항상 수의사 상담 안내를 함께 표시합니다.</li>
<li><b>약 용량을 계산하지 않습니다.</b> 대신 <a href="vet-consult/index.html">언제 병원에 가야 하는지</a>를 정리했습니다.</li>
<li><b>근거를 밝힙니다.</b> 각 데이터에는 출처 링크와 확인일이 붙어 있습니다.</li>
<li><b>개인정보를 받지 않습니다.</b> 이름·연락처를 묻는 입력창이 없습니다.</li>
<li><b>보험·금융 상품을 비교하거나 추천하지 않습니다.</b></li>
</ul>
<h2>이렇게 쓰면 좋습니다</h2>
<ol>
<li>입양 직후 — <a href="vaccine/index.html">접종 스케줄</a>을 만들고 캘린더에 등록합니다.</li>
<li>매달 — <a href="weight-log/index.html">체중을 기록</a>하고 그래프로 흐름을 봅니다.</li>
<li>사료를 바꿀 때 — <a href="food-amount/index.html">급여량</a>을 다시 계산합니다.</li>
<li>사람 음식을 주기 전 — <a href="can-eat/index.html">먹어도 되는지</a> 먼저 확인합니다.</li>
</ol>`,
  faq: [
    { q: "정말 무료인가요?", a: "네. 모든 도구는 무료이며 회원가입이 없습니다. 사이트 운영은 광고 수익으로 이뤄집니다." },
    { q: "입력한 정보가 저장되나요?", a: "계산 입력값은 저장되지 않습니다. 체중 기록만 이용자 브라우저에 저장되며 서버로 전송되지 않습니다." },
    { q: "정보의 출처는 어디인가요?", a: "각 페이지 하단에 근거 자료의 링크와 확인일을 표시했습니다. 수의학 지침·중독 정보 기관·견종 단체의 공개 자료를 참고했습니다." },
    { q: "이 계산 결과로 진료를 대신할 수 있나요?", a: "아니요. 모든 내용은 참고용이며 진단이 아닙니다. 증상이 있다면 수의사에게 진료를 받으세요." },
  ],
  related: relatedBlock("", ["petAge", "petMeal", "petVetCost"], [
    { name: "먹어도 되는 음식 검색", href: "can-eat/index.html", ic: "🥗" },
    { name: "견종 정보 백과", href: "breed/index.html", ic: "📚" },
  ]),
});

/* ---------------- 17) sitemap · robots ---------------- */
const priorityOf = (d) => (d === "" ? "1.0" : d.split("/").length === 1 ? "0.9" : d.split("/").length === 2 ? "0.7" : "0.6");
const today = "2026-08-19";
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  PAGES.map((d) => `  <url><loc>${canonOf(d)}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${priorityOf(d)}</priority></url>`).join("\n") +
  "\n</urlset>\n";
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");

fs.writeFileSync(
  path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
  "utf8"
);

const ms = Date.now() - T0;
console.log(`생성 완료: ${PAGES.length}개 페이지 · sitemap.xml · robots.txt`);
console.log(`  - can-eat 롱테일: 강아지 ${DOG_CANEAT.items.length} + 고양이 ${CAT_CANEAT.items.length} = ${DOG_CANEAT.items.length + CAT_CANEAT.items.length}`);
console.log(`  - 견종 롱테일: ${BREEDS.length}`);
console.log(`  - 빌드 시간: ${ms}ms · 경고 ${WARN}건`);
if (WARN > 0) process.exitCode = 1;
