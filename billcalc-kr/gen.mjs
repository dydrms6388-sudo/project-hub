// billcalc-kr 정적 페이지 생성기 (Node 내장만 사용, 의존성 0)
// 실행: node billcalc-kr/gen.mjs
// 생성물: index.html, <tool>/index.html × 10, appliance/index.html + 가전 롱테일,
//        privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPLIANCES, CATS } from "./data/appliances.mjs";
import { TARIFF } from "./data/electric.mjs";
import { GAS } from "./data/gas.mjs";

const SITE_ORIGIN = "https://billcalc-kr.vercel.app";
const SITE_NAME = "전기가스요금 계산기 허브";
const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const KEPCO = TARIFF.meta.source;
const BASIS = TARIFF.meta.revision; // "2023년 5월 16일 개정 기준"

const TEC = "https://tomatoeggcat.com/electric-bill-calc/";
const TPY = "https://tomatoeggcat.com/pyeong-electric/";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 공통 HTML 셸 ───────────────────────────────────────────── */
function shell(p) {
  const path = p.path;                                  // "" | "ac-cost/" | "appliance/tv-55/" | "privacy.html"
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

  const crumbNav = `<nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">⚡ ${SITE_NAME}</a>` +
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
<script>try{var t=localStorage.getItem('bc-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
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
    <p style="margin:0 0 8px">⚡ <a href="${HOME}">${SITE_NAME}</a></p>
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
const ELEC_BASIS = `<h2>요금표 기준일과 출처</h2>
    <p class="note">전기요금 단가는 <strong>${BASIS}</strong>의 주택용 전력 요금표를 사용합니다(데이터 확인일 ${TODAY}).
    연료비조정요금은 분기마다, 전력산업기반기금 요율은 제도 개정에 따라 바뀌므로
    최신 단가는 <a href="${KEPCO}" target="_blank" rel="noopener">한국전력 사이버지점 요금표</a>에서 확인하고,
    고지서 값과 다르면 각 계산기의 <strong>고급 설정</strong>에서 직접 수정해 계산하세요.</p>`;

const GAS_BASIS = `<h2>도시가스 단가 기준</h2>
    <p class="note">도시가스 소매 단가(원/MJ)·기본요금·평균열량(MJ/㎥)은 <strong>지역 도시가스사가 각각 고시</strong>하므로
    전국 공통값이 없습니다. 이 사이트는 단가를 임의로 넣지 않고 <span class="badge warn">확인 필요</span> 표시와 함께
    직접 입력받습니다. 내 지역 단가는
    <a href="https://www.citygas.or.kr" target="_blank" rel="noopener">한국도시가스협회</a>에서 지역사를 찾아 확인하거나
    고지서의 단가·평균열량을 그대로 입력하세요. (데이터 확인일 ${TODAY})</p>`;

const DISC = (extra = "") => `<p class="disclaimer">본 결과는 참고용 추정치이며 실제 청구 금액을 확정하지 않습니다. ${extra}
    정확한 금액은 <a href="https://cyber.kepco.co.kr" target="_blank" rel="noopener">한국전력 사이버지점</a> 또는 고지서에서 확인하세요.</p>`;

const ADV_ELEC = `<details class="adv">
      <summary>고급 설정 — 연료비조정·기금 요율 직접 수정</summary>
      <div class="grid2">
        <label class="f">연료비조정요금 <span class="u">(원/kWh, 한도 ±5)</span>
          <input type="number" id="fuelAdj" step="0.1" value="5" />
        </label>
        <label class="f">전력산업기반기금 <span class="u">(%, 2025.7부터 2.7)</span>
          <input type="number" id="fundRate" step="0.1" value="2.7" />
        </label>
      </div>
    </details>`;

const MONTH_VOLT = `<div class="grid2">
      <label class="f">계산 월 <span class="u">(7~8월 하계 구간)</span>
        <select id="month"></select>
      </label>
      <label class="f">계약 종류
        <select id="voltage"><option value="low">저압 (대부분 가정)</option><option value="high">고압 (아파트 일괄계약)</option></select>
      </label>
    </div>`;

const MONTH_FILL = `const monthSel = $("month");
const nowM = new Date().getMonth() + 1;
for (let m = 1; m <= 12; m++) { const o = document.createElement("option"); o.value = m; o.textContent = m + "월" + (m === 7 || m === 8 ? " (하계)" : ""); if (m === nowM) o.selected = true; monthSel.appendChild(o); }`;

const CROSS = [
  { url: TEC, e: "🔌", n: "전기요금시뮬 (TomatoEggCat)" },
  { url: TPY, e: "🏠", n: "평수별 전기요금 (TomatoEggCat)" },
];

/* ── 도구 정의 ──────────────────────────────────────────────── */
const TOOLS = [
{
  slug: "electric-bill", emoji: "⚡", nav: "전기요금 계산기",
  hubName: "전기요금 계산기", hubDesc: "kWh만 넣으면 누진 3단계·기본요금·기후환경·연료비조정·부가세·전력기금까지 항목별로 전부 보여줍니다.",
  title: "전기요금 계산기 — 누진세 구간·항목별 산출 과정 전부 표시",
  ogTitle: "전기요금 계산기 — 누진세 항목별 산출",
  desc: "월 사용량 kWh만 입력하면 주택용 전기요금을 기본요금·전력량요금(누진 3단계)·기후환경요금·연료비조정요금·부가세·전력기금까지 항목별로 계산합니다. 하계(7~8월) 누진 완화 구간 자동 적용.",
  h1: "전기요금 계산기",
  lead: `월 사용량(kWh)만 넣으면 누진 3단계·하계 완화 구간·부가세·전력기금까지 <strong>산출 과정을 전부</strong> 보여드립니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>사용량 입력</h2>
    <div class="grid2">
      <label class="f">월 사용량 <span class="u">(kWh)</span>
        <input type="number" id="kwh" inputmode="decimal" min="0" step="1" value="350" />
      </label>
      <label class="f">계산 월 <span class="u">(하계 7~8월 자동 반영)</span>
        <select id="month"></select>
      </label>
    </div>
    <div style="margin-top:12px">
      <span class="f" style="display:block">계약 종류</span>
      <div class="seg" id="voltSeg" role="group" aria-label="계약 종류">
        <button type="button" data-v="low" aria-pressed="true">저압 (대부분 가정)</button>
        <button type="button" data-v="high" aria-pressed="false">고압 (아파트 일괄계약)</button>
      </div>
    </div>
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">전기요금 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">예상 청구금액 <span class="num" id="totalOut"></span></p>
      <p class="note" id="tierOut"></p>
      <div id="tableOut"></div>
      <p class="note">※ 복지할인·필수공제 등 개별 할인 미반영. 검침일에 따라 두 계절 요금이 일할 혼합될 수 있어 실제 고지서와 다를 수 있습니다.</p>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>이 계산기는 무엇을 하나요?</h2>
    <p>주택용 전기요금은 단순히 "사용량 × 단가"가 아닙니다. 누진 3단계 전력량요금에 구간별 기본요금, 기후환경요금, 연료비조정요금이 더해지고, 그 합계에 부가가치세 10%와 전력산업기반기금이 붙어 최종 청구금액이 됩니다. 이 계산기는 그 과정을 항목별로 전부 펼쳐 보여주기 때문에, 고지서의 어떤 항목이 왜 그 금액인지 그대로 대조할 수 있습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>고지서 또는 한전 앱에서 이번 달 사용량(kWh)을 확인해 입력합니다.</li>
      <li>계산 월을 고릅니다 — 7·8월은 하계 완화 구간(300/450kWh)이 자동 적용됩니다.</li>
      <li>저압/고압을 선택합니다. 아파트 관리비에 전기요금이 포함돼 나오면 대부분 고압(단지 일괄계약)입니다.</li>
      <li>결과에서 항목별 산출 과정과 예상 청구금액을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "누진 구간을 조금 넘으면 요금이 확 뛰나요?", a: "초과분에만 높은 단가가 적용되지만, 구간이 올라가면 기본요금 자체도 함께 뛰기 때문에(예: 저압 1,600원 → 7,300원) 경계 근처에서는 몇 kWh 차이로 수천 원이 달라질 수 있습니다." },
    { q: "검침일이 달라도 계산이 맞나요?", a: "검침 주기가 월과 어긋나면 하계·기타계절 요금이 날짜 비례로 혼합 적용됩니다. 이 계산기는 한 계절 기준의 근사치이므로 계절이 바뀌는 달에는 실제와 차이가 있을 수 있습니다." },
    { q: "연료비조정요금은 왜 직접 수정할 수 있게 했나요?", a: "분기마다 ±5원/kWh 한도에서 조정되는 항목이라서입니다. 고지서에 표기된 값이 다르면 고급 설정에서 바꿔 계산하세요." },
    { q: "1,000kWh 넘게 쓰면 어떻게 되나요?", a: "하계(7~8월)·동계(12~2월)에는 1,000kWh 초과분에 슈퍼유저 요금(저압 736.2원/kWh)이 적용됩니다. 이 계산기도 자동 반영합니다." },
  ],
  script: `import { calcBill } from "__U__lib/elec.mjs";
import { won, num, showAd, initTheme, segInit, billTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
let voltage = "low";
segInit($("voltSeg"), (v) => { voltage = v; });
$("calcBtn").addEventListener("click", () => {
  const r = calcBill(num($("kwh")), { month: +monthSel.value, voltage, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 });
  $("totalOut").textContent = won(r.total);
  $("tierOut").textContent = (r.isSummer ? "하계(7~8월) 완화 구간" : "기타계절 구간") + " 적용 · 누진 " + r.tier + "단계 (경계 " + r.brackets[0] + "/" + r.brackets[1] + "kWh) · " + r.voltageLabel;
  $("tableOut").innerHTML = billTableHtml(r);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "ac-cost", e: "❄️", n: "에어컨 전기요금 계산기" }, { slug: "save-simulator", e: "📉", n: "전기요금 절약 시뮬레이터" }, { slug: "bill-reader", e: "📄", n: "고지서 보는 법·검산" }],
},

{
  slug: "ac-cost", emoji: "❄️", nav: "에어컨 전기요금",
  hubName: "에어컨 전기요금 계산기", hubDesc: "기존 사용량을 함께 넣어 <strong>누진 구간 이동</strong>까지 반영한 '진짜 추가 요금'을 계산합니다.",
  title: "에어컨 전기요금 계산기 — 누진 구간 이동까지 반영한 진짜 증가액",
  ogTitle: "에어컨 전기요금, 실제로 얼마나 더 나올까",
  desc: "에어컨을 켜면 요금이 얼마나 더 나올까? 기존 월 사용량을 함께 입력해 누진 구간이 올라가면서 생기는 실제 증가액을 계산합니다. 단순 곱셈 추정치와 얼마나 차이 나는지도 함께 보여줍니다.",
  h1: "에어컨 전기요금 계산기",
  lead: `"1.8kW × 8시간 = 얼마" 식 계산은 틀립니다. 기존 사용량을 넣어 <strong>누진 구간 이동으로 인한 실제 증가액</strong>을 계산하세요.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>1. 에어컨을 켜기 전 사용량</h2>
    <label class="f">에어컨 제외 월 사용량 <span class="u">(kWh · 지난달 고지서 참고)</span>
      <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="250" />
    </label>
    <p class="note">이 값이 핵심입니다. 같은 에어컨을 써도 기존 사용량이 200kWh인 집과 380kWh인 집은 추가 요금이 두 배 이상 차이 날 수 있습니다.</p>
  </section>

  <section class="card" aria-label="에어컨 설정">
    <h2>2. 에어컨 사용 조건</h2>
    <div class="grid2">
      <label class="f">기기 종류 <span class="u">(선택 시 소비전력 자동)</span>
        <select id="preset">
          <option value="800">벽걸이 (약 800W)</option>
          <option value="1800" selected>스탠드 (약 1,800W)</option>
          <option value="500">인버터 벽걸이 절전운전 (약 500W)</option>
          <option value="1100">인버터 스탠드 절전운전 (약 1,100W)</option>
          <option value="">직접 입력</option>
        </select>
      </label>
      <label class="f">소비전력 <span class="u">(W · 제품 라벨값 권장)</span>
        <input type="number" id="watt" inputmode="decimal" min="0" step="10" value="1800" />
      </label>
      <label class="f">하루 사용 시간 <span class="u">(시간)</span>
        <input type="number" id="hours" inputmode="decimal" min="0" step="0.5" value="8" />
      </label>
      <label class="f">한 달 사용 일수 <span class="u">(일)</span>
        <input type="number" id="days" inputmode="decimal" min="0" max="31" step="1" value="30" />
      </label>
    </div>
    ${MONTH_VOLT}
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">추가 요금 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">에어컨 때문에 늘어나는 금액 <span class="num" id="totalOut"></span></p>
      <p class="note">에어컨 월 사용량 <strong id="addOut"></strong> 기준</p>
      <div id="cmpOut"></div>
    </div>
    <div class="card">
      <h2>에어컨 포함 전체 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>왜 "소비전력 × 시간 × 단가"로 계산하면 틀리나요?</h2>
    <p>주택용 전기요금은 누진제입니다. 추가된 사용량은 언제나 <strong>내가 쓰던 사용량 위에</strong> 얹히기 때문에, 에어컨이 만들어낸 100kWh는 1단계 단가가 아니라 2·3단계 단가로 계산됩니다. 게다가 구간이 올라가면 기본요금(저압 기준 910원 → 1,600원 → 7,300원)까지 함께 뛰고, 그 합계에 부가세 10%와 전력산업기반기금이 다시 붙습니다.</p>
    <p>그래서 이 계산기는 "에어컨만의 요금"을 따로 구하지 않고, <strong>에어컨을 켜기 전 청구액과 켠 뒤 청구액의 차이</strong>를 구합니다. 결과에는 흔히 쓰는 단순 곱셈 추정치와의 차액(= 누진 이동으로 인한 추가 부담)도 함께 표시됩니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>지난달 고지서에서 사용량을 확인해 "에어컨 제외 월 사용량"에 넣습니다. 여름 이전(5~6월) 사용량이 기준으로 쓰기 좋습니다.</li>
      <li>기기 종류를 고르거나 제품 라벨의 냉방 소비전력(W)을 직접 입력합니다.</li>
      <li>하루 사용 시간과 사용 일수를 넣고 계산합니다. 인버터 에어컨은 설정 온도 도달 후 소비전력이 크게 떨어지므로, 라벨값 그대로 넣으면 다소 과대 추정됩니다.</li>
      <li>결과에서 실제 증가액·1kWh당 실질 부담·누진 단계 이동 여부를 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "인버터 에어컨도 라벨의 소비전력을 그대로 넣나요?", a: "인버터 제품은 설정 온도에 도달하면 소비전력이 정격의 30~60% 수준으로 떨어집니다. 라벨값을 그대로 넣으면 과대 추정이 되므로, 하루 종일 켜두는 사용 패턴이라면 절전운전 프리셋이나 라벨값의 절반 정도를 넣어 함께 비교해 보세요." },
    { q: "왜 단순 곱셈보다 금액이 크게 나오나요?", a: "추가 사용량이 상위 누진 구간에 걸리기 때문입니다. 예를 들어 기존 180kWh를 쓰던 집이 100kWh를 더 쓰면 1단계에서 2단계로 올라가면서 기본요금까지 함께 오릅니다. 결과 표의 '누진 이동으로 인한 추가 부담' 줄에서 그 차액을 확인할 수 있습니다." },
    { q: "24시간 켜두는 게 더 싸다는 말은 사실인가요?", a: "인버터 제품에서 짧게 자주 껐다 켜는 것보다 연속 운전이 유리한 구간이 있는 것은 맞지만, 하루 종일 켜두면 총 사용량 자체가 늘어 누진 구간이 올라갑니다. 이 계산기로 '8시간 운전'과 '24시간 운전'을 각각 계산해 증가액을 직접 비교해 보세요." },
    { q: "여름에는 요금이 덜 오르나요?", a: "7~8월에는 누진 구간이 300/450kWh로 완화되어 같은 사용량이라도 낮은 단계에 머무를 수 있습니다. 계산 월을 7·8월로 두면 이 완화 구간이 자동 반영됩니다." },
  ],
  script: `import { calcDelta, naiveDelta, kwhOf } from "__U__lib/elec.mjs";
import { won, num, kwhFmt, showAd, initTheme, billTableHtml, deltaTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("preset").addEventListener("change", (e) => { if (e.target.value) $("watt").value = e.target.value; });
$("calcBtn").addEventListener("click", () => {
  const add = kwhOf(num($("watt"), 1800), num($("hours"), 8), num($("days"), 30));
  const base = num($("baseKwh"), 250);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const d = calcDelta(base, add, opts);
  const nv = naiveDelta(base, add, opts);
  $("totalOut").textContent = won(d.delta);
  $("addOut").textContent = kwhFmt(add);
  $("cmpOut").innerHTML = deltaTableHtml(d, nv, "에어컨");
  $("tableOut").innerHTML = billTableHtml(d.after);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }, { slug: "appliance-cost", e: "🔌", n: "가전제품 전기요금" }, { slug: "save-simulator", e: "📉", n: "절약 시뮬레이터" }],
},

{
  slug: "appliance-cost", emoji: "🔌", nav: "가전제품 전기요금",
  hubName: "가전제품 전기요금 계산기", hubDesc: "60여 종 가전의 참고 소비전력으로 한 달 요금과 누진 반영 증가액을 계산합니다.",
  title: "가전제품 전기요금 계산기 — 소비전력(W)으로 월 요금 계산",
  desc: "냉장고·건조기·에어프라이어·게이밍 PC 등 가전제품의 소비전력(W)과 사용 시간을 넣으면 월 사용량(kWh)과 누진 구간을 반영한 실제 요금 증가액을 계산합니다.",
  h1: "가전제품 전기요금 계산기",
  lead: `기기를 고르면 참고 소비전력이 채워집니다. 기존 사용량을 함께 넣으면 <strong>누진 반영 증가액</strong>까지 계산합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>기기와 사용 시간</h2>
    <label class="f">가전제품 선택
      <select id="app"></select>
    </label>
    <div class="grid2" style="margin-top:12px">
      <label class="f">소비전력 <span class="u">(W · 라벨값 권장)</span>
        <input type="number" id="watt" inputmode="decimal" min="0" step="10" value="40" />
      </label>
      <label class="f">하루 사용 시간 <span class="u">(시간)</span>
        <input type="number" id="hours" inputmode="decimal" min="0" max="24" step="0.5" value="24" />
      </label>
      <label class="f">한 달 사용 일수 <span class="u">(일)</span>
        <input type="number" id="days" inputmode="decimal" min="0" max="31" step="1" value="30" />
      </label>
      <label class="f">기기 대수
        <input type="number" id="qty" inputmode="numeric" min="1" step="1" value="1" />
      </label>
    </div>
    <label class="f" style="margin-top:12px">이 기기를 뺀 월 사용량 <span class="u">(kWh · 누진 반영용)</span>
      <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="250" />
    </label>
    ${MONTH_VOLT}
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">전기요금 계산하기</button>
    <p class="note" id="noteOut"></p>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">이 기기 때문에 늘어나는 금액 <span class="num" id="totalOut"></span></p>
      <p class="note">월 사용량 <strong id="addOut"></strong> · 하루 <span id="dayOut"></span> · 1년 <span id="yearOut"></span></p>
      <div id="cmpOut"></div>
      <p class="note" id="linkOut"></p>
    </div>
    <div class="card">
      <h2>이 기기 포함 전체 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>가전 소비전력, 어디까지 믿어야 하나요?</h2>
    <p>제품 라벨의 정격 소비전력은 "최대로 쓸 때"의 값인 경우가 많습니다. 냉장고처럼 압축기가 껐다 켜지는 기기는 24시간 정격으로 도는 게 아니라 실제 평균은 훨씬 낮고, 세탁기·식기세척기처럼 물을 데우는 기기는 히터가 도는 구간에만 전력이 몰립니다. 그래서 이 계산기의 기본값은 <strong>일반적인 참고 범위의 대표값</strong>이며, 정확한 계산을 원하면 제품 라벨이나 에너지소비효율등급 라벨의 값을 직접 넣는 것이 좋습니다.</p>
    <p>냉장고·김치냉장고처럼 라벨에 "월간 소비전력량(kWh/월)"이 적혀 있으면 그 값이 가장 정확합니다. 월간 kWh를 30일·24시간으로 나눠 평균 W로 환산해 넣으세요(예: 월 30kWh ÷ 720시간 × 1000 ≈ 42W).</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>목록에서 기기를 고르면 참고 소비전력과 일반적인 사용 시간이 자동으로 채워집니다.</li>
      <li>제품 라벨의 값이 있으면 소비전력(W)을 직접 수정합니다.</li>
      <li>이 기기를 제외한 월 사용량을 넣으면 누진 단계를 반영한 실제 증가액이 계산됩니다.</li>
      <li>기기별 상세 페이지에서는 같은 계산이 미리 채워진 상태로 열립니다.</li>
    </ol>`,
  faq: [
    { q: "왜 기기마다 요금이 이렇게 다르게 나오나요?", a: "소비전력(W)과 사용 시간의 곱이 사용량을 결정하기 때문입니다. 1,500W 헤어드라이어를 하루 10분 쓰면 월 7.5kWh지만, 15W 셋톱박스를 24시간 켜두면 월 10.8kWh로 오히려 더 많습니다." },
    { q: "누진 반영 증가액과 단순 요금은 뭐가 다른가요?", a: "단순 요금은 1단계 단가 등 하나의 단가로만 곱한 값이고, 누진 반영 증가액은 기존 사용량 위에 이 기기의 사용량이 얹혔을 때 청구서가 실제로 얼마나 늘어나는지를 계산한 값입니다. 사용량이 많은 집일수록 차이가 커집니다." },
    { q: "대기전력은 포함되나요?", a: "여기서는 사용 시간 동안의 소비전력만 계산합니다. 꺼져 있어도 소모되는 대기전력은 대기전력 계산기에서 따로 확인하세요." },
  ],
  script: `import { calcDelta, naiveDelta, kwhOf } from "__U__lib/elec.mjs";
import { APPLIANCES, CATS, APPLIANCE_SOURCE } from "__U__data/appliances.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, deltaTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
const sel = $("app");
for (const key of Object.keys(CATS)) {
  const g = document.createElement("optgroup"); g.label = CATS[key];
  for (const a of APPLIANCES.filter((x) => x.cat === key)) {
    const o = document.createElement("option"); o.value = a.slug; o.textContent = a.name + " (약 " + a.w + "W)"; g.appendChild(o);
  }
  sel.appendChild(g);
}
const find = (s) => APPLIANCES.find((a) => a.slug === s);
function fill() {
  const a = find(sel.value); if (!a) return;
  $("watt").value = a.w; $("hours").value = a.h;
  $("noteOut").innerHTML = "참고 범위 " + a.range[0] + "~" + a.range[1] + "W · " + (a.note || "제품·용량·모드에 따라 편차가 있습니다.") + " (출처: " + APPLIANCE_SOURCE.name + ")";
}
sel.value = "refrigerator"; fill();
sel.addEventListener("change", fill);
$("calcBtn").addEventListener("click", () => {
  const qty = Math.max(1, num($("qty"), 1));
  const add = kwhOf(num($("watt"), 40), num($("hours"), 24), num($("days"), 30)) * qty;
  const base = num($("baseKwh"), 250);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const d = calcDelta(base, add, opts);
  const nv = naiveDelta(base, add, opts);
  $("totalOut").textContent = won(d.delta);
  $("addOut").textContent = kwhFmt(add);
  $("dayOut").textContent = kwhFmt(add / Math.max(1, num($("days"), 30)));
  $("yearOut").textContent = won(d.delta * 12) + " 수준";
  $("cmpOut").innerHTML = deltaTableHtml(d, nv, find(sel.value) ? find(sel.value).name : "기기");
  $("tableOut").innerHTML = billTableHtml(d.after);
  const a = find(sel.value);
  $("linkOut").textContent = "";
  if (a) {
    const link = document.createElement("a");
    link.href = "__U__appliance/" + a.slug + "/";
    link.textContent = a.name + " 전기요금 자세히 보기";
    $("linkOut").append("이 기기만 따로 보기 → ", link);
  }
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "appliance", e: "📚", n: "가전제품별 전기요금 목록" }, { slug: "standby-power", e: "🔋", n: "대기전력 계산기" }, { slug: "ac-cost", e: "❄️", n: "에어컨 전기요금" }],
},

{
  slug: "standby-power", emoji: "🔋", nav: "대기전력 계산기",
  hubName: "대기전력 계산기", hubDesc: "플러그만 꽂아둬도 새는 전기, 1년에 얼마인지 기기별로 합산합니다.",
  title: "대기전력 계산기 — 플러그 뽑으면 1년에 얼마 아낄까",
  desc: "셋톱박스·공유기·전자레인지 등 대기전력 기기의 소비전력을 합산해 월·연간 사용량과 절감액을 누진 구간까지 반영해 계산합니다.",
  h1: "대기전력 계산기",
  lead: `꺼둬도 새는 전기를 기기별로 합산해 <strong>월·연간 절감액</strong>을 계산합니다. 값은 모두 수정할 수 있습니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>우리 집 대기전력 기기</h2>
    <div class="tbl-scroll"><table class="tbl" id="stbTable">
      <thead><tr><th>기기</th><th>대기전력(W)</th><th>대수</th></tr></thead>
      <tbody id="stbBody"></tbody>
    </table></div>
    <p class="note" id="srcNote"></p>
    <label class="f" style="margin-top:12px">현재 월 사용량 <span class="u">(kWh · 누진 반영용)</span>
      <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="300" />
    </label>
    ${MONTH_VOLT}
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">대기전력 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">모두 차단하면 1년에 <span class="num" id="totalOut"></span></p>
      <p class="note">대기전력 합계 <strong id="wOut"></strong> · 월 <span id="mOut"></span> · 연 <span id="yOut"></span></p>
      <div id="cmpOut"></div>
      <p class="note">※ 공유기·냉장고처럼 항상 켜둬야 하는 기기는 차단 대상에서 빼고 계산하세요(대수를 0으로).</p>
    </div>
    <div class="card">
      <h2>대기전력 차단 후 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>대기전력은 정말 무시 못 할까?</h2>
    <p>개별 기기의 대기전력은 1~15W로 작지만, 24시간 365일 켜져 있다는 점이 다릅니다. 12W짜리 셋톱박스 하나만 해도 1년이면 약 105kWh — 웬만한 가전 하나를 더 쓰는 셈입니다. 여기에 누진제가 붙으면 사용량이 많은 집일수록 같은 1kWh의 값이 더 비싸집니다.</p>
    <p>다만 최신 기기는 대기전력 저감 기준(대체로 1W 이하)을 맞춰 나오기 때문에 오래된 기기일수록 효과가 큽니다. 이 계산기의 기본값은 참고 범위이며, 대기전력 측정 콘센트로 실측한 값이 있으면 그 값을 넣으세요.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>집에 있는 기기의 대수를 조정합니다(없으면 0).</li>
      <li>실측값이 있으면 대기전력(W)을 직접 수정합니다.</li>
      <li>현재 월 사용량을 넣으면 누진 단계를 반영한 절감액이 계산됩니다.</li>
      <li>결과의 연간 절감액을 보고 멀티탭 스위치·타이머 콘센트 도입을 판단하세요.</li>
    </ol>`,
  faq: [
    { q: "공유기도 뽑는 게 좋나요?", a: "인터넷 공유기와 모뎀은 항상 연결돼 있어야 하는 기기라 차단을 권하지 않습니다. 대신 잘 쓰지 않는 시간대(외출·취침)에 타이머 콘센트로 제어하는 방법이 있습니다." },
    { q: "TV를 뽑으면 설정이 초기화되지 않나요?", a: "최신 TV는 대기전력이 1W 이하로 낮고 뽑았다 꽂으면 채널 검색 등이 필요할 수 있어 실익이 크지 않습니다. 오래된 셋톱박스나 오디오, 사용하지 않는 방의 기기부터 차단하는 편이 효율적입니다." },
    { q: "냉장고나 비데도 차단 대상인가요?", a: "냉장고는 차단 대상이 아닙니다. 비데는 저장식 온수를 유지하는 제품의 대기 소비가 큰 편이라 절전 모드나 순간온수식 사용을 검토할 만합니다." },
  ],
  script: `import { calcBill } from "__U__lib/elec.mjs";
import { STANDBY_ITEMS, STANDBY_SOURCE } from "__U__data/misc.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
const body = $("stbBody");
for (const it of STANDBY_ITEMS) {
  const tr = document.createElement("tr");
  tr.innerHTML = '<td>' + it.name + (it.note ? ' <span class="mut">' + it.note + '</span>' : '') + '</td>' +
    '<td><input type="number" step="0.1" min="0" value="' + it.w + '" data-w="' + it.slug + '" style="max-width:96px" /></td>' +
    '<td><input type="number" step="1" min="0" value="1" data-q="' + it.slug + '" style="max-width:72px" /></td>';
  body.appendChild(tr);
}
$("srcNote").innerHTML = "참고 출처: " + STANDBY_SOURCE.name + " · " + STANDBY_SOURCE.note;
$("calcBtn").addEventListener("click", () => {
  let watt = 0;
  const rows = [];
  for (const it of STANDBY_ITEMS) {
    const w = num(document.querySelector('[data-w="' + it.slug + '"]'), it.w);
    const q = Math.max(0, num(document.querySelector('[data-q="' + it.slug + '"]'), 0));
    if (q > 0) { watt += w * q; rows.push({ name: it.name, w: w * q, kwh: (w * q * 24 * 365) / 1000 }); }
  }
  const monthKwh = (watt * 24 * 30) / 1000;
  const yearKwh = (watt * 24 * 365) / 1000;
  const base = num($("baseKwh"), 300);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const before = calcBill(base, opts);
  const after = calcBill(Math.max(0, base - monthKwh), opts);
  const save = before.total - after.total;
  $("totalOut").textContent = won(save * 12);
  $("wOut").textContent = fmt(watt) + "W";
  $("mOut").textContent = kwhFmt(monthKwh) + " / " + won(save);
  $("yOut").textContent = kwhFmt(yearKwh);
  rows.sort((a, b) => b.kwh - a.kwh);
  const perKwh = monthKwh > 0 ? save / monthKwh : 0;
  $("cmpOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>기기</th><th>연간 사용량</th><th>연간 요금</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + r.name + ' <span class="mut">' + fmt(r.w) + 'W</span></td><td>' + kwhFmt(r.kwh) + '</td><td>' + won(r.kwh * perKwh) + '</td></tr>').join('') +
    '<tr class="sum"><td>합계 (차단 시 절감)</td><td>' + kwhFmt(yearKwh) + '</td><td>' + won(save * 12) + '</td></tr>' +
    '</tbody></table></div><div class="note">현재 사용량 ' + kwhFmt(base) + ' 기준 1kWh당 실질 단가 ' + fmt(perKwh) + '원으로 배분했습니다. 누진 ' + before.tier + '단계 → ' + after.tier + '단계.</div>';
  $("tableOut").innerHTML = billTableHtml(after);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "appliance-cost", e: "🔌", n: "가전제품 전기요금" }, { slug: "save-simulator", e: "📉", n: "절약 시뮬레이터" }, { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }],
},

{
  slug: "heating-cost", emoji: "🔥", nav: "난방비 비교",
  hubName: "난방비 비교 계산기", hubDesc: "전기히터·전기장판과 가스보일러 난방비를 같은 조건에서 비교합니다.",
  title: "난방비 계산기 — 전기난방 vs 가스보일러 요금 비교",
  desc: "전기히터·전기장판·온수매트의 전기요금 증가액(누진 반영)과 가스보일러 도시가스 요금을 같은 화면에서 비교합니다. 가스 단가는 지역 고시값을 직접 입력합니다.",
  h1: "난방비 비교 계산기",
  lead: `전기난방은 <strong>누진 구간 이동</strong>까지, 가스난방은 <strong>지역 단가</strong>를 넣어 한 달 난방비를 비교합니다.`,
  body: `
  <section class="card" aria-label="전기난방 입력">
    <h2>1. 전기 난방기기</h2>
    <div class="grid2">
      <label class="f">기기 종류
        <select id="preset">
          <option value="1500">전기히터·온풍기 (약 1,500W)</option>
          <option value="150">전기장판 더블 (약 150W)</option>
          <option value="240">온수매트 (약 240W)</option>
          <option value="1500">전기 라디에이터 (약 1,500W)</option>
          <option value="">직접 입력</option>
        </select>
      </label>
      <label class="f">소비전력 <span class="u">(W)</span>
        <input type="number" id="watt" inputmode="decimal" min="0" step="10" value="1500" />
      </label>
      <label class="f">하루 사용 시간 <span class="u">(시간)</span>
        <input type="number" id="hours" inputmode="decimal" min="0" step="0.5" value="5" />
      </label>
      <label class="f">한 달 사용 일수 <span class="u">(일)</span>
        <input type="number" id="days" inputmode="decimal" min="0" max="31" step="1" value="30" />
      </label>
    </div>
    <label class="f" style="margin-top:12px">난방기기 제외 월 사용량 <span class="u">(kWh)</span>
      <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="300" />
    </label>
    ${MONTH_VOLT}
    ${ADV_ELEC}
  </section>

  <section class="card" aria-label="가스난방 입력">
    <h2>2. 가스보일러 <span class="badge warn">단가 확인 필요</span></h2>
    <div class="grid2">
      <label class="f">월 도시가스 사용량 <span class="u">(㎥)</span>
        <input type="number" id="m3" inputmode="decimal" min="0" step="1" value="100" />
      </label>
      <label class="f">단가 <span class="u">(원/MJ · 고지서 값)</span>
        <input type="number" id="price" inputmode="decimal" min="0" step="0.01" value="" placeholder="예: 20.00" />
      </label>
      <label class="f">평균열량 <span class="u">(MJ/㎥ · 고지서 값)</span>
        <input type="number" id="factor" inputmode="decimal" min="1" step="0.1" value="${GAS.heatFactor.value}" />
      </label>
      <label class="f">월 기본요금 <span class="u">(원)</span>
        <input type="number" id="baseCharge" inputmode="decimal" min="0" step="10" value="1000" />
      </label>
    </div>
    <p class="note">도시가스 단가·기본요금은 지역 도시가스사가 고시하므로 전국 공통값이 없습니다. 값을 지어내지 않고 <strong>고지서에 적힌 숫자를 그대로 입력</strong>하도록 비워 두었습니다.</p>
    <button class="btn" id="calcBtn">난방비 비교하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>비교 결과</h2>
      <p class="big" id="verdict"></p>
      <div id="cmpOut"></div>
      <p class="note">※ 전기난방은 전기에너지가 그대로 열이 되지만(효율 100%), 가스보일러는 배기 손실이 있어 실제 열효율은 80~95% 수준입니다. 같은 열량을 내려면 가스 사용량이 조금 더 필요합니다.</p>
    </div>
    <div class="card">
      <h2>전기요금 산출 과정 (난방기기 포함)</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
    <div id="gasSrcOut"></div>
  </section>`,
  intro: `<h2>전기난방이 비싼 이유</h2>
    <p>1kWh의 열을 만드는 데 드는 돈만 놓고 보면 도시가스가 전기보다 훨씬 쌉니다. 전기는 발전소에서 만든 에너지를 다시 열로 바꾸는 구조라 단가 자체가 높고, 여기에 누진제가 붙어 겨울철 사용량이 늘어날수록 1kWh당 실질 단가가 계속 올라갑니다. 반면 도시가스는 누진 구조가 아니라 사용량에 비례합니다.</p>
    <p>그래서 "전기히터 하나쯤이야" 하고 켠 1,500W 기기를 하루 5시간 쓰면 월 225kWh — 웬만한 가구의 한 달 사용량이 두 배가 되면서 누진 3단계로 올라갑니다. 이 계산기는 그 증가액을 가스요금과 나란히 보여줍니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>전기 난방기기의 종류·사용 시간과, 난방기기를 제외한 월 사용량을 입력합니다.</li>
      <li>가스 고지서에서 단가(원/MJ)·평균열량(MJ/㎥)·기본요금을 찾아 그대로 입력합니다.</li>
      <li>비교 결과에서 어느 쪽이 얼마나 저렴한지, 전기요금은 누진 몇 단계로 올라가는지 확인합니다.</li>
      <li>가스 단가를 모르면 지역 도시가스사 링크에서 확인하세요.</li>
    </ol>`,
  faq: [
    { q: "가스 단가를 왜 미리 넣어두지 않았나요?", a: "도시가스 소매 단가는 지역 도시가스사별·용도별·시기별로 달라 전국 공통값이 없습니다. 확신할 수 없는 숫자를 기본값으로 넣으면 계산 결과 전체가 틀리기 때문에, 고지서 값을 직접 입력하도록 했습니다." },
    { q: "전기장판은 전기난방인데도 왜 싸게 나오나요?", a: "전기장판은 150W 안팎으로 히터의 10분의 1 수준이고, 공기 전체가 아니라 몸에 닿는 면만 데우기 때문입니다. 실내 전체를 데우는 히터와 국소 난방을 같은 조건에서 비교할 때는 체감 난방 범위가 다르다는 점을 감안하세요." },
    { q: "가스보일러 열효율은 반영되나요?", a: "이 계산기는 입력한 가스 사용량(㎥)에 대한 요금을 그대로 계산합니다. 같은 열량 기준으로 엄밀히 비교하려면 보일러 효율(대략 80~95%)을 감안해야 하며, 결과 하단에 안내로 표시됩니다." },
  ],
  script: `import { calcDelta, kwhOf } from "__U__lib/elec.mjs";
import { calcGasBill, m3ToKwh } from "__U__lib/gas.mjs";
import { GAS } from "__U__data/gas.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, tariffSourceHtml, gasSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("preset").addEventListener("change", (e) => { if (e.target.value) $("watt").value = e.target.value; });
$("calcBtn").addEventListener("click", () => {
  const add = kwhOf(num($("watt"), 1500), num($("hours"), 5), num($("days"), 30));
  const base = num($("baseKwh"), 300);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const d = calcDelta(base, add, opts);
  const price = num($("price"), 0);
  const factor = num($("factor"), GAS.heatFactor.value);
  const m3 = num($("m3"), 0);
  const g = calcGasBill(m3, price, { baseCharge: num($("baseCharge"), 0), factor });
  const gasKwh = m3ToKwh(m3, factor);
  const rows = [
    ['전기난방 추가 사용량', kwhFmt(add), '누진 ' + d.before.tier + '단계 → ' + d.after.tier + '단계'],
    ['전기요금 증가액', won(d.delta), '1kWh당 ' + fmt(d.avgPerKwh) + '원'],
    ['가스 사용량', fmt(m3) + '㎥', kwhFmt(gasKwh) + ' 상당 열량'],
    ['가스요금 (부가세 포함)', won(g.total), price > 0 ? '단가 ' + price + '원/MJ' : '단가 미입력'],
  ];
  $("cmpOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>항목</th><th>값</th><th>비고</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td class="mut">' + r[2] + '</td></tr>').join('') +
    '<tr class="sum"><td>차액</td><td>' + won(Math.abs(d.delta - g.total)) + '</td><td class="mut">' + (price > 0 ? (d.delta > g.total ? '가스난방이 저렴' : '전기난방이 저렴') : '가스 단가 입력 필요') + '</td></tr>' +
    '</tbody></table></div>';
  $("verdict").innerHTML = price > 0
    ? '전기난방 <span class="num">' + won(d.delta) + '</span> vs 가스난방 <span class="num">' + won(g.total) + '</span>'
    : '전기난방 증가액 <span class="num">' + won(d.delta) + '</span> <span class="badge warn">가스 단가 확인 필요</span>';
  $("tableOut").innerHTML = billTableHtml(d.after);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("gasSrcOut").innerHTML = gasSourceHtml(GAS.retailPrice.links);
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "gas-unit", e: "🔵", n: "도시가스 단위 변환" }, { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }, { slug: "save-simulator", e: "📉", n: "절약 시뮬레이터" }],
  basisType: "both",
},

{
  slug: "gas-unit", emoji: "🔵", nav: "도시가스 단위 변환",
  hubName: "도시가스 단위 변환기", hubDesc: "㎥ ↔ MJ ↔ kWh를 한 번에 변환하고, 단가를 넣으면 요금까지 계산합니다.",
  title: "도시가스 단위 변환 — ㎥·MJ·kWh 환산과 요금 계산",
  desc: "도시가스 사용량 ㎥를 MJ(열량)와 kWh로 변환합니다. 고지서의 평균열량(MJ/㎥)과 단가(원/MJ)를 넣으면 기본요금·부가세까지 포함한 요금도 함께 계산합니다.",
  h1: "도시가스 단위 변환기",
  lead: `㎥ · MJ · kWh 아무 칸에나 입력하면 나머지가 즉시 변환됩니다. 단가를 넣으면 <strong>요금</strong>까지 계산합니다.`,
  body: `
  <section class="card" aria-label="변환">
    <h2>단위 변환</h2>
    <div class="grid2">
      <label class="f">부피 <span class="u">(㎥ · 계량기 사용량)</span>
        <input type="number" id="m3" inputmode="decimal" min="0" step="0.1" value="100" />
      </label>
      <label class="f">열량 <span class="u">(MJ · 요금 계산 기준)</span>
        <input type="number" id="mj" inputmode="decimal" min="0" step="1" value="4270" />
      </label>
      <label class="f">전력 환산 <span class="u">(kWh · 1kWh = 3.6MJ)</span>
        <input type="number" id="kwh" inputmode="decimal" min="0" step="0.1" value="1186.1" />
      </label>
      <label class="f">평균열량 <span class="u">(MJ/㎥ · 고지서 값)</span>
        <input type="number" id="factor" inputmode="decimal" min="1" step="0.1" value="${GAS.heatFactor.value}" />
      </label>
    </div>
    <p class="note">평균열량은 지역 도시가스사가 월별로 고시합니다(대략 42~43.5 MJ/㎥ 수준). 정확한 계산을 위해 고지서의 "평균열량"을 입력하세요. <span class="badge warn">확인 필요</span></p>
  </section>

  <section class="card" aria-label="요금">
    <h2>요금 계산 <span class="badge warn">단가 확인 필요</span></h2>
    <div class="grid2">
      <label class="f">단가 <span class="u">(원/MJ · 고지서 값)</span>
        <input type="number" id="price" inputmode="decimal" min="0" step="0.01" value="" placeholder="예: 20.00" />
      </label>
      <label class="f">월 기본요금 <span class="u">(원)</span>
        <input type="number" id="baseCharge" inputmode="decimal" min="0" step="10" value="1000" />
      </label>
    </div>
    <button class="btn" id="calcBtn">가스요금 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">예상 청구금액 <span class="num" id="totalOut"></span></p>
      <div id="tableOut"></div>
    </div>
    <div id="gasSrcOut"></div>
  </section>`,
  intro: `<h2>도시가스는 왜 ㎥가 아니라 MJ로 요금을 매길까?</h2>
    <p>계량기는 부피(㎥)를 재지만, 같은 1㎥라도 가스의 성분과 온도·압력에 따라 담긴 열량이 다릅니다. 그래서 도시가스 요금은 <strong>사용량(㎥) × 평균열량(MJ/㎥) × 단가(원/MJ)</strong> 구조로 계산합니다. 고지서에 ㎥와 MJ가 함께 찍혀 있는 이유입니다.</p>
    <p>전기와 비교하고 싶을 때는 kWh로 바꾸면 편합니다. 1kWh = 3.6MJ은 국제 단위 정의값이라 지역·계절과 무관하게 항상 같습니다. 100㎥를 평균열량 42.7로 환산하면 약 4,270MJ ≈ 1,186kWh로, 4인 가구 전기 사용량 서너 달치에 해당하는 에너지입니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>고지서의 평균열량(MJ/㎥)을 먼저 입력합니다.</li>
      <li>㎥·MJ·kWh 중 아는 값을 한 칸에 넣으면 나머지가 자동으로 채워집니다.</li>
      <li>단가(원/MJ)와 기본요금을 넣고 계산하면 공급가액·부가세·청구금액이 나옵니다.</li>
    </ol>`,
  faq: [
    { q: "1㎥는 몇 kWh인가요?", a: "평균열량 42.7MJ/㎥을 적용하면 1㎥ ≈ 42.7MJ ≈ 11.86kWh입니다. 평균열량이 43.1이면 약 11.97kWh로 조금 달라지므로 고지서 값을 넣는 것이 정확합니다." },
    { q: "가스요금 단가가 지역마다 다른 이유는?", a: "도매(한국가스공사) 단가는 전국이 비슷하지만, 소매 공급비용은 지역 도시가스사가 시·도의 승인을 받아 각각 고시하기 때문입니다. 그래서 같은 사용량이라도 지역에 따라 요금이 다를 수 있습니다." },
    { q: "이 계산에 부가세가 포함되나요?", a: "포함됩니다. (기본요금 + 사용량요금)에 부가가치세 10%를 더하고 10원 미만을 절사해 청구금액을 계산합니다." },
  ],
  script: `import { m3ToMj, mjToM3, mjToKwh, kwhToMj, calcGasBill } from "__U__lib/gas.mjs";
import { GAS } from "__U__data/gas.mjs";
import { won, num, fmt, showAd, initTheme, gasSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
const r1 = (v) => Math.round(v * 10) / 10;
let lock = false;
function sync(from) {
  if (lock) return; lock = true;
  const f = Math.max(1, num($("factor"), GAS.heatFactor.value));
  let mj;
  if (from === "m3") mj = m3ToMj(num($("m3"), 0), f);
  else if (from === "kwh") mj = kwhToMj(num($("kwh"), 0));
  else mj = num($("mj"), 0);
  if (from !== "mj") $("mj").value = r1(mj);
  if (from !== "m3") $("m3").value = r1(mjToM3(mj, f));
  if (from !== "kwh") $("kwh").value = r1(mjToKwh(mj));
  lock = false;
}
$("m3").addEventListener("input", () => sync("m3"));
$("mj").addEventListener("input", () => sync("mj"));
$("kwh").addEventListener("input", () => sync("kwh"));
$("factor").addEventListener("input", () => sync("m3"));
sync("m3");
$("calcBtn").addEventListener("click", () => {
  const f = Math.max(1, num($("factor"), GAS.heatFactor.value));
  const price = num($("price"), 0);
  const g = calcGasBill(num($("m3"), 0), price, { baseCharge: num($("baseCharge"), 0), factor: f });
  $("totalOut").textContent = price > 0 ? won(g.total) : "단가 입력 필요";
  $("tableOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>항목</th><th>계산</th><th>금액</th></tr></thead><tbody>' +
    '<tr><td>기본요금</td><td class="mut">월정액</td><td>' + won(g.baseCharge) + '</td></tr>' +
    '<tr><td>사용량요금</td><td class="mut">' + fmt(g.m3) + '㎥ × ' + f + 'MJ/㎥ × ' + price + '원</td><td>' + won(g.usageCharge) + '</td></tr>' +
    '<tr class="sum"><td>공급가액</td><td></td><td>' + won(g.supply) + '</td></tr>' +
    '<tr><td>부가가치세 <span class="mut">(10%)</span></td><td></td><td>' + won(g.vat) + '</td></tr>' +
    '<tr class="sum"><td>청구금액 <span class="mut">(10원 미만 절사)</span></td><td></td><td>' + won(g.total) + '</td></tr>' +
    '</tbody></table></div><div class="note">열량 환산: ' + fmt(g.m3) + '㎥ = ' + fmt(g.mj) + 'MJ = ' + fmt(mjToKwh(g.mj)) + 'kWh</div>';
  $("gasSrcOut").innerHTML = gasSourceHtml(GAS.retailPrice.links);
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "heating-cost", e: "🔥", n: "난방비 비교 계산기" }, { slug: "bill-reader", e: "📄", n: "고지서 보는 법" }, { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }],
  basisType: "gas",
},

{
  slug: "solar-home", emoji: "☀️", nav: "가정용 태양광",
  hubName: "가정용 태양광 절감액 계산기", hubDesc: "설치 용량으로 월 발전량과 상계 후 요금 절감액·회수 기간을 계산합니다.",
  title: "가정용 태양광 절감액 계산기 — 상계거래 기준 월 요금 비교",
  desc: "베란다형·주택형 태양광 설치 용량(kW)으로 월 발전량을 추정하고, 상계거래로 사용량이 줄었을 때 누진 구간까지 반영한 전기요금 절감액과 단순 회수 기간을 계산합니다.",
  h1: "가정용 태양광 절감액 계산기",
  lead: `발전량만큼 사용량이 깎이면 <strong>누진 단계가 내려가</strong> 절감액이 커집니다. 설치비를 넣으면 회수 기간도 계산합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>설치 조건</h2>
    <div class="grid2">
      <label class="f">설치 용량 <span class="u">(kW · 베란다형 0.3~0.6)</span>
        <input type="number" id="cap" inputmode="decimal" min="0" step="0.1" value="3" />
      </label>
      <label class="f">일 발전시간 <span class="u">(시간/일)</span>
        <input type="number" id="peak" inputmode="decimal" min="0" step="0.1" value="3.6" />
      </label>
      <label class="f">종합 효율 <span class="u">(% · 인버터·배선 손실 반영)</span>
        <input type="number" id="loss" inputmode="decimal" min="1" max="100" step="1" value="85" />
      </label>
      <label class="f">현재 월 사용량 <span class="u">(kWh)</span>
        <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="400" />
      </label>
    </div>
    <p class="note">일 발전시간 기본값 3.6시간은 전국 연평균 참고값입니다(지역·방위·경사에 따라 대략 3.2~3.9시간). <span class="badge warn">확인 필요</span> 정확한 지역 값은 재생에너지 데이터센터에서 확인해 직접 입력하세요.</p>
    ${MONTH_VOLT}
    <label class="f" style="margin-top:12px">설치비 <span class="u">(원 · 보조금 차감 후 자부담액)</span>
      <input type="number" id="cost" inputmode="decimal" min="0" step="10000" value="0" placeholder="예: 1500000" />
    </label>
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">절감액 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">월 전기요금 절감액 <span class="num" id="totalOut"></span></p>
      <p class="note" id="genOut"></p>
      <div id="cmpOut"></div>
      <p class="note" id="paybackOut"></p>
    </div>
    <div class="card">
      <h2>상계 후 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>태양광은 "발전한 만큼 돈을 받는" 게 아닙니다</h2>
    <p>가정용 태양광은 대부분 <strong>상계거래</strong> 방식입니다. 발전량이 사용량에서 먼저 차감되고, 남으면 현금이 아니라 다음 달로 이월됩니다. 그래서 태양광의 경제성은 "발전량 × 단가"가 아니라 <strong>줄어든 사용량이 누진 구간의 어디를 깎아내는가</strong>로 결정됩니다.</p>
    <p>월 400kWh를 쓰던 집이 3kW 설비로 300kWh 남짓을 발전하면, 3단계·2단계 구간이 통째로 사라지면서 절감액이 발전량 × 1단계 단가보다 훨씬 커집니다. 반대로 원래 사용량이 150kWh인 집은 아무리 많이 발전해도 1단계 단가만큼만 아끼게 됩니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>설치 용량(kW)을 넣습니다. 베란다형 미니 태양광은 보통 0.3~0.6kW, 단독주택 지붕형은 3kW 안팎입니다.</li>
      <li>지역 일사량을 알고 있다면 일 발전시간을 수정합니다(기본 3.6시간).</li>
      <li>현재 월 사용량과 계약 종류를 넣고 계산합니다.</li>
      <li>보조금을 뺀 실제 자부담 설치비를 입력하면 단순 회수 기간이 함께 표시됩니다.</li>
    </ol>`,
  faq: [
    { q: "발전량이 사용량보다 많으면 돈을 받나요?", a: "가정용 상계거래에서는 남은 전력이 현금 정산되지 않고 다음 달로 이월됩니다. 그래서 사용량보다 지나치게 큰 설비를 올리면 초과분의 경제성이 떨어집니다." },
    { q: "베란다형 미니 태양광도 효과가 있나요?", a: "0.3~0.6kW 기준으로 월 30~60kWh 정도를 만듭니다. 사용량이 많아 3단계에 걸쳐 있는 집이라면 이 정도만으로도 상위 구간이 깎여 체감 절감액이 생깁니다. 설치 용량을 바꿔가며 비교해 보세요." },
    { q: "겨울에도 같은 발전량이 나오나요?", a: "일사량이 계절에 따라 달라 여름과 겨울의 발전량 차이는 큽니다. 이 계산기의 기본값은 연평균이므로 월별 정확도가 필요하면 지역 월별 일사량 자료로 일 발전시간을 바꿔 계산하세요." },
  ],
  script: `import { calcBill } from "__U__lib/elec.mjs";
import { SOLAR } from "__U__data/misc.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("peak").value = SOLAR.peakHours.value;
$("calcBtn").addEventListener("click", () => {
  const gen = num($("cap"), 3) * num($("peak"), SOLAR.peakHours.value) * 30 * (num($("loss"), 85) / 100);
  const base = num($("baseKwh"), 400);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const before = calcBill(base, opts);
  const used = Math.max(0, base - gen);
  const after = calcBill(used, opts);
  const save = before.total - after.total;
  $("totalOut").textContent = won(save);
  $("genOut").innerHTML = "월 발전량 <strong>" + kwhFmt(gen) + "</strong> · 상계 후 사용량 " + kwhFmt(used) + (gen > base ? " (발전량이 사용량보다 많아 초과분은 이월됩니다)" : "");
  $("cmpOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>구분</th><th>사용량</th><th>청구금액</th></tr></thead><tbody>' +
    '<tr><td>설치 전</td><td>' + kwhFmt(base) + '</td><td>' + won(before.total) + '</td></tr>' +
    '<tr><td>설치 후 (상계)</td><td>' + kwhFmt(used) + '</td><td>' + won(after.total) + '</td></tr>' +
    '<tr class="sum"><td>월 절감액 <span class="mut">(누진 ' + before.tier + '단계 → ' + after.tier + '단계)</span></td><td>-' + kwhFmt(Math.min(gen, base)) + '</td><td>' + won(save) + '</td></tr>' +
    '<tr><td>연 절감액</td><td></td><td>' + won(save * 12) + '</td></tr>' +
    '<tr><td>발전 1kWh당 실질 가치</td><td></td><td>' + (gen > 0 ? fmt(save / Math.min(gen, base || 1)) + '원' : '-') + '</td></tr>' +
    '</tbody></table></div>';
  const cost = num($("cost"), 0);
  $("paybackOut").innerHTML = cost > 0 && save > 0
    ? '단순 회수 기간: 설치비 ' + won(cost) + ' ÷ 연 절감액 ' + won(save * 12) + ' ≈ <strong>' + (cost / (save * 12)).toFixed(1) + '년</strong> (유지보수비·발전량 감소·요금 인상 미반영)'
    : '설치비를 입력하면 단순 회수 기간이 계산됩니다.';
  $("tableOut").innerHTML = billTableHtml(after);
  const link = (u, n) => '<a href=' + JSON.stringify(u) + ' target="_blank" rel="noopener">' + n + '</a>';
  $("srcOut").innerHTML = tariffSourceHtml() + '<div class="srcbox">' + SOLAR.netMeteringNote + ' ' + link(SOLAR.netMeteringSource.url, SOLAR.netMeteringSource.name) + ' · 일사량 참고: ' + link('https://kier-solar.org', '재생에너지 데이터센터') + ' (확인일 ' + SOLAR.peakHours.checkedAt + ')</div>';
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }, { slug: "save-simulator", e: "📉", n: "절약 시뮬레이터" }, { slug: "ev-charging", e: "🚗", n: "전기차 충전요금" }],
},

{
  slug: "ev-charging", emoji: "🚗", nav: "전기차 충전요금",
  hubName: "전기차 충전요금 계산기", hubDesc: "충전 단가를 직접 넣어 월 충전비를 계산하고 휘발유차 연료비와 비교합니다.",
  title: "전기차 충전요금 계산기 — 단가 입력식·휘발유 대비 비교",
  desc: "월 주행거리와 전비(km/kWh), 충전 단가(원/kWh)를 넣어 월 충전비용을 계산하고 휘발유차 연료비와 비교합니다. 가정 충전은 주택용 누진 구간을 반영합니다.",
  h1: "전기차 충전요금 계산기",
  lead: `충전 단가는 사업자·시간대마다 달라 <strong>직접 입력</strong>합니다. 가정 충전은 누진 구간까지 반영합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>주행·충전 조건</h2>
    <div class="grid2">
      <label class="f">월 주행거리 <span class="u">(km)</span>
        <input type="number" id="km" inputmode="decimal" min="0" step="10" value="1200" />
      </label>
      <label class="f">전비 <span class="u">(km/kWh · 인증 전비)</span>
        <input type="number" id="eff" inputmode="decimal" min="0.1" step="0.1" value="5.0" />
      </label>
      <label class="f">충전 손실 <span class="u">(% · 보통 5~15)</span>
        <input type="number" id="loss" inputmode="decimal" min="0" max="50" step="1" value="10" />
      </label>
      <label class="f">충전 방식
        <select id="mode">
          <option value="public">공용 충전기 (단가 직접 입력)</option>
          <option value="home">가정용 콘센트 (주택용 누진 반영)</option>
        </select>
      </label>
    </div>
    <div id="publicBox">
      <label class="f" style="margin-top:12px">충전 단가 <span class="u">(원/kWh)</span> <span class="badge warn">확인 필요</span>
        <input type="number" id="price" inputmode="decimal" min="0" step="0.1" value="" placeholder="충전기 화면·앱에 표시된 단가" />
      </label>
      <p class="note" id="exOut"></p>
    </div>
    <div id="homeBox" hidden>
      <label class="f" style="margin-top:12px">충전 제외 월 사용량 <span class="u">(kWh)</span>
        <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="300" />
      </label>
      ${MONTH_VOLT}
      ${ADV_ELEC}
    </div>
    <h2 style="margin-top:18px">휘발유차와 비교 <span class="u" style="font-weight:400;color:var(--muted)">(선택)</span></h2>
    <div class="grid2">
      <label class="f">비교 차량 연비 <span class="u">(km/L)</span>
        <input type="number" id="kml" inputmode="decimal" min="0.1" step="0.1" value="12" />
      </label>
      <label class="f">유가 <span class="u">(원/L · 오늘 주유소 가격)</span>
        <input type="number" id="oil" inputmode="decimal" min="0" step="10" value="1700" />
      </label>
    </div>
    <button class="btn" id="calcBtn">충전요금 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">월 충전비용 <span class="num" id="totalOut"></span></p>
      <p class="note" id="kwhOut"></p>
      <div id="cmpOut"></div>
    </div>
    <div id="tableWrap" class="card" hidden>
      <h2>가정 충전 시 전기요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>충전 단가를 기본값으로 넣지 않은 이유</h2>
    <p>전기차 충전 단가는 사업자(환경부·민간 로밍·아파트 완속)마다 다르고, 급속·완속, 회원·비회원, 계절과 시간대에 따라서도 달라집니다. 여기에 요금제 개편도 잦아서 "지금 이 순간의 전국 단일 단가"라는 것이 존재하지 않습니다. 그래서 이 계산기는 단가를 지어내지 않고 <strong>충전기 화면이나 앱에 표시된 단가를 그대로 입력</strong>받습니다.</p>
    <p>가정용 콘센트로 충전하는 경우는 이야기가 다릅니다. 이때 충전 전력은 그 집의 주택용 전기요금에 그대로 얹히므로, 누진 구간이 올라가 1kWh당 실질 부담이 공용 급속 충전보다 비싸질 수도 있습니다. 가정 충전 모드는 이 부분을 계산합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>월 주행거리와 차량 전비(km/kWh)를 입력합니다. 계기판의 평균 전비를 쓰면 가장 정확합니다.</li>
      <li>공용 충전이면 실제 결제 단가(원/kWh)를, 가정 충전이면 충전을 제외한 월 사용량을 입력합니다.</li>
      <li>휘발유 연비와 유가를 넣으면 같은 거리 기준 연료비 차액이 계산됩니다.</li>
    </ol>`,
  faq: [
    { q: "충전 손실은 왜 더하나요?", a: "충전기가 계량하는 전력과 배터리에 실제로 저장되는 전력은 다릅니다. 변환·발열 손실로 보통 5~15% 정도 더 계량되므로, 결제 금액 기준으로는 이 손실을 포함해 계산해야 실제와 맞습니다." },
    { q: "아파트 완속 충전기 요금은 어떻게 확인하나요?", a: "충전기 화면 또는 사업자 앱의 결제 내역에 원/kWh 단가가 표시됩니다. 관리사무소가 별도 요금을 부과하는 경우도 있으니 실제 결제액을 충전량으로 나눠 단가를 구해 입력하는 방법이 가장 정확합니다." },
    { q: "가정 충전이 공용 충전보다 비쌀 수도 있나요?", a: "있습니다. 월 1,200km를 5km/kWh로 주행하면 약 240kWh가 추가되는데, 원래 300kWh를 쓰던 집이라면 누진 3단계 구간에서 충전하게 되어 1kWh당 실질 부담이 400원을 넘길 수 있습니다." },
  ],
  script: `import { calcDelta, naiveDelta } from "__U__lib/elec.mjs";
import { EV } from "__U__data/misc.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, deltaTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("exOut").innerHTML = "참고 예시(현재 단가 아님, 확인 필요): " + EV.examples.map((e) => e.name + " " + e.price + "원/kWh").join(" · ") +
  ' — 최신 단가는 <a href="https://ev.or.kr" target="_blank" rel="noopener">무공해차 통합누리집</a>에서 확인하세요.';
$("mode").addEventListener("change", () => {
  const home = $("mode").value === "home";
  $("homeBox").hidden = !home; $("publicBox").hidden = home;
});
$("calcBtn").addEventListener("click", () => {
  const km = num($("km"), 1200), eff = Math.max(0.1, num($("eff"), 5));
  const kwh = (km / eff) * (1 + num($("loss"), 10) / 100);
  const home = $("mode").value === "home";
  let cost = 0, detail = "", perKwh = 0;
  if (home) {
    const base = num($("baseKwh"), 300);
    const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
    const d = calcDelta(base, kwh, opts);
    cost = d.delta; perKwh = d.avgPerKwh;
    detail = deltaTableHtml(d, naiveDelta(base, kwh, opts), "전기차 충전");
    $("tableOut").innerHTML = billTableHtml(d.after);
    $("tableWrap").hidden = false;
    $("srcOut").innerHTML = tariffSourceHtml();
  } else {
    const price = num($("price"), 0);
    cost = Math.round(kwh * price); perKwh = price;
    detail = price > 0 ? "" : '<div class="alert">충전 단가(원/kWh)를 입력해야 금액이 계산됩니다.</div>';
    $("tableWrap").hidden = true;
    $("srcOut").innerHTML = '<div class="srcbox"><strong>충전 단가는 사용자가 입력한 값</strong>으로만 계산합니다. 사업자·시간대·회원 여부에 따라 단가가 달라지므로 결제 화면의 단가를 사용하세요. 충전 손실 기본값 10%는 참고치입니다(대략 5~15%). 확인일 ' + EV.checkedAt + '</div>';
  }
  const oilCost = (km / Math.max(0.1, num($("kml"), 12))) * num($("oil"), 1700);
  $("totalOut").textContent = won(cost);
  $("kwhOut").innerHTML = "월 충전 전력량 <strong>" + kwhFmt(kwh) + "</strong> (손실 포함) · 1km당 " + (km > 0 ? fmt(cost / km * 10) / 10 : 0) + "원";
  $("cmpOut").innerHTML = detail + '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>구분</th><th>월 비용</th><th>1km당</th></tr></thead><tbody>' +
    '<tr><td>전기차 충전 <span class="mut">' + (home ? '가정 충전(누진)' : fmt(perKwh) + '원/kWh') + '</span></td><td>' + won(cost) + '</td><td>' + (km > 0 ? fmt(cost / km) + '원' : '-') + '</td></tr>' +
    '<tr><td>휘발유차 <span class="mut">' + num($("kml"), 12) + 'km/L · ' + fmt(num($("oil"), 1700)) + '원/L</span></td><td>' + won(oilCost) + '</td><td>' + (km > 0 ? fmt(oilCost / km) + '원' : '-') + '</td></tr>' +
    '<tr class="sum"><td>차액</td><td>' + won(Math.abs(oilCost - cost)) + '</td><td class="mut">' + (cost < oilCost ? '전기차가 저렴' : '휘발유차가 저렴') + '</td></tr>' +
    '</tbody></table></div>';
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }, { slug: "solar-home", e: "☀️", n: "가정용 태양광" }, { slug: "appliance-cost", e: "🔌", n: "가전제품 전기요금" }],
},

{
  slug: "bill-reader", emoji: "📄", nav: "고지서 보는 법",
  hubName: "전기요금 고지서 보는 법", hubDesc: "고지서의 항목이 각각 무슨 뜻인지 표로 정리하고, 숫자가 맞는지 검산합니다.",
  title: "전기요금 고지서 보는 법 — 항목별 뜻과 검산 도구",
  desc: "기본요금·전력량요금·기후환경요금·연료비조정요금·부가가치세·전력산업기반기금 등 전기요금 고지서 항목의 의미를 정리하고, 사용량과 청구액을 넣어 계산이 맞는지 검산합니다.",
  h1: "전기요금 고지서 보는 법",
  lead: `고지서에 찍힌 항목이 각각 무슨 뜻인지 정리했습니다. 아래에서 <strong>내 고지서 숫자로 검산</strong>도 할 수 있습니다.`,
  body: `
  <section class="card" aria-label="항목 설명">
    <h2>고지서 항목 한눈에 보기</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>항목</th><th>뜻</th><th>계산 방식</th></tr></thead>
      <tbody>
        <tr><td>기본요금</td><td>사용량과 무관하게 누진 단계에 따라 붙는 고정 요금</td><td>저압 910 / 1,600 / 7,300원 (단계별)</td></tr>
        <tr><td>전력량요금</td><td>실제 사용한 전기의 값. 누진 3단계로 나눠 계산</td><td>구간별 사용량 × 구간 단가의 합</td></tr>
        <tr><td>기후환경요금</td><td>신재생에너지 의무이행·온실가스 배출권 비용 등을 사용량에 비례해 부과</td><td>사용량 × ${TARIFF.climate.value}원/kWh</td></tr>
        <tr><td>연료비조정요금</td><td>발전 연료비 변동을 분기마다 반영하는 조정 항목 (±5원/kWh 한도)</td><td>사용량 × 조정단가</td></tr>
        <tr><td>전기요금계</td><td>위 네 항목의 합계 (세금 붙기 전 금액)</td><td>기본 + 전력량 + 기후환경 + 연료비조정</td></tr>
        <tr><td>부가가치세</td><td>전기요금계에 붙는 세금</td><td>전기요금계 × 10% (원 미만 반올림)</td></tr>
        <tr><td>전력산업기반기금</td><td>전력산업 발전을 위한 법정 부담금</td><td>전기요금계 × ${(TARIFF.fund.value * 100).toFixed(1)}% (10원 미만 절사)</td></tr>
        <tr class="sum"><td>청구금액</td><td>실제로 내야 하는 금액</td><td>전기요금계 + 부가세 + 기금 (10원 미만 절사)</td></tr>
        <tr><td>검침일 / 사용기간</td><td>요금이 계산된 기간. 월초~월말이 아닐 수 있음</td><td>계절이 바뀌면 일할 혼합 적용</td></tr>
        <tr><td>당월/전월 사용량</td><td>같은 기간 비교용. 증가 원인을 찾는 출발점</td><td>-</td></tr>
        <tr><td>복지할인</td><td>다자녀·대가족·장애인·기초생활수급 등 대상 할인 <span class="badge warn">확인 필요</span></td><td>대상·금액은 한전에서 확인</td></tr>
        <tr><td>TV수신료</td><td>전기요금과 함께 징수되는 별도 항목 (전기요금 계산과 무관)</td><td>월정액</td></tr>
      </tbody>
    </table></div>
  </section>

  <section class="card" aria-label="검산">
    <h2>내 고지서 검산하기</h2>
    <div class="grid2">
      <label class="f">고지서의 사용량 <span class="u">(kWh)</span>
        <input type="number" id="kwh" inputmode="decimal" min="0" step="1" value="350" />
      </label>
      <label class="f">고지서의 청구금액 <span class="u">(원 · 선택)</span>
        <input type="number" id="paid" inputmode="decimal" min="0" step="10" value="" placeholder="예: 62000" />
      </label>
    </div>
    ${MONTH_VOLT}
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">검산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>검산 결과</h2>
      <p class="big">계산상 청구금액 <span class="num" id="totalOut"></span></p>
      <p class="note" id="diffOut"></p>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>고지서를 볼 때 먼저 확인할 세 가지</h2>
    <p>첫째는 <strong>사용기간</strong>입니다. 검침일이 매월 15일 전후인 집도 많아서, 7월 고지서라도 6월 중순~7월 중순 사용분일 수 있습니다. 이 경우 하계 요금과 기타계절 요금이 날짜 비율로 섞여 계산됩니다.</p>
    <p>둘째는 <strong>누진 단계</strong>입니다. 전월 대비 사용량이 조금 늘었을 뿐인데 요금이 크게 뛰었다면, 대개 단계가 올라가면서 기본요금과 단가가 함께 오른 경우입니다. 셋째는 <strong>전기요금계와 세금의 구분</strong>입니다. 부가세와 전력산업기반기금은 전기요금계를 기준으로 계산되므로, 전기요금계가 맞는지 먼저 확인하면 나머지는 자동으로 따라옵니다.</p>`,
  howto: `<h2>검산 사용법</h2>
    <ol>
      <li>고지서의 사용량(kWh)과 청구금액을 입력합니다.</li>
      <li>사용기간이 속한 달과 계약 종류(저압·고압)를 고릅니다.</li>
      <li>계산 결과와 고지서 금액의 차이를 확인합니다. 차이가 크다면 복지할인, 계절 혼합 적용, 연료비조정단가 차이, TV수신료 포함 여부를 살펴보세요.</li>
    </ol>`,
  faq: [
    { q: "계산 결과와 고지서 금액이 다릅니다. 왜 그런가요?", a: "가장 흔한 원인은 세 가지입니다. 첫째 복지할인 등 개별 할인이 적용된 경우, 둘째 검침 기간이 두 계절에 걸쳐 요금이 일할 혼합된 경우, 셋째 고지서 금액에 TV수신료 같은 별도 항목이 포함된 경우입니다." },
    { q: "TV수신료도 전기요금인가요?", a: "아닙니다. 전기요금 고지서에 함께 징수될 뿐 전기 사용량과는 무관한 별도 항목입니다. 검산할 때는 청구금액에서 수신료를 뺀 금액으로 비교하세요." },
    { q: "아파트 관리비에 나오는 전기요금은 어떻게 확인하나요?", a: "단지 일괄계약(고압) 아파트는 단지 전체 사용량으로 한전에 요금을 내고 세대별로 배분합니다. 계약 종류를 고압으로 두고 계산하면 근사치를 확인할 수 있지만, 공용 전기요금 배분분이 더해지므로 관리비 고지서 금액과는 차이가 납니다." },
  ],
  script: `import { calcBill } from "__U__lib/elec.mjs";
import { won, num, fmt, showAd, initTheme, billTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("calcBtn").addEventListener("click", () => {
  const r = calcBill(num($("kwh"), 350), { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 });
  $("totalOut").textContent = won(r.total);
  const paid = num($("paid"), 0);
  const diff = paid - r.total;
  $("diffOut").innerHTML = paid > 0
    ? '고지서 ' + won(paid) + ' − 계산 ' + won(r.total) + ' = <strong>' + (diff >= 0 ? "+" : "") + won(diff) + '</strong>' +
      (Math.abs(diff) <= Math.max(500, r.total * 0.02) ? ' — 오차 범위 안입니다(단수 처리·단가 차이).' : ' — 차이가 큽니다. 복지할인·계절 혼합 검침·TV수신료 포함 여부를 확인해 보세요.')
    : '고지서 청구금액을 입력하면 차이를 비교합니다. 누진 ' + r.tier + '단계 · ' + (r.isSummer ? '하계' : '기타계절') + ' 기준.';
  $("tableOut").innerHTML = billTableHtml(r);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }, { slug: "gas-unit", e: "🔵", n: "도시가스 단위 변환" }, { slug: "save-simulator", e: "📉", n: "절약 시뮬레이터" }],
},

{
  slug: "save-simulator", emoji: "📉", nav: "절약 시뮬레이터",
  hubName: "전기요금 절약 시뮬레이터", hubDesc: "설정 온도·사용 시간·대기전력을 조정하면 월 요금이 어떻게 움직이는지 그래프로 봅니다.",
  title: "전기요금 절약 시뮬레이터 — 온도·시간 조정 효과를 그래프로",
  desc: "냉방 설정온도 1℃ 조정, 에어컨 사용시간 단축, 대기전력 차단, 조명 교체 등의 절약 효과를 합산해 월 전기요금이 얼마나 줄어드는지 누진 구간 곡선 그래프로 보여줍니다.",
  h1: "전기요금 절약 시뮬레이터",
  lead: `조정 항목을 바꾸면 절감 kWh와 요금이 즉시 계산되고, <strong>누진 곡선 위 내 위치</strong>가 그래프로 표시됩니다.`,
  body: `
  <section class="card" aria-label="현재 상태">
    <h2>1. 현재 상태</h2>
    <div class="grid2">
      <label class="f">현재 월 사용량 <span class="u">(kWh)</span>
        <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="400" />
      </label>
      <label class="f">그중 냉·난방 사용량 <span class="u">(kWh · 대략)</span>
        <input type="number" id="hvacKwh" inputmode="decimal" min="0" step="1" value="150" />
      </label>
    </div>
    ${MONTH_VOLT}
  </section>

  <section class="card" aria-label="조정">
    <h2>2. 무엇을 바꿔볼까요</h2>
    <div class="grid2">
      <label class="f">냉·난방 설정온도 조정 <span class="u">(℃ · 여름은 높게/겨울은 낮게)</span>
        <input type="number" id="deg" inputmode="decimal" min="0" max="5" step="1" value="1" />
      </label>
      <label class="f">1℃당 절감률 <span class="u">(% · 참고치)</span> 
        <input type="number" id="degRate" inputmode="decimal" min="0" max="20" step="0.5" value="7" />
      </label>
      <label class="f">냉·난방 기기 소비전력 <span class="u">(W)</span>
        <input type="number" id="watt" inputmode="decimal" min="0" step="10" value="1800" />
      </label>
      <label class="f">하루 사용시간 단축 <span class="u">(시간)</span>
        <input type="number" id="cutH" inputmode="decimal" min="0" max="24" step="0.5" value="2" />
      </label>
      <label class="f">차단할 대기전력 <span class="u">(W · 24시간 기준)</span>
        <input type="number" id="stbW" inputmode="decimal" min="0" step="1" value="20" />
      </label>
      <label class="f">조명 교체 절감 <span class="u">(W · 사용 6시간 기준)</span>
        <input type="number" id="lightW" inputmode="decimal" min="0" step="10" value="0" />
      </label>
    </div>
    <p class="note">설정온도 1℃당 절감률 7%는 에너지절약 캠페인에서 쓰이는 <strong>참고치</strong>입니다 <span class="badge warn">확인 필요</span> — 단열·외기온·기기에 따라 달라지므로 값을 직접 조정해 비교해 보세요.</p>
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">절약 효과 시뮬레이션</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>시뮬레이션 결과</h2>
      <p class="big">월 절감액 <span class="num" id="totalOut"></span></p>
      <p class="note" id="sumOut"></p>
      <div id="chartOut"></div>
      <div id="cmpOut"></div>
    </div>
    <div class="card">
      <h2>절약 후 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
  intro: `<h2>같은 10kWh를 아껴도 절감액이 다른 이유</h2>
    <p>누진제에서는 <strong>마지막에 쓴 1kWh가 가장 비쌉니다</strong>. 저압 기준 1단계 단가는 120원이지만 3단계는 307.3원이고, 여기에 기후환경요금·연료비조정요금·부가세·전력기금이 얹히면 실질 부담은 400원을 넘습니다. 그래서 사용량이 3단계 초입에 걸쳐 있는 집이 10kWh를 아끼면 1단계에 머무는 집보다 세 배 넘게 절감할 수 있습니다.</p>
    <p>아래 그래프는 사용량에 따른 청구금액 곡선입니다. 누진 경계에서 계단처럼 꺾이는 지점이 보이고, 현재 위치와 절약 후 위치가 점으로 표시됩니다. 경계 바로 위에 있다면 조금만 줄여도 효과가 큽니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>현재 월 사용량과 그중 냉·난방이 차지하는 대략의 비중을 입력합니다(모르면 전체의 30~40%로 시작).</li>
      <li>설정온도 조정 폭, 하루 사용시간 단축, 차단할 대기전력을 넣습니다.</li>
      <li>그래프에서 현재 위치와 절약 후 위치, 누진 단계 변화를 확인합니다.</li>
      <li>1℃당 절감률은 참고치이므로 값을 바꿔가며 보수적인 시나리오도 함께 보세요.</li>
    </ol>`,
  faq: [
    { q: "설정온도 1℃에 7%는 믿을 만한 수치인가요?", a: "에너지절약 캠페인에서 널리 쓰이는 참고치이며 보장된 값이 아닙니다. 단열 상태, 외기 온도, 기기 효율에 따라 크게 달라지므로 이 계산기는 절감률을 직접 수정할 수 있게 했습니다. 보수적으로 보려면 3~5%로 낮춰 계산해 보세요." },
    { q: "누진 경계 근처면 얼마나 이득인가요?", a: "예를 들어 기타계절에 410kWh를 쓰는 집이 사용량을 400kWh 아래로 낮추면 3단계 단가와 7,300원짜리 기본요금이 함께 사라져, 10kWh 절감만으로 만 원 안팎이 줄어들 수 있습니다. 그래프의 꺾이는 지점이 그 경계입니다." },
    { q: "절감 항목이 겹치면 중복 계산되지 않나요?", a: "설정온도 조정은 '냉·난방 사용량'에만 적용되고, 사용시간 단축은 입력한 기기 소비전력 기준으로 계산됩니다. 두 항목을 동시에 크게 넣으면 냉·난방 사용량보다 절감량이 커질 수 있어, 계산 시 냉·난방 사용량을 넘지 않도록 제한합니다." },
  ],
  script: `import { calcBill, kwhOf } from "__U__lib/elec.mjs";
import { GAS } from "__U__data/gas.mjs";
import { won, num, fmt, kwhFmt, showAd, initTheme, billTableHtml, tariffSourceHtml, chartSvg } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("calcBtn").addEventListener("click", () => {
  const base = Math.max(0, num($("baseKwh"), 400));
  const hvac = Math.min(base, Math.max(0, num($("hvacKwh"), 150)));
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const degCut = Math.min(hvac, hvac * (num($("deg"), 1) * num($("degRate"), 7) / 100));
  const timeCut = Math.min(hvac - degCut, kwhOf(num($("watt"), 1800), num($("cutH"), 2), 30));
  const stbCut = kwhOf(num($("stbW"), 20), 24, 30);
  const lightCut = kwhOf(num($("lightW"), 0), 6, 30);
  const cut = Math.min(base, degCut + timeCut + stbCut + lightCut);
  const before = calcBill(base, opts);
  const after = calcBill(base - cut, opts);
  const save = before.total - after.total;
  $("totalOut").textContent = won(save);
  $("sumOut").innerHTML = "절감 사용량 <strong>" + kwhFmt(cut) + "</strong> · " + kwhFmt(base) + " → " + kwhFmt(base - cut) +
    " · 누진 " + before.tier + "단계 → " + after.tier + "단계 · 연 " + won(save * 12);
  const maxX = Math.max(500, Math.ceil((base * 1.25) / 50) * 50);
  const pts = [];
  for (let x = 0; x <= maxX; x += Math.max(5, Math.round(maxX / 120))) pts.push({ x, y: calcBill(x, opts).total });
  $("chartOut").innerHTML = chartSvg({
    pts,
    marks: [
      { x: base, y: before.total, label: "현재 " + won(before.total), color: "var(--bad)" },
      { x: base - cut, y: after.total, label: "절약 후 " + won(after.total), color: "var(--acc)" },
    ],
  });
  const rows = [
    ["설정온도 " + num($("deg"), 1) + "℃ 조정", degCut],
    ["하루 " + num($("cutH"), 2) + "시간 단축", timeCut],
    ["대기전력 " + num($("stbW"), 20) + "W 차단", stbCut],
    ["조명 " + num($("lightW"), 0) + "W 절감", lightCut],
  ].filter((r) => r[1] > 0);
  const perKwh = cut > 0 ? save / cut : 0;
  $("cmpOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>절약 항목</th><th>절감 사용량</th><th>절감액(추정 배분)</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + kwhFmt(r[1]) + '</td><td>' + won(r[1] * perKwh) + '</td></tr>').join('') +
    '<tr class="sum"><td>합계</td><td>' + kwhFmt(cut) + '</td><td>' + won(save) + '</td></tr></tbody></table></div>' +
    '<div class="note">1kWh당 실질 절감 단가 ' + fmt(perKwh) + '원으로 항목별 배분했습니다. 절감률 기본값 ' + (GAS.savePerDegree.value * 100) + '%/℃는 참고치입니다.</div>';
  $("tableOut").innerHTML = billTableHtml(after);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
  related: [{ slug: "ac-cost", e: "❄️", n: "에어컨 전기요금" }, { slug: "standby-power", e: "🔋", n: "대기전력 계산기" }, { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" }],
},
];

/* ── 가전 롱테일 페이지 ─────────────────────────────────────── */
const CAT_INTRO = {
  cool: "여름철 사용량을 좌우하는 냉방·공기질 가전입니다. 사용 시간이 길어 누진 구간을 밀어 올리기 쉽습니다.",
  kitchen: "주방 가전은 순간 소비전력이 크지만 사용 시간이 짧은 기기와, 24시간 돌아가는 기기가 섞여 있습니다.",
  laundry: "세탁·건조 가전은 물을 데우거나 히터를 쓰는 구간에서 전력이 몰립니다.",
  media: "IT·미디어 기기는 개별 소비전력이 작아도 늘 켜져 있어 합치면 무시하기 어렵습니다.",
  heat: "겨울철 요금 급등의 주범입니다. 전기로 열을 만드는 기기는 예외 없이 소비전력이 큽니다.",
  etc: "생활 가전은 사용 빈도에 따라 요금 영향이 크게 달라집니다.",
};

function appliancePage(a) {
  const cat = CATS[a.cat];
  const monthKwh = Math.round(((a.w * a.h * 30) / 1000) * 10) / 10;
  const note = a.note || `${a.name}의 소비전력은 제품·용량·모드에 따라 ${a.range[0]}~${a.range[1]}W 범위에서 달라집니다.`;
  return {
    path: `appliance/${a.slug}/`,
    emoji: "🔌",
    title: `${a.name} 전기요금 계산 — ${a.w}W 기준 한 달 요금`,
    desc: `${a.name}(약 ${a.w}W)를 하루 ${a.h}시간 쓰면 월 약 ${monthKwh}kWh. 누진 구간을 반영한 실제 요금 증가액을 계산하고 절약 방법을 정리했습니다.`,
    h1: `${a.name} 전기요금`,
    appName: `${a.name} 전기요금 계산기`,
    lead: `${a.name} 약 <strong>${a.w}W</strong> 기준 · 하루 ${a.h}시간이면 월 약 ${monthKwh}kWh. 기존 사용량을 넣으면 <strong>누진 반영 증가액</strong>이 나옵니다.`,
    crumbs: [
      { name: "가전제품별 전기요금", item: `${SITE_ORIGIN}/appliance/`, rel: "appliance/" },
      { name: `${a.name} 전기요금`, item: `${SITE_ORIGIN}/appliance/${a.slug}/` },
    ],
    body: `
  <section class="card" aria-label="입력">
    <h2>${a.name} 사용 조건</h2>
    <div class="grid2">
      <label class="f">소비전력 <span class="u">(W · 참고 ${a.range[0]}~${a.range[1]})</span>
        <input type="number" id="watt" inputmode="decimal" min="0" step="10" value="${a.w}" />
      </label>
      <label class="f">하루 사용 시간 <span class="u">(시간)</span>
        <input type="number" id="hours" inputmode="decimal" min="0" max="24" step="0.5" value="${a.h}" />
      </label>
      <label class="f">한 달 사용 일수 <span class="u">(일)</span>
        <input type="number" id="days" inputmode="decimal" min="0" max="31" step="1" value="30" />
      </label>
      <label class="f">이 기기를 뺀 월 사용량 <span class="u">(kWh)</span>
        <input type="number" id="baseKwh" inputmode="decimal" min="0" step="1" value="250" />
      </label>
    </div>
    ${MONTH_VOLT}
    ${ADV_ELEC}
    <button class="btn" id="calcBtn">${a.name} 전기요금 계산</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">${a.name} 때문에 늘어나는 금액 <span class="num" id="totalOut"></span></p>
      <p class="note">월 사용량 <strong id="addOut"></strong> · 1년이면 <span id="yearOut"></span></p>
      <div id="cmpOut"></div>
    </div>
    <div class="card">
      <h2>${a.name} 포함 전체 요금 산출 과정</h2>
      <div id="tableOut"></div>
    </div>
    <div id="srcOut"></div>
  </section>`,
    intro: `<h2>${a.name}, 한 달에 얼마나 나올까?</h2>
    <p>${a.name}의 일반적인 소비전력은 약 <strong>${a.w}W</strong>이며 제품에 따라 ${a.range[0]}~${a.range[1]}W 범위에서 달라집니다. 하루 ${a.h}시간, 한 달 30일을 기준으로 하면 약 <strong>${monthKwh}kWh</strong>를 사용합니다. ${note}</p>
    <p>다만 이 사용량이 요금으로 얼마가 되는지는 <strong>우리 집이 원래 얼마나 쓰는지</strong>에 달려 있습니다. 주택용 전기요금은 누진제라서, 같은 ${monthKwh}kWh라도 월 150kWh를 쓰는 집과 380kWh를 쓰는 집의 추가 요금은 두 배 이상 차이 납니다. 위 계산기에 기존 사용량을 함께 넣으면 그 차이가 반영된 실제 증가액이 나옵니다.</p>
    <p class="note">분류: ${cat} — ${CAT_INTRO[a.cat]}</p>`,
    howto: `<h2>정확하게 계산하려면</h2>
    <ol>
      <li>제품 뒷면 라벨이나 설명서에서 정격 소비전력(W)을 확인해 입력합니다. 라벨에 "월간 소비전력량(kWh/월)"이 있으면 그 값을 720시간으로 나눠 평균 W로 환산하는 편이 더 정확합니다.</li>
      <li>하루 실제 사용 시간을 넣습니다. ${a.h >= 20 ? "상시 가동 기기이므로 24시간을 기준으로 두되, 압축기·모터가 쉬는 시간을 감안해 평균 소비전력을 낮춰 넣으면 실제에 가까워집니다." : "쓰지 않는 날이 있으면 사용 일수를 함께 줄이세요."}</li>
      <li>이 기기를 제외한 월 사용량을 넣어야 누진 구간이 제대로 반영됩니다.</li>
    </ol>`,
    faq: [
      { q: `${a.name}는 하루 종일 켜두면 요금이 얼마나 늘어나나요?`, a: `${a.w}W 기준으로 24시간 30일이면 약 ${Math.round((a.w * 24 * 30) / 1000)}kWh입니다. 여기에 누진 단계가 올라가면 1kWh당 실질 부담이 커지므로, 계산기에서 사용 시간을 24로 바꿔 증가액을 직접 비교해 보세요.` },
      { q: `표시된 ${a.w}W는 어디서 나온 값인가요?`, a: `한국에너지공단 효율등급 제품정보와 제조사 사양표를 참고한 일반적인 범위(${a.range[0]}~${a.range[1]}W)의 대표값입니다. 모델별 편차가 크므로 제품 라벨의 값을 직접 입력하는 것을 권장합니다.` },
      { q: "계산 결과가 고지서와 다를 수 있나요?", a: "실제 고지서에는 다른 모든 가전의 사용량, 복지할인, 검침 기간에 따른 계절 혼합 적용 등이 함께 반영됩니다. 이 계산기는 해당 기기 하나가 청구금액을 얼마나 밀어 올리는지 보여주는 참고 도구입니다." },
    ],
    basis: ELEC_BASIS,
    disclaimer: DISC("가전 소비전력은 모델별 편차가 커 참고 범위를 사용합니다."),
    script: `import { calcDelta, naiveDelta, kwhOf } from "__U__lib/elec.mjs";
import { won, num, kwhFmt, showAd, initTheme, billTableHtml, deltaTableHtml, tariffSourceHtml } from "__U__assets/app.mjs";
const $ = (id) => document.getElementById(id);
${MONTH_FILL}
$("calcBtn").addEventListener("click", () => {
  const add = kwhOf(num($("watt"), ${a.w}), num($("hours"), ${a.h}), num($("days"), 30));
  const base = num($("baseKwh"), 250);
  const opts = { month: +monthSel.value, voltage: $("voltage").value, fuelAdj: num($("fuelAdj"), 5), fundRate: num($("fundRate"), 2.7) / 100 };
  const d = calcDelta(base, add, opts);
  const nv = naiveDelta(base, add, opts);
  $("totalOut").textContent = won(d.delta);
  $("addOut").textContent = kwhFmt(add);
  $("yearOut").textContent = won(d.delta * 12);
  $("cmpOut").innerHTML = deltaTableHtml(d, nv, ${JSON.stringify(a.name)});
  $("tableOut").innerHTML = billTableHtml(d.after);
  $("srcOut").innerHTML = tariffSourceHtml();
  $("resultBox").hidden = false;
  showAd();
});`,
    related: [
      { slug: "appliance", e: "📚", n: "가전제품별 전기요금 목록" },
      { slug: "appliance-cost", e: "🔌", n: "가전제품 전기요금 계산기" },
      { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" },
    ].concat(CROSS),
  };
}

function applianceIndexPage() {
  const groups = Object.keys(CATS).map((k) => {
    const items = APPLIANCES.filter((a) => a.cat === k);
    return `<h2>${CATS[k]}</h2>
    <p class="note">${CAT_INTRO[k]}</p>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>기기</th><th>대표 소비전력</th><th>하루 ${""}사용 기준 월 사용량</th></tr></thead>
      <tbody>${items.map((a) => `<tr><td><a href="${a.slug}/">${a.name}</a></td><td>${a.w}W <span class="mut">(${a.range[0]}~${a.range[1]})</span></td><td>${Math.round(((a.w * a.h * 30) / 1000) * 10) / 10}kWh <span class="mut">(${a.h}h/일)</span></td></tr>`).join("")}</tbody>
    </table></div>`;
  }).join("\n    ");
  return {
    path: "appliance/", emoji: "📚", ad: false,
    title: "가전제품별 전기요금 — 소비전력 참고표와 계산기 모음",
    desc: `에어컨·냉장고·건조기·게이밍 PC 등 가전 ${APPLIANCES.length}종의 참고 소비전력(W)과 월 사용량을 한눈에 보고, 기기별 전기요금 계산 페이지로 이동합니다.`,
    h1: "가전제품별 전기요금",
    appName: "가전제품별 전기요금 계산기 모음",
    lead: `가전 <strong>${APPLIANCES.length}종</strong>의 참고 소비전력과 월 사용량. 기기 이름을 누르면 누진 반영 계산기가 열립니다.`,
    crumbs: [{ name: "가전제품별 전기요금", item: `${SITE_ORIGIN}/appliance/` }],
    body: `
  <section class="card">
    <h2>보는 방법</h2>
    <p class="note">"대표 소비전력"은 일반적인 제품의 참고값이며 괄호 안은 참고 범위입니다. "월 사용량"은 표에 적힌 하루 사용 시간 기준으로 30일 환산한 값입니다. 실제 요금은 우리 집 기존 사용량에 따라 누진 단계가 달라지므로, 각 기기 페이지에서 기존 사용량을 함께 넣어 계산하세요.</p>
  </section>
  <section class="about" style="margin-top:8px">
    ${groups}
  </section>`,
    intro: `<h2>소비전력 표를 볼 때 주의할 점</h2>
    <p>같은 이름의 가전이라도 용량·연식·에너지소비효율등급에 따라 소비전력이 두세 배 차이 납니다. 이 표의 값은 제품 선택의 출발점이며, 정확한 계산에는 제품 라벨의 값을 쓰는 것이 가장 좋습니다. 특히 냉장고·에어컨처럼 압축기가 켜졌다 꺼지는 기기는 정격 소비전력이 실제 평균보다 훨씬 높게 표시됩니다.</p>`,
    howto: `<h2>요금을 줄이는 순서</h2>
    <ol>
      <li>소비전력(W) × 사용 시간이 큰 기기부터 찾습니다. 표의 월 사용량 열이 그 기준입니다.</li>
      <li>상시 가동 기기(냉장고·셋톱박스·정수기)는 시간을 줄일 수 없으므로 효율이 높은 제품 교체나 대기전력 차단이 답입니다.</li>
      <li>고출력·단시간 기기(전기포트·헤어드라이어)는 요금 영향이 생각보다 작습니다.</li>
      <li>난방 기기는 예외 없이 큽니다. 겨울철 사용량이 뛰는 원인 1순위입니다.</li>
    </ol>`,
    faq: [
      { q: "소비전력이 같으면 요금도 같은가요?", a: "사용 시간이 같다면 사용량은 같지만, 요금은 우리 집의 기존 사용량에 따라 달라집니다. 누진 3단계에 걸친 집에서는 같은 10kWh라도 1단계인 집보다 세 배 가까이 비쌉니다." },
      { q: "에너지소비효율 1등급이면 얼마나 아끼나요?", a: "제품군마다 다르지만 5등급 대비 30~40% 정도 소비전력이 낮은 경우가 많습니다. 표의 참고 범위 중 낮은 쪽 값을 넣어 계산하면 대략적인 차이를 확인할 수 있습니다." },
      { q: "목록에 없는 기기는 어떻게 계산하나요?", a: "가전제품 전기요금 계산기에서 소비전력(W)과 사용 시간을 직접 넣어 계산할 수 있습니다." },
    ],
    basis: ELEC_BASIS,
    disclaimer: DISC("소비전력 참고값은 한국에너지공단 효율등급 제품정보·제조사 사양표를 참고한 범위입니다."),
    related: [
      { slug: "appliance-cost", e: "🔌", n: "가전제품 전기요금 계산기" },
      { slug: "standby-power", e: "🔋", n: "대기전력 계산기" },
      { slug: "electric-bill", e: "⚡", n: "전기요금 계산기" },
    ].concat(CROSS),
  };
}

/* ── 허브 · 정책 페이지 ─────────────────────────────────────── */
function hubPage() {
  const cards = TOOLS.map((t) => `<a class="tool" href="${t.slug}/"><div class="t-e">${t.emoji}</div><div class="t-n">${t.hubName}</div><div class="t-d">${t.hubDesc}</div></a>`).join("\n      ");
  return {
    path: "", emoji: "⚡", ad: false,
    title: "전기·가스 요금 계산기 허브 — 누진세까지 반영한 실제 요금",
    desc: "전기요금·에어컨 추가요금·가전제품 전기요금·대기전력·난방비·도시가스 단위 변환·태양광 절감액·전기차 충전요금까지, 누진 구간을 반영해 항목별 산출 과정을 전부 보여주는 무료 계산기 모음입니다.",
    h1: "전기·가스 요금 계산기",
    appName: "전기가스요금 계산기 허브",
    lead: `"사용량 × 단가"가 아니라 <strong>누진 구간 이동까지</strong> 반영합니다. 모든 계산기가 항목별 산출 과정을 그대로 보여줍니다.`,
    crumbs: [],
    body: `
  <div class="tool-grid">
      ${cards}
      <a class="tool" href="appliance/"><div class="t-e">📚</div><div class="t-n">가전제품별 전기요금</div><div class="t-d">가전 ${APPLIANCES.length}종의 참고 소비전력과 기기별 계산 페이지 모음.</div></a>
  </div>`,
    intro: `<h2>왜 또 하나의 전기요금 계산기인가</h2>
    <p>인터넷의 많은 계산기는 "예상 요금"이라는 숫자 하나만 던져 줍니다. 하지만 고지서를 손에 들고 있는 사람에게 필요한 것은 <strong>그 숫자가 어떻게 나왔는지</strong>입니다. 이 사이트의 모든 계산기는 기본요금·전력량요금(누진 단계별)·기후환경요금·연료비조정요금·부가가치세·전력산업기반기금을 한 줄씩 펼쳐 보여줍니다. 고지서와 나란히 놓고 어느 항목에서 차이가 나는지 대조할 수 있습니다.</p>
    <p>또 하나의 원칙은 <strong>모르는 값은 지어내지 않는다</strong>는 것입니다. 도시가스 소매 단가나 전기차 충전 단가처럼 지역·사업자·시기별로 달라지는 값은 기본값을 넣는 대신 "확인 필요" 표시와 함께 직접 입력하도록 했고, 확인처 링크를 함께 제공합니다.</p>`,
    howto: `<h2>이런 질문에 답합니다</h2>
    <ul>
      <li>에어컨을 하루 8시간 켜면 요금이 <strong>실제로</strong> 얼마나 더 나올까? (누진 구간 이동 포함)</li>
      <li>건조기·전기히터·게이밍 PC 한 대의 월 요금은?</li>
      <li>안 쓰는 플러그를 다 뽑으면 1년에 얼마 아낄까?</li>
      <li>전기난방과 가스보일러 중 어느 쪽이 싼가? (지역 가스 단가 입력)</li>
      <li>도시가스 100㎥는 몇 MJ, 몇 kWh인가?</li>
      <li>베란다 태양광 3kW를 달면 월 얼마가 줄어들까?</li>
      <li>전기차를 집에서 충전하면 누진 때문에 얼마나 비싸질까?</li>
      <li>고지서의 이 항목은 대체 무슨 뜻인가?</li>
    </ul>`,
    faq: [
      { q: "요금표는 언제 기준인가요?", a: `주택용 전력 ${BASIS}의 요금표를 사용합니다(데이터 확인일 ${TODAY}). 연료비조정요금은 분기마다, 전력산업기반기금 요율은 제도 개정에 따라 바뀌므로 각 계산기의 고급 설정에서 직접 수정할 수 있습니다.` },
      { q: "계산 결과가 고지서와 정확히 일치하나요?", a: "복지할인, 검침 기간에 따른 계절 혼합 적용, 연료비조정단가 변동, TV수신료 같은 별도 항목 때문에 차이가 날 수 있습니다. 참고용 추정치로 사용하시고 확정 금액은 한국전력 사이버지점에서 확인하세요." },
      { q: "개인정보를 입력해야 하나요?", a: "아닙니다. 모든 계산은 브라우저 안에서만 이뤄지며 입력값은 서버로 전송되거나 저장되지 않습니다. 이름·연락처 등 개인정보는 수집하지 않습니다." },
      { q: "도시가스 단가는 왜 비어 있나요?", a: "도시가스 소매 단가는 지역 도시가스사별로 고시되어 전국 공통값이 없습니다. 잘못된 기본값이 계산 전체를 틀리게 만들기 때문에, 고지서의 단가를 직접 입력하도록 하고 확인처 링크를 제공합니다." },
    ],
    basis: ELEC_BASIS + "\n    " + GAS_BASIS,
    disclaimer: DISC(),
    related: CROSS.concat([{ url: "https://tomatoeggcat.com/", e: "🍅", n: "TomatoEggCat 도구 허브" }]),
  };
}

const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ad: false, app: false,
    title: "개인정보처리방침 — 전기가스요금 계산기 허브",
    desc: "본 사이트는 개인정보를 수집하지 않습니다. 계산은 모두 브라우저에서 처리되며, 광고 제공을 위한 쿠키 사용에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    crumbs: [{ name: "개인정보처리방침", item: `${SITE_ORIGIN}/privacy.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 수집하는 개인정보</h2>
    <p>본 사이트는 회원가입 절차가 없으며 이름·연락처·이메일·주민등록번호 등 개인을 식별할 수 있는 정보를 일절 수집하지 않습니다. 계산기에 입력하는 사용량·단가 등의 값은 브라우저 안에서만 처리되며 서버로 전송되거나 저장되지 않습니다.</p>
    <h2>2. 쿠키와 광고</h2>
    <p>본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다.</p>
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
    title: "이용약관 — 전기가스요금 계산기 허브",
    desc: "본 사이트가 제공하는 요금 계산 결과의 성격과 책임 범위, 저작권에 관한 안내입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 추정치입니다.",
    crumbs: [{ name: "이용약관", item: `${SITE_ORIGIN}/terms.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 서비스의 성격</h2>
    <p>본 사이트는 전기·도시가스 요금을 공개된 요금표와 이용자가 입력한 값에 근거해 계산해 주는 무료 도구입니다. 계산 결과는 <strong>참고용 추정치</strong>이며 실제 청구 금액을 확정하거나 보증하지 않습니다.</p>
    <h2>2. 요금표의 갱신</h2>
    <p>전기요금 단가는 ${BASIS}의 주택용 전력 요금표를 기준으로 하며(확인일 ${TODAY}), 연료비조정요금·전력산업기반기금 요율 등은 수시로 변경될 수 있습니다. 최신 단가는 <a href="${KEPCO}" target="_blank" rel="noopener">한국전력 사이버지점</a>에서 확인하시기 바랍니다. 도시가스 단가는 지역 도시가스사 고시값을 이용자가 직접 입력합니다.</p>
    <h2>3. 책임의 한계</h2>
    <p>이용자가 본 사이트의 계산 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다. 요금 납부·설비 투자 등 중요한 결정은 반드시 한국전력, 지역 도시가스사, 관련 기관의 공식 자료로 확인하시기 바랍니다.</p>
    <h2>4. 저작권</h2>
    <p>본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 요금표 등 공공 데이터의 권리는 각 기관에 있습니다.</p>
    <h2>5. 광고</h2>
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
    basis: t.basisType === "gas" ? GAS_BASIS : t.basisType === "both" ? ELEC_BASIS + "\n    " + GAS_BASIS : ELEC_BASIS,
    disclaimer: DISC(),
    script: t.script,
    related: (t.related || []).concat(CROSS),
  });
}
pages.push(applianceIndexPage());
for (const a of APPLIANCES) pages.push(appliancePage(a));
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
  const pr = p.path === "" ? "1.0" : p.path.startsWith("appliance/") && p.path !== "appliance/" ? "0.5" : p.path.endsWith(".html") ? "0.3" : "0.8";
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

/* 고아 디렉터리 정리(생성 대상이 아닌 slug 폴더 경고만) */
const known = new Set(pages.filter((p) => p.path.endsWith("/") && p.path).map((p) => p.path.split("/")[0]));
const RESERVED = new Set(["assets", "data", "lib", "tests", "node_modules", "appliance"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

console.log(`생성 완료: HTML ${written}개 (도구 ${TOOLS.length} · 가전 롱테일 ${APPLIANCES.length} · 정책 ${POLICY.length})`);
console.log(`sitemap.xml: ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
