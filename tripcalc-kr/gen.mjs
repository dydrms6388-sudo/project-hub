// tripcalc-kr 정적 페이지 생성기 (Node 내장만 사용, 의존성 0)
// 실행: node tripcalc-kr/gen.mjs
// 생성물: index.html, <tool>/index.html × 12, currency/<pair>/ 롱테일, country/<slug>/ 롱테일,
//        privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, KOREA, VISA_LINK, CHECKED_AT } from "./data/countries.mjs";
import { AIRPORTS, AIRPORTS_META, findAirport } from "./data/airports.mjs";
import { DUTY } from "./lib/dutyfree.mjs";
import { FRANKFURTER_CODES, FX_DISCLAIMER } from "./lib/fx.mjs";
import { distanceBetween, flightHours, hoursToKo } from "./lib/geo.mjs";

const SITE_ORIGIN = "https://tripcalc-kr.vercel.app";
const SITE_NAME = "해외여행 계산기 허브";
const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 공통 HTML 셸 ───────────────────────────────────────────── */
function shell(p) {
  const path = p.path;                       // "" | "currency/" | "currency/usd-krw/" | "privacy.html"
  const depth = path.endsWith("/") ? path.split("/").filter(Boolean).length : 0;
  const U = "../".repeat(depth);
  const HOME = U || "./";
  const canonical = SITE_ORIGIN + "/" + path;

  const graph = [];
  if (p.app !== false) {
    graph.push({
      "@type": "SoftwareApplication", name: p.appName || p.h1, description: p.desc,
      applicationCategory: "TravelApplication", operatingSystem: "Web",
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

  const crumbNav = `<nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">🧳 ${SITE_NAME}</a>` +
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
      : `<a class="rel" href="${U}${r.slug}"><span class="e">${r.e}</span> ${esc(r.n)}</a>`).join("\n      ");
  const related = rel ? `
  <section class="related">
    <h2>관련 도구</h2>
    <div class="rel-grid">
      ${rel}
    </div>
  </section>` : "";

  const script = `
<script type="module">
import { initTheme } from "${U}assets/app.mjs";
initTheme(document.getElementById("themeBtn"));
</script>` + (p.script ? `
<script type="module">
${p.script.replace(/__U__/g, U)}
</script>` : "");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />
<script>try{var t=localStorage.getItem('tc-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
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
    <p style="margin:0 0 8px">🧳 <a href="${HOME}">${SITE_NAME}</a></p>
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
const T = {
  budget: { url: "https://tomatoeggcat.com/travel-budget/", e: "💰", n: "여행 예산 계산기 (TomatoEggCat)" },
  packing: { url: "https://tomatoeggcat.com/travel-packing/", e: "🎒", n: "여행 짐 체크리스트 (TomatoEggCat)" },
  split: { url: "https://tomatoeggcat.com/split-bill/", e: "🧾", n: "더치페이 정산 (TomatoEggCat)" },
  china: { url: "https://tomatoeggcat.com/china-travel/", e: "🇨🇳", n: "중국여행 준비 (TomatoEggCat)" },
  pin: { url: "https://tomatoeggcat.com/travel-pin/", e: "📍", n: "여행 핀 지도 (TomatoEggCat)" },
};

const VISA_BOX = `<div class="srcbox">
    <strong>비자·입국요건은 이 사이트에서 안내하지 않습니다.</strong><br />
    비자 면제 여부·체류 가능일·전자여행허가(ETA/ESTA 등)는 수시로 바뀌고 국적·여권 종류·방문 목적에 따라 달라져,
    잘못된 정보가 곧바로 입국 거부로 이어질 수 있습니다. 반드시
    <a href="${VISA_LINK}" target="_blank" rel="noopener">외교부 해외안전여행(0404.go.kr)</a>에서 최신 정보를 확인하세요.
  </div>`;

const NO_SERVER = `<p class="note">입력한 값은 <strong>브라우저 안에서만</strong> 처리되며 서버로 전송되거나 저장되지 않습니다. 저장 기능은 이 브라우저의 localStorage 만 사용합니다(서버 저장 없음).</p>`;

const DISC = (extra = "") => `<p class="disclaimer">본 결과는 참고용 추정치이며 어떤 확정 정보도 보증하지 않습니다. ${extra}</p>`;

const FX_BOX = `<h2>환율 데이터의 출처와 한계</h2>
    <p class="note">환율은 <a href="https://api.frankfurter.dev/" target="_blank" rel="noopener">Frankfurter</a>(유럽중앙은행 기준환율)의 공개 API 를 브라우저에서 직접 불러오고, 실패하면
    <a href="https://open.er-api.com/" target="_blank" rel="noopener">ExchangeRate-API 공개 엔드포인트</a>를 시도합니다.
    받아온 값은 브라우저에 24시간 캐시되고, 두 곳 모두 실패하면 마지막으로 저장된 값을 "오래된 값" 표시와 함께 보여줍니다.
    저장된 값조차 없으면 숫자를 지어내지 않고 안내 메시지만 표시합니다.
    ${FX_DISCLAIMER} 기준환율은 영업일에만 갱신되므로 주말·공휴일에는 직전 영업일 값이 표시됩니다. (확인일 ${TODAY})</p>`;

const TZ_BOX = `<h2>시차 계산 방식</h2>
    <p class="note">시차는 표를 하드코딩하지 않고 <strong>IANA 타임존 데이터베이스</strong>(예: <code>Asia/Seoul</code>)를 브라우저의
    <code>Intl</code> API 로 계산합니다. 따라서 서머타임(일광절약시간) 시행·해제가 자동으로 반영되고, 브라우저의 tzdb 가 갱신되면 결과도 함께 갱신됩니다.
    출처: <a href="https://www.iana.org/time-zones" target="_blank" rel="noopener">IANA Time Zone Database</a> (확인일 ${CHECKED_AT})</p>`;

const GEO_BOX = `<h2>거리·비행시간 계산 근거</h2>
    <p class="note">두 공항 사이 거리는 좌표를 이용한 <strong>대권거리(great-circle distance)</strong>이며 지구를 완전한 구로 가정한 <strong>추정치</strong>입니다.
    실제 항로는 항공로·관제·영공 우회·바람 때문에 대권거리보다 길고, 비행시간도 편서풍 방향(동행/서행)에 따라 1시간 이상 차이가 납니다.
    좌표 출처: <a href="${AIRPORTS_META.source}" target="_blank" rel="noopener">OurAirports</a> (확인일 ${AIRPORTS_META.checkedAt}). 실제 소요시간은 항공사 시간표를 확인하세요.</p>`;

const DUTY_BOX = `<h2>면세 한도 데이터 기준</h2>
    <p class="note">기본 면세한도 미화 ${DUTY.basic.value}달러, 주류 ${DUTY.alcohol.bottles}병(합계 ${DUTY.alcohol.liters}L·${DUTY.alcohol.usd}달러 이하),
    궐련 ${DUTY.tobacco.value}개비, 향수 ${DUTY.perfume.value}mL 는 <a href="${DUTY.meta.source}" target="_blank" rel="noopener">관세청</a> 여행자 휴대품 기준입니다(확인일 ${DUTY.meta.checkedAt}).
    자진신고 감면율 30%는 확정 값이지만 <strong>감면 한도액은 개정 이력이 있어 이 사이트에서 확정 표기하지 않습니다</strong>
    <span class="badge warn">확인 필요</span> — 계산기에서 직접 입력하도록 두었습니다. 품목별 세율·통관 가능 여부는 관세청에서 확인하세요.</p>`;

/* ── 파생 데이터 ────────────────────────────────────────────── */
const CUR_MAP = new Map();
CUR_MAP.set("KRW", { code: "KRW", nameKo: "원", api: true, flag: "🇰🇷", countries: ["대한민국"] });
for (const c of COUNTRIES) {
  const k = c.currency.code;
  if (!CUR_MAP.has(k)) CUR_MAP.set(k, { code: k, nameKo: c.currency.nameKo, api: !!c.currency.apiSupported, flag: c.flag, countries: [] });
  CUR_MAP.get(k).countries.push(c.nameKo);
}
const CURRENCIES = [...CUR_MAP.values()];
const ORDER = ["KRW", "USD", "JPY", "EUR", "CNY", "GBP", "HKD", "SGD", "THB", "VND", "TWD", "AUD"];
const rank = (c) => { const i = ORDER.indexOf(c.code); return i < 0 ? 99 : i; };
const FX_CUR = CURRENCIES.filter((c) => c.api && FRANKFURTER_CODES.includes(c.code))
  .sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
const CUR_OPTS = FX_CUR.map((c) => ({ v: c.code, n: `${c.flag} ${c.code} · ${c.nameKo}${c.countries[0] ? " (" + c.countries[0] + ")" : ""}` }));
const CUR_JSON = JSON.stringify(CUR_OPTS);
const CUR_BY = Object.fromEntries(FX_CUR.map((c) => [c.code, { nameKo: c.nameKo, flag: c.flag, countries: c.countries }]));

const CITY_MAP = new Map();
for (const a of AIRPORTS) {
  const city = a.city === "서울/인천" ? "서울" : a.city;
  if (!CITY_MAP.has(city)) CITY_MAP.set(city, { city, tz: a.tz });
}
const CITIES = [...CITY_MAP.values()];
const CITY_JSON = JSON.stringify(CITIES.map((c) => ({ v: c.tz + "|" + c.city, n: c.city })));
const AIR_JSON = JSON.stringify(AIRPORTS.map((a) => ({ v: a.iata, n: `${a.iata} · ${a.city} ${a.nameKo}` })));
const AIRDATA_JSON = JSON.stringify(Object.fromEntries(AIRPORTS.map((a) => [a.iata, { c: a.city, n: a.nameKo, lat: a.lat, lon: a.lon, tz: a.tz }])));
const COUNTRY_JSON = JSON.stringify(COUNTRIES.map((c) => ({
  slug: c.slug, n: c.nameKo, flag: c.flag, v: c.voltage.value, f: c.voltage.freq, p: c.voltage.plugs,
  tz: c.tz.zone, cur: c.currency.code, curN: c.currency.nameKo, tip: c.tip.summary, pct: c.tip.pct,
})));

/* ── 도구 정의 ──────────────────────────────────────────────── */
const TOOLS = [
{
  slug: "currency", emoji: "💱", nav: "환율 계산기",
  hubName: "환율 계산기", hubDesc: "원화↔28개 통화를 공개 환율 API로 실시간 환산. 24시간 캐시와 오프라인 폴백까지.",
  title: "환율 계산기 — 원화 환산·실시간 공개 환율 (28개 통화)",
  ogTitle: "환율 계산기 — 원화 환산",
  desc: "달러·엔·유로·위안 등 28개 통화를 원화로 환산합니다. 유럽중앙은행 기준환율 공개 API를 브라우저에서 직접 불러오고 24시간 캐시하며, 연결이 안 되면 마지막 환율을 표시합니다. 참고용이며 은행 고시 환율이 아닙니다.",
  h1: "환율 계산기",
  lead: `금액과 통화만 고르면 <strong>바로 환산</strong>됩니다. 환율은 공개 API에서 불러와 24시간 저장하고, 연결이 끊겨도 마지막 값을 보여줍니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>금액·통화 선택</h2>
    <label class="f">금액
      <input type="number" id="amt" inputmode="decimal" min="0" step="any" value="100" />
    </label>
    <div class="grid2" style="margin-top:12px">
      <label class="f">바꿀 통화 <select id="from"></select></label>
      <label class="f">받을 통화 <select id="to"></select></label>
    </div>
    <div class="row">
      <button class="btn2" id="swapBtn" type="button">⇅ 통화 바꾸기</button>
      <button class="btn2" id="refreshBtn" type="button">🔄 환율 새로 받기</button>
    </div>
    <button class="btn" id="goBtn" type="button">환율 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>환산 결과</h2>
      <p class="big"><span class="num" id="out">-</span></p>
      <div id="rateLines"></div>
      <div id="quickTbl"></div>
      <p class="note" id="fxStatus"></p>
      <div class="share">
        <button class="btn2" id="copyBtn" type="button">📋 결과 복사</button>
        <button class="btn2" id="linkBtn" type="button">🔗 링크 복사</button>
      </div>
    </div>
  </section>

  <section class="card" aria-label="통화쌍 바로가기">
    <h2>자주 찾는 통화쌍</h2>
    <div class="chips">
      ${["USD", "JPY", "EUR", "CNY", "GBP", "THB", "SGD", "AUD"].map((c) => `<a class="chip" href="${c.toLowerCase()}-krw/">${CUR_BY[c] ? CUR_BY[c].flag : ""} ${c} → KRW</a>`).join("\n      ")}
    </div>
  </section>`,
  intro: `<h2>왜 또 하나의 환율 계산기인가</h2>
  <p>포털 환율은 대개 "매매기준율" 하나만 보여주고, 앱은 설치를 요구합니다. 이 계산기는 설치 없이 열자마자 계산되고, <strong>왜 그 숫자가 나왔는지</strong>(어느 기관 기준환율인지, 언제 받아온 값인지)를 화면에 같이 적어 둡니다.</p>
  <p>또 하나 중요한 점은 <strong>연결이 끊겼을 때의 동작</strong>입니다. 해외 로밍이 불안정한 상황에서 환율 앱이 빈 화면을 띄우면 아무 쓸모가 없습니다. 이 계산기는 받아온 환율을 브라우저에 24시간 저장해 두고, 네트워크가 실패하면 "마지막으로 받아온 환율"이라고 명시한 뒤 그 값으로 계산합니다. 저장된 값조차 없으면 아무 숫자도 지어내지 않고 안내만 표시합니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>금액을 입력하고 바꿀 통화 / 받을 통화를 고릅니다.</li>
    <li>"환율 계산하기"를 누르면 환산 금액과 함께 <strong>1단위 환율·역환율</strong>, 그리고 1·10·100·1,000 단위 빠른 표가 나옵니다.</li>
    <li>환율이 오래됐다고 느껴지면 "환율 새로 받기"로 강제 갱신합니다(24시간 캐시 무시).</li>
    <li>결과 아래 "링크 복사"로 같은 조건의 계산 화면을 그대로 공유할 수 있습니다.</li>
  </ol>
  <h2>실제 환전할 때 이 숫자와 달라지는 이유</h2>
  <p>여기 표시되는 값은 기관 간 거래에 쓰이는 <strong>기준환율</strong>입니다. 실제 은행·환전소·카드사는 여기에 스프레드(살 때/팔 때 차이)와 수수료를 붙입니다. 현금 환전은 보통 기준환율보다 불리하고, 해외 카드 결제는 카드사 매입 환율에 해외이용수수료가 더해집니다. 따라서 이 화면의 숫자는 <strong>"대략 얼마인지 감을 잡는 용도"</strong>로 쓰고, 실제 지불액은 은행 고시 환율로 확인하세요.</p>`,
  faq: [
    { q: "환율은 얼마나 자주 갱신되나요?", a: "브라우저에 24시간 캐시합니다. 그 사이에도 '환율 새로 받기' 버튼을 누르면 즉시 다시 받아옵니다. 기준환율 자체는 영업일 기준으로 하루 한 번 갱신되므로 주말·공휴일에는 직전 영업일 값이 표시됩니다." },
    { q: "비행기 안이나 데이터가 없는 곳에서도 되나요?", a: "한 번이라도 환율을 받아온 적이 있다면 됩니다. 저장된 환율로 계산하고 화면에 '마지막으로 받아온 환율'이라고 표시합니다. 한 번도 받아온 적이 없으면 계산하지 않고 안내 메시지만 보여줍니다." },
    { q: "은행에서 환전하면 이 금액 그대로 받나요?", a: "아닙니다. 표시되는 값은 기준환율이며 실제로는 환전 스프레드와 수수료가 붙습니다. 참고용이며 은행 고시 환율이 아닙니다." },
    { q: "베트남 동(VND)이나 대만 달러(TWD)는 왜 없나요?", a: "무료 공개 환율 API가 지원하는 통화만 선택지에 넣었습니다. 없는 통화를 넣고 임의의 값을 표시하는 대신, 지원되는 통화만 정확하게 보여주는 쪽을 택했습니다." },
  ],
  basis: FX_BOX,
  related: [T.budget, T.split, T.china],
  script: `
import { $, showAd, fillSelect, copyText, esc } from "__U__assets/app.mjs";
import { getRates, rateOf, fxFmt, fetchedLabel, FX_DISCLAIMER } from "__U__lib/fx.mjs";
const OPTS = ${CUR_JSON};
const q = new URLSearchParams(location.search);
const from = $("from"), to = $("to"), amt = $("amt");
fillSelect(from, OPTS, q.get("from") || "USD");
fillSelect(to, OPTS, q.get("to") || "KRW");
if (q.get("amt")) amt.value = q.get("amt");
let state = null;
function status(st) {
  if (!st) return "";
  if (!st.ok) return "⚠ " + esc(st.message);
  const when = fetchedLabel(st);
  const stale = st.stale ? "<strong>마지막으로 받아온 환율</strong>을 사용 중입니다. " + esc(st.message) + " " : "";
  return stale + "출처: " + esc(st.src || "저장된 값") + (st.date ? " · 기준일 " + esc(st.date) : "") + (when ? " · 받아온 시각 " + esc(when) : "") + "<br />" + FX_DISCLAIMER;
}
async function run(force) {
  const f = from.value, t = to.value, a = Number(amt.value) || 0;
  $("resultBox").hidden = false;
  $("fxStatus").innerHTML = "환율을 불러오는 중…";
  state = await getRates(f, { force: !!force });
  $("fxStatus").innerHTML = status(state);
  const r = rateOf(state, f, t);
  if (r == null) { $("out").textContent = "-"; $("rateLines").innerHTML = ""; $("quickTbl").innerHTML = ""; showAd(); return; }
  $("out").textContent = fxFmt(a * r, t) + " " + t;
  $("rateLines").innerHTML =
    '<div class="fxline"><span>1 ' + f + "</span><b>" + fxFmt(r, t) + " " + t + "</b></div>" +
    '<div class="fxline"><span>1 ' + t + "</span><b>" + fxFmt(1 / r, f) + " " + f + "</b></div>";
  const units = [1, 10, 100, 1000, 10000];
  $("quickTbl").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>' + f + "</th><th>" + t + '</th></tr></thead><tbody>' +
    units.map((u) => "<tr><td>" + u.toLocaleString("ko-KR") + "</td><td>" + fxFmt(u * r, t) + "</td></tr>").join("") + "</tbody></table></div>";
  showAd();
}
$("goBtn").addEventListener("click", () => run(false));
$("refreshBtn").addEventListener("click", () => run(true));
$("swapBtn").addEventListener("click", () => { const a = from.value; from.value = to.value; to.value = a; run(false); });
$("copyBtn").addEventListener("click", () => copyText(amt.value + " " + from.value + " = " + $("out").textContent + " (tripcalc-kr.vercel.app/currency)"));
$("linkBtn").addEventListener("click", () => {
  const u = new URL(location.href);
  u.search = "?amt=" + encodeURIComponent(amt.value) + "&from=" + from.value + "&to=" + to.value;
  copyText(u.toString(), "링크를 복사했습니다");
});
run(false);
`,
},
{
  slug: "timezone", emoji: "🕐", nav: "세계 시차 계산기",
  hubName: "세계 시차 계산기", hubDesc: "한국 시각 ↔ 현지 시각 변환. 서머타임은 IANA 타임존으로 자동 반영됩니다.",
  title: "세계 시차 계산기 — 한국 시각 ↔ 현지 시각 (서머타임 자동)",
  ogTitle: "세계 시차 계산기 — 현지 시각 변환",
  desc: "도시를 고르면 지금 현지 시각과 한국과의 시차를 보여주고, 특정 날짜·시각을 현지 시각으로 변환합니다. 서머타임은 IANA 타임존 데이터로 자동 반영되어 하드코딩된 시차표보다 정확합니다.",
  h1: "세계 시차 계산기",
  lead: `도시를 고르면 <strong>지금 현지 시각</strong>과 한국과의 시차가 바로 나옵니다. 서머타임은 자동 반영됩니다.`,
  body: `
  <section class="card" aria-label="도시 선택">
    <h2>도시 선택 (여러 개 가능)</h2>
    <div class="grid2">
      <label class="f">도시 추가 <select id="citySel"></select></label>
      <label class="f">&nbsp;<button class="btn2" id="addBtn" type="button" style="width:100%;padding:11px">➕ 시계 추가</button></label>
    </div>
    <div class="chips" id="picked"></div>
    <button class="btn" id="goBtn" type="button">현지 시각 보기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>지금 이 순간</h2>
      <div id="clocks"></div>
      <p class="note">기준: 대한민국 서울(Asia/Seoul, UTC+09:00, 서머타임 없음). 시차는 브라우저의 IANA 타임존 데이터로 계산합니다.</p>
    </div>
    <div class="card">
      <h2>특정 시각 변환</h2>
      <div class="grid2">
        <label class="f">한국 날짜·시각 <input type="datetime-local" id="when" /></label>
        <label class="f">&nbsp;<button class="btn2" id="convBtn" type="button" style="width:100%;padding:11px">🔁 현지 시각으로 변환</button></label>
      </div>
      <div id="convOut"></div>
    </div>
  </section>`,
  intro: `<h2>시차표를 외우지 않아도 되는 이유</h2>
  <p>"파리는 한국보다 8시간 느리다"는 문장은 절반만 맞습니다. 유럽은 3월 마지막 일요일부터 10월 마지막 일요일까지 서머타임을 시행해 그 기간에는 7시간 차이가 됩니다. 미국은 시행 기간이 유럽과 다르고, 호주는 남반구라 방향이 반대이며, 같은 나라 안에서도 주(州)별로 시행 여부가 갈립니다.</p>
  <p>그래서 이 도구는 시차를 표로 저장해 두지 않습니다. 도시마다 <strong>IANA 타임존 ID</strong>(예: <code>Europe/Paris</code>)만 저장해 두고, 실제 시차는 계산하는 순간 브라우저의 타임존 데이터베이스에서 구합니다. 서머타임 전환일이 바뀌어도, 어떤 나라가 서머타임을 폐지해도 결과가 자동으로 따라갑니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>도시를 골라 "시계 추가"를 누릅니다. 여러 도시를 동시에 볼 수 있습니다(칩을 다시 누르면 삭제).</li>
    <li>"현지 시각 보기"를 누르면 각 도시의 현재 시각과 서울 대비 시차가 1초마다 갱신됩니다.</li>
    <li>아래 "특정 시각 변환"에 한국 날짜·시각을 넣으면 그 순간의 각 도시 현지 시각을 계산합니다. 화상회의·국제전화 약속 잡을 때 씁니다.</li>
  </ol>`,
  faq: [
    { q: "서머타임이 자동으로 반영되나요?", a: "네. 시차를 저장하지 않고 IANA 타임존 데이터베이스를 브라우저 Intl API로 조회해 계산하므로, 서머타임 시행·해제가 그대로 반영됩니다. 화면에도 현재 서머타임 적용 여부를 표시합니다." },
    { q: "같은 나라인데 도시마다 시각이 다르게 나옵니다.", a: "정상입니다. 미국·캐나다·호주·인도네시아 등은 한 나라에 여러 시간대가 있습니다. 그래서 이 도구는 국가가 아니라 도시(공항 소재지) 단위로 시각을 계산합니다." },
    { q: "날짜가 하루 앞서거나 뒤처져 보입니다.", a: "시차가 큰 지역에서는 흔한 일입니다. 각 시계에 요일과 날짜를 함께 표시하니 '어제/오늘/내일'을 반드시 확인하세요." },
  ],
  basis: TZ_BOX,
  related: [T.pin, T.china],
  script: `
import { $, showAd, fillSelect, esc } from "__U__assets/app.mjs";
import { offsetMinutes, offsetLabel, diffHours, diffLabel, localParts, isDst } from "__U__lib/tz.mjs";
const CITIES = ${CITY_JSON};
const SEOUL = "Asia/Seoul";
fillSelect($("citySel"), CITIES, "Asia/Tokyo|도쿄");
const q = new URLSearchParams(location.search);
let picked = (q.get("c") || "도쿄,파리,뉴욕").split(",").map((n) => CITIES.find((c) => c.n === n)).filter(Boolean);
function renderChips() {
  $("picked").innerHTML = picked.map((c, i) => '<button class="chip" aria-pressed="true" data-i="' + i + '" type="button">' + esc(c.n) + ' ✕</button>').join("");
  [...$("picked").querySelectorAll("button")].forEach((b) => b.addEventListener("click", () => { picked.splice(+b.dataset.i, 1); renderChips(); }));
}
$("addBtn").addEventListener("click", () => {
  const v = $("citySel").value;
  const c = CITIES.find((x) => x.v === v);
  if (c && !picked.some((p) => p.v === c.v) && picked.length < 8) picked.push(c);
  renderChips();
});
renderChips();
let timer = null;
function tick() {
  const now = new Date();
  $("clocks").innerHTML = picked.map((c) => {
    const [tz, name] = c.v.split("|");
    const p = localParts(tz, now);
    const d = diffHours(SEOUL, tz, now);
    const dst = isDst(tz, now) ? ' <span class="badge ok">서머타임</span>' : "";
    return '<div class="clock"><div><div class="city">' + esc(name) + dst + '</div><div class="zone">' + esc(tz) + " · UTC" + offsetLabel(offsetMinutes(tz, now)) + " · 서울 대비 " + esc(diffLabel(d)) + '</div></div>' +
      '<div><div class="time">' + String(p.h).padStart(2, "0") + ":" + String(p.mi).padStart(2, "0") + '</div><div class="day">' + p.m + "/" + p.d + " (" + p.wd + ")</div></div></div>";
  }).join("") || '<p class="note">도시를 추가하세요.</p>';
}
$("goBtn").addEventListener("click", () => {
  $("resultBox").hidden = false;
  tick();
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
  showAd();
});
function pad(n) { return String(n).padStart(2, "0"); }
const n0 = new Date();
$("when").value = n0.getFullYear() + "-" + pad(n0.getMonth() + 1) + "-" + pad(n0.getDate()) + "T" + pad(n0.getHours()) + ":00";
$("convBtn").addEventListener("click", () => {
  const v = $("when").value;
  if (!v) return;
  const [ds, ts] = v.split("T");
  const [y, mo, da] = ds.split("-").map(Number);
  const [hh, mi] = ts.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, hh, mi) - offsetMinutes(SEOUL, new Date(Date.UTC(y, mo - 1, da, hh, mi))) * 60000;
  const at = new Date(guess);
  $("convOut").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>도시</th><th>현지 날짜</th><th>현지 시각</th></tr></thead><tbody>' +
    picked.map((c) => {
      const [tz, name] = c.v.split("|");
      const p = localParts(tz, at);
      return "<tr><td>" + esc(name) + "</td><td>" + p.y + "-" + pad(p.m) + "-" + pad(p.d) + " (" + p.wd + ")</td><td>" + pad(p.h) + ":" + pad(p.mi) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
});
`,
},
{
  slug: "meeting-time", emoji: "🤝", nav: "회의 시간 찾기",
  hubName: "국제 회의 시간 찾기", hubDesc: "여러 도시의 근무시간이 겹치는 시간대를 24시간 표로 한눈에.",
  title: "국제 회의 시간 찾기 — 여러 나라 근무시간 겹치는 시간대",
  ogTitle: "국제 회의 시간 찾기",
  desc: "서울·뉴욕·런던처럼 시차가 다른 도시들의 근무시간이 겹치는 구간을 24시간 표로 보여줍니다. 주말 여부까지 표시해 화상회의·국제전화 시간을 정할 수 있습니다. 서머타임 자동 반영.",
  h1: "국제 회의 시간 찾기",
  lead: `여러 도시의 <strong>근무시간이 겹치는 구간</strong>을 24시간 표로 찾아줍니다. 주말이면 주말이라고 알려줍니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>참여 도시 (2~6곳)</h2>
    <div class="grid2">
      <label class="f">도시 추가 <select id="citySel"></select></label>
      <label class="f">&nbsp;<button class="btn2" id="addBtn" type="button" style="width:100%;padding:11px">➕ 추가</button></label>
    </div>
    <div class="chips" id="picked"></div>
    <div class="grid3" style="margin-top:14px">
      <label class="f">근무 시작 <input type="number" id="ws" min="0" max="23" value="9" /></label>
      <label class="f">근무 종료 <input type="number" id="we" min="1" max="24" value="18" /></label>
      <label class="f">기준 날짜 <input type="date" id="day" /></label>
    </div>
    <button class="btn" id="goBtn" type="button">겹치는 시간 찾기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>겹치는 시간대</h2>
      <p class="big"><span class="num" id="bestOut">-</span></p>
      <p class="note" id="bestNote"></p>
      <div class="slots" id="grid"></div>
      <p class="note">초록색 = 그 도시의 근무시간(주말 제외) 안. 표의 각 줄은 같은 순간을 각 도시 현지 시각으로 표시한 것입니다.</p>
      <div class="share">
        <button class="btn2" id="linkBtn" type="button">🔗 이 조합 링크 복사</button>
        <button class="btn2" id="textBtn" type="button">📋 회의 후보 시간 복사</button>
      </div>
    </div>
  </section>`,
  intro: `<h2>"몇 시에 하면 되죠?"를 끝내는 표</h2>
  <p>서울·런던·뉴욕이 함께 회의를 잡으려면 세 도시의 근무시간이 동시에 열려 있는 구간을 찾아야 합니다. 그런데 서울과 뉴욕은 13~14시간 차이라 하루 중 겹치는 구간이 거의 없고, 있어도 한쪽이 이른 아침이거나 늦은 저녁입니다. 머릿속으로 더하고 빼다 보면 날짜를 하루 착각하기 쉽습니다.</p>
  <p>이 도구는 하루 24개 슬롯 각각에 대해 모든 도시의 현지 시각을 계산해 근무시간 안인지, 주말인지 표시합니다. 완전히 겹치는 구간이 있으면 가장 긴 구간을 뽑아 알려주고, 하나도 없으면 없다고 분명히 말합니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>참여 도시를 2~6곳 추가합니다(칩을 누르면 삭제).</li>
    <li>근무 시작·종료 시각을 조정합니다. 기본은 9시~18시이고, 유연근무라면 8~20처럼 넓혀도 됩니다.</li>
    <li>기준 날짜를 고릅니다. 주말 여부와 서머타임 적용이 날짜에 따라 달라지므로 실제 회의 예정일을 넣는 것이 좋습니다.</li>
    <li>"겹치는 시간 찾기"를 누르면 24시간 표와 가장 긴 공통 구간이 나옵니다.</li>
  </ol>`,
  faq: [
    { q: "겹치는 시간이 하나도 없다고 나옵니다.", a: "서울과 미국 동부처럼 시차가 13~14시간이면 9~18시 기준으로는 겹치는 구간이 없는 것이 정상입니다. 근무 시간을 8~20시로 넓히거나, 한쪽이 이른 아침/늦은 저녁을 감수하는 시간을 골라야 합니다. 표에서 초록색 칸이 가장 많은 줄을 참고하세요." },
    { q: "주말은 어떻게 처리되나요?", a: "각 도시의 현지 요일이 토·일이면 근무시간이라도 겹침에서 제외하고 노란색으로 표시합니다. 중동 등 주말이 금·토인 지역은 이 규칙과 다를 수 있으니 표의 현지 요일을 직접 확인하세요." },
    { q: "서머타임 때문에 결과가 달라지나요?", a: "네, 그래서 기준 날짜를 입력받습니다. 3월과 11월처럼 전환 시기 전후로 겹치는 구간이 한 시간씩 밀릴 수 있어 실제 회의 날짜로 계산하는 것이 정확합니다." },
  ],
  basis: TZ_BOX,
  related: [T.pin, T.split],
  script: `
import { $, showAd, fillSelect, esc, copyText } from "__U__assets/app.mjs";
import { overlapSlots, bestBlocks, localParts } from "__U__lib/tz.mjs";
const CITIES = ${CITY_JSON};
fillSelect($("citySel"), CITIES, "Asia/Seoul|서울");
const q = new URLSearchParams(location.search);
let picked = (q.get("c") || "서울,런던,뉴욕").split(",").map((n) => CITIES.find((c) => c.n === n)).filter(Boolean);
function pad(n) { return String(n).padStart(2, "0"); }
function renderChips() {
  $("picked").innerHTML = picked.map((c, i) => '<button class="chip" aria-pressed="true" data-i="' + i + '" type="button">' + esc(c.n) + ' ✕</button>').join("");
  [...$("picked").querySelectorAll("button")].forEach((b) => b.addEventListener("click", () => { picked.splice(+b.dataset.i, 1); renderChips(); }));
}
$("addBtn").addEventListener("click", () => {
  const c = CITIES.find((x) => x.v === $("citySel").value);
  if (c && !picked.some((p) => p.v === c.v) && picked.length < 6) picked.push(c);
  renderChips();
});
renderChips();
const t0 = new Date();
$("day").value = t0.getFullYear() + "-" + pad(t0.getMonth() + 1) + "-" + pad(t0.getDate());
let lastText = "";
function run() {
  if (picked.length < 2) { alert("도시를 2곳 이상 골라주세요."); return; }
  const ws = Math.max(0, Math.min(23, +$("ws").value || 9));
  const we = Math.max(ws + 1, Math.min(24, +$("we").value || 18));
  const [y, m, d] = $("day").value.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const zones = picked.map((c) => { const [tz, label] = c.v.split("|"); return { tz, label }; });
  const slots = overlapSlots(zones, { start: ws, end: we }, base);
  const blocks = bestBlocks(slots);
  $("resultBox").hidden = false;
  if (blocks.length) {
    const b = blocks[0];
    const cells = b.from.cells.map((c, i) => c.label + " " + pad(c.h) + ":00");
    $("bestOut").textContent = b.len + "시간 겹침";
    lastText = "겹치는 시간: " + cells.join(" / ") + " 부터 " + b.len + "시간";
    $("bestNote").innerHTML = "가장 긴 공통 구간 시작 시각 — " + esc(cells.join(" · ")) + " (총 " + b.len + "시간)";
  } else {
    $("bestOut").textContent = "겹치는 구간 없음";
    lastText = "이 조건으로는 겹치는 근무시간이 없습니다.";
    $("bestNote").textContent = "근무 시간을 넓히거나(예: 8~20시) 한쪽이 이른 아침·늦은 저녁을 감수해야 합니다. 아래 표에서 초록 칸이 가장 많은 줄을 고르세요.";
  }
  const head = "<tr><th>UTC</th>" + zones.map((z) => "<th>" + esc(z.label) + "</th>").join("") + "<th>겹침</th></tr>";
  const rows = slots.map((s) => {
    const cls = s.all ? ' class="best"' : "";
    return "<tr" + cls + "><td>" + pad(s.utcHour) + ":00</td>" + s.cells.map((c) =>
      '<td class="' + (c.ok ? "on" : c.weekend ? "wknd" : "off") + '">' + pad(c.h) + ":00<br /><span class=\\"mini\\">" + c.wd + "</span></td>").join("") +
      "<td>" + s.okCount + "/" + zones.length + "</td></tr>";
  }).join("");
  $("grid").innerHTML = "<table><thead>" + head + "</thead><tbody>" + rows + "</tbody></table>";
  showAd();
}
$("goBtn").addEventListener("click", run);
$("linkBtn").addEventListener("click", () => {
  const u = new URL(location.href);
  u.search = "?c=" + encodeURIComponent(picked.map((p) => p.n).join(","));
  copyText(u.toString(), "링크를 복사했습니다");
});
$("textBtn").addEventListener("click", () => copyText(lastText + "\\n(tripcalc-kr.vercel.app/meeting-time)"));
`,
},
{
  slug: "packing-list", emoji: "🎒", nav: "짐 싸기 목록",
  hubName: "여행 짐 싸기 목록", hubDesc: "기후·기간·여행 유형을 고르면 체크리스트를 만들어 줍니다. 저장·공유·내보내기 지원.",
  title: "여행 짐 싸기 목록 만들기 — 기후·기간·유형별 체크리스트",
  ogTitle: "여행 짐 싸기 체크리스트 만들기",
  desc: "목적지 기후(더운 나라·온화·추운 곳·건조), 여행 기간, 여행 유형(관광·휴양·액티비티·출장·아이 동반)을 고르면 빠뜨리기 쉬운 항목까지 포함한 짐 목록을 만들어 줍니다. 체크 상태는 브라우저에 저장되고 링크로 공유할 수 있습니다.",
  h1: "여행 짐 싸기 목록",
  lead: `기후·기간·유형만 고르면 <strong>체크리스트가 만들어집니다</strong>. 체크 상태는 이 브라우저에 저장되고, 링크로 공유할 수 있습니다.`,
  body: `
  <div id="ctaBox" hidden></div>
  <section class="card" aria-label="입력">
    <h2>여행 조건</h2>
    <span class="f" style="display:block">목적지 기후</span>
    <div class="chips" id="climate">
      <button class="chip" type="button" data-v="tropical" aria-pressed="false">🌴 더운 나라</button>
      <button class="chip" type="button" data-v="temperate" aria-pressed="true">🍃 온화</button>
      <button class="chip" type="button" data-v="cold" aria-pressed="false">❄️ 추운 곳</button>
      <button class="chip" type="button" data-v="desert" aria-pressed="false">🏜️ 건조·사막</button>
    </div>
    <span class="f" style="display:block;margin-top:14px">여행 유형</span>
    <div class="chips" id="ttype">
      <button class="chip" type="button" data-v="city" aria-pressed="true">🏙️ 도시 관광</button>
      <button class="chip" type="button" data-v="resort" aria-pressed="false">🏖️ 휴양</button>
      <button class="chip" type="button" data-v="activity" aria-pressed="false">🥾 액티비티</button>
      <button class="chip" type="button" data-v="business" aria-pressed="false">💼 출장</button>
      <button class="chip" type="button" data-v="family" aria-pressed="false">👨‍👩‍👧 아이 동반</button>
    </div>
    <span class="f" style="display:block;margin-top:14px">추가 조건 (복수 선택)</span>
    <div class="chips" id="opts">
      <button class="chip" type="button" data-v="carryonly" aria-pressed="false">🧳 기내 수하물만</button>
      <button class="chip" type="button" data-v="swim" aria-pressed="false">🏊 물놀이</button>
      <button class="chip" type="button" data-v="camera" aria-pressed="false">📷 카메라</button>
      <button class="chip" type="button" data-v="longhaul" aria-pressed="false">✈️ 장거리 비행</button>
      <button class="chip" type="button" data-v="driving" aria-pressed="false">🚗 렌터카</button>
    </div>
    <label class="f" style="margin-top:14px;display:block">여행 기간 <span class="u">(박이 아닌 총 일수)</span>
      <input type="number" id="days" min="1" max="60" value="5" />
    </label>
    <button class="btn" id="goBtn" type="button">짐 목록 만들기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>내 짐 목록 <span class="mini" id="progress"></span></h2>
      <div class="bar"><i id="barFill" style="width:0%"></i></div>
      <div id="qty"></div>
      <div id="list"></div>
      ${NO_SERVER}
      <div class="share">
        <button class="btn2" id="linkBtn" type="button">🔗 링크 복사</button>
        <button class="btn2" id="textBtn" type="button">📋 목록 텍스트 복사</button>
        <button class="btn2" id="expBtn" type="button">⬇️ 텍스트로 내보내기</button>
        <button class="btn2" id="xBtn" type="button">𝕏 공유</button>
        <button class="btn2" id="shareBtn" type="button">📤 공유</button>
        <button class="btn2" id="clearBtn" type="button">🗑️ 저장 기록 전체 삭제</button>
      </div>
    </div>
  </section>`,
  intro: `<h2>짐은 "빠뜨린 것" 때문에 문제가 됩니다</h2>
  <p>여행 짐에서 진짜 문제는 많이 싸는 게 아니라 <strong>하나를 빠뜨리는 것</strong>입니다. 보조배터리를 위탁 수하물에 넣어 공항에서 꺼내야 하거나, 렌터카를 예약해 두고 국제운전면허증을 안 챙기거나, 한겨울 유럽에서 립밤 하나가 없어 고생하는 식입니다.</p>
  <p>이 도구는 목적지 기후·기간·여행 유형을 조합해 <strong>그 조건에서 실제로 필요한 항목</strong>만 추립니다. 예를 들어 "기내 수하물만"을 고르면 액체류 100mL 규정이, "렌터카"를 고르면 국제운전면허증·국내면허증·여권 3종 세트가 목록에 추가됩니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>기후·여행 유형·추가 조건을 고르고 기간을 입력합니다.</li>
    <li>"짐 목록 만들기"를 누르면 카테고리별 체크리스트와 <strong>기간에 맞는 수량 가이드</strong>(상의 몇 벌, 속옷 몇 세트)가 나옵니다.</li>
    <li>체크한 상태는 이 브라우저에 자동 저장됩니다. 짐을 싸면서 하나씩 지워 나가면 됩니다.</li>
    <li>"링크 복사"로 같은 조건의 목록을 동행에게 보내고, "텍스트로 내보내기"로 파일 저장할 수 있습니다.</li>
    <li>"저장 기록 전체 삭제"를 누르면 이 브라우저에 저장된 내용이 즉시 지워집니다.</li>
  </ol>`,
  faq: [
    { q: "체크한 내용이 다른 기기에서도 보이나요?", a: "아니요. 서버에 저장하지 않고 이 브라우저의 localStorage에만 저장하므로 기기·브라우저가 바뀌면 보이지 않습니다. 다른 기기로 옮기려면 '링크 복사'로 조건을 공유하거나 '텍스트로 내보내기'를 사용하세요." },
    { q: "보조배터리는 왜 기내 반입만 되나요?", a: "리튬 배터리는 위탁 수하물에 넣을 수 없고 기내에 들고 타야 합니다. 용량 제한(대개 100Wh 이하 자유, 100~160Wh는 항공사 승인)이 있으므로 대용량 배터리는 항공사 규정을 확인하세요." },
    { q: "액체류는 얼마나 가져갈 수 있나요?", a: "기내 반입은 개별 용기 100mL 이하로, 모두 합쳐 1L 투명 지퍼백 1개에 들어가야 합니다. 위탁 수하물에는 이 제한이 없습니다. 자세한 기준은 이용 공항·항공사 안내를 확인하세요." },
    { q: "목록에 없는 항목을 추가할 수 있나요?", a: "현재는 생성된 항목을 체크하는 방식만 지원합니다. 개인 항목은 '텍스트로 내보내기' 후 메모 앱에서 덧붙이는 방식을 권합니다." },
  ],
  disclaimer: DISC("기내 반입·위탁 수하물 규정은 항공사와 출발 공항에 따라 다르므로 반드시 항공사 공지를 확인하세요."),
  related: [T.packing, T.budget, T.pin],
  script: `
import { $, showAd, esc, segInit, multiInit, copyText, store, download, readR, shareUrl, sharedCta, wireShare } from "__U__assets/app.mjs";
import { buildList } from "__U__lib/packing.mjs";
const S = store("tc-packing-v1");
const cl = segInit($("climate"));
const ty = segInit($("ttype"));
const op = multiInit($("opts"));
let checked = new Set();
const shared = readR();
const saved = S.load(null);
const init = shared || saved;
if (init) {
  cl.set(init.climate); ty.set(init.type); op.set(init.options || []);
  $("days").value = init.days || 5;
  checked = new Set(init.checked || []);
}
if (shared) sharedCta($("ctaBox"), "나도 내 짐 목록 만들기");
function stateOf() {
  return { climate: cl.get(), type: ty.get(), options: op.get(), days: +$("days").value || 5, checked: [...checked] };
}
let cur = null;
function render() {
  const st = stateOf();
  cur = buildList(st);
  $("qty").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>' + st.days + '일 기준 수량 가이드</th><th>권장</th></tr></thead><tbody>' +
    cur.quantities.map((q) => "<tr><td>" + esc(q.name) + "</td><td>" + esc(q.qty) + "</td></tr>").join("") + "</tbody></table></div>";
  $("list").innerHTML = cur.groups.map((g) =>
    '<div class="grp"><h3>' + esc(g.cat) + '<span class="c">' + g.items.length + '개</span></h3><ul class="list">' +
    g.items.map((it) => {
      const on = checked.has(it.name);
      return '<li class="' + (on ? "done" : "") + '"><input type="checkbox" data-n="' + esc(it.name) + '"' + (on ? " checked" : "") + ' /><span class="nm">' + esc(it.name) +
        (it.note ? '<span class="hint">' + esc(it.note) + "</span>" : "") + "</span></li>";
    }).join("") + "</ul></div>").join("");
  [...$("list").querySelectorAll("input")].forEach((b) => b.addEventListener("change", () => {
    if (b.checked) checked.add(b.dataset.n); else checked.delete(b.dataset.n);
    b.closest("li").classList.toggle("done", b.checked);
    S.save(stateOf());
    progress();
  }));
  progress();
  S.save(st);
}
function progress() {
  const total = cur ? cur.count : 0;
  const done = cur ? cur.groups.reduce((s, g) => s + g.items.filter((i) => checked.has(i.name)).length, 0) : 0;
  $("progress").textContent = done + " / " + total + " 완료";
  $("barFill").style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
}
function asText() {
  if (!cur) return "";
  return "여행 짐 목록 (" + stateOf().days + "일)\\n" + cur.groups.map((g) =>
    "\\n[" + g.cat + "]\\n" + g.items.map((i) => (checked.has(i.name) ? "[v] " : "[ ] ") + i.name).join("\\n")).join("\\n");
}
$("goBtn").addEventListener("click", () => { $("resultBox").hidden = false; render(); showAd(); });
$("expBtn").addEventListener("click", () => download("packing-list.txt", asText()));
$("textBtn").addEventListener("click", () => copyText(asText()));
$("clearBtn").addEventListener("click", () => { S.clear(); checked = new Set(); render(); alert("이 브라우저에 저장된 짐 목록 기록을 삭제했습니다."); });
wireShare({
  linkBtn: $("linkBtn"), textBtn: null, xBtn: $("xBtn"), shareBtn: $("shareBtn"),
  getUrl: () => shareUrl(stateOf()),
  getText: () => "여행 짐 목록 " + (cur ? cur.count : 0) + "개 항목을 만들었어요",
  title: "여행 짐 싸기 목록",
});
if (init) { $("resultBox").hidden = false; render(); showAd(); }
`,
},
{
  slug: "budget", emoji: "💰", nav: "여행 예산 계산기",
  hubName: "여행 예산 계산기", hubDesc: "항목별 예산을 현지 통화로 넣으면 환율로 원화 환산 + 1인당·하루당·N빵까지.",
  title: "여행 예산 계산기 — 항목별·1인당·N빵 정산 (환율 연동)",
  ogTitle: "여행 예산 계산기 — 1인당·N빵",
  desc: "항공·숙소·식비·교통·액티비티를 현지 통화로 입력하면 공개 환율 API로 원화 환산해 총액·1인당·하루당 예산을 계산하고, 누가 얼마 냈는지 넣으면 N빵 정산 송금 내역까지 만들어 줍니다. 저장은 브라우저에만 합니다.",
  h1: "여행 예산 계산기",
  lead: `항목별 예산을 <strong>현지 통화 그대로</strong> 넣으면 환율로 원화 환산해 총액·1인당·하루당까지 계산합니다. N빵 정산도 함께.`,
  body: `
  <div id="ctaBox" hidden></div>
  <section class="card" aria-label="여행 조건">
    <h2>여행 조건</h2>
    <div class="grid3">
      <label class="f">인원 <span class="u">(명)</span><input type="number" id="people" min="1" max="30" value="2" /></label>
      <label class="f">기간 <span class="u">(일)</span><input type="number" id="days" min="1" max="90" value="5" /></label>
      <label class="f">현지 통화 <select id="cur"></select></label>
    </div>
    <p class="note" id="fxNote">환율은 결과를 계산할 때 불러옵니다.</p>
  </section>

  <section class="card" aria-label="예산 항목">
    <h2>항목별 예산</h2>
    <p class="note" style="margin-top:0">각 항목의 단위(총액 / 1인당 / 1인 1일)를 함께 고르세요. 금액은 원화(KRW)나 현지 통화 중 하나로 넣습니다.</p>
    <div id="rows"></div>
    <button class="btn" id="goBtn" type="button">예산 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>예산 합계</h2>
      <p class="big">총 예산 <span class="num" id="total">-</span></p>
      <dl class="kv" id="summary"></dl>
      <div id="breakdown"></div>
      <p class="note" id="fxStatus"></p>
    </div>
    <div class="card">
      <h2>N빵 정산 — 누가 얼마 냈나</h2>
      <div id="payers"></div>
      <div class="row">
        <button class="btn2" id="addPayer" type="button">➕ 사람 추가</button>
        <button class="btn2" id="settleBtn" type="button">🧮 정산하기</button>
      </div>
      <div id="settleOut"></div>
    </div>
    <div class="card">
      <h2>저장·공유</h2>
      ${NO_SERVER}
      <div class="share">
        <button class="btn2" id="saveBtn" type="button">💾 이 브라우저에 저장</button>
        <button class="btn2" id="linkBtn" type="button">🔗 링크 복사</button>
        <button class="btn2" id="expBtn" type="button">⬇️ 텍스트로 내보내기</button>
        <button class="btn2" id="shareBtn" type="button">📤 공유</button>
        <button class="btn2" id="clearBtn" type="button">🗑️ 저장 기록 전체 삭제</button>
      </div>
    </div>
  </section>`,
  intro: `<h2>여행 예산이 항상 빗나가는 이유</h2>
  <p>예산을 세울 때 사람들은 보통 항공권과 숙소만 더합니다. 하지만 실제로 지갑을 여는 건 <strong>매일 반복되는 지출</strong>입니다. 하루 식비 3만 원은 5일이면 15만 원이고, 2명이면 30만 원입니다. 이 계산기가 항목마다 "총액 / 1인당 / 1인 1일" 단위를 따로 받는 이유가 여기에 있습니다.</p>
  <p>또 현지에서 본 가격은 현지 통화입니다. 매번 머리로 환산하다 보면 자릿수를 놓치기 쉽습니다(특히 엔·동·루피아). 여기서는 현지 통화로 그대로 적어 두면 공개 환율 API로 원화 환산해 합산합니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>인원·기간·현지 통화를 정합니다.</li>
    <li>항목별 금액을 넣고 단위를 고릅니다. 예를 들어 항공권은 "1인당", 숙소는 "총액", 식비는 "1인 1일"이 자연스럽습니다.</li>
    <li>"예산 계산하기"를 누르면 총액·1인당·하루당·1인 1일 예산과 항목별 비중이 나옵니다.</li>
    <li>여행이 끝난 뒤에는 아래 "N빵 정산"에 각자 낸 금액을 넣으면 <strong>누가 누구에게 얼마를 보내면 되는지</strong> 송금 횟수를 최소화해 계산합니다.</li>
    <li>저장은 이 브라우저에만 됩니다. "저장 기록 전체 삭제"로 언제든 지울 수 있습니다.</li>
  </ol>`,
  faq: [
    { q: "환율이 안 불러와지면 계산이 안 되나요?", a: "원화(KRW)로 입력한 항목은 그대로 계산됩니다. 현지 통화 항목은 마지막으로 받아온 환율이 있으면 그 값으로 계산하고 화면에 표시합니다. 저장된 환율도 없으면 안내 메시지를 띄우고 환산을 건너뜁니다." },
    { q: "N빵 정산은 어떤 방식인가요?", a: "총 지출을 인원수로 나눠 1인당 부담액을 구한 뒤, 덜 낸 사람에서 더 낸 사람으로 가는 송금 목록을 만듭니다. 큰 금액부터 상계해 송금 횟수를 줄입니다." },
    { q: "입력한 예산이 서버에 저장되나요?", a: "아닙니다. 모든 계산은 브라우저에서 이뤄지고, '저장' 버튼을 눌렀을 때만 이 브라우저의 localStorage에 남습니다. 서버 저장은 없습니다." },
    { q: "예비비는 얼마나 잡아야 하나요?", a: "정답은 없지만 총예산의 10~15%를 별도로 두는 방식이 흔합니다. '보험·로밍·기타' 항목에 예비비를 함께 넣어 계산해 보세요." },
  ],
  basis: FX_BOX,
  disclaimer: DISC("환율은 참고용 기준환율이며 실제 결제 금액은 카드사·환전 수수료에 따라 달라집니다."),
  related: [T.budget, T.split, T.packing],
  script: `
import { $, showAd, esc, fmt, won, copyText, store, download, fillSelect, readR, shareUrl, sharedCta, wireShare, toast } from "__U__assets/app.mjs";
import { totalize, settle, BUDGET_CATS } from "__U__lib/budget.mjs";
import { getRates, rateOf, fetchedLabel, FX_DISCLAIMER } from "__U__lib/fx.mjs";
const OPTS = ${CUR_JSON};
const S = store("tc-budget-v1");
fillSelect($("cur"), OPTS.filter((o) => o.v !== "KRW"), "JPY");
const PER = [["trip", "총액"], ["person", "1인당"], ["personDay", "1인 1일"]];
$("rows").innerHTML = BUDGET_CATS.map((c) =>
  '<div class="grid3" style="margin-top:10px"><label class="f">' + c.emoji + " " + esc(c.name) +
  '<input type="number" min="0" step="any" id="a_' + c.id + '" value="0" /></label>' +
  '<label class="f">통화<select id="c_' + c.id + '"><option value="KRW">KRW 원</option><option value="LOC">현지 통화</option></select></label>' +
  '<label class="f">단위<select id="p_' + c.id + '">' + PER.map((p) => '<option value="' + p[0] + '"' + (p[0] === c.per ? " selected" : "") + ">" + p[1] + "</option>").join("") + "</select></label></div>").join("");
let payers = [{ name: "나", paid: 0 }, { name: "동행 1", paid: 0 }];
function renderPayers() {
  $("payers").innerHTML = payers.map((p, i) =>
    '<div class="grid2" style="margin-top:8px"><label class="f">이름<input type="text" data-k="name" data-i="' + i + '" value="' + esc(p.name) + '" /></label>' +
    '<label class="f">낸 금액(원)<input type="number" data-k="paid" data-i="' + i + '" min="0" value="' + (p.paid || 0) + '" /></label></div>').join("");
  [...$("payers").querySelectorAll("input")].forEach((inp) => inp.addEventListener("input", () => {
    const i = +inp.dataset.i;
    payers[i][inp.dataset.k] = inp.dataset.k === "paid" ? (Number(inp.value) || 0) : inp.value;
  }));
}
renderPayers();
$("addPayer").addEventListener("click", () => { payers.push({ name: "동행 " + payers.length, paid: 0 }); renderPayers(); });
function stateOf() {
  const items = BUDGET_CATS.map((c) => ({
    id: c.id, name: c.name, emoji: c.emoji,
    amount: Number($("a_" + c.id).value) || 0,
    currency: $("c_" + c.id).value === "LOC" ? $("cur").value : "KRW",
    per: $("p_" + c.id).value,
  }));
  return { people: +$("people").value || 1, days: +$("days").value || 1, cur: $("cur").value, items };
}
function applyState(st) {
  if (!st) return;
  $("people").value = st.people; $("days").value = st.days; $("cur").value = st.cur;
  for (const it of st.items || []) {
    if (!$("a_" + it.id)) continue;
    $("a_" + it.id).value = it.amount;
    $("c_" + it.id).value = it.currency === "KRW" ? "KRW" : "LOC";
    $("p_" + it.id).value = it.per;
  }
}
const shared = readR();
applyState(shared || S.load(null));
if (shared) sharedCta($("ctaBox"), "나도 여행 예산 계산하기");
let last = null;
async function run() {
  const st = stateOf();
  $("resultBox").hidden = false;
  const need = st.items.some((i) => i.currency !== "KRW" && i.amount > 0);
  let fx = null;
  if (need) {
    $("fxStatus").textContent = "환율을 불러오는 중…";
    fx = await getRates(st.cur);
    $("fxStatus").innerHTML = fx.ok
      ? (fx.stale ? "<strong>마지막으로 받아온 환율</strong> 사용 중. " : "") + "출처: " + esc(fx.src || "저장된 값") + (fx.date ? " · 기준일 " + esc(fx.date) : "") + " · " + esc(fetchedLabel(fx)) + "<br />" + FX_DISCLAIMER
      : "⚠ " + esc(fx.message) + " 현지 통화 항목은 합계에서 제외했습니다.";
  } else { $("fxStatus").innerHTML = "원화로만 입력해 환율 조회가 필요하지 않았습니다."; }
  const rateToKrw = (code) => (fx && fx.ok ? (rateOf(fx, code, "KRW") || 0) : 0);
  const r = totalize({ items: st.items, people: st.people, days: st.days, rateToKrw });
  last = { st, r };
  $("total").textContent = won(r.total);
  $("summary").innerHTML =
    "<dt>1인당</dt><dd>" + won(r.perPerson) + "</dd>" +
    "<dt>하루당</dt><dd>" + won(r.perDay) + "</dd>" +
    "<dt>1인 1일</dt><dd>" + won(r.perPersonDay) + "</dd>" +
    "<dt>인원 · 기간</dt><dd>" + r.people + "명 · " + r.days + "일</dd>";
  const max = Math.max(1, ...r.rows.map((x) => x.krw));
  $("breakdown").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>항목</th><th>입력</th><th>원화 합계</th></tr></thead><tbody>' +
    r.rows.map((x) => "<tr><td>" + esc(x.emoji + " " + x.name) + '<div class="bar"><i style="width:' + Math.round((x.krw / max) * 100) + '%"></i></div></td><td class="mut">' +
      fmt(x.amount) + " " + x.currency + " × " + x.mult + "</td><td>" + won(x.krw) + "</td></tr>").join("") +
    '<tr class="sum"><td>합계</td><td></td><td>' + won(r.total) + "</td></tr></tbody></table></div>";
  showAd();
}
$("goBtn").addEventListener("click", run);
$("settleBtn").addEventListener("click", () => {
  const s = settle(payers);
  $("settleOut").innerHTML = '<p class="note">총 지출 ' + won(s.total) + " · 1인당 " + won(s.each) + "</p>" +
    (s.transfers.length
      ? '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>보내는 사람</th><th>받는 사람</th><th>금액</th></tr></thead><tbody>' +
        s.transfers.map((t) => "<tr><td>" + esc(t.from) + "</td><td>" + esc(t.to) + "</td><td>" + won(t.amount) + "</td></tr>").join("") + "</tbody></table></div>"
      : '<p class="note">정산할 금액이 없습니다(모두 균등하게 냈습니다).</p>');
});
function asText() {
  if (!last) return "";
  return "여행 예산 (" + last.st.people + "명 · " + last.st.days + "일)\\n" +
    last.r.rows.map((x) => "- " + x.name + ": " + won(x.krw)).join("\\n") +
    "\\n총 " + won(last.r.total) + " / 1인당 " + won(last.r.perPerson);
}
$("saveBtn").addEventListener("click", () => { S.save(stateOf()); toast("이 브라우저에 저장했습니다"); });
$("expBtn").addEventListener("click", () => download("travel-budget.txt", asText()));
$("clearBtn").addEventListener("click", () => { S.clear(); toast("저장 기록을 삭제했습니다"); });
wireShare({
  linkBtn: $("linkBtn"), textBtn: null, xBtn: null, shareBtn: $("shareBtn"),
  getUrl: () => shareUrl(stateOf()),
  getText: () => (last ? "여행 예산 " + won(last.r.total) + " (1인당 " + won(last.r.perPerson) + ")" : "여행 예산 계산기"),
  title: "여행 예산 계산기",
});
if (shared) run();
`,
},
{
  slug: "tip-calc", emoji: "🧾", nav: "팁 계산기",
  hubName: "나라별 팁 계산기", hubDesc: "국가별 팁 관행을 반영해 팁·총액·1인당 금액을 계산합니다.",
  title: "나라별 팁 계산기 — 국가별 팁 관행·1인당 금액까지",
  ogTitle: "나라별 팁 계산기",
  desc: "미국 15~20%, 일본 0%처럼 나라마다 다른 팁 관행을 반영해 팁 금액과 총액, 인원수로 나눈 1인당 금액을 계산합니다. 봉사료가 이미 포함된 계산서 처리와 원화 환산도 지원합니다.",
  h1: "나라별 팁 계산기",
  lead: `나라를 고르면 <strong>그 나라의 팁 관행</strong>이 기본값으로 들어갑니다. 봉사료 포함 계산서도 처리합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>계산서 정보</h2>
    <div class="grid2">
      <label class="f">나라 <select id="country"></select></label>
      <label class="f">계산서 금액 <span class="u" id="curLbl">(현지 통화)</span><input type="number" id="bill" min="0" step="any" value="100" /></label>
    </div>
    <div class="grid3" style="margin-top:12px">
      <label class="f">팁 비율 <span class="u">(%)</span><input type="number" id="pct" min="0" max="40" step="0.5" value="15" /></label>
      <label class="f">인원 <span class="u">(명)</span><input type="number" id="people" min="1" max="30" value="2" /></label>
      <label class="f">봉사료 이미 포함<select id="incl"><option value="0">아니오</option><option value="1">예 (팁 계산 제외)</option></select></label>
    </div>
    <p class="note" id="custom"></p>
    <button class="btn" id="goBtn" type="button">팁 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">총 결제액 <span class="num" id="total">-</span></p>
      <dl class="kv" id="sum"></dl>
      <p class="note" id="tipNote"></p>
      <p class="note" id="krwNote"></p>
      <div class="share"><button class="btn2" id="copyBtn" type="button">📋 결과 복사</button></div>
    </div>
  </section>`,
  intro: `<h2>팁은 "얼마"보다 "내는지 여부"가 먼저다</h2>
  <p>팁 문화는 나라마다 완전히 다릅니다. 미국·캐나다는 테이블 서비스에서 15~20%가 사실상 의무에 가깝고, 일본·중국은 팁을 건네면 오히려 사양하는 경우가 많습니다. 유럽 상당수 국가는 계산서에 봉사료가 포함돼 있어 잔돈 정도만 남기는 것이 관행입니다.</p>
  <p>그래서 이 계산기는 금액 계산보다 <strong>그 나라에서 팁이 어떤 의미인지</strong>를 먼저 보여줍니다. 나라를 고르면 관행 요약이 표시되고, 관행 비율이 기본값으로 채워집니다. 물론 최종 금액은 서비스 만족도와 업장 정책에 따라 본인이 정하는 것입니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>나라를 고릅니다. 팁 비율 기본값과 관행 설명이 자동으로 채워집니다.</li>
    <li>계산서 금액을 <strong>현지 통화 그대로</strong> 넣습니다.</li>
    <li>계산서에 봉사료(service charge)가 이미 붙어 있다면 "예"를 고릅니다. 이때 팁은 0으로 계산하고 안내만 표시합니다.</li>
    <li>인원을 넣으면 1인당 금액까지 나눠 줍니다.</li>
  </ol>
  <h2>팁을 낼 때 주의할 점</h2>
  <ul>
    <li>카드 영수증에 <em>Service charge</em>, <em>Gratuity</em>, <em>Coperto</em> 같은 항목이 이미 있는지 먼저 확인하세요. 중복 지불이 흔한 실수입니다.</li>
    <li>미국은 세금(Tax) 전 금액 기준으로 계산하는 것이 일반적입니다.</li>
    <li>단체 손님에게는 자동으로 18~20% 팁이 붙는 식당이 많습니다.</li>
  </ul>`,
  faq: [
    { q: "팁을 꼭 내야 하나요?", a: "나라와 업장에 따라 다릅니다. 이 도구가 보여주는 것은 일반적인 관행 요약이며 법적 의무나 정답이 아닙니다. 봉사료가 이미 포함된 곳에서는 추가 팁이 필수가 아닙니다." },
    { q: "표시된 비율이 실제와 다릅니다.", a: "팁 관행은 지역·업장·서비스 형태에 따라 편차가 큽니다. 화면의 값은 참고용 요약이므로 필요하면 비율을 직접 수정해 계산하세요." },
    { q: "원화로는 얼마인가요?", a: "결과 아래에 공개 환율 API로 환산한 원화 금액을 함께 표시합니다. 환율을 불러오지 못하면 현지 통화 금액만 표시합니다." },
  ],
  basis: `<h2>팁 관행 데이터 기준</h2>
    <p class="note">국가별 팁 관행 요약은 일반적으로 알려진 관행을 정리한 <strong>참고용 요약</strong>이며(확인일 ${CHECKED_AT}), 법령이나 공식 기준이 아닙니다.
    같은 나라 안에서도 도시·업장·서비스 형태에 따라 크게 다르므로 계산서의 봉사료 표기와 현지 안내를 우선하세요.</p>`,
  disclaimer: DISC("팁 관행은 정답이 아니라 관행이며, 최종 금액은 이용자가 결정할 문제입니다."),
  related: [T.split, T.budget],
  script: `
import { $, showAd, esc, fillSelect, copyText, fmt } from "__U__assets/app.mjs";
import { getRates, rateOf, fxFmt } from "__U__lib/fx.mjs";
const C = ${COUNTRY_JSON};
fillSelect($("country"), C.map((c) => ({ v: c.slug, n: c.flag + " " + c.n })), "usa");
function cur() { return C.find((c) => c.slug === $("country").value) || C[0]; }
function sync() {
  const c = cur();
  $("curLbl").textContent = "(" + c.cur + " " + c.curN + ")";
  $("pct").value = c.pct ? (c.pct[0] + c.pct[1]) / 2 : 0;
  $("custom").textContent = c.flag + " " + c.n + " — " + c.tip;
}
$("country").addEventListener("change", sync);
sync();
async function run() {
  const c = cur();
  const bill = Number($("bill").value) || 0;
  const people = Math.max(1, +$("people").value || 1);
  const incl = $("incl").value === "1";
  const pct = incl ? 0 : Math.max(0, Number($("pct").value) || 0);
  const tip = bill * pct / 100;
  const total = bill + tip;
  $("resultBox").hidden = false;
  $("total").textContent = fxFmt(total, c.cur) + " " + c.cur;
  $("sum").innerHTML =
    "<dt>계산서</dt><dd>" + fxFmt(bill, c.cur) + " " + c.cur + "</dd>" +
    "<dt>팁 (" + pct + "%)</dt><dd>" + fxFmt(tip, c.cur) + " " + c.cur + "</dd>" +
    "<dt>1인당</dt><dd>" + fxFmt(total / people, c.cur) + " " + c.cur + "</dd>";
  $("tipNote").textContent = incl
    ? "봉사료가 이미 포함된 계산서로 처리했습니다. 추가 팁은 선택 사항입니다. (" + c.n + ": " + c.tip + ")"
    : c.n + " 관행: " + c.tip;
  showAd();
  const fx = await getRates(c.cur);
  const r = fx.ok ? rateOf(fx, c.cur, "KRW") : null;
  $("krwNote").innerHTML = r
    ? "원화 환산 약 <strong>" + fmt(total * r) + "원</strong> (1 " + c.cur + " ≈ " + fxFmt(r, "KRW") + "원" + (fx.stale ? ", 마지막으로 받아온 환율" : "") + ") — 참고용이며 은행 고시 환율이 아닙니다."
    : "환율을 불러오지 못해 원화 환산은 생략했습니다. " + esc(fx.message || "");
}
$("goBtn").addEventListener("click", run);
$("copyBtn").addEventListener("click", () => copyText($("total").textContent + " (" + cur().n + " 팁 포함, tripcalc-kr.vercel.app/tip-calc)"));
`,
},
{
  slug: "voltage", emoji: "🔌", nav: "전압·플러그 확인",
  hubName: "전압·플러그 확인", hubDesc: "나라별 전압·주파수·콘센트 모양과 한국 기기 사용 가능 여부.",
  title: "해외 전압·콘센트 플러그 확인 — 변압기가 필요한가?",
  ogTitle: "해외 전압·플러그 확인",
  desc: "나라를 고르면 전압·주파수·콘센트 타입을 보여주고, 한국 220V 기기를 그대로 쓸 수 있는지 어댑터만 필요한지 변압기까지 필요한지 판정합니다. 고데기·드라이어처럼 사고가 잦은 기기도 따로 안내합니다.",
  h1: "해외 전압·플러그 확인",
  lead: `나라를 고르면 <strong>어댑터만 필요한지, 변압기까지 필요한지</strong> 알려드립니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>목적지 선택</h2>
    <label class="f">나라 <select id="country"></select></label>
    <span class="f" style="display:block;margin-top:14px">가져갈 기기</span>
    <div class="chips" id="devs">
      <button class="chip" type="button" data-v="phone" aria-pressed="true">📱 휴대폰·노트북 충전기</button>
      <button class="chip" type="button" data-v="hair" aria-pressed="false">💇 드라이어·고데기</button>
      <button class="chip" type="button" data-v="shaver" aria-pressed="false">🪒 전기면도기·전동칫솔</button>
      <button class="chip" type="button" data-v="rice" aria-pressed="false">🍚 소형 가전(전기포트 등)</button>
    </div>
    <button class="btn" id="goBtn" type="button">사용 가능 여부 확인</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>확인 결과</h2>
      <p class="big"><span class="num" id="verdict">-</span></p>
      <dl class="kv" id="spec"></dl>
      <div id="devOut"></div>
      <p class="note">한국은 ${KOREA.voltage.value} ${KOREA.voltage.freq}, 플러그 ${KOREA.voltage.plugs.join("/")}타입입니다. 판정은 이 값을 기준으로 합니다.</p>
    </div>
  </section>

  <section class="card" aria-label="나라별 카드">
    <h2>나라별 전압 카드</h2>
    <p class="note" style="margin-top:0">자주 찾는 나라의 전용 페이지입니다.</p>
    <div class="chips">
      ${["japan", "usa", "vietnam", "thailand", "uk", "france", "australia", "china"].map((s) => {
        const c = COUNTRIES.find((x) => x.slug === s);
        return c ? `<a class="chip" href="../country/${c.slug}/">${c.flag} ${c.nameKo}</a>` : "";
      }).filter(Boolean).join("\n      ")}
      <a class="chip" href="../country/">전체 ${COUNTRIES.length}개국 →</a>
    </div>
  </section>`,
  intro: `<h2>어댑터와 변압기는 완전히 다른 물건입니다</h2>
  <p>여행 준비에서 가장 흔한 오해가 이것입니다. <strong>어댑터(플러그 변환기)</strong>는 콘센트 구멍 모양만 바꿔 줄 뿐 전압은 그대로 통과시킵니다. <strong>변압기</strong>는 전압 자체를 바꿉니다. 110V 나라에서 220V 전용 고데기를 어댑터만 끼워 꽂으면 제대로 작동하지 않거나 고장 나고, 반대로 110V 전용 기기를 220V에 꽂으면 타 버립니다.</p>
  <p>다행히 요즘 휴대폰·노트북 충전기는 대부분 <em>INPUT 100-240V 50/60Hz</em> 프리볼트라서 플러그 모양만 맞추면 됩니다. 문제는 헤어드라이어·고데기·전기포트처럼 열을 내는 기기입니다. 이런 기기는 소비전력이 커서 여행용 소형 변압기로도 감당이 안 되는 경우가 많습니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>목적지 나라를 고릅니다.</li>
    <li>가져갈 기기 종류를 고릅니다(복수 선택).</li>
    <li>"사용 가능 여부 확인"을 누르면 전압·주파수·플러그 타입과 함께 기기별 판정이 나옵니다.</li>
  </ol>
  <h2>출발 전 직접 확인하는 법</h2>
  <p>충전기나 어댑터 몸통의 작은 글씨를 보세요. <strong>INPUT: 100-240V ~ 50/60Hz</strong> 라고 적혀 있으면 전 세계 어디서나 플러그만 맞추면 됩니다. <strong>INPUT: 220V 60Hz</strong> 처럼 한 가지만 적혀 있으면 그 전압에서만 써야 합니다.</p>`,
  faq: [
    { q: "어댑터만 있으면 되나요?", a: "기기가 프리볼트(100-240V)라면 어댑터만으로 충분합니다. 특정 전압 전용 기기라면 목적지 전압과 다를 때 변압기가 필요합니다. 기기 표기를 반드시 확인하세요." },
    { q: "주파수(50Hz/60Hz)가 다르면 문제가 되나요?", a: "충전기·노트북 같은 전자기기는 대부분 문제가 없습니다. 다만 모터가 회전 속도에 의존하는 일부 구형 기기나 시계 기능이 있는 기기는 동작이 달라질 수 있습니다." },
    { q: "호텔에 어댑터가 있나요?", a: "호텔마다 다릅니다. 프런트에서 대여해 주는 곳도 있지만 수량이 한정적입니다. 멀티 어댑터 하나를 챙기는 편이 안전합니다." },
    { q: "고데기를 꼭 가져가야 한다면?", a: "듀얼 볼티지(전압 전환 스위치가 있거나 100-240V 표기) 제품을 사거나 현지에서 구매·대여하는 편이 안전합니다. 열기구는 소비전력이 커서 여행용 소형 변압기로는 감당하지 못하는 경우가 많습니다." },
  ],
  basis: `<h2>전압·플러그 데이터 출처</h2>
    <p class="note">국가별 전압·주파수·플러그 타입은 <a href="https://www.iec.ch/world-plugs" target="_blank" rel="noopener">IEC World Plugs</a> 기준입니다(확인일 ${CHECKED_AT}).
    같은 나라 안에서도 건물 연식·지역에 따라 콘센트가 다를 수 있고, 브라질처럼 지역별로 전압이 다른 나라도 있습니다. 숙소 안내를 함께 확인하세요.</p>`,
  disclaimer: DISC("기기 손상·화재 위험이 있는 판단이므로 반드시 기기 본체의 전압 표기를 직접 확인하세요."),
  related: [T.packing, T.china],
  script: `
import { $, showAd, esc, fillSelect, multiInit } from "__U__assets/app.mjs";
const C = ${COUNTRY_JSON};
const KO = { v: "${KOREA.voltage.value}", f: "${KOREA.voltage.freq}", p: ${JSON.stringify(KOREA.voltage.plugs)} };
fillSelect($("country"), C.map((c) => ({ v: c.slug, n: c.flag + " " + c.n })), "japan");
const dv = multiInit($("devs"));
function volts(s) { const m = String(s).match(/(\\d+)/g) || ["220"]; return m.map(Number); }
$("goBtn").addEventListener("click", () => {
  const c = C.find((x) => x.slug === $("country").value);
  const vs = volts(c.v), lo = Math.min(...vs);
  const samePlug = c.p.some((p) => KO.p.includes(p));
  const sameVolt = vs.some((v) => Math.abs(v - 220) <= 20);
  const verdict = samePlug && sameVolt ? "그대로 사용 가능" : sameVolt ? "어댑터 필요" : "어댑터 + 전압 확인 필요";
  $("resultBox").hidden = false;
  $("verdict").textContent = verdict;
  $("spec").innerHTML =
    "<dt>전압</dt><dd>" + esc(c.v) + "</dd>" +
    "<dt>주파수</dt><dd>" + esc(c.f) + "</dd>" +
    "<dt>플러그 타입</dt><dd>" + c.p.join(", ") + "형</dd>" +
    "<dt>한국(" + KO.v + " " + KO.f + ", " + KO.p.join("/") + "형) 대비</dt><dd>" + (samePlug ? "플러그 호환" : "플러그 변환 필요") + " / " + (sameVolt ? "전압 유사" : "전압 다름") + "</dd>";
  const picked = dv.get();
  const rules = {
    phone: lo < 200
      ? ["📱 휴대폰·노트북 충전기", "대부분 프리볼트(100-240V)라 <strong>플러그 어댑터만</strong> 있으면 됩니다. 충전기에 100-240V 표기가 있는지 확인하세요.", "ok"]
      : ["📱 휴대폰·노트북 충전기", "전압이 한국과 비슷해 " + (samePlug ? "그대로 꽂아 쓸 수 있습니다." : "어댑터만 있으면 됩니다."), "ok"],
    hair: lo < 200
      ? ["💇 드라이어·고데기", "220V 전용 제품이면 <strong>사용 불가</strong>합니다. 듀얼 볼티지 제품인지 확인하고, 아니라면 현지 구매·대여를 권합니다. 소비전력이 커서 여행용 변압기로 감당이 어렵습니다.", "warn"]
      : ["💇 드라이어·고데기", "전압은 맞지만 숙소 콘센트 용량·플러그 모양을 확인하세요. 열기구는 소비전력이 큽니다.", "ok"],
    shaver: ["🪒 전기면도기·전동칫솔", "대부분 프리볼트 충전 방식이라 어댑터만으로 충전됩니다. 본체가 아닌 충전 어댑터의 표기를 확인하세요.", "ok"],
    rice: lo < 200
      ? ["🍚 소형 가전(전기포트 등)", "220V 전용이면 <strong>사용 불가</strong>. 열기구는 소비전력(1,000W 이상)이 커서 여행용 변압기로 감당하기 어렵습니다. 가져가지 않기를 권합니다.", "warn"]
      : ["🍚 소형 가전(전기포트 등)", "전압은 맞지만 콘센트 용량과 숙소 규정을 확인하세요. 화재 위험이 있어 금지하는 숙소도 있습니다.", "warn"],
  };
  $("devOut").innerHTML = picked.map((k) => {
    const r = rules[k];
    return '<div class="alert" style="border-color:var(--' + (r[2] === "ok" ? "acc" : "warn") + ');color:var(--tx2)"><strong>' + r[0] + "</strong><br />" + r[1] + "</div>";
  }).join("");
  showAd();
});
`,
},
{
  slug: "jetlag", emoji: "😵‍💫", nav: "시차적응 플래너",
  hubName: "시차적응 플래너", hubDesc: "시차 방향·크기로 적응 기간을 추정하고 출발 전·후 수면 조정 일정을 만듭니다.",
  title: "시차적응 플래너 — 적응 기간 추정과 출발 전 수면 조정",
  ogTitle: "시차적응 플래너",
  desc: "출발지와 도착지를 고르면 시차의 방향과 크기로 적응에 걸리는 대략의 기간을 추정하고, 출발 며칠 전부터 취침 시각을 어떻게 옮기면 좋은지 일정표를 만들어 줍니다. 의학적 조언이 아닌 일반적인 생활 정보입니다.",
  h1: "시차적응 플래너",
  lead: `동쪽으로 갈수록 힘든 이유부터. <strong>출발 전 수면 조정 일정</strong>과 도착 후 행동 요령을 만들어 드립니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>여정 입력</h2>
    <div class="grid2">
      <label class="f">출발 도시 <select id="fromCity"></select></label>
      <label class="f">도착 도시 <select id="toCity"></select></label>
    </div>
    <div class="grid2" style="margin-top:12px">
      <label class="f">출발 날짜 <input type="date" id="date" /></label>
      <label class="f">평소 취침 시각 <input type="time" id="sleep" value="23:30" /></label>
    </div>
    <label class="f" style="display:block;margin-top:12px">체류 기간 <span class="u">(일)</span>
      <input type="number" id="stay" min="1" max="60" value="7" />
    </label>
    <button class="btn" id="goBtn" type="button">시차적응 계획 만들기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>적응 예상</h2>
      <p class="big">완전 적응까지 대략 <span class="num" id="daysOut">-</span></p>
      <dl class="kv" id="sum"></dl>
      <p class="note" id="dirNote"></p>
    </div>
    <div class="card">
      <h2>출발 전 수면 조정 일정</h2>
      <div id="plan"></div>
      <p class="note">하루 30분~1시간씩 취침·기상 시각을 목적지 방향으로 옮기는 방식입니다. 무리해서 한꺼번에 옮기면 오히려 수면 부족이 겹칩니다.</p>
    </div>
    <div class="card">
      <h2>도착 후 행동 요령</h2>
      <div id="after"></div>
    </div>
  </section>`,
  intro: `<h2>왜 동쪽 여행이 더 힘든가</h2>
  <p>사람의 생체 시계는 자연 상태에서 24시간보다 조금 길게 도는 경향이 있습니다. 그래서 <strong>하루를 늘리는 방향(서쪽으로 이동)</strong>이 <strong>하루를 줄이는 방향(동쪽으로 이동)</strong>보다 대체로 수월합니다. 서울에서 유럽으로 갈 때(서쪽)보다 유럽에서 서울로 돌아올 때(동쪽) 더 힘든 이유가 여기에 있습니다.</p>
  <p>흔히 쓰이는 경험칙은 <strong>시차 1시간당 하루 정도</strong> 적응 기간이 필요하다는 것입니다. 서쪽 이동은 이보다 조금 빠르고, 동쪽 이동은 조금 더 걸리는 편입니다. 이 도구는 이 경험칙으로 대략의 기간을 추정하고, 출발 전에 미리 시계를 옮겨 두는 일정을 만들어 줍니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>출발·도착 도시와 출발 날짜, 평소 취침 시각을 입력합니다.</li>
    <li>"시차적응 계획 만들기"를 누르면 시차 방향(동/서), 적응 예상 기간, 출발 전 며칠간의 취침·기상 조정표가 나옵니다.</li>
    <li>체류 기간이 짧으면(2~3일) 굳이 현지 시각에 맞추지 않는 편이 나을 수 있다는 안내도 함께 표시됩니다.</li>
  </ol>
  <h2>도착 후에 도움이 되는 습관</h2>
  <ul>
    <li>도착 당일 낮에는 <strong>바깥 햇빛</strong>을 쬐고, 낮잠은 짧게(20~30분) 제한합니다.</li>
    <li>기내와 도착 첫날은 <strong>수분 섭취</strong>를 늘리고 술·카페인은 줄입니다.</li>
    <li>첫날부터 현지 시각에 맞춰 식사하면 몸이 시간을 인식하는 데 도움이 됩니다.</li>
    <li>일정을 짤 때 도착 첫날은 가볍게 잡아 두면 이후가 편합니다.</li>
  </ul>`,
  faq: [
    { q: "적응 기간 추정은 얼마나 정확한가요?", a: "개인차가 매우 큽니다. 나이·평소 수면 습관·비행 시간대·현지 활동량에 따라 달라지므로 '대략 이 정도'의 감을 잡는 용도로만 쓰세요. 의학적 조언이 아닙니다." },
    { q: "짧은 출장에도 시차를 맞춰야 하나요?", a: "2~3일처럼 아주 짧은 일정이라면 한국 시각을 유지하는 편이 나을 수 있습니다. 어차피 적응이 끝나기 전에 돌아오기 때문입니다. 중요한 일정이 있는 시간대에 컨디션이 좋도록 맞추는 편이 실용적입니다." },
    { q: "수면제나 멜라토닌은 어떤가요?", a: "약물·보충제 사용은 이 사이트가 다루지 않습니다. 복용 여부와 용량은 반드시 의사·약사와 상의하세요." },
    { q: "밤 비행기와 낮 비행기 중 어느 쪽이 나은가요?", a: "일반적으로 도착 시각이 현지 저녁이면 그날 밤 자연스럽게 잠들 수 있어 적응이 수월하다고 여겨집니다. 다만 기내에서 얼마나 잘 수 있는지가 사람마다 달라 일률적인 정답은 없습니다." },
  ],
  basis: TZ_BOX,
  disclaimer: DISC("시차적응 안내는 일반적인 생활 정보이며 의학적 진단·처방·치료 조언이 아닙니다. 수면 문제가 지속되면 전문가와 상담하세요."),
  related: [T.pin, T.packing],
  script: `
import { $, showAd, esc, fillSelect } from "__U__assets/app.mjs";
import { diffHours, diffLabel, localParts } from "__U__lib/tz.mjs";
const CITIES = ${CITY_JSON};
fillSelect($("fromCity"), CITIES, "Asia/Seoul|서울");
fillSelect($("toCity"), CITIES, "America/New_York|뉴욕");
function pad(n) { return String(n).padStart(2, "0"); }
const t0 = new Date();
$("date").value = t0.getFullYear() + "-" + pad(t0.getMonth() + 1) + "-" + pad(t0.getDate());
$("goBtn").addEventListener("click", () => {
  const [fz, fn] = $("fromCity").value.split("|");
  const [tz, tn] = $("toCity").value.split("|");
  const [y, m, d] = $("date").value.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, d, 3));
  const diff = diffHours(fz, tz, when);
  const east = diff > 0;
  const abs = Math.abs(diff);
  const stay = Math.max(1, +$("stay").value || 7);
  const days = abs === 0 ? 0 : Math.round(abs * (east ? 1.1 : 0.75) * 10) / 10;
  $("resultBox").hidden = false;
  $("daysOut").textContent = abs === 0 ? "시차 없음" : days + "일";
  $("sum").innerHTML =
    "<dt>시차</dt><dd>" + esc(fn) + " 대비 " + esc(diffLabel(diff)) + "</dd>" +
    "<dt>이동 방향</dt><dd>" + (abs === 0 ? "동일 시간대" : east ? "동쪽 (하루가 짧아짐)" : "서쪽 (하루가 길어짐)") + "</dd>" +
    "<dt>도착지 현재 시각</dt><dd>" + (function () { const p = localParts(tz); return pad(p.h) + ":" + pad(p.mi) + " (" + p.wd + ")"; })() + "</dd>" +
    "<dt>체류 기간</dt><dd>" + stay + "일</dd>";
  $("dirNote").innerHTML = abs === 0
    ? "시차가 없어 특별한 조정이 필요하지 않습니다. 비행 피로만 관리하세요."
    : east
      ? "동쪽 이동은 하루를 <strong>줄이는</strong> 방향이라 대체로 더 힘듭니다. 출발 며칠 전부터 <strong>일찍 자고 일찍 일어나는</strong> 쪽으로 옮겨 두면 도움이 됩니다."
      : "서쪽 이동은 하루를 <strong>늘리는</strong> 방향이라 상대적으로 수월합니다. 출발 전 <strong>늦게 자고 늦게 일어나는</strong> 쪽으로 조금씩 옮겨 보세요.";
  const shiftDays = Math.min(4, Math.ceil(abs / 2));
  const [sh, sm] = $("sleep").value.split(":").map(Number);
  let rows = "";
  for (let i = shiftDays; i >= 1; i--) {
    const move = (shiftDays - i + 1) * (east ? -1 : 1);
    const t = new Date(2000, 0, 1, sh, sm);
    t.setMinutes(t.getMinutes() + move * 45);
    const day = new Date(Date.UTC(y, m - 1, d - i));
    rows += "<tr><td>출발 " + i + "일 전 (" + (day.getUTCMonth() + 1) + "/" + day.getUTCDate() + ")</td><td>" +
      pad(t.getHours()) + ":" + pad(t.getMinutes()) + "</td><td class=\\"mut\\">평소보다 " + Math.abs(move * 45) + "분 " + (east ? "일찍" : "늦게") + "</td></tr>";
  }
  $("plan").innerHTML = abs === 0 ? '<p class="note">조정할 시차가 없습니다.</p>'
    : '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>날짜</th><th>권장 취침</th><th>변화</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  const tips = [];
  if (stay <= 3 && abs >= 5) tips.push("체류가 " + stay + "일로 짧습니다. 시차를 완전히 맞추기보다 <strong>한국 시각을 어느 정도 유지</strong>하면서 중요한 일정 시간대에 컨디션을 맞추는 편이 실용적일 수 있습니다.");
  tips.push(east
    ? "도착 후 <strong>아침 햇빛</strong>을 충분히 쬐고 늦은 밤 밝은 화면은 줄이세요."
    : "도착 후 <strong>저녁 무렵 밝은 빛</strong>에 노출되면 늦게까지 깨어 있기 쉬워 적응에 도움이 됩니다.");
  tips.push("도착 첫날 낮잠은 20~30분으로 제한하고, 현지 시각에 맞춰 식사하세요.");
  tips.push("기내와 도착 첫날은 수분을 넉넉히 섭취하고 술·카페인은 줄이세요.");
  tips.push("도착 첫날 일정은 가볍게 잡아 두면 남은 일정이 편해집니다.");
  $("after").innerHTML = '<ul class="about" style="margin:0;padding-left:20px">' + tips.map((t) => "<li style=\\"margin:8px 0;color:var(--tx2)\\">" + t + "</li>").join("") + "</ul>";
  showAd();
});
`,
},
{
  slug: "duty-free", emoji: "🛃", nav: "면세 한도 계산기",
  hubName: "면세 한도 계산기", hubDesc: "관세청 기준 면세 한도와 초과 시 예상 세액, 자진신고 감면까지.",
  title: "면세 한도 계산기 — 800달러 초과분 예상 세액·자진신고 감면",
  ogTitle: "면세 한도 계산기 (관세청 기준)",
  desc: "입국 시 여행자 휴대품 기본 면세한도 미화 800달러와 주류 2병·궐련 200개비·향수 100mL 별도 면세를 기준으로, 한도를 넘겼을 때 예상 세액과 자진신고 감면 효과를 계산합니다. 관세청 출처 기준.",
  h1: "면세 한도 계산기",
  lead: `기본 면세한도 <strong>미화 ${DUTY.basic.value}달러</strong>. 넘겼다면 얼마를 내는지, 자진신고하면 얼마나 줄어드는지 계산합니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>구매 내역</h2>
    <label class="f">물품 합계 <span class="u">(미화 달러, 주류·담배·향수 제외)</span>
      <input type="number" id="goods" min="0" step="any" value="1200" />
    </label>
    <div class="grid3" style="margin-top:12px">
      <label class="f">주류 <span class="u">(병)</span><input type="number" id="bottles" min="0" value="0" /></label>
      <label class="f">주류 용량 <span class="u">(L)</span><input type="number" id="liters" min="0" step="0.1" value="0" /></label>
      <label class="f">주류 금액 <span class="u">(USD)</span><input type="number" id="alcUsd" min="0" value="0" /></label>
    </div>
    <div class="grid3" style="margin-top:12px">
      <label class="f">궐련 <span class="u">(개비)</span><input type="number" id="cig" min="0" value="0" /></label>
      <label class="f">향수 <span class="u">(mL)</span><input type="number" id="perf" min="0" value="0" /></label>
      <label class="f">자진신고<select id="self"><option value="1">한다 (감면 30%)</option><option value="0">안 한다</option></select></label>
    </div>
    <details class="adv">
      <summary>고급 설정 — 간이세율·감면 한도액·적용 환율</summary>
      <div class="grid3">
        <label class="f">간이세율 <span class="u">(%)</span><input type="number" id="rate" step="1" value="20" /></label>
        <label class="f">감면 한도액 <span class="u">(원) <span class="badge warn">확인 필요</span></span><input type="number" id="cap" step="10000" value="200000" /></label>
        <label class="f">적용 환율 <span class="u">(원/USD)</span><input type="number" id="fxRate" step="1" value="0" /></label>
      </div>
      <p class="note">간이세율은 대부분의 여행자 휴대품에 적용되는 대표값(20%)이며 품목에 따라 다릅니다. 자진신고 감면 한도액은 개정 이력이 있어 기본값을 확정 표기하지 않고 직접 수정하도록 두었습니다. 환율을 0으로 두면 공개 환율 API 값을 사용합니다(실제 과세환율은 별도 고시).</p>
    </details>
    <button class="btn" id="goBtn" type="button">예상 세액 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">예상 납부세액 <span class="num" id="taxOut">-</span></p>
      <div id="tbl"></div>
      <div id="allow"></div>
      <p class="note" id="fxStatus"></p>
    </div>
  </section>`,
  intro: `<h2>면세 한도는 "1인당 800달러"입니다</h2>
  <p>해외에서 산 물건을 국내로 들여올 때, 여행자 1명당 <strong>미화 ${DUTY.basic.value}달러</strong>까지는 세금 없이 반입할 수 있습니다. 여기서 자주 오해하는 점은 <strong>면세점에서 산 것도 합산된다</strong>는 사실입니다. 국내 출국장 면세점, 기내 면세, 해외 현지 구매를 모두 더해 판단합니다.</p>
  <p>또 주류·담배·향수는 기본 한도와 <strong>별도로</strong> 면세됩니다. 다만 조건이 붙습니다. 주류는 ${DUTY.alcohol.bottles}병 이하이면서 합계 ${DUTY.alcohol.liters}L 이하, 그리고 합계 ${DUTY.alcohol.usd}달러 이하를 모두 만족해야 합니다. 셋 중 하나라도 넘으면 초과분이 과세 대상이 됩니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>주류·담배·향수를 <strong>뺀</strong> 물품 합계를 달러로 넣습니다.</li>
    <li>주류·담배·향수는 아래 칸에 따로 넣습니다. 별도 면세 한도 충족 여부를 판정해 줍니다.</li>
    <li>자진신고 여부를 고릅니다. 자진신고하면 관세의 30%를 감면받고, 신고하지 않고 적발되면 가산세가 붙습니다.</li>
    <li>결과에는 과세 대상 금액, 감면액, 최종 예상 세액이 단계별로 표시됩니다.</li>
  </ol>
  <h2>세관 신고, 이렇게 하면 손해 보지 않습니다</h2>
  <ul>
    <li>면세 한도를 넘겼다면 <strong>자진신고가 거의 항상 유리</strong>합니다. 감면(30%)을 받는 대신, 미신고 적발 시에는 반대로 가산세 40%(2년 내 반복 시 60%)가 붙습니다.</li>
    <li>영수증을 보관하세요. 가격을 증빙하지 못하면 세관이 과세가격을 산정합니다.</li>
    <li>고가 시계·가방을 착용하고 입국해도 신고 대상입니다.</li>
  </ul>`,
  faq: [
    { q: "면세점에서 산 것도 800달러에 포함되나요?", a: "네. 출국장 면세점·기내 면세점·해외 현지 구매를 모두 합산해 판단합니다." },
    { q: "가족끼리 합산할 수 있나요?", a: "면세 한도는 여행자 1명 단위로 적용됩니다. 한 사람이 산 고가 물품을 가족 인원수로 나눠 계산하는 방식은 인정되지 않습니다. 구체적인 사례는 관세청에 문의하세요." },
    { q: "계산된 세액이 실제와 다를 수 있나요?", a: "네. 품목별로 세율이 다르고 실제 과세환율은 별도로 고시되며, 개별소비세 대상 품목은 계산 구조가 다릅니다. 이 계산기는 대표 간이세율 20%를 적용한 참고용 추정치입니다." },
    { q: "자진신고 감면 한도액이 왜 비어 있나요?", a: "감면 한도액은 개정 이력이 있어 이 사이트에서 확정값으로 표기하지 않습니다. 고급 설정에서 직접 입력하도록 두었고, 정확한 값은 관세청에서 확인하세요." },
  ],
  basis: DUTY_BOX,
  disclaimer: DISC("실제 세액은 품목별 세율·과세환율·개별소비세 적용 여부에 따라 달라집니다. 확정 금액은 관세청 또는 입국 세관에서 확인하세요."),
  related: [T.budget, T.china],
  script: `
import { $, showAd, esc, won, fmt } from "__U__assets/app.mjs";
import { estimateDuty, checkAllowance, DUTY } from "__U__lib/dutyfree.mjs";
import { getRates, rateOf, fxFmt } from "__U__lib/fx.mjs";
async function run() {
  const manual = Number($("fxRate").value) || 0;
  let usdKrw = manual, note = "적용 환율: 직접 입력 " + fmt(manual) + "원/USD";
  if (!manual) {
    $("fxStatus").textContent = "환율을 불러오는 중…";
    const fx = await getRates("USD");
    const r = fx.ok ? rateOf(fx, "USD", "KRW") : null;
    if (r) { usdKrw = r; note = "적용 환율: " + fxFmt(r, "KRW") + "원/USD (" + esc(fx.src || "저장된 값") + (fx.stale ? ", 마지막으로 받아온 환율" : "") + "). 실제 과세환율은 관세청이 별도로 고시합니다."; }
    else { usdKrw = 0; note = "⚠ " + esc(fx.message) + " 고급 설정에서 환율을 직접 입력하면 세액을 계산합니다."; }
  }
  const alcUsd = Number($("alcUsd").value) || 0;
  const a = checkAllowance({
    bottles: +$("bottles").value || 0, liters: +$("liters").value || 0, alcoholUsd: alcUsd,
    cigarettes: +$("cig").value || 0, perfumeMl: +$("perf").value || 0,
  });
  const r = estimateDuty({
    goodsUsd: Number($("goods").value) || 0,
    extraAlcoholUsd: a.alcohol.ok ? 0 : alcUsd,
    usdKrw, selfReport: $("self").value === "1",
    rate: (Number($("rate").value) || 20) / 100,
    cap: Number($("cap").value) || 0,
  });
  $("resultBox").hidden = false;
  $("fxStatus").innerHTML = note;
  $("taxOut").textContent = r.free ? "면세 (세금 없음)" : won(r.tax);
  $("tbl").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>항목</th><th>금액</th></tr></thead><tbody>' +
    "<tr><td>기본 면세한도</td><td>USD " + fmt(r.limit) + "</td></tr>" +
    "<tr><td>한도 초과분</td><td>USD " + fmt(r.overBasic) + "</td></tr>" +
    "<tr><td>과세 대상 합계</td><td>USD " + fmt(r.taxableUsd) + " (" + won(r.taxableKrw) + ")</td></tr>" +
    "<tr><td>간이세율 " + Math.round(r.rate * 100) + "% 적용 세액</td><td>" + won(r.gross) + "</td></tr>" +
    (r.discount ? "<tr><td>자진신고 감면 (30%, 한도 적용)</td><td>-" + won(r.discount) + "</td></tr>" : "") +
    (r.penalty ? '<tr><td>미신고 가산세 (40%)</td><td class="mut">+' + won(r.penalty) + "</td></tr>" : "") +
    '<tr class="sum"><td>예상 납부세액</td><td>' + won(r.tax) + "</td></tr></tbody></table></div>";
  const rows = [
    ["주류", a.alcohol.ok, a.alcohol.ok ? DUTY.alcohol.detail : "한도 초과 — " + a.alcohol.over.join(", ")],
    ["담배", a.tobacco.ok, a.tobacco.detail],
    ["향수", a.perfume.ok, a.perfume.detail],
  ];
  $("allow").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>별도 면세</th><th>판정</th><th>기준</th></tr></thead><tbody>' +
    rows.map((x) => "<tr><td>" + x[0] + '</td><td><span class="badge ' + (x[1] ? "ok" : "warn") + '">' + (x[1] ? "면세 범위" : "초과") + "</span></td><td class=\\"mut\\">" + esc(x[2]) + "</td></tr>").join("") +
    "</tbody></table></div>";
  showAd();
}
$("goBtn").addEventListener("click", run);
`,
},
{
  slug: "flight-time", emoji: "✈️", nav: "비행시간·거리",
  hubName: "비행시간·거리 계산기", hubDesc: "공항 두 곳의 대권거리로 비행시간을 추정하고 도착 현지 시각까지 계산합니다.",
  title: "비행시간·거리 계산기 — 대권거리 기반 추정과 도착 현지 시각",
  ogTitle: "비행시간·거리 계산기",
  desc: "공항 두 곳을 고르면 대권거리(km)를 계산하고 예상 비행시간과 도착지 현지 시각을 알려줍니다. 인천-뉴욕처럼 시차가 큰 노선의 도착 날짜·요일까지 확인할 수 있습니다. 대권거리 기반 추정치입니다.",
  h1: "비행시간·거리 계산기",
  lead: `공항 두 곳만 고르면 <strong>거리·예상 비행시간·도착 현지 시각</strong>이 한 번에 나옵니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>노선 선택</h2>
    <div class="grid2">
      <label class="f">출발 공항 <select id="dep"></select></label>
      <label class="f">도착 공항 <select id="arr"></select></label>
    </div>
    <div class="grid2" style="margin-top:12px">
      <label class="f">출발 날짜 <input type="date" id="date" /></label>
      <label class="f">출발 시각 <span class="u">(출발지 현지)</span><input type="time" id="time" value="10:00" /></label>
    </div>
    <div class="row"><button class="btn2" id="swapBtn" type="button">⇅ 출발·도착 바꾸기</button></div>
    <button class="btn" id="goBtn" type="button">비행시간 계산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>계산 결과</h2>
      <p class="big">예상 비행시간 <span class="num" id="hOut">-</span></p>
      <dl class="kv" id="sum"></dl>
      <p class="note">대권거리 기반 <strong>추정치</strong>입니다. 실제 항로는 대권거리보다 길고, 편서풍 때문에 동쪽으로 갈 때가 서쪽으로 갈 때보다 대체로 빠릅니다.</p>
      <div class="share"><button class="btn2" id="copyBtn" type="button">📋 결과 복사</button></div>
    </div>
  </section>`,
  intro: `<h2>지도 위 직선이 실제 항로는 아니다</h2>
  <p>인천에서 뉴욕까지의 거리를 평면 지도에서 재면 실제보다 훨씬 멀게 나옵니다. 지구는 구체라서 두 지점의 최단 경로는 <strong>대권(great circle)</strong>, 즉 지구 중심을 지나는 평면이 표면과 만나는 원호입니다. 인천-뉴욕 노선이 북극 근처를 지나는 것도 그것이 최단 경로이기 때문입니다.</p>
  <p>이 계산기는 공항 좌표로 대권거리를 구하고, 거리 구간별 평균 순항 속도와 이착륙·지상활주 시간을 더해 비행시간을 추정합니다. 실제 스케줄과는 보통 10% 안쪽에서 차이가 나며, 영공 우회나 강한 맞바람이 있으면 더 벌어집니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>출발·도착 공항을 IATA 코드나 도시 이름으로 고릅니다.</li>
    <li>출발 날짜와 <strong>출발지 현지 시각</strong>을 넣습니다.</li>
    <li>"비행시간 계산하기"를 누르면 거리·예상 비행시간과 함께 <strong>도착지 현지 날짜·시각</strong>이 나옵니다. 날짜가 바뀌면 함께 표시됩니다.</li>
  </ol>`,
  faq: [
    { q: "실제 항공사 시간표와 차이가 납니다.", a: "대권거리를 기준으로 한 추정치이기 때문입니다. 실제 항로는 항공로·관제·영공 우회로 더 길고, 제트기류 영향으로 같은 노선도 방향에 따라 1시간 이상 차이가 납니다. 정확한 시간은 항공사 시간표를 확인하세요." },
    { q: "도착 시각이 출발 시각보다 이른 것으로 나옵니다.", a: "시차 때문입니다. 예를 들어 인천에서 아침에 출발해 미국 서부에 같은 날 아침에 도착하는 일은 실제로 일어납니다. 결과에 도착지 현지 날짜와 요일을 함께 표시하니 확인하세요." },
    { q: "경유 노선도 계산되나요?", a: "직항 기준 대권거리만 계산합니다. 경유편은 각 구간을 따로 계산한 뒤 환승 대기시간을 더해 보세요." },
  ],
  basis: GEO_BOX,
  disclaimer: DISC("비행시간은 대권거리 기반 추정치이며 실제 운항 시간표와 다를 수 있습니다."),
  related: [T.pin, T.budget],
  script: `
import { $, showAd, esc, fillSelect, copyText, fmt } from "__U__assets/app.mjs";
import { haversine, flightHours, hoursToKo } from "__U__lib/geo.mjs";
import { offsetMinutes, diffHours, diffLabel, localParts } from "__U__lib/tz.mjs";
const A = ${AIRDATA_JSON};
const OPTS = ${AIR_JSON};
fillSelect($("dep"), OPTS, "ICN");
fillSelect($("arr"), OPTS, "JFK");
function pad(n) { return String(n).padStart(2, "0"); }
const t0 = new Date();
$("date").value = t0.getFullYear() + "-" + pad(t0.getMonth() + 1) + "-" + pad(t0.getDate());
$("swapBtn").addEventListener("click", () => { const a = $("dep").value; $("dep").value = $("arr").value; $("arr").value = a; });
let lastTxt = "";
$("goBtn").addEventListener("click", () => {
  const d = A[$("dep").value], r = A[$("arr").value];
  if (!d || !r || $("dep").value === $("arr").value) { alert("서로 다른 공항을 골라주세요."); return; }
  const km = haversine(d.lat, d.lon, r.lat, r.lon);
  const h = flightHours(km);
  const [y, m, da] = $("date").value.split("-").map(Number);
  const [hh, mi] = $("time").value.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, da, hh, mi);
  const depUtc = new Date(naive - offsetMinutes(d.tz, new Date(naive)) * 60000);
  const arrUtc = new Date(depUtc.getTime() + h * 3600000);
  const p = localParts(r.tz, arrUtc);
  const dayDiff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(y, m - 1, da)) / 86400000);
  $("resultBox").hidden = false;
  $("hOut").textContent = hoursToKo(h);
  $("sum").innerHTML =
    "<dt>대권거리</dt><dd>약 " + fmt(km) + " km (" + fmt(km * 0.539957) + " NM)</dd>" +
    "<dt>노선</dt><dd>" + esc($("dep").value + " " + d.c) + " → " + esc($("arr").value + " " + r.c) + "</dd>" +
    "<dt>시차</dt><dd>" + esc(diffLabel(diffHours(d.tz, r.tz, depUtc))) + "</dd>" +
    "<dt>도착 현지 시각</dt><dd>" + p.y + "-" + pad(p.m) + "-" + pad(p.d) + " (" + p.wd + ") " + pad(p.h) + ":" + pad(p.mi) +
      (dayDiff === 0 ? "" : dayDiff > 0 ? " <span class=\\"badge warn\\">+" + dayDiff + "일</span>" : " <span class=\\"badge warn\\">" + dayDiff + "일</span>") + "</dd>";
  lastTxt = $("dep").value + "→" + $("arr").value + " 약 " + fmt(km) + "km · 예상 " + hoursToKo(h);
  showAd();
});
$("copyBtn").addEventListener("click", () => copyText(lastTxt + " (추정치, tripcalc-kr.vercel.app/flight-time)"));
`,
},
{
  slug: "roaming", emoji: "📶", nav: "로밍 vs 유심 비교",
  hubName: "로밍·유심 비용 비교", hubDesc: "로밍·현지유심·이심·포켓와이파이 요금을 직접 넣어 1일·1인 기준으로 비교합니다.",
  title: "로밍 vs 유심 vs 이심 비용 비교 — 직접 입력해 1인 1일 요금 비교",
  ogTitle: "로밍·유심·이심 비용 비교",
  desc: "통신사 로밍, 현지 유심, eSIM, 포켓와이파이의 요금을 직접 입력하면 여행 기간·인원 기준으로 1인당 총액과 하루당 요금을 나란히 비교합니다. 요금제는 수시로 바뀌므로 값을 저장하지 않고 입력받습니다.",
  h1: "로밍·유심 비용 비교",
  lead: `요금제는 수시로 바뀌므로 <strong>본인이 본 가격을 그대로 입력</strong>해 비교합니다. 1인 1일 기준으로 환산해 줍니다.`,
  body: `
  <section class="card" aria-label="입력">
    <h2>여행 조건</h2>
    <div class="grid2">
      <label class="f">여행 기간 <span class="u">(일)</span><input type="number" id="days" min="1" max="90" value="5" /></label>
      <label class="f">인원 <span class="u">(명)</span><input type="number" id="people" min="1" max="20" value="2" /></label>
    </div>
    <p class="note">포켓와이파이처럼 <strong>여러 명이 함께 쓰는</strong> 방식은 인원수로 나눠 1인당 요금을 계산합니다.</p>
  </section>

  <section class="card" aria-label="요금 입력">
    <h2>비교할 요금 입력</h2>
    <div id="rows"></div>
    <button class="btn" id="goBtn" type="button">비교하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>비교 결과</h2>
      <p class="big">가장 저렴 <span class="num" id="best">-</span></p>
      <div id="tbl"></div>
      <p class="note">데이터 용량·속도 제한·통화 가능 여부가 다르므로 <strong>가격만으로 결정하지 마세요</strong>. 현지 번호가 필요한지(택시·배달 앱 인증), 테더링이 되는지도 함께 확인하세요.</p>
      <div class="share"><button class="btn2" id="copyBtn" type="button">📋 결과 복사</button></div>
    </div>
  </section>`,
  intro: `<h2>요금제를 저장하지 않는 이유</h2>
  <p>로밍·유심·이심 요금은 통신사 프로모션과 판매처에 따라 수시로 바뀝니다. 어제 맞았던 가격표가 오늘은 틀린 정보가 되고, 틀린 가격표를 그대로 믿고 결제하면 손해가 발생합니다. 그래서 이 도구는 요금 데이터를 저장하지 않고 <strong>이용자가 실제로 본 가격</strong>을 입력받아 비교만 합니다.</p>
  <p>비교의 핵심은 <strong>단위를 통일하는 것</strong>입니다. 로밍은 하루 단위, 유심은 기간 패키지, 포켓와이파이는 기기당 하루 단위로 팔리기 때문에 그대로 보면 어느 쪽이 싼지 알기 어렵습니다. 여기서는 모두 "1인 총액"과 "1인 1일"로 환산합니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>여행 기간과 인원을 입력합니다.</li>
    <li>비교하려는 방식의 요금을 넣습니다. 요금 단위(하루당 / 전체 기간 / 기기당 하루)를 정확히 고르는 것이 중요합니다.</li>
    <li>포켓와이파이처럼 여러 명이 공유하는 방식은 "인원수로 나눔"에 체크합니다.</li>
    <li>결과에서 1인 총액과 1인 1일 요금을 비교합니다.</li>
  </ol>
  <h2>가격 말고 확인해야 할 것</h2>
  <ul>
    <li><strong>현지 번호가 필요한가</strong> — 현지 택시·배달·간편결제 앱은 SMS 인증을 요구하는 경우가 많습니다. 이심·유심은 현지 번호가 생기지만 데이터 전용 상품은 아닐 수 있습니다.</li>
    <li><strong>한국 번호 수신이 필요한가</strong> — 은행·본인인증 문자를 받아야 한다면 한국 번호를 살려 두는 로밍이나 듀얼심 이심이 유리합니다.</li>
    <li><strong>테더링 허용 여부</strong>와 <strong>속도 제한 조건</strong>(일정 용량 초과 후 속도 저하)을 확인하세요.</li>
    <li>포켓와이파이는 <strong>기기 배터리</strong>와 반납 절차가 변수입니다. 일행이 흩어지면 한 명만 인터넷을 쓰게 됩니다.</li>
  </ul>`,
  faq: [
    { q: "왜 요금제 목록이 미리 들어 있지 않나요?", a: "로밍·유심 요금은 프로모션에 따라 자주 바뀌어, 잘못된 값을 미리 넣어 두면 오히려 잘못된 결정을 유도하기 때문입니다. 확인한 가격을 직접 넣어 비교하는 방식이 정확합니다." },
    { q: "이심(eSIM)은 어떤 기기에서 되나요?", a: "최근 스마트폰 상당수가 지원하지만 모델·통신사 정책에 따라 다르고 국내 개통 기기 중 일부는 제약이 있습니다. 반드시 본인 기기의 지원 여부를 먼저 확인하세요." },
    { q: "한국 번호로 오는 문자를 받아야 합니다.", a: "데이터 전용 유심으로 갈아 끼우면 한국 번호 수신이 끊깁니다. 듀얼심(물리심+이심)으로 한국 번호를 살려 두거나 통신사 로밍을 쓰는 방식을 고려하세요. 구체적인 조건은 통신사에 확인해야 합니다." },
  ],
  disclaimer: DISC("요금·조건은 통신사와 판매처에 따라 다르며 이 사이트는 어떤 상품도 추천하거나 판매하지 않습니다."),
  related: [T.china, T.budget],
  script: `
import { $, showAd, esc, won, copyText } from "__U__assets/app.mjs";
const PLANS = [
  { id: "roaming", n: "📱 통신사 로밍", per: "day", share: false, ph: 9900 },
  { id: "esim", n: "📶 eSIM", per: "total", share: false, ph: 15000 },
  { id: "sim", n: "💳 현지 유심", per: "total", share: false, ph: 20000 },
  { id: "pocket", n: "📡 포켓와이파이", per: "day", share: true, ph: 6000 },
];
const PER = [["day", "하루당"], ["total", "전체 기간"]];
$("rows").innerHTML = PLANS.map((p) =>
  '<div class="grid3" style="margin-top:10px"><label class="f">' + esc(p.n) + '<input type="number" id="a_' + p.id + '" min="0" value="' + p.ph + '" /></label>' +
  '<label class="f">요금 단위<select id="p_' + p.id + '">' + PER.map((x) => '<option value="' + x[0] + '"' + (x[0] === p.per ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select></label>" +
  '<label class="f">인원수로 나눔<select id="s_' + p.id + '"><option value="0"' + (p.share ? "" : " selected") + ">아니오 (1인 1개)</option><option value=\\"1\\"" + (p.share ? " selected" : "") + ">예 (함께 사용)</option></select></label></div>").join("");
let lastTxt = "";
$("goBtn").addEventListener("click", () => {
  const days = Math.max(1, +$("days").value || 1);
  const people = Math.max(1, +$("people").value || 1);
  const rows = PLANS.map((p) => {
    const amt = Number($("a_" + p.id).value) || 0;
    const per = $("p_" + p.id).value;
    const share = $("s_" + p.id).value === "1";
    const groupTotal = (per === "day" ? amt * days : amt) * (share ? 1 : people);
    return { n: p.n, groupTotal, perPerson: groupTotal / people, perPersonDay: groupTotal / people / days, amt };
  }).filter((r) => r.amt > 0);
  if (!rows.length) { alert("요금을 하나 이상 입력하세요."); return; }
  const sorted = [...rows].sort((a, b) => a.perPerson - b.perPerson);
  const best = sorted[0];
  $("resultBox").hidden = false;
  $("best").textContent = best.n.replace(/^\\S+\\s/, "") + " · 1인 " + won(best.perPerson);
  $("tbl").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>방식</th><th>일행 전체</th><th>1인 총액</th><th>1인 1일</th></tr></thead><tbody>' +
    sorted.map((r) => "<tr" + (r === best ? ' class="sum"' : "") + "><td>" + esc(r.n) + "</td><td>" + won(r.groupTotal) + "</td><td>" + won(r.perPerson) + "</td><td>" + won(r.perPersonDay) + "</td></tr>").join("") +
    "</tbody></table></div>";
  lastTxt = days + "일 " + people + "명 기준 최저 " + best.n + " 1인 " + won(best.perPerson);
  showAd();
});
$("copyBtn").addEventListener("click", () => copyText(lastTxt + " (tripcalc-kr.vercel.app/roaming)"));
`,
},
{
  slug: "itinerary", emoji: "🗓️", nav: "여행 일정표 만들기",
  hubName: "여행 일정표 만들기", hubDesc: "날짜별 일정을 넣어 표를 만들고, 인쇄(PDF 저장)·이미지 저장·링크 공유까지.",
  title: "여행 일정표 만들기 — 날짜별 일정 표·인쇄용 PDF 저장",
  ogTitle: "여행 일정표 만들기",
  desc: "여행 시작일과 기간을 넣고 날짜별 일정을 추가하면 보기 좋은 일정표가 만들어집니다. 인쇄(PDF로 저장) 레이아웃, 결과 카드 이미지 저장, 링크 공유, 텍스트 내보내기를 지원하며 저장은 브라우저에만 합니다.",
  h1: "여행 일정표 만들기",
  lead: `날짜별 일정을 넣으면 <strong>인쇄해서 들고 다닐 수 있는 일정표</strong>가 됩니다. 링크로 공유도 됩니다.`,
  body: `
  <div id="ctaBox" hidden></div>
  <section class="card noprint" aria-label="입력">
    <h2>여행 기본 정보</h2>
    <div class="grid3">
      <label class="f">여행 제목 <input type="text" id="title" value="도쿄 여행" maxlength="40" /></label>
      <label class="f">시작일 <input type="date" id="start" /></label>
      <label class="f">기간 <span class="u">(일)</span><input type="number" id="days" min="1" max="30" value="4" /></label>
    </div>
    <h2 style="margin-top:18px">일정 추가</h2>
    <div class="grid3">
      <label class="f">몇째 날 <select id="dayNo"></select></label>
      <label class="f">시각 <input type="time" id="at" value="10:00" /></label>
      <label class="f">내용 <input type="text" id="what" placeholder="예: 아사쿠사 센소지" maxlength="60" /></label>
    </div>
    <button class="btn" id="addBtn" type="button">➕ 일정 추가</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2 id="planTitle">일정표</h2>
      <div class="itin" id="itin"></div>
      ${NO_SERVER}
      <div class="share noprint">
        <button class="btn2" id="printBtn" type="button">🖨️ 인쇄 / PDF 저장</button>
        <button class="btn2" id="pngBtn" type="button">🖼️ 이미지로 저장</button>
        <button class="btn2" id="linkBtn" type="button">🔗 링크 복사</button>
        <button class="btn2" id="textBtn" type="button">📋 텍스트 복사</button>
        <button class="btn2" id="expBtn" type="button">⬇️ 파일로 내보내기</button>
        <button class="btn2" id="shareBtn" type="button">📤 공유</button>
        <button class="btn2" id="clearBtn" type="button">🗑️ 저장 기록 전체 삭제</button>
      </div>
      <canvas id="cardCv" class="cardimg" hidden></canvas>
    </div>
  </section>`,
  intro: `<h2>일정표는 결국 "종이로 들고 다닐 수 있어야" 쓸모 있다</h2>
  <p>여행 일정을 메신저 대화나 메모 앱에 흩어 두면 정작 현지에서 찾기 어렵습니다. 배터리가 없거나 데이터가 안 될 때도 있습니다. 그래서 이 도구는 화면에서 만든 일정표를 <strong>그대로 인쇄</strong>할 수 있게 만들었습니다. 인쇄 화면에서는 광고·버튼·메뉴가 모두 사라지고 일정만 남습니다. 브라우저의 "PDF로 저장"을 고르면 파일로도 남습니다.</p>
  <p>동행과 공유할 때는 링크 하나면 됩니다. 일정 내용이 링크 안에 담겨 있어 서버에 저장하지 않고도 상대방 화면에 같은 일정표가 뜹니다.</p>`,
  howto: `<h2>사용법</h2>
  <ol>
    <li>여행 제목·시작일·기간을 입력합니다.</li>
    <li>몇째 날인지 고르고 시각과 내용을 넣어 "일정 추가"를 누릅니다. 시각순으로 자동 정렬됩니다.</li>
    <li>각 항목 오른쪽 ✕ 로 삭제할 수 있습니다.</li>
    <li>"인쇄 / PDF 저장"을 누르면 일정만 남은 인쇄 화면이 나옵니다. 대상에서 "PDF로 저장"을 고르면 파일이 됩니다.</li>
    <li>"링크 복사"로 동행에게 공유하고, "이미지로 저장"으로 요약 카드를 저장할 수 있습니다.</li>
  </ol>`,
  faq: [
    { q: "일정이 서버에 저장되나요?", a: "아닙니다. 이 브라우저의 localStorage에만 저장되고, 공유 링크에는 일정 내용이 링크 자체에 인코딩되어 담깁니다. 서버에는 아무것도 남지 않습니다." },
    { q: "링크가 너무 깁니다.", a: "일정 내용을 서버 없이 담기 위해 링크 안에 인코딩하기 때문입니다. 일정이 많을수록 길어집니다. 메신저로 보낼 때는 문제가 없습니다." },
    { q: "PDF로 저장하려면?", a: "'인쇄 / PDF 저장' 버튼을 누른 뒤 인쇄 대화상자의 대상에서 'PDF로 저장'을 고르세요. 인쇄 레이아웃에서는 광고·버튼이 제외됩니다." },
    { q: "지도나 예약 정보도 넣을 수 있나요?", a: "현재는 시각과 내용 텍스트만 지원합니다. 예약번호처럼 짧은 정보는 내용란에 함께 적어 두면 인쇄물에 같이 나옵니다. 여권번호 등 민감한 정보는 넣지 마세요." },
  ],
  disclaimer: DISC("여권번호·카드번호 등 민감한 개인정보는 입력하지 마세요. 공유 링크에 그대로 담깁니다."),
  related: [T.pin, T.packing, T.budget],
  script: `
import { $, showAd, esc, copyText, store, download, readR, shareUrl, sharedCta, wireShare, toast, drawCard, saveCanvas } from "__U__assets/app.mjs";
const S = store("tc-itin-v1");
function pad(n) { return String(n).padStart(2, "0"); }
const t0 = new Date();
$("start").value = t0.getFullYear() + "-" + pad(t0.getMonth() + 1) + "-" + pad(t0.getDate());
let evs = [];
const shared = readR();
const init = shared || S.load(null);
if (init) { $("title").value = init.title || "여행"; $("start").value = init.start || $("start").value; $("days").value = init.days || 4; evs = init.evs || []; }
if (shared) sharedCta($("ctaBox"), "나도 일정표 만들기");
function fillDays() {
  const n = Math.max(1, +$("days").value || 1);
  $("dayNo").innerHTML = Array.from({ length: n }, (_, i) => "<option value=\\"" + (i + 1) + "\\">" + (i + 1) + "일차</option>").join("");
}
$("days").addEventListener("change", () => { fillDays(); render(); });
fillDays();
function stateOf() { return { title: $("title").value, start: $("start").value, days: +$("days").value || 1, evs }; }
function dateOf(i) {
  const [y, m, d] = $("start").value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + i));
  const wd = ["일", "월", "화", "수", "목", "금", "토"][dt.getUTCDay()];
  return (dt.getUTCMonth() + 1) + "/" + dt.getUTCDate() + " (" + wd + ")";
}
function render() {
  const st = stateOf();
  $("resultBox").hidden = false;
  $("planTitle").textContent = st.title + " · " + st.days + "일 일정표";
  let html = "";
  for (let i = 0; i < st.days; i++) {
    const list = evs.filter((e) => e.d === i + 1).sort((a, b) => a.t.localeCompare(b.t));
    html += '<div class="d"><h3>' + (i + 1) + "일차 · " + dateOf(i) + "</h3>" +
      (list.length ? list.map((e) => {
        const idx = evs.indexOf(e);
        return '<div class="ev"><span class="t">' + esc(e.t) + '</span><span>' + esc(e.w) + '</span><button class="x noprint" data-i="' + idx + '" type="button" aria-label="삭제">✕</button></div>';
      }).join("") : '<p class="note" style="margin:0">아직 일정이 없습니다.</p>') + "</div>";
  }
  $("itin").innerHTML = html;
  [...$("itin").querySelectorAll(".x")].forEach((b) => b.addEventListener("click", () => { evs.splice(+b.dataset.i, 1); S.save(stateOf()); render(); }));
  S.save(st);
}
$("addBtn").addEventListener("click", () => {
  const w = $("what").value.trim();
  if (!w) { alert("일정 내용을 입력하세요."); return; }
  evs.push({ d: +$("dayNo").value, t: $("at").value, w });
  $("what").value = "";
  render();
  showAd();
});
function asText() {
  const st = stateOf();
  let s = st.title + " (" + st.days + "일)\\n";
  for (let i = 0; i < st.days; i++) {
    s += "\\n[" + (i + 1) + "일차 " + dateOf(i) + "]\\n";
    const list = evs.filter((e) => e.d === i + 1).sort((a, b) => a.t.localeCompare(b.t));
    s += list.length ? list.map((e) => "  " + e.t + "  " + e.w).join("\\n") + "\\n" : "  (일정 없음)\\n";
  }
  return s;
}
$("printBtn").addEventListener("click", () => window.print());
$("textBtn").addEventListener("click", () => copyText(asText()));
$("expBtn").addEventListener("click", () => download("itinerary.txt", asText()));
$("clearBtn").addEventListener("click", () => { S.clear(); evs = []; render(); toast("저장 기록을 삭제했습니다"); });
$("pngBtn").addEventListener("click", () => {
  const st = stateOf();
  const lines = [];
  for (let i = 0; i < Math.min(st.days, 5); i++) {
    const list = evs.filter((e) => e.d === i + 1).sort((a, b) => a.t.localeCompare(b.t));
    lines.push("· " + (i + 1) + "일차 " + dateOf(i) + " — " + (list.length ? list.slice(0, 2).map((e) => e.t + " " + e.w).join(", ") : "자유"));
  }
  const cv = drawCard({ title: st.title, big: st.days + "일 일정", lines, slug: "itinerary" });
  const box = $("cardCv");
  box.hidden = false;
  box.width = cv.width; box.height = cv.height;
  box.getContext("2d").drawImage(cv, 0, 0);
  saveCanvas(cv, "itinerary.png");
});
wireShare({
  linkBtn: $("linkBtn"), textBtn: null, xBtn: null, shareBtn: $("shareBtn"),
  getUrl: () => shareUrl(stateOf()),
  getText: () => stateOf().title + " " + stateOf().days + "일 일정표",
  title: "여행 일정표",
});
if (init) { render(); showAd(); }
`,
},
];

/* ── 롱테일 1: 통화쌍 페이지 ────────────────────────────────── */
const PAIR_CUR = FX_CUR.filter((c) => c.code !== "KRW");
const PAIRS = [];
for (const c of PAIR_CUR) { PAIRS.push([c.code, "KRW"]); PAIRS.push(["KRW", c.code]); }

function curInfo(code) {
  return CUR_BY[code] || { nameKo: code, flag: "💱", countries: [] };
}

function pairPage([from, to]) {
  const f = curInfo(from), t = curInfo(to);
  const slug = `${from.toLowerCase()}-${to.toLowerCase()}`;
  const fName = `${f.nameKo}(${from})`, tName = `${t.nameKo}(${to})`;
  const cList = (from === "KRW" ? t : f).countries.slice(0, 4).join("·");
  const sample = from === "KRW" ? [1000, 10000, 50000, 100000] : [1, 10, 100, 1000];
  const isKrwOut = to === "KRW";
  return {
    path: `currency/${slug}/`, emoji: `${f.flag}${t.flag}`, ad: true,
    title: `${fName} → ${tName} 환율 계산기 — ${sample[2].toLocaleString("ko-KR")}${from === "KRW" ? "원" : from}은 얼마?`,
    ogTitle: `${from}/${to} 환율 계산기`,
    desc: `${fName}를 ${tName}로 환산합니다. ${cList ? cList + " 여행·구매 시 " : ""}${sample.map((s) => s.toLocaleString("ko-KR")).join("·")} ${from} 단위 환산표를 함께 보여주며, 환율은 공개 API에서 불러와 24시간 캐시합니다. 참고용이며 은행 고시 환율이 아닙니다.`,
    h1: `${from} → ${to} 환율`,
    appName: `${from}/${to} 환율 계산기`,
    lead: `${f.flag} <strong>${fName}</strong>를 ${t.flag} <strong>${tName}</strong>로 환산합니다. 열자마자 오늘 환율로 계산됩니다.`,
    crumbs: [
      { name: "환율 계산기", item: `${SITE_ORIGIN}/currency/`, rel: "currency/" },
      { name: `${from}/${to}`, item: `${SITE_ORIGIN}/currency/${slug}/` },
    ],
    body: `
  <section class="card" aria-label="입력">
    <h2>${fName} 금액</h2>
    <label class="f">금액 <span class="u">(${from})</span>
      <input type="number" id="amt" inputmode="decimal" min="0" step="any" value="${sample[2]}" />
    </label>
    <button class="btn" id="goBtn" type="button">${to}로 환산하기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>환산 결과</h2>
      <p class="big"><span class="num" id="out">-</span></p>
      <div id="rateLines"></div>
      <div id="quickTbl"></div>
      <p class="note" id="fxStatus"></p>
      <div class="share">
        <button class="btn2" id="copyBtn" type="button">📋 결과 복사</button>
        <a class="btn2" href="../">💱 다른 통화로 계산하기</a>
        <a class="btn2" href="../${to.toLowerCase()}-${from.toLowerCase()}/">⇅ ${to} → ${from}</a>
      </div>
    </div>
  </section>

  <section class="card" aria-label="다른 통화쌍">
    <h2>다른 통화쌍</h2>
    <div class="chips">
      ${PAIR_CUR.filter((c) => c.code !== from && c.code !== to).slice(0, 10).map((c) =>
        `<a class="chip" href="../${c.code.toLowerCase()}-krw/">${c.flag} ${c.code}→KRW</a>`).join("\n      ")}
    </div>
  </section>`,
    intro: `<h2>${fName} 환율, 이 페이지만 열어 두면 됩니다</h2>
    <p>${from === "KRW"
      ? `원화를 ${tName}로 바꿀 때 얼마가 되는지 계산합니다. ${cList ? cList + " 여행을 준비하면서 " : ""}예산을 현지 통화 기준으로 잡을 때 유용합니다.`
      : `${cList ? cList + " 등에서 쓰는 " : ""}${fName}를 원화로 환산합니다. 현지 가격표를 보고 "이게 우리 돈으로 얼마지?"를 바로 확인할 때 쓰세요.`}
    페이지를 열면 자동으로 최신 기준환율을 불러오고, 네트워크가 안 되면 마지막으로 받아온 환율로 계산한 뒤 그 사실을 화면에 표시합니다.</p>
    <p>표시되는 값은 <strong>기준환율</strong>입니다. 실제 은행·환전소·카드 결제에는 스프레드와 수수료가 붙기 때문에 ${isKrwOut ? "실제로 손에 쥐는 원화" : "실제 결제되는 금액"}은 이보다 불리합니다. 대략적인 감을 잡는 용도로 쓰세요.</p>`,
    howto: `<h2>사용법</h2>
    <ol>
      <li>금액을 넣고 "${to}로 환산하기"를 누릅니다.</li>
      <li>1 ${from} 기준 환율과 역환율(1 ${to} = ? ${from})이 함께 표시됩니다.</li>
      <li>아래 단위별 표(${sample.map((s) => s.toLocaleString("ko-KR")).join(", ")} ${from})로 자릿수 감각을 잡을 수 있습니다.</li>
    </ol>`,
    faq: [
      { q: `${from} 환율은 얼마나 자주 갱신되나요?`, a: "유럽중앙은행 기준환율을 제공하는 공개 API를 사용하며 영업일 기준으로 하루 한 번 갱신됩니다. 브라우저에는 24시간 캐시되고, 상단 계산기의 새로고침으로 즉시 다시 받아올 수 있습니다." },
      { q: "은행에서 환전하면 이 금액을 받나요?", a: "아닙니다. 기준환율이며 실제 환전에는 스프레드와 수수료가 붙습니다. 참고용이며 은행 고시 환율이 아닙니다." },
      { q: "인터넷이 안 되는 곳에서도 계산되나요?", a: "한 번이라도 이 사이트에서 환율을 받아온 적이 있으면 저장된 값으로 계산하고 '마지막으로 받아온 환율'이라고 표시합니다." },
    ],
    basis: FX_BOX,
    related: [T.budget, T.split],
    script: `
import { $, showAd, esc, copyText } from "__U__assets/app.mjs";
import { getRates, rateOf, fxFmt, fetchedLabel, FX_DISCLAIMER } from "__U__lib/fx.mjs";
const FROM = "${from}", TO = "${to}";
const UNITS = ${JSON.stringify(sample)};
async function run() {
  $("resultBox").hidden = false;
  $("fxStatus").innerHTML = "환율을 불러오는 중…";
  const st = await getRates(FROM);
  const r = rateOf(st, FROM, TO);
  $("fxStatus").innerHTML = st.ok
    ? (st.stale ? "<strong>마지막으로 받아온 환율</strong>을 사용 중입니다. " + esc(st.message) + " " : "") +
      "출처: " + esc(st.src || "저장된 값") + (st.date ? " · 기준일 " + esc(st.date) : "") + " · 받아온 시각 " + esc(fetchedLabel(st)) + "<br />" + FX_DISCLAIMER
    : "⚠ " + esc(st.message);
  if (r == null) { $("out").textContent = "-"; showAd(); return; }
  const a = Number($("amt").value) || 0;
  $("out").textContent = fxFmt(a * r, TO) + " " + TO;
  $("rateLines").innerHTML =
    '<div class="fxline"><span>1 ' + FROM + "</span><b>" + fxFmt(r, TO) + " " + TO + "</b></div>" +
    '<div class="fxline"><span>1 ' + TO + "</span><b>" + fxFmt(1 / r, FROM) + " " + FROM + "</b></div>";
  $("quickTbl").innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>' + FROM + "</th><th>" + TO + "</th></tr></thead><tbody>" +
    UNITS.map((u) => "<tr><td>" + u.toLocaleString("ko-KR") + "</td><td>" + fxFmt(u * r, TO) + "</td></tr>").join("") + "</tbody></table></div>";
  showAd();
}
$("goBtn").addEventListener("click", run);
$("copyBtn").addEventListener("click", () => copyText($("amt").value + " " + FROM + " = " + $("out").textContent + " (tripcalc-kr.vercel.app/currency/" + FROM.toLowerCase() + "-" + TO.toLowerCase() + ")"));
run();
`,
  };
}

/* ── 롱테일 2: 국가별 카드 ──────────────────────────────────── */
function countryPage(c) {
  const plugs = c.voltage.plugs.join(", ");
  const koPlug = KOREA.voltage.plugs;
  const samePlug = c.voltage.plugs.some((p) => koPlug.includes(p));
  const vNum = (String(c.voltage.value).match(/\d+/g) || ["220"]).map(Number);
  const sameVolt = vNum.some((v) => Math.abs(v - 220) <= 20);
  const verdict = samePlug && sameVolt ? "한국 플러그를 그대로 꽂을 수 있습니다" : sameVolt ? "전압은 비슷하지만 플러그 어댑터가 필요합니다" : "전압이 달라 기기 표기(100-240V 여부) 확인이 필요합니다";
  return {
    path: `country/${c.slug}/`, emoji: c.flag, ad: true,
    title: `${c.nameKo} 여행 기본정보 — 전압 ${c.voltage.value}·플러그 ${plugs}형·시차·팁`,
    ogTitle: `${c.nameKo} 전압·플러그·시차 정보`,
    desc: `${c.nameKo} 여행에 필요한 전압(${c.voltage.value} ${c.voltage.freq})과 콘센트 플러그 ${plugs}형, 통화(${c.currency.code} ${c.currency.nameKo}), 한국과의 시차, 팁 관행을 한 장에 정리했습니다. 비자·입국요건은 외교부 해외안전여행에서 확인하세요.`,
    h1: `${c.nameKo} 여행 기본정보`,
    appName: `${c.nameKo} 여행 정보 카드`,
    lead: `${c.flag} <strong>${c.nameKo}</strong>의 전압·플러그·시차·통화·팁 관행을 한 장에 정리했습니다.`,
    crumbs: [
      { name: "나라별 정보", item: `${SITE_ORIGIN}/country/`, rel: "country/" },
      { name: c.nameKo, item: `${SITE_ORIGIN}/country/${c.slug}/` },
    ],
    body: `
  <section class="card" aria-label="기본 정보">
    <h2>${c.flag} ${c.nameKo} 한눈에</h2>
    <dl class="kv">
      <dt>전압 / 주파수</dt><dd>${c.voltage.value} / ${c.voltage.freq}</dd>
      <dt>콘센트 플러그</dt><dd>${plugs}형</dd>
      <dt>통화</dt><dd>${c.currency.code} · ${c.currency.nameKo}</dd>
      <dt>표준시</dt><dd>${c.tz.zone} (UTC${c.tz.utcBase}${c.tz.dst ? ", 서머타임 시행" : ""})</dd>
      <dt>팁 관행</dt><dd>${c.tip.pct ? c.tip.pct[0] + "~" + c.tip.pct[1] + "%" : "관행 없음"}</dd>
    </dl>
    ${c.tz.note ? `<p class="note">⏱ ${c.tz.note}</p>` : ""}
    <button class="btn" id="goBtn" type="button">지금 현지 시각·시차 보기</button>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <div class="card">
      <h2>지금 ${c.nameKo}</h2>
      <div id="clock"></div>
      <p class="note" id="tzNote"></p>
    </div>
    <div class="card">
      <h2>전기 기기 사용</h2>
      <p class="big"><span class="num" style="font-size:20px">${verdict}</span></p>
      <p class="note">한국은 ${KOREA.voltage.value} ${KOREA.voltage.freq}, ${koPlug.join("/")}형입니다. 휴대폰·노트북 충전기는 대부분 프리볼트(100-240V)라 플러그 어댑터만으로 충분하지만,
      드라이어·고데기처럼 열을 내는 기기는 전압 표기를 반드시 확인하세요. 자세한 판정은 <a href="../../voltage/">전압·플러그 확인</a>에서 기기별로 볼 수 있습니다.</p>
    </div>
    <div class="card">
      <h2>팁 관행</h2>
      <p>${esc(c.tip.summary)}</p>
      <p class="note">${esc(c.tip.note)} 계산은 <a href="../../tip-calc/">나라별 팁 계산기</a>에서.</p>
    </div>
  </section>

  <section class="card" aria-label="관련 계산">
    <h2>${c.nameKo} 여행에 쓰는 계산기</h2>
    <div class="chips">
      ${c.currency.apiSupported && FRANKFURTER_CODES.includes(c.currency.code)
        ? `<a class="chip" href="../../currency/${c.currency.code.toLowerCase()}-krw/">💱 ${c.currency.code}→KRW 환율</a>`
        : `<a class="chip" href="../../currency/">💱 환율 계산기</a>`}
      <a class="chip" href="../../timezone/">🕐 시차 계산</a>
      <a class="chip" href="../../voltage/">🔌 전압 확인</a>
      <a class="chip" href="../../packing-list/">🎒 짐 목록</a>
      <a class="chip" href="../../duty-free/">🛃 면세 한도</a>
    </div>
  </section>`,
    intro: `<h2>${c.nameKo} 갈 때 미리 확인하면 좋은 것들</h2>
    <p>${c.nameKo}의 전기는 <strong>${c.voltage.value} ${c.voltage.freq}</strong>이고 콘센트는 <strong>${plugs}형</strong>입니다. ${samePlug
      ? "한국에서 쓰는 플러그와 모양이 호환되는 타입이 포함돼 있어 어댑터 없이 꽂히는 경우가 많습니다."
      : "한국 플러그(C/F형)와 모양이 달라 플러그 어댑터가 필요합니다."} ${sameVolt
      ? "전압도 한국과 비슷해 대부분의 기기를 그대로 쓸 수 있습니다."
      : "전압이 한국과 달라, 100-240V 프리볼트 표기가 없는 기기는 사용을 피하는 것이 안전합니다."}</p>
    <p>표준시는 <code>${c.tz.zone}</code>(UTC${c.tz.utcBase})입니다. ${c.tz.dst
      ? "서머타임을 시행하므로 계절에 따라 한국과의 시차가 1시간 달라집니다."
      : "서머타임을 시행하지 않아 연중 시차가 일정합니다."} 이 페이지의 "지금 현지 시각" 버튼은 시차표를 쓰지 않고 브라우저의 IANA 타임존 데이터로 계산하므로 항상 현재 기준으로 맞습니다.</p>
    <p>통화는 <strong>${c.currency.code}(${c.currency.nameKo})</strong>입니다. ${c.currency.apiSupported
      ? "환율은 공개 API로 조회할 수 있어 이 사이트의 환율 계산기에서 원화 환산이 가능합니다."
      : "무료 공개 환율 API가 지원하지 않는 통화라 이 사이트에서는 환율을 표시하지 않습니다. 임의의 값을 넣는 대신 표시하지 않는 쪽을 택했습니다."}</p>`,
    howto: `<h2>출발 전 체크리스트</h2>
    <ul>
      <li>충전기·어댑터에 <strong>100-240V</strong> 표기가 있는지 확인 (없으면 변압기 필요)</li>
      <li>${plugs}형 플러그를 지원하는 멀티 어댑터 준비</li>
      <li>${c.currency.code} 환전 또는 해외결제 카드 준비</li>
      <li>한국과의 시차를 확인해 도착 첫날 일정 조정</li>
      <li>비자·입국요건은 외교부 해외안전여행에서 최신 확인</li>
    </ul>
    ${VISA_BOX}`,
    faq: [
      { q: `${c.nameKo}에서 한국 충전기를 그대로 쓸 수 있나요?`, a: `${c.nameKo}는 ${c.voltage.value} ${c.voltage.freq}, ${plugs}형 콘센트를 사용합니다. ${verdict}. 휴대폰·노트북 충전기는 대부분 100-240V 프리볼트라 플러그 모양만 맞추면 되지만, 기기 본체의 전압 표기를 반드시 확인하세요.` },
      { q: `${c.nameKo}와 한국의 시차는 얼마인가요?`, a: `${c.nameKo}의 표준시는 ${c.tz.zone}(UTC${c.tz.utcBase})입니다. ${c.tz.dst ? "서머타임을 시행하므로 시기에 따라 시차가 달라집니다. 이 페이지의 버튼을 누르면 현재 시각 기준으로 정확한 시차를 계산합니다." : "서머타임이 없어 한국(UTC+9)과의 시차가 연중 일정합니다."}` },
      { q: `${c.nameKo}에서 팁을 줘야 하나요?`, a: c.tip.summary + " 이는 일반적인 관행 요약이며 정답이 아닙니다. 계산서의 봉사료 표기를 먼저 확인하세요." },
      { q: `${c.nameKo} 비자가 필요한가요?`, a: "비자·입국요건은 국적·여권 종류·방문 목적에 따라 다르고 수시로 바뀌므로 이 사이트에서는 안내하지 않습니다. 외교부 해외안전여행(0404.go.kr)에서 반드시 최신 정보를 확인하세요." },
    ],
    basis: `<h2>데이터 출처와 확인일</h2>
    <p class="note">전압·플러그: <a href="${c.voltage.source}" target="_blank" rel="noopener">IEC World Plugs</a> (확인일 ${c.voltage.checkedAt}) ·
    타임존: <a href="${c.tz.source}" target="_blank" rel="noopener">IANA tzdb</a> (확인일 ${c.tz.checkedAt}) ·
    통화 코드: <a href="${c.currency.source}" target="_blank" rel="noopener">ISO 4217</a> (확인일 ${c.currency.checkedAt}) ·
    팁 관행: 일반 관행 요약(참고용, 확인일 ${c.tip.checkedAt}) ·
    비자: <a href="${VISA_LINK}" target="_blank" rel="noopener">외교부 해외안전여행</a></p>`,
    disclaimer: DISC("현지 사정·건물 연식에 따라 콘센트와 전압이 다를 수 있습니다."),
    related: [T.pin, T.packing, T.budget],
    script: `
import { $, showAd, esc } from "__U__assets/app.mjs";
import { offsetMinutes, offsetLabel, diffHours, diffLabel, localParts, isDst } from "__U__lib/tz.mjs";
const TZ = "${c.tz.zone}", NAME = "${c.nameKo}";
let timer = null;
function tick() {
  const now = new Date();
  const p = localParts(TZ, now);
  const d = diffHours("Asia/Seoul", TZ, now);
  const k = localParts("Asia/Seoul", now);
  $("clock").innerHTML = '<div class="clock"><div><div class="city">' + NAME + (isDst(TZ, now) ? ' <span class="badge ok">서머타임</span>' : "") +
    '</div><div class="zone">' + TZ + " · UTC" + offsetLabel(offsetMinutes(TZ, now)) + '</div></div>' +
    '<div><div class="time">' + String(p.h).padStart(2, "0") + ":" + String(p.mi).padStart(2, "0") + '</div><div class="day">' + p.m + "/" + p.d + " (" + p.wd + ")</div></div></div>" +
    '<div class="clock"><div><div class="city">대한민국 서울</div><div class="zone">Asia/Seoul · UTC+09:00</div></div>' +
    '<div><div class="time">' + String(k.h).padStart(2, "0") + ":" + String(k.mi).padStart(2, "0") + '</div><div class="day">' + k.m + "/" + k.d + " (" + k.wd + ")</div></div></div>";
  $("tzNote").textContent = "한국 기준 " + diffLabel(d) + " — 시차는 IANA 타임존 데이터로 계산해 서머타임이 자동 반영됩니다.";
}
$("goBtn").addEventListener("click", () => {
  $("resultBox").hidden = false;
  tick();
  if (!timer) timer = setInterval(tick, 1000);
  showAd();
});
`,
  };
}

function countryIndexPage() {
  const rows = COUNTRIES.map((c) =>
    `<tr><td><a href="${c.slug}/">${c.flag} ${esc(c.nameKo)}</a></td><td>${esc(c.voltage.value)}</td><td>${c.voltage.plugs.join(",")}형</td><td>${c.currency.code}</td><td class="mut">UTC${c.tz.utcBase}${c.tz.dst ? " (DST)" : ""}</td></tr>`).join("\n      ");
  return {
    path: "country/", emoji: "🌏", ad: false,
    title: `나라별 여행 기본정보 ${COUNTRIES.length}개국 — 전압·플러그·시차·통화 한눈에`,
    ogTitle: "나라별 전압·플러그·시차·통화",
    desc: `${COUNTRIES.length}개국의 전압·콘센트 플러그 타입·통화·표준시를 표 하나로 비교합니다. 나라를 누르면 한국과의 시차, 기기 사용 가능 여부, 팁 관행까지 정리된 카드로 이동합니다.`,
    h1: "나라별 여행 기본정보",
    appName: "나라별 여행 정보",
    lead: `${COUNTRIES.length}개국의 <strong>전압·플러그·통화·표준시</strong>를 한 표에서 비교하세요.`,
    crumbs: [{ name: "나라별 정보", item: `${SITE_ORIGIN}/country/` }],
    body: `
  <section class="card">
    <h2>전체 ${COUNTRIES.length}개국</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>나라</th><th>전압</th><th>플러그</th><th>통화</th><th>표준시</th></tr></thead>
      <tbody>
      ${rows}
      </tbody>
    </table></div>
  </section>`,
    intro: `<h2>여행 준비의 첫 세 가지: 전기, 시간, 돈</h2>
    <p>목적지가 정해지면 가장 먼저 확인해야 할 것은 화려한 관광지가 아니라 <strong>전기·시간·돈</strong>입니다. 콘센트 모양을 모르면 첫날 밤 휴대폰이 꺼지고, 시차를 착각하면 첫 일정을 놓치며, 통화를 모르면 환전 계획을 세울 수 없습니다.</p>
    <p>이 표는 그 세 가지를 한 화면에 모았습니다. 나라 이름을 누르면 한국과의 실시간 시차, 한국 기기 사용 가능 여부, 팁 관행까지 정리된 개별 페이지로 이동합니다.</p>`,
    howto: `<h2>표 보는 법</h2>
    <ul>
      <li><strong>전압</strong> — 100~127V 계열은 한국(220V)과 다릅니다. 프리볼트가 아닌 기기는 사용 불가입니다.</li>
      <li><strong>플러그</strong> — 한국은 C/F형입니다. 다른 문자가 적혀 있으면 어댑터가 필요합니다.</li>
      <li><strong>표준시</strong> — UTC 기준 오프셋입니다. (DST)는 서머타임 시행국으로, 시기에 따라 한국과의 시차가 1시간 달라집니다.</li>
    </ul>
    ${VISA_BOX}`,
    faq: [
      { q: "한 나라 안에서 전압이 다를 수도 있나요?", a: "네. 브라질처럼 지역에 따라 127V와 220V를 함께 쓰는 나라가 있고, 오래된 건물과 새 건물의 콘센트가 다른 경우도 있습니다. 숙소 안내를 함께 확인하세요." },
      { q: "표에 없는 나라는 어떻게 확인하나요?", a: "현재 55개국을 다루고 있습니다. 없는 나라는 IEC World Plugs와 IANA 타임존 데이터베이스에서 직접 확인할 수 있습니다." },
      { q: "비자 정보는 왜 없나요?", a: "비자·입국요건은 국적과 방문 목적에 따라 다르고 수시로 바뀌어, 잘못된 정보가 곧바로 입국 거부로 이어질 수 있습니다. 그래서 이 사이트는 직접 기재하지 않고 외교부 해외안전여행 링크만 제공합니다." },
    ],
    basis: `<h2>데이터 출처</h2>
    <p class="note">전압·플러그 <a href="https://www.iec.ch/world-plugs" target="_blank" rel="noopener">IEC World Plugs</a>,
    타임존 <a href="https://www.iana.org/time-zones" target="_blank" rel="noopener">IANA tzdb</a>,
    통화 코드 <a href="https://www.iso.org/iso-4217-currency-codes.html" target="_blank" rel="noopener">ISO 4217</a> 기준. 확인일 ${CHECKED_AT}.</p>`,
    related: [T.pin, T.china],
  };
}

/* ── 허브 · 정책 페이지 ─────────────────────────────────────── */
function hubPage() {
  const cards = TOOLS.map((t) => `<a class="tool" href="${t.slug}/"><div class="t-e">${t.emoji}</div><div class="t-n">${t.hubName}</div><div class="t-d">${t.hubDesc}</div></a>`).join("\n      ");
  const icnJfk = Math.round(distanceBetween(findAirport("ICN"), findAirport("JFK")));
  return {
    path: "", emoji: "🧳", ad: false,
    title: "해외여행 계산기 허브 — 환율·시차·짐·예산·면세 한도까지",
    desc: `환율, 세계 시차, 국제 회의 시간, 짐 싸기 목록, 여행 예산과 N빵 정산, 나라별 팁, 전압·플러그, 시차적응, 면세 한도, 비행시간, 로밍 비교, 일정표까지 해외여행에 필요한 계산을 한곳에 모은 무료 도구 모음입니다. 설치 없이 브라우저에서 바로 씁니다.`,
    h1: "해외여행 계산기",
    appName: SITE_NAME,
    lead: `환율·시차·짐·예산·면세 한도까지. <strong>설치 없이</strong> 브라우저에서 바로 계산하고, 계산 근거와 출처를 함께 보여줍니다.`,
    crumbs: [],
    body: `
  <div class="tool-grid">
      ${cards}
      <a class="tool" href="country/"><div class="t-e">🌏</div><div class="t-n">나라별 여행 기본정보</div><div class="t-d">${COUNTRIES.length}개국의 전압·플러그·통화·표준시를 한 표로. 나라별 상세 카드 제공.</div></a>
  </div>`,
    intro: `<h2>여행 준비의 계산을 한곳에</h2>
    <p>해외여행을 준비하다 보면 검색 탭이 열 개씩 열립니다. 환율 하나, 시차 하나, 콘센트 모양 하나, 면세 한도 하나. 이 사이트는 그 계산들을 한곳에 모으되, <strong>숫자만 던지지 않는 것</strong>을 원칙으로 만들었습니다. 어떤 기준으로 계산했는지, 출처가 어디인지, 언제 확인한 값인지를 화면에 함께 적습니다.</p>
    <p>두 번째 원칙은 <strong>모르는 것은 지어내지 않는다</strong>입니다. 비자·입국요건은 국적과 목적에 따라 다르고 수시로 바뀌므로 이 사이트에서 직접 기재하지 않고 외교부 해외안전여행 링크만 제공합니다. 자진신고 감면 한도액처럼 개정 이력이 있는 값은 "확인 필요" 표시와 함께 직접 입력하도록 두었습니다. 무료 공개 환율 API가 지원하지 않는 통화는 임의의 값을 넣는 대신 아예 표시하지 않습니다.</p>
    <p>세 번째 원칙은 <strong>입력값을 서버로 보내지 않는 것</strong>입니다. 모든 계산은 브라우저 안에서 이뤄집니다. 환율을 불러올 때만 공개 API에 요청하며, 그때도 이용자의 입력값은 전송되지 않습니다. 짐 목록·예산·일정표의 저장 기능은 이 브라우저의 localStorage만 사용하고, 전체 삭제 버튼을 항상 함께 둡니다.</p>`,
    howto: `<h2>이런 질문에 답합니다</h2>
    <ul>
      <li>100달러는 지금 몇 원인가? 비행기 안에서도 계산할 수 있나?</li>
      <li>서울·런던·뉴욕이 함께 회의할 수 있는 시간이 하루에 있기는 한가?</li>
      <li>겨울 유럽 7일, 뭘 챙겨야 빠뜨리지 않을까?</li>
      <li>2명 5일 도쿄 여행, 1인당 예산은 얼마이고 정산은 누가 누구에게?</li>
      <li>이 나라에서 팁을 줘야 하나, 준다면 몇 퍼센트인가?</li>
      <li>내 고데기를 가져가면 쓸 수 있나, 어댑터만 있으면 되나?</li>
      <li>800달러를 넘게 샀는데 세금이 얼마나 나오나? 자진신고하면 얼마 줄어드나?</li>
      <li>인천에서 뉴욕까지 ${icnJfk.toLocaleString("ko-KR")}km, 몇 시간 걸리고 현지 도착 시각은?</li>
      <li>로밍이 나은가 유심이 나은가, 우리 일행 기준으로는?</li>
      <li>일정표를 인쇄해서 들고 다니려면?</li>
    </ul>`,
    faq: [
      { q: "회원가입이나 앱 설치가 필요한가요?", a: "필요 없습니다. 모든 도구는 브라우저에서 바로 동작하며 개인정보를 수집하지 않습니다." },
      { q: "입력한 값이 서버에 저장되나요?", a: "아닙니다. 계산은 모두 브라우저 안에서 이뤄집니다. 저장 기능이 있는 도구는 이 브라우저의 localStorage만 사용하며 전체 삭제 버튼을 함께 제공합니다." },
      { q: "환율은 어디서 가져오나요?", a: "키가 필요 없는 공개 API(Frankfurter, 유럽중앙은행 기준환율)를 브라우저에서 직접 호출하고 24시간 캐시합니다. 실패하면 보조 공개 엔드포인트를 시도하고, 그것도 안 되면 마지막으로 저장된 환율을 표시합니다. 참고용이며 은행 고시 환율이 아닙니다." },
      { q: "비자 정보는 왜 없나요?", a: "비자·입국요건은 국적·여권 종류·방문 목적에 따라 다르고 수시로 바뀌어 잘못된 정보의 위험이 큽니다. 그래서 직접 기재하지 않고 외교부 해외안전여행(0404.go.kr) 링크만 제공합니다." },
      { q: "계산 결과를 그대로 믿어도 되나요?", a: "참고용 추정치입니다. 특히 비행시간(대권거리 기반 추정), 면세 세액(대표 간이세율 적용), 팁 관행(일반 관행 요약)은 실제와 차이가 날 수 있습니다. 각 페이지에 근거와 한계를 적어 두었으니 함께 읽어 주세요." },
    ],
    basis: `${VISA_BOX}\n    ${FX_BOX}`,
    disclaimer: DISC("특히 비자·입국요건, 세관 신고, 항공 규정은 공식 기관 안내를 우선하세요."),
    related: [T.budget, T.packing, T.split, T.china, T.pin],
  };
}

const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ad: false, app: false,
    title: `개인정보처리방침 — ${SITE_NAME}`,
    desc: "본 사이트는 개인정보를 수집하지 않습니다. 계산은 모두 브라우저에서 처리되며, 저장 기능은 localStorage만 사용합니다. 환율 조회 시 외부 공개 API 호출과 광고 쿠키에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    crumbs: [{ name: "개인정보처리방침", item: `${SITE_ORIGIN}/privacy.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 수집하는 개인정보</h2>
    <p>본 사이트는 회원가입 절차가 없으며 이름·연락처·이메일·여권번호·주민등록번호 등 개인을 식별할 수 있는 정보를 일절 수집하지 않습니다. 계산기에 입력하는 금액·날짜·도시 등의 값은 브라우저 안에서만 처리되며 운영자의 서버로 전송되거나 저장되지 않습니다(운영자는 별도의 서버를 두고 있지 않습니다).</p>
    <h2>2. 브라우저 저장소(localStorage) 사용</h2>
    <p>다음 기능은 이용자 편의를 위해 이 브라우저의 localStorage에 값을 저장합니다. 서버 전송은 없으며, 각 도구의 "저장 기록 전체 삭제" 버튼이나 브라우저 설정으로 언제든 삭제할 수 있습니다.</p>
    <ul>
      <li>화면 테마(밝은/어두운) 설정</li>
      <li>짐 싸기 목록의 조건과 체크 상태</li>
      <li>여행 예산 입력값(직접 "저장"을 누른 경우)</li>
      <li>여행 일정표의 일정 내용</li>
      <li>환율 계산기가 받아온 환율 값과 받아온 시각(24시간 캐시)</li>
    </ul>
    <h2>3. 외부 API 호출(환율)</h2>
    <p>환율 계산 기능은 이용자의 브라우저에서 공개 환율 API(api.frankfurter.dev, 실패 시 open.er-api.com)에 직접 요청을 보냅니다. 이 요청에는 조회할 통화 코드만 포함되며 이용자가 입력한 금액이나 그 밖의 정보는 전송되지 않습니다. 다만 요청 과정에서 해당 서비스 제공자에게 접속 IP 등 통상적인 네트워크 정보가 전달될 수 있습니다.</p>
    <h2>4. 쿠키와 광고</h2>
    <p>본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다. 광고는 계산 결과가 표시된 이후 결과 하단에만 노출됩니다.</p>
    <h2>5. 공유 링크에 담기는 정보</h2>
    <p>짐 목록·예산·일정표의 "링크 복사" 기능은 입력 내용을 링크 주소 자체에 인코딩합니다. 서버에 저장되지는 않지만 <strong>링크를 받은 사람은 그 내용을 볼 수 있으므로</strong>, 여권번호·카드번호 등 민감한 정보는 입력하지 마시기 바랍니다.</p>
    <h2>6. 접속 분석</h2>
    <p>호스팅 사업자가 제공하는 기본적인 접속 통계(방문 수, 페이지 조회 수 등)가 집계될 수 있으며, 이는 개인을 식별하지 않는 형태입니다.</p>
    <h2>7. 문의</h2>
    <p>개인정보 관련 문의는 <a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a>을 통해 연락하실 수 있습니다.</p>
    <p class="note">시행일: ${TODAY}</p>
  </section>`,
    about: false,
  },
  {
    path: "terms.html", emoji: "📜", ad: false, app: false,
    title: `이용약관 — ${SITE_NAME}`,
    desc: "본 사이트가 제공하는 여행 계산 결과의 성격과 책임 범위, 데이터 출처와 저작권에 관한 안내입니다. 계산 결과는 참고용 추정치입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 추정치입니다.",
    crumbs: [{ name: "이용약관", item: `${SITE_ORIGIN}/terms.html` }],
    body: `
  <section class="about" style="margin-top:8px">
    <h2>1. 서비스의 성격</h2>
    <p>본 사이트는 해외여행에 필요한 계산(환율·시차·거리·예산·면세 한도 등)을 공개 데이터와 이용자가 입력한 값에 근거해 수행하는 무료 도구입니다. 모든 결과는 <strong>참고용 추정치</strong>이며 어떤 확정 정보도 보증하지 않습니다.</p>
    <h2>2. 비자·입국요건에 관한 고지</h2>
    <p>본 사이트는 비자 필요 여부, 체류 가능 기간, 전자여행허가 등 <strong>입국요건을 직접 안내하지 않습니다</strong>. 해당 정보는 국적·여권 종류·방문 목적에 따라 다르고 수시로 변경되므로, 반드시 <a href="${VISA_LINK}" target="_blank" rel="noopener">외교부 해외안전여행</a> 및 목적지 국가의 공식 기관에서 확인하시기 바랍니다.</p>
    <h2>3. 환율 정보</h2>
    <p>환율은 제3자가 제공하는 공개 API의 기준환율을 그대로 표시하며, 은행 고시 환율이 아닙니다. 실제 환전·결제 금액은 스프레드와 수수료에 따라 달라집니다. 환율 제공 서비스의 중단·오류로 인한 손해에 대해 운영자는 책임지지 않습니다.</p>
    <h2>4. 면세·세관 관련 정보</h2>
    <p>면세 한도와 세액 계산은 관세청이 공개한 여행자 휴대품 기준을 참고한 <strong>추정</strong>이며, 품목별 세율·과세환율·개별소비세 적용 여부에 따라 실제 세액은 달라집니다. 확정 세액은 관세청 또는 입국 세관에서 확인하시기 바랍니다.</p>
    <h2>5. 비행시간·거리</h2>
    <p>거리와 비행시간은 공항 좌표를 이용한 대권거리 기반 추정치입니다. 실제 항로·운항 시간과 다를 수 있으므로 항공사 시간표를 확인하시기 바랍니다.</p>
    <h2>6. 책임의 한계</h2>
    <p>이용자가 본 사이트의 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다. 항공권 구매, 세관 신고, 예산 집행 등 중요한 결정은 반드시 공식 기관과 사업자의 안내로 확인하시기 바랍니다.</p>
    <h2>7. 저작권</h2>
    <p>본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 인용한 공공 데이터 및 제3자 데이터의 권리는 각 제공 기관에 있습니다.</p>
    <h2>8. 광고</h2>
    <p>본 사이트는 Google AdSense 광고를 게재하며, 광고 내용에 대한 책임은 광고주에게 있습니다. 광고는 계산 결과가 표시된 이후 결과 하단에만 노출됩니다.</p>
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
    basis: t.basis, disclaimer: t.disclaimer || DISC(),
    script: t.script,
    related: t.related,
  });
}
pages.push(countryIndexPage());
for (const c of COUNTRIES) pages.push(countryPage(c));
for (const p of PAIRS) pages.push(pairPage(p));
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
  const deep = p.path.split("/").filter(Boolean).length > 1;
  const pr = p.path === "" ? "1.0" : p.path.endsWith(".html") ? "0.3" : deep ? "0.5" : "0.8";
  return `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${p.path.startsWith("currency") ? "daily" : "monthly"}</changefreq><priority>${pr}</priority></url>`;
}).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap, "utf8");

/* robots */
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, "utf8");

/* 고아 디렉터리 경고 */
const known = new Set(pages.filter((p) => p.path.endsWith("/") && p.path).map((p) => p.path.split("/")[0]));
const RESERVED = new Set(["assets", "data", "lib", "tests", "node_modules"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

const nTool = TOOLS.length, nCountry = COUNTRIES.length, nPair = PAIRS.length;
console.log(`생성 완료: HTML ${written}개 (허브 1 · 도구 ${nTool} · 국가 목록 1 · 국가 롱테일 ${nCountry} · 통화쌍 롱테일 ${nPair} · 정책 ${POLICY.length})`);
console.log(`sitemap.xml: ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
