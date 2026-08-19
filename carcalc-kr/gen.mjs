// carcalc-kr 정적 페이지 생성기 (Node 내장만 사용, 의존성 0)
// 실행: node carcalc-kr/gen.mjs
// 생성물: index.html, <tool>/index.html × 12, fine/index.html + 위반유형 롱테일,
//        privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN, SITE_NAME, CHECKED_AT, TOOLS as TOOL_META, CROSS_LINKS } from "./data/site.mjs";
import { FINES, FINE_SOURCES, FINE_NOTES } from "./data/fines.mjs";
import { TODO_ITEMS as TAX_TODO } from "./data/car-tax.mjs";
import { TODO_ITEMS as ACQ_TODO } from "./data/acquisition.mjs";
import { TODO_ITEMS as FUEL_TODO, PRICE_LOOKUP } from "./data/fuel.mjs";
import { MAINT_ITEMS, MAINT_LABEL } from "./data/maintenance.mjs";

const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = CHECKED_AT;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const WETAX = "https://www.wetax.go.kr";
const EFINE = "https://www.efine.go.kr";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const won = (n) => (n == null ? "해당 없음" : n.toLocaleString("ko-KR") + "원");

/* ── 공통 HTML 셸 ───────────────────────────────────────────── */
function shell(p) {
  const path = p.path;                        // "" | "car-tax/" | "fine/speed-20/" | "privacy.html"
  const depth = path.endsWith("/") ? path.split("/").filter(Boolean).length : 0;
  const U = "../".repeat(depth);
  const HOME = U || "./";
  const canonical = SITE_ORIGIN + "/" + path;
  const tok = (s) => String(s == null ? "" : s).replace(/__U__/g, U);

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

  const crumbNav = `<nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">🚗 카캘크</a>` +
    (p.crumbs || []).map((c, i, arr) => ` <span class="sep">›</span> ` +
      (i === arr.length - 1 ? `<span class="c-cur">${esc(c.name)}</span>` : `<a href="${U}${c.rel}">${esc(c.name)}</a>`)).join("") +
    `</nav>`;

  const ad = p.ad === false ? "" : `
  <div class="ad-wrap" id="adBox" hidden>
    <p class="ad-label">스폰서</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </div>`;

  const faqHtml = (p.faq || []).map((f) =>
    `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${esc(f.a)}</p></div>`).join("\n    ");

  const about = p.about === false ? "" : `
  <section class="about">
    ${tok(p.introHtml || "")}
    ${tok(p.howtoHtml || "")}
    ${faqHtml ? `<h2>자주 묻는 질문</h2>\n    ${faqHtml}` : ""}
    ${tok(p.sourceHtml || "")}
    ${tok(p.disclaimerHtml || "")}
  </section>`;

  const rel = (p.related || []).map((r) => r.url
    ? `<a class="rel" href="${r.url}" target="_blank" rel="noopener"><span class="ic">${r.e}</span>${esc(r.n)}</a>`
    : `<a class="rel" href="${U}${r.slug}/"><span class="ic">${r.e}</span>${esc(r.n)}</a>`).join("\n      ");
  const related = rel ? `
  <section class="related">
    <h2>관련 도구</h2>
    <div class="rel-grid">
      ${rel}
    </div>
  </section>` : "";

  const script = p.script ? `
<script type="module">
${tok(p.script)}
</script>` : "";

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
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${esc(p.ogTitle || p.title)}" />
<meta property="og:description" content="${esc(p.desc)}" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary" />
<meta name="google-adsense-account" content="${ADS_CLIENT}" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
<link rel="stylesheet" href="${U}assets/style.css" />
<script src="${U}assets/app.js"></script>
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
    <p class="lead">${tok(p.lead)}</p>
  </div>
${tok(p.bodyHtml || "")}
${ad}
${about}
${related}
  <footer>
    <p style="margin:0 0 8px">🚗 <a href="${HOME}">${SITE_NAME}</a></p>
    <p style="margin:0"><a href="${U}privacy.html">개인정보처리방침</a>·<a href="${U}terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a></p>
  </footer>
</div>
${script}
</body>
</html>
`;
}

/* ── 공통 조각 ──────────────────────────────────────────────── */
const TAX_NOTICE = `<p class="notice">⚠ 이 계산기는 <strong>참고용 추정</strong>입니다. 정확한 세액은 <a href="${WETAX}" target="_blank" rel="noopener">위택스</a>·관할 지자체(시군구청 세무과)에서 확인하세요. 아래 결과에는 <strong>산출 과정(산식)</strong>을 그대로 표시합니다.</p>`;

const DISC = (extra = "") => `<p class="disclaimer">본 결과는 참고용 추정치이며 실제 부과·청구 금액을 확정하지 않습니다. ${extra}</p>`;

const NO_SERVER = `<p class="disclaimer">입력한 값은 <strong>서버로 전송되지 않고</strong> 브라우저 안에서만 계산됩니다. 기록은 이 브라우저의 localStorage에만 저장되며(<strong>서버 저장 없음</strong>) 기기·브라우저를 바꾸면 보이지 않습니다. CSV로 내보내 백업하세요.</p>`;

const TODO_BLOCK = (items, title) => `<h2>${title} <span class="badge todo">확인 필요</span></h2>
    <ul>
      ${items.map((t) => `<li><strong>${esc(t.label)}</strong> — ${esc(t.note)} <a href="${t.link}" target="_blank" rel="noopener">확인처</a></li>`).join("\n      ")}
    </ul>`;

const SRC_LIST = (items) => `<h2>데이터 출처와 확인일</h2>
    <p class="src">${items.map((i) => `<a href="${i.url}" target="_blank" rel="noopener">${esc(i.label)}</a>`).join(" · ")}<br />데이터 확인일: ${TODAY}</p>`;

const X = CROSS_LINKS;
const REL = {
  maint: { url: X.maintenanceCycle.url, e: "🔩", n: "차량 소모품 교체주기 가이드" },
  ins: { url: X.insuranceRider.url, e: "🛡️", n: "자동차보험 특약 점검" },
  refi: { url: X.loanRefi.url, e: "🔁", n: "대출 갈아타기 계산기" },
  yeon: { url: X.yeonbigak.url, e: "⛽", n: "연비각 — 연비 기록장" },
  test: { url: X.drivingTest.url, e: "📝", n: "운전면허 필기 모의고사" },
};

/* ── 도구 정의 ──────────────────────────────────────────────── */
const TOOLS = [
/* 1 ─ 자동차세 ───────────────────────────────────────────── */
{
  slug: "car-tax", emoji: "🧾", nav: "자동차세 계산기",
  title: "자동차세 계산기 — 배기량·차령 경감·연납 할인까지 산식 공개",
  ogTitle: "자동차세 계산기 — 산식까지 보여주는",
  desc: "배기량(cc)과 차령만 넣으면 자동차세 본세·지방교육세 30%·차령 경감·연납 공제까지 계산해 산출 과정을 한 줄씩 보여줍니다. 전기차·영업용·승용 외 차종 직접 입력도 지원합니다.",
  h1: "자동차세 계산기",
  lead: "숫자 하나만 던지지 않습니다. <strong>cc × 세율 → 차령 경감 → 지방교육세 → 연납 공제</strong>까지 계산 과정을 전부 펼쳐 보여줍니다.",
  bodyHtml: `
  ${TAX_NOTICE}
  <div class="card">
    <div class="field">
      <label for="cc">배기량 <span class="hint">cc — 자동차등록증에 표기</span></label>
      <input type="number" id="cc" inputmode="numeric" placeholder="1598" value="1598" />
    </div>
    <div class="field">
      <label class="chk"><input type="checkbox" id="isEv" /> 전기·수소차 (배기량 없는 "그 밖의 승용자동차")</label>
    </div>
    <div class="field">
      <label>용도</label>
      <div class="seg">
        <label><input type="radio" name="use" value="nonbusiness" checked />비영업용 (자가용)</label>
        <label><input type="radio" name="use" value="business" />영업용</label>
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="age">차령 <span class="hint">년차 (최초등록 후)</span></label>
        <input type="number" id="age" inputmode="numeric" min="1" value="1" />
      </div>
      <div class="field">
        <label for="prepay">연납(일시납) 신청</label>
        <select id="prepay"></select>
      </div>
    </div>
    <button class="btn full" id="go" type="button">자동차세 계산하기</button>
  </div>

  <details class="card">
    <summary>승합·화물·특수차 — 본세 직접 입력 <span class="badge todo">확인 필요</span></summary>
    <p class="src">승용 외 차종의 세율표는 아직 출처 대조를 마치지 않아 계산기에 넣지 않았습니다. 고지서·위택스 모의계산의 <strong>본세(자동차세) 연세액</strong>을 아래에 넣으면 지방교육세와 연납 공제만 계산합니다.</p>
    <div class="field">
      <label for="manual">본세 연세액 직접 입력 <span class="hint">원 · 비우면 무시</span></label>
      <input type="number" id="manual" inputmode="numeric" placeholder="예: 65000" />
    </div>
  </details>

  <div class="result" id="out" hidden></div>`,
  script: `import { carTax, floor10 } from "__U__lib/calc.mjs";
import { PREPAY_DISCOUNT, EDUCATION_TAX_RATE } from "__U__data/car-tax.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
const per = PREPAY_DISCOUNT.periods.value;
const sel = $('prepay');
const o0 = document.createElement('option'); o0.value = ''; o0.textContent = '연납 안 함 (6월·12월 분납)'; sel.appendChild(o0);
for (const k of Object.keys(per)) { const o = document.createElement('option'); o.value = k; o.textContent = per[k].label; sel.appendChild(o); }
$('isEv').addEventListener('change', function () { $('cc').disabled = this.checked; });
function run() {
  const manual = C.num($('manual'));
  const ev = $('isEv').checked;
  const cc = ev ? 0 : C.num($('cc'));
  const use = document.querySelector('input[name=use]:checked').value;
  const age = Math.max(1, Math.round(C.num($('age')) || 1));
  const pmv = $('prepay').value;
  const pm = pmv ? parseInt(pmv, 10) : null;
  if (manual <= 0 && !ev && cc <= 0) { alert('배기량(cc)을 입력하거나 전기·수소차를 선택하세요.'); return; }
  const st = [];
  let r;
  if (manual > 0) {
    const mainTax = floor10(manual);
    const educTax = use === 'nonbusiness' ? floor10(mainTax * EDUCATION_TAX_RATE.value) : 0;
    const annualTotal = mainTax + educTax;
    let prepayDiscount = 0;
    if (pm) prepayDiscount = floor10(annualTotal * PREPAY_DISCOUNT.rate.value * (per[pm].days / 365));
    r = { mainTax: mainTax, educTax: educTax, annualTotal: annualTotal, prepayDiscount: prepayDiscount, prepayPaid: annualTotal - prepayDiscount, reduction: 0 };
    st.push('직접 입력한 본세 연세액 = ' + C.won(mainTax) + ' (승용 외 차종은 차령 경감 규정이 달라 미적용)');
  } else {
    r = carTax({ cc: cc, use: use, ageYears: age, prepayMonth: pm });
    st.push(ev ? '그 밖의 승용자동차(전기·수소) 정액 세액 = ' + C.won(r.raw)
               : '과세표준 = ' + C.fmt(cc) + 'cc × ' + r.perCc + '원/cc = ' + C.won(r.raw));
    if (r.reduction > 0) st.push('차령 경감 = ' + Math.round(r.reduction * 100) + '% (3년차부터 매년 5%p, 최대 50%) → 본세 ' + C.won(r.mainTax));
    else st.push('차령 ' + age + '년차 → 경감 없음(3년차부터 적용). 본세 ' + C.won(r.mainTax));
  }
  st.push(use === 'nonbusiness' ? '지방교육세 = 본세 × 30% = ' + C.won(r.educTax) : '영업용 승용자동차분은 지방교육세 비과세 → 0원');
  st.push('연세액 = 본세 + 지방교육세 = ' + C.won(r.annualTotal));
  if (pm) st.push('연납 공제 = 연세액 × 5% × (' + per[pm].days + '일 ÷ 365) = ' + C.won(r.prepayDiscount) + ' → 실제 납부액 ' + C.won(r.prepayPaid));
  const half = floor10(r.annualTotal / 2);
  C.result('out', {
    big: C.won(r.prepayPaid),
    sub: pm ? '연납 신청 시 1회 납부액입니다.' : '연납을 하지 않으면 6월·12월에 각 ' + C.won(half) + ' 안팎으로 나눠 부과됩니다.',
    rows: [
      ['자동차세 본세', C.won(r.mainTax)],
      ['지방교육세 (30%)', C.won(r.educTax)],
      ['연세액 합계', C.won(r.annualTotal)],
      pm ? ['연납 공제', '-' + C.won(r.prepayDiscount)] : null,
      ['최종 납부액', C.won(r.prepayPaid), 'total'],
    ],
    foot: C.steps(st) + '<p class="src">10원 미만은 절사해 표시합니다. 지자체 고지서와 수십 원 차이가 날 수 있습니다.</p>',
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>자동차세는 어떻게 정해지나</h2>
    <p>비영업용 승용차의 자동차세는 <strong>배기량(cc)에 cc당 세율을 곱한 금액</strong>이 출발점입니다. 지방세법 제127조는 1,000cc 이하 80원, 1,600cc 이하 140원, 그 초과 200원으로 정하고 있어 1,600cc를 1cc라도 넘으면 cc당 세율이 한 단계 뛰어오릅니다. 같은 "2.0 가솔린"이라도 1,598cc와 1,999cc의 세금 차이가 큰 이유입니다.</p>
    <p>여기에 두 가지가 더 붙습니다. 하나는 <strong>지방교육세</strong>로 본세의 30%가 자동 가산되고, 다른 하나는 <strong>차령 경감</strong>입니다. 차령 3년차부터 매년 5%p씩 세금이 깎여 12년차 이후에는 절반이 됩니다. 전기차·수소차처럼 배기량이 없는 승용차는 배기량 대신 정액(비영업용 10만원)이 적용되고, 여기에도 지방교육세 30%가 붙습니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>자동차등록증의 <strong>배기량(cc)</strong>을 입력합니다. 전기·수소차는 체크박스를 선택하세요.</li>
      <li>최초등록일 기준 <strong>차령</strong>을 년차로 입력합니다(등록 첫 해가 1년차).</li>
      <li>1·3·6·9월 <strong>연납</strong>을 신청할 계획이면 해당 월을 고르면 공제액까지 계산됩니다.</li>
      <li>결과의 "산출 과정"에서 어느 단계에서 얼마가 붙고 깎였는지 확인하세요.</li>
    </ol>`,
  faq: [
    { q: "1,600cc를 넘으면 세금이 얼마나 뛰나요?", a: "1,600cc는 cc당 140원, 1,601cc부터는 cc당 200원이 적용됩니다. 1,600cc는 본세 224,000원이지만 1,601cc는 320,200원으로, 1cc 차이에 본세가 약 9만6천원 늘어납니다. 지방교육세 30%까지 더하면 격차는 더 커집니다." },
    { q: "차령 경감은 언제부터 얼마나 되나요?", a: "승용차는 차령 3년차부터 매년 5%p씩 경감되어 4년차 10%, 5년차 15% 식으로 늘고 12년차 이후 50%로 고정됩니다. 이 계산기는 이 규칙을 그대로 적용합니다." },
    { q: "연납 할인은 몇 %인가요?", a: "연세액 일시납부 공제는 2025년 이후 5%이며, 공제액은 연세액 × 5% × (남은 기간 일수 ÷ 365)로 계산됩니다. 1월에 신청하면 334일분이 적용돼 실질 공제율이 약 4.6%가 되고, 9월 신청은 92일분이라 1%대로 줄어듭니다." },
    { q: "전기차도 자동차세를 내나요?", a: "냅니다. 배기량이 없어 '그 밖의 승용자동차'로 분류되어 비영업용 기준 연 10만원 정액에 지방교육세 30%를 더해 13만원이 부과됩니다. 여기에도 차령 경감이 적용됩니다." },
    { q: "계산 결과가 고지서와 다릅니다.", a: "10원 미만 절사 처리, 지자체별 감면(다자녀·국가유공자 등), 연중 취득·이전에 따른 일할 계산 때문에 차이가 날 수 있습니다. 최종 금액은 위택스나 관할 지자체에서 확인하세요." },
  ],
  sourceHtml: TODO_BLOCK(TAX_TODO, "아직 넣지 않은 항목") + "\n    " + SRC_LIST([
    { label: "지방세법 제127조 (자동차세 세율)", url: "https://www.law.go.kr/법령/지방세법/제127조" },
    { label: "지방세법 제128조 (납기와 징수방법)", url: "https://www.law.go.kr/법령/지방세법/제128조" },
    { label: "지방세법 시행령 제125조 (연세액 일시납부 공제)", url: "https://www.law.go.kr/법령/지방세법시행령/제125조" },
    { label: "위택스 (실제 세액 조회·납부)", url: WETAX },
  ]),
  disclaimerHtml: DISC(`정확한 세액은 <a href="${WETAX}" target="_blank" rel="noopener">위택스</a> 또는 관할 지자체에서 확인하세요.`),
  related: [{ slug: "acquisition", e: "🏷️", n: "자동차 취등록세 계산기" }, REL.ins, REL.maint],
},

/* 2 ─ 취득세 ─────────────────────────────────────────────── */
{
  slug: "acquisition", emoji: "🏷️", nav: "취등록세 계산기",
  title: "자동차 취등록세 계산기 — 차량가액·용도별 세율과 산식",
  ogTitle: "자동차 취등록세 계산기",
  desc: "차량 가액과 용도(승용·경차·승합화물·영업용·이륜)를 고르면 지방세법 제12조 세율로 취득세를 계산하고 산식을 그대로 보여줍니다. 세율 직접 입력과 공채 등 제외 항목 안내 포함.",
  h1: "자동차 취등록세 계산기",
  lead: "차값 × 세율, 그 한 줄이 전부지만 <strong>어떤 세율이 왜 적용되는지</strong>와 계산기에 넣지 않은 항목까지 함께 보여줍니다.",
  bodyHtml: `
  ${TAX_NOTICE}
  <div class="card">
    <div class="field">
      <label for="price">과세표준 <span class="hint">원 — 신차는 부가세 제외 공급가액</span></label>
      <input type="number" id="price" inputmode="numeric" placeholder="30000000" value="30000000" />
    </div>
    <div class="field">
      <label for="type">차량 구분</label>
      <select id="type"></select>
    </div>
    <div class="field">
      <label for="rateOv">세율 직접 입력 <span class="hint">% · 비우면 위 구분의 법정 세율 사용</span></label>
      <input type="number" id="rateOv" step="0.1" placeholder="예: 7" />
    </div>
    <button class="btn full" id="go" type="button">취득세 계산하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `import { acquisitionTax, floor10 } from "__U__lib/calc.mjs";
import { ACQ_RATES, TAX_BASE_NOTE } from "__U__data/acquisition.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
const sel = $('type');
for (const k of Object.keys(ACQ_RATES)) {
  const o = document.createElement('option');
  o.value = k; o.textContent = ACQ_RATES[k].label + ' — ' + (ACQ_RATES[k].value * 100) + '%';
  sel.appendChild(o);
}
function run() {
  const price = C.num($('price'));
  const type = $('type').value;
  const ov = C.num($('rateOv'));
  if (price <= 0) { alert('과세표준(차량 가액)을 입력하세요.'); return; }
  const st = [];
  let rate, label, tax;
  if (ov > 0) {
    rate = ov / 100; label = '직접 입력 세율'; tax = floor10(price * rate);
    st.push('직접 입력한 세율 ' + ov + '% 적용');
  } else {
    const r = acquisitionTax({ price: price, type: type });
    rate = r.rate; label = r.label; tax = r.tax;
  }
  st.push('과세표준 = ' + C.won(price));
  st.push('취득세 = 과세표준 × ' + (rate * 100).toFixed(1) + '% = ' + C.won(tax) + ' (10원 미만 절사)');
  st.push('※ 공채(도시철도채권 등) 매입·할인비, 증지·번호판 비용, 감면 특례는 포함하지 않았습니다.');
  C.result('out', {
    big: C.won(tax),
    sub: label + ' 기준 · 차량가액의 ' + (rate * 100).toFixed(1) + '%',
    rows: [
      ['과세표준', C.won(price)],
      ['적용 세율', (rate * 100).toFixed(1) + '%'],
      ['취득세', C.won(tax), 'total'],
      ['취득세 포함 총 지출(참고)', C.won(price + tax)],
    ],
    foot: C.steps(st) + '<p class="src">과세표준 기준: ' + C.esc(TAX_BASE_NOTE.value) + '</p>',
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>자동차 취득세, 무엇이 세율을 가르나</h2>
    <p>자동차를 사면 등록 단계에서 <strong>취득세</strong>를 냅니다. 지방세법 제12조는 비영업용 승용차 7%, 경자동차 4%, 승합·화물 등 그 밖의 자동차 5%, 영업용 4%, 125cc 초과 이륜차 2%로 세율을 정하고 있습니다. 흔히 "취등록세"라고 부르지만 2011년 등록세가 취득세에 통합되어 지금은 취득세 하나입니다.</p>
    <p>과세표준은 신차의 경우 실제 취득가격(부가가치세를 뺀 공급가액)이고, 중고차는 신고가액과 시가표준액 중 <strong>더 높은 금액</strong>이 기준이 됩니다. 그래서 중고차를 시세보다 싸게 샀다고 해서 취득세가 그만큼 줄어들지는 않습니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>과세표준</strong>에 차량 가액을 넣습니다. 신차 견적서의 부가세 제외 공급가액을 쓰면 실제와 가장 가깝습니다.</li>
      <li><strong>차량 구분</strong>에서 승용/경차/승합화물/영업용/이륜 중 하나를 고릅니다.</li>
      <li>감면이나 특례로 다른 세율을 적용받는다면 <strong>세율 직접 입력</strong>에 그 값을 넣습니다.</li>
    </ol>`,
  faq: [
    { q: "취등록세와 취득세는 다른 건가요?", a: "지금은 같습니다. 2011년 지방세 개편으로 등록세가 취득세에 통합되어 자동차 등록 시 내는 세금은 취득세 하나입니다. 관행적으로 취등록세라 부를 뿐입니다." },
    { q: "경차는 취득세를 아예 안 내나요?", a: "법정 세율은 4%이며, 지방세특례제한법에 따른 감면(한도 있음)이 별도로 적용될 수 있습니다. 다만 감면은 일몰 기한이 연장·축소되며 바뀌므로 이 계산기에는 반영하지 않았습니다. 관할 지자체에서 확인하세요." },
    { q: "공채는 왜 계산에 없나요?", a: "도시철도채권·지역개발채권 매입 의무는 지역과 배기량에 따라 매입률이 달라 전국 공통값이 없습니다. 즉시 할인매도하면 실부담은 매입액의 일부이며, 이 부분은 등록 대행 견적에서 확인하는 편이 정확합니다." },
    { q: "중고차 취득세 기준은 무엇인가요?", a: "신고가액과 지방자치단체가 고시하는 시가표준액 중 높은 금액이 과세표준입니다. 차량 연식에 따른 잔가율이 적용된 시가표준액이 기준선 역할을 합니다." },
  ],
  sourceHtml: TODO_BLOCK(ACQ_TODO, "계산에 넣지 않은 항목") + "\n    " + SRC_LIST([
    { label: "지방세법 제12조 (부동산 외 취득의 세율)", url: "https://www.law.go.kr/법령/지방세법/제12조" },
    { label: "지방세법 제10조의2 (취득 당시의 가액)", url: "https://www.law.go.kr/법령/지방세법/제10조의2" },
    { label: "위택스 (실제 세액 조회·납부)", url: WETAX },
  ]),
  disclaimerHtml: DISC(`감면·공채·부대비용이 빠져 있으므로 실제 등록 비용은 더 클 수 있습니다. <a href="${WETAX}" target="_blank" rel="noopener">위택스</a>에서 확인하세요.`),
  related: [{ slug: "car-tax", e: "🧾", n: "자동차세 계산기" }, { slug: "loan", e: "💳", n: "자동차 할부 계산기" }, REL.refi, REL.ins],
},
];

/* 3 ─ 연비 계산기 (기록·그래프) ───────────────────────────── */
TOOLS.push({
  slug: "fuel-economy", emoji: "⛽", nav: "연비 계산기",
  title: "연비 계산기 — 주유 기록 누적과 연비 추이 그래프",
  ogTitle: "연비 계산기 — 기록하면 그래프까지",
  desc: "주행거리와 주유량만 넣으면 실연비(km/L)와 100km당 연료량, 1km당 비용을 계산합니다. 주유할 때마다 기록하면 평균 연비와 추이 그래프가 쌓이고 CSV로 내보낼 수 있습니다. 기록은 내 브라우저에만 저장됩니다.",
  h1: "연비 계산기",
  lead: "이번 주유의 실연비를 계산하고, <strong>주유할 때마다 기록</strong>하면 연비 추이 그래프가 쌓입니다. 서버 저장 없음.",
  bodyHtml: `
  <div class="card">
    <div class="row2">
      <div class="field"><label for="date">주유일</label><input type="date" id="date" /></div>
      <div class="field"><label for="km">주행거리 <span class="hint">km · 트립 미터</span></label><input type="number" id="km" inputmode="decimal" step="0.1" placeholder="450" value="450" /></div>
    </div>
    <div class="row2">
      <div class="field"><label for="lit">주유량 <span class="hint">L</span></label><input type="number" id="lit" inputmode="decimal" step="0.01" placeholder="38.5" value="38.5" /></div>
      <div class="field"><label for="price">유가 <span class="hint">원/L · 선택</span></label><input type="number" id="price" inputmode="numeric" placeholder="1700" value="1700" /></div>
    </div>
    <div class="btnrow">
      <button class="btn" id="go" type="button">연비 계산</button>
      <button class="btn ghost" id="save" type="button">＋ 기록에 저장</button>
    </div>
  </div>
  <div class="result" id="out" hidden></div>

  <section class="about" id="logSec">
    <h2>내 주유 기록</h2>
    <div id="logBox"></div>
    <div class="btnrow">
      <button class="btn ghost" id="csv" type="button">CSV 내보내기</button>
      <button class="btn danger" id="clear" type="button">기록 전체 삭제</button>
    </div>
    ${NO_SERVER}
  </section>`,
  script: `import { fuelEconomy } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
const KEY = 'cc-fuel-logs';
let logs = C.lsGet(KEY, []);
$('date').value = new Date().toISOString().slice(0, 10);

function current() {
  const km = C.num($('km')), lit = C.num($('lit')), price = C.num($('price'));
  return { d: $('date').value || new Date().toISOString().slice(0, 10), km: km, l: lit, p: price, e: fuelEconomy(km, lit) };
}
function calc() {
  const c = current();
  if (c.km <= 0 || c.l <= 0) { alert('주행거리와 주유량을 입력하세요.'); return null; }
  const per100 = 100 / c.e;
  const cost = c.p > 0 ? c.p * c.l : 0;
  C.result('out', {
    big: c.e.toFixed(2) + ' km/L',
    sub: C.fmt(c.km) + 'km 주행 · ' + c.l + 'L 주유 기준 실연비',
    rows: [
      ['100km당 연료', per100.toFixed(2) + ' L'],
      c.p > 0 ? ['이번 주유비', C.won(cost)] : null,
      c.p > 0 ? ['1km당 연료비', (c.p / c.e).toFixed(1) + '원'] : null,
      c.p > 0 ? ['1만km당 연료비', C.won(c.p / c.e * 10000)] : null,
      ['실연비', c.e.toFixed(2) + ' km/L', 'total'],
    ],
    foot: C.steps([
      '연비 = 주행거리 ÷ 주유량 = ' + C.fmt(c.km) + ' ÷ ' + c.l + ' = ' + c.e.toFixed(3) + ' km/L',
      '100km당 연료량 = 100 ÷ 연비 = ' + per100.toFixed(2) + ' L',
      c.p > 0 ? '1km당 연료비 = 유가 ÷ 연비 = ' + C.fmt(c.p) + ' ÷ ' + c.e.toFixed(2) + ' = ' + (c.p / c.e).toFixed(1) + '원' : '유가를 넣으면 1km당 비용까지 계산됩니다.',
    ]),
  });
  return c;
}
function save() {
  const c = calc();
  if (!c) return;
  logs.push({ d: c.d, km: c.km, l: c.l, p: c.p });
  logs.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  C.lsSet(KEY, logs);
  render();
  $('logSec').scrollIntoView({ behavior: 'smooth' });
}
function chart(rs) {
  if (rs.length < 2) return '<p class="src">기록이 2개 이상 쌓이면 연비 추이 그래프가 그려집니다.</p>';
  const W = 640, H = 220, PL = 46, PR = 14, PT = 16, PB = 30;
  const vals = rs.map(function (r) { return r.e; });
  let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  if (mx - mn < 1) { mn = mn - 0.5; mx = mx + 0.5; }
  const pad = (mx - mn) * 0.12; mn = Math.max(0, mn - pad); mx = mx + pad;
  const X = function (i) { return PL + (W - PL - PR) * (i / (rs.length - 1)); };
  const Y = function (v) { return PT + (H - PT - PB) * (1 - (v - mn) / (mx - mn)); };
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = mn + (mx - mn) * i / 4, y = Y(v);
    g += '<line class="grid" x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" />';
    g += '<text x="' + (PL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  }
  let d = '', dots = '';
  rs.forEach(function (r, i) {
    const x = X(i).toFixed(1), y = Y(r.e).toFixed(1);
    d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    dots += '<circle class="dot" cx="' + x + '" cy="' + y + '" r="3"><title>' + r.d + ' · ' + r.e.toFixed(2) + 'km/L</title></circle>';
  });
  const first = rs[0].d, last = rs[rs.length - 1].d;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="연비 추이 그래프">' + g +
    '<line class="axis" x1="' + PL + '" y1="' + (H - PB) + '" x2="' + (W - PR) + '" y2="' + (H - PB) + '" />' +
    '<path class="line" d="' + d.trim() + '" />' + dots +
    '<text x="' + PL + '" y="' + (H - 10) + '">' + first + '</text>' +
    '<text x="' + (W - PR) + '" y="' + (H - 10) + '" text-anchor="end">' + last + '</text>' +
    '<text x="' + (PL - 6) + '" y="' + (PT - 4) + '" text-anchor="end">km/L</text></svg>';
}
function render() {
  const box = $('logBox');
  if (!logs.length) { box.innerHTML = '<p class="src">아직 기록이 없습니다. 위에서 값을 넣고 "＋ 기록에 저장"을 누르면 여기에 쌓입니다.</p>'; return; }
  const rs = logs.map(function (r) { return { d: r.d, km: r.km, l: r.l, p: r.p, e: fuelEconomy(r.km, r.l) }; });
  const totKm = rs.reduce(function (s, r) { return s + r.km; }, 0);
  const totL = rs.reduce(function (s, r) { return s + r.l; }, 0);
  const totCost = rs.reduce(function (s, r) { return s + (r.p > 0 ? r.p * r.l : 0); }, 0);
  const avg = totL > 0 ? totKm / totL : 0;
  const es = rs.map(function (r) { return r.e; });
  const rows = rs.slice().reverse().map(function (r) {
    return [r.d, C.fmt(r.km), r.l.toFixed(2), r.p > 0 ? C.fmt(r.p) : '-', r.e.toFixed(2)];
  });
  box.innerHTML = chart(rs) +
    '<table class="kv"><tbody>' +
    '<tr><th>기록 수</th><td>' + rs.length + '회</td></tr>' +
    '<tr><th>누적 주행 / 주유</th><td>' + C.fmt(totKm) + 'km / ' + totL.toFixed(1) + 'L</td></tr>' +
    '<tr><th>최고 / 최저 연비</th><td>' + Math.max.apply(null, es).toFixed(2) + ' / ' + Math.min.apply(null, es).toFixed(2) + ' km/L</td></tr>' +
    (totCost > 0 ? '<tr><th>누적 주유비</th><td>' + C.won(totCost) + '</td></tr>' : '') +
    '<tr class="total"><th>누적 평균 연비</th><td>' + avg.toFixed(2) + ' km/L</td></tr>' +
    '</tbody></table>' +
    C.tbl(['주유일', '주행(km)', '주유(L)', '유가', '연비(km/L)'], rows);
}
$('go').addEventListener('click', calc);
$('save').addEventListener('click', save);
$('csv').addEventListener('click', function () {
  if (!logs.length) { alert('내보낼 기록이 없습니다.'); return; }
  const rows = [['주유일', '주행거리(km)', '주유량(L)', '유가(원/L)', '연비(km/L)']];
  for (const r of logs) rows.push([r.d, r.km, r.l, r.p || '', fuelEconomy(r.km, r.l).toFixed(3)]);
  C.downloadCsv('carcalc-fuel-log.csv', rows);
});
$('clear').addEventListener('click', function () {
  if (!confirm('저장된 주유 기록을 모두 삭제할까요? 되돌릴 수 없습니다.')) return;
  logs = []; C.lsSet(KEY, logs); render();
});
render();`,
  introHtml: `<h2>계기판 연비와 실연비가 다른 이유</h2>
    <p>계기판에 뜨는 평균 연비는 차가 추정한 값이고, 실제로 넣은 기름과 달린 거리로 계산한 <strong>만탱크 실연비</strong>가 진짜입니다. 방법은 간단합니다. 주유구가 자동으로 멈출 때까지 가득 채우고 트립 미터를 0으로 초기화한 뒤, 다음 주유 때 다시 가득 채우면서 그때의 주행거리와 주유량을 나누면 됩니다.</p>
    <p>한 번의 측정만으로는 정확하지 않습니다. 주유기 자동 정지 시점, 노면 경사, 그날의 정체 정도에 따라 오차가 생기기 때문입니다. 그래서 이 계산기는 기록을 누적해 <strong>누적 주행거리 ÷ 누적 주유량</strong>으로 평균을 내고, 추이 그래프로 계절별·운전 습관별 변화를 볼 수 있게 했습니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>주유 시 <strong>가득 주유</strong>하고 트립 미터를 초기화합니다.</li>
      <li>다음 주유 때 <strong>주행거리(트립)</strong>와 <strong>주유량(L)</strong>, 리터당 유가를 입력합니다.</li>
      <li>"＋ 기록에 저장"을 누르면 그래프와 누적 평균이 갱신됩니다.</li>
      <li>백업이 필요하면 <strong>CSV 내보내기</strong>로 파일을 받아두세요.</li>
    </ol>`,
  faq: [
    { q: "연비 기록은 어디에 저장되나요?", a: "사용 중인 브라우저의 localStorage에만 저장됩니다. 서버로 전송되거나 저장되지 않으므로 기기나 브라우저를 바꾸면 보이지 않습니다. CSV 내보내기로 백업할 수 있습니다." },
    { q: "km/L과 L/100km 중 어느 쪽이 정확한가요?", a: "둘 다 같은 값의 다른 표현입니다. km/L은 높을수록 좋고 L/100km는 낮을수록 좋습니다. 연료비 비교에는 L/100km가 직관적이어서 함께 표시합니다." },
    { q: "겨울에 연비가 떨어지는 게 정상인가요?", a: "일반적입니다. 냉간 시동 구간이 길어지고 공기 밀도·타이어 압력·공조 부하가 달라져 같은 차라도 계절별 편차가 생깁니다. 그래서 한 번의 값보다 누적 평균과 추이가 더 유용합니다." },
    { q: "정확도를 높이려면 어떻게 해야 하나요?", a: "같은 주유소, 같은 주유기, 자동 정지 시점까지만 넣는 방식으로 조건을 통일하고 최소 3~5회 이상 기록해 평균을 보세요." },
  ],
  sourceHtml: SRC_LIST([{ label: "오피넷 — 실시간 유가 조회", url: PRICE_LOOKUP.url }]),
  disclaimerHtml: DISC("주유 방식·측정 조건에 따라 회차별 편차가 큽니다. 누적 평균을 기준으로 보세요."),
  related: [REL.yeon, { slug: "fuel-cost", e: "🛣️", n: "유류비 계산기" }, REL.maint],
});

/* 4 ─ 유류비 계산기 ──────────────────────────────────────── */
TOOLS.push({
  slug: "fuel-cost", emoji: "🛣️", nav: "유류비 계산기",
  title: "유류비 계산기 — 거리·연비·유가로 왕복 기름값과 톨비까지",
  ogTitle: "유류비 계산기 — 왕복 기름값",
  desc: "주행 거리와 차량 연비, 리터당 유가를 넣으면 필요한 연료량과 기름값을 계산합니다. 왕복 여부와 통행료를 함께 반영하고, 연비가 1km/L 달라질 때 비용이 얼마나 변하는지도 보여줍니다.",
  h1: "유류비 계산기",
  lead: "이번 주행에 기름값이 얼마나 들까. <strong>거리·연비·유가·톨비</strong>만 넣으면 왕복까지 한 번에 계산합니다.",
  bodyHtml: `
  <div class="card">
    <div class="row2">
      <div class="field"><label for="km">편도 거리 <span class="hint">km</span></label><input type="number" id="km" inputmode="decimal" step="0.1" placeholder="250" value="250" /></div>
      <div class="field"><label for="kpl">차량 연비 <span class="hint">km/L</span></label><input type="number" id="kpl" inputmode="decimal" step="0.1" placeholder="12" value="12" /></div>
    </div>
    <div class="row2">
      <div class="field"><label for="price">유가 <span class="hint">원/L</span></label><input type="number" id="price" inputmode="numeric" placeholder="1700" value="1700" /></div>
      <div class="field"><label for="toll">편도 통행료 <span class="hint">원 · 선택</span></label><input type="number" id="toll" inputmode="numeric" placeholder="9000" value="9000" /></div>
    </div>
    <div class="field">
      <label class="chk"><input type="checkbox" id="rt" checked /> 왕복으로 계산</label>
    </div>
    <button class="btn full" id="go" type="button">유류비 계산하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `import { fuelCost } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
function run() {
  const km = C.num($('km')), kpl = C.num($('kpl')), price = C.num($('price')), toll = C.num($('toll'));
  const rt = $('rt').checked;
  if (km <= 0 || kpl <= 0 || price <= 0) { alert('거리·연비·유가를 모두 입력하세요.'); return; }
  const r = fuelCost({ km: km, kmPerL: kpl, pricePerL: price, roundTrip: rt, toll: toll });
  const worse = fuelCost({ km: km, kmPerL: Math.max(1, kpl - 1), pricePerL: price, roundTrip: rt, toll: 0 });
  C.result('out', {
    big: C.won(r.total),
    sub: (rt ? '왕복 ' : '편도 ') + C.fmt(r.dist) + 'km 기준 (연료 + 통행료)',
    rows: [
      ['총 주행거리', C.fmt(r.dist) + ' km'],
      ['필요 연료량', r.liters.toFixed(2) + ' L'],
      ['연료비', C.won(r.fuel)],
      toll > 0 ? ['통행료', C.won(r.toll)] : null,
      ['1km당 비용', (r.total / r.dist).toFixed(1) + '원'],
      ['합계', C.won(r.total), 'total'],
    ],
    foot: C.steps([
      '총 거리 = ' + C.fmt(km) + 'km' + (rt ? ' × 2(왕복) = ' + C.fmt(r.dist) + 'km' : ''),
      '연료량 = 총 거리 ÷ 연비 = ' + C.fmt(r.dist) + ' ÷ ' + kpl + ' = ' + r.liters.toFixed(2) + 'L',
      '연료비 = 연료량 × 유가 = ' + r.liters.toFixed(2) + ' × ' + C.fmt(price) + ' = ' + C.won(r.fuel),
      toll > 0 ? '통행료 = ' + C.fmt(toll) + '원' + (rt ? ' × 2 = ' + C.won(r.toll) : '') : '통행료 미입력',
      '연비가 1km/L 낮은 ' + Math.max(1, kpl - 1) + 'km/L 차라면 연료비는 ' + C.won(worse.fuel) + ' (차이 ' + C.won(worse.fuel - r.fuel) + ')',
    ]),
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>기름값은 거리보다 연비가 가른다</h2>
    <p>같은 거리를 달려도 연비가 8km/L인 차와 16km/L인 차는 연료비가 정확히 두 배 차이 납니다. 유가가 100원 오르는 것보다 연비가 2km/L 떨어지는 쪽이 지갑에 더 아픈 경우가 많습니다. 이 계산기는 그 감각을 숫자로 확인할 수 있도록, 연비가 1km/L 낮았을 때의 비용도 함께 보여줍니다.</p>
    <p>고속도로 장거리에서는 <strong>통행료</strong>도 무시하기 어렵습니다. 편도 통행료를 넣으면 왕복 기준으로 합산해 실제 지출에 가까운 총액을 계산합니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>내비게이션이 알려주는 <strong>편도 거리</strong>를 입력합니다.</li>
      <li><strong>연비</strong>는 계기판 값보다 실측 평균이 정확합니다. 모르면 연비 계산기로 먼저 구해보세요.</li>
      <li><strong>유가</strong>는 오피넷에서 현재 지역 평균을 확인해 넣으면 좋습니다.</li>
      <li>왕복 체크와 통행료를 넣으면 실제 지출 총액이 나옵니다.</li>
    </ol>`,
  faq: [
    { q: "고속도로와 시내 중 어느 연비를 넣어야 하나요?", a: "장거리 고속 주행이라면 고속 연비, 시내 위주라면 시내 연비를 넣는 편이 정확합니다. 혼합이라면 실측 누적 평균을 쓰세요." },
    { q: "유가는 어디서 확인하나요?", a: "한국석유공사 오피넷(opinet.co.kr)에서 지역별·주유소별 실시간 가격을 확인할 수 있습니다. 이 계산기는 외부 API를 쓰지 않으므로 값을 직접 입력합니다." },
    { q: "전기차도 계산할 수 있나요?", a: "연비 자리에 전비(km/kWh), 유가 자리에 충전 단가(원/kWh)를 넣으면 같은 방식으로 충전비가 계산됩니다. 전기차와 내연기관 비교는 전기차 유지비 비교 도구를 이용하세요." },
    { q: "왜 실제 주유비와 차이가 나나요?", a: "에어컨 사용, 정체, 짐 무게, 타이어 공기압, 급가속 습관에 따라 실연비가 달라지기 때문입니다. 여유 있게 10% 정도를 더 잡아두면 안전합니다." },
  ],
  sourceHtml: SRC_LIST([{ label: "오피넷 — 실시간 유가 조회", url: PRICE_LOOKUP.url }]) + "\n    " + TODO_BLOCK(FUEL_TODO, "고정 값으로 넣지 않은 항목"),
  disclaimerHtml: DISC("실제 연비는 주행 조건에 따라 크게 달라집니다."),
  related: [{ slug: "trip-share", e: "🧮", n: "여행 기름값 N빵 계산기" }, REL.yeon, { slug: "ev-vs-ice", e: "🔌", n: "전기차 유지비 비교" }, REL.maint],
});

/* 5 ─ 자동차 할부 계산기 ─────────────────────────────────── */
TOOLS.push({
  slug: "loan", emoji: "💳", nav: "할부 계산기",
  title: "자동차 할부 계산기 — 원리금균등·원금균등 상환 스케줄 전체",
  ogTitle: "자동차 할부 계산기 — 상환 스케줄",
  desc: "차량가와 선수금, 연이율, 할부 개월수를 넣으면 월 납입금과 총이자, 회차별 원금·이자·잔액 스케줄을 전부 보여줍니다. 원리금균등과 원금균등을 비교하고 CSV로 내보낼 수 있습니다.",
  h1: "자동차 할부 계산기",
  lead: "월 납입금 하나가 아니라 <strong>1회차부터 마지막 회차까지 원금·이자·잔액</strong>을 전부 펼쳐 보여줍니다.",
  bodyHtml: `
  <div class="card">
    <div class="row2">
      <div class="field"><label for="price">차량 가격 <span class="hint">원</span></label><input type="number" id="price" inputmode="numeric" placeholder="40000000" value="40000000" /></div>
      <div class="field"><label for="down">선수금 <span class="hint">원</span></label><input type="number" id="down" inputmode="numeric" placeholder="10000000" value="10000000" /></div>
    </div>
    <div class="row3">
      <div class="field"><label for="rate">연이율 <span class="hint">%</span></label><input type="number" id="rate" step="0.01" placeholder="5.9" value="5.9" /></div>
      <div class="field"><label for="months">할부 기간 <span class="hint">개월</span></label><input type="number" id="months" inputmode="numeric" placeholder="60" value="60" /></div>
      <div class="field"><label for="method">상환 방식</label>
        <select id="method"><option value="equalPayment">원리금균등</option><option value="equalPrincipal">원금균등</option></select>
      </div>
    </div>
    <button class="btn full" id="go" type="button">할부금 계산하기</button>
  </div>
  <div class="result" id="out" hidden></div>
  <section class="about" id="schSec" hidden>
    <h2>회차별 상환 스케줄</h2>
    <div id="sch"></div>
    <div class="btnrow"><button class="btn ghost" id="csv" type="button">CSV 내보내기</button></div>
  </section>`,
  script: `import { loanSchedule } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
let last = null;
function run() {
  const price = C.num($('price')), down = C.num($('down'));
  const rate = C.num($('rate')) / 100, months = Math.round(C.num($('months')));
  const method = $('method').value;
  const principal = price - down;
  if (principal <= 0) { alert('선수금이 차량 가격보다 크거나 같습니다.'); return; }
  if (months <= 0 || months > 120) { alert('할부 기간을 1~120개월 사이로 입력하세요.'); return; }
  const r = loanSchedule({ principal: principal, annualRate: rate, months: months, method: method });
  const other = loanSchedule({ principal: principal, annualRate: rate, months: months, method: method === 'equalPayment' ? 'equalPrincipal' : 'equalPayment' });
  last = r;
  const lastRow = r.rows[r.rows.length - 1];
  C.result('out', {
    big: C.won(r.firstPay) + (method === 'equalPrincipal' ? ' → ' + C.won(lastRow.pay) : ' / 월'),
    sub: method === 'equalPayment' ? months + '개월 원리금균등 · 매월 같은 금액' : months + '개월 원금균등 · 1회차 ' + C.won(r.firstPay) + ', 마지막 ' + C.won(lastRow.pay),
    rows: [
      ['할부 원금 (차량가 − 선수금)', C.won(principal)],
      ['총 이자', C.won(r.totalInterest)],
      ['총 상환액 (원금+이자)', C.won(r.totalPay)],
      ['선수금 포함 총 지출', C.won(down + r.totalPay), 'total'],
      [method === 'equalPayment' ? '원금균등으로 바꾸면 총이자' : '원리금균등으로 바꾸면 총이자', C.won(other.totalInterest) + ' (' + (other.totalInterest > r.totalInterest ? '+' : '') + C.won(other.totalInterest - r.totalInterest) + ')'],
    ],
    foot: C.steps([
      '할부 원금 = ' + C.won(price) + ' − ' + C.won(down) + ' = ' + C.won(principal),
      '월 이율 = 연 ' + (rate * 100).toFixed(2) + '% ÷ 12 = ' + (rate / 12 * 100).toFixed(4) + '%',
      method === 'equalPayment'
        ? '원리금균등 월납입금 = 원금 × 월이율 ÷ (1 − (1+월이율)^-' + months + ') = ' + C.won(r.firstPay)
        : '원금균등 매월 원금 = ' + C.won(Math.floor(principal / months)) + ' + 잔액 × 월이율(이자)',
      '총이자 = 총 상환액 − 원금 = ' + C.won(r.totalPay) + ' − ' + C.won(principal) + ' = ' + C.won(r.totalInterest),
    ]),
  });
  $('schSec').hidden = false;
  $('sch').innerHTML = C.tbl(['회차', '납입금', '원금', '이자', '잔액'],
    r.rows.map(function (x) { return [x.m + '회', C.won(x.pay), C.won(x.principalPart), C.won(x.interest), C.won(x.balance)]; }));
}
$('go').addEventListener('click', run);
$('csv').addEventListener('click', function () {
  if (!last) { alert('먼저 계산해 주세요.'); return; }
  const rows = [['회차', '납입금', '원금', '이자', '잔액']];
  for (const x of last.rows) rows.push([x.m, x.pay, x.principalPart, x.interest, x.balance]);
  rows.push(['합계', last.totalPay, last.totalPrincipal, last.totalInterest, 0]);
  C.downloadCsv('carcalc-loan-schedule.csv', rows);
});`,
  introHtml: `<h2>원리금균등과 원금균등, 무엇이 다른가</h2>
    <p><strong>원리금균등</strong>은 매달 내는 금액이 같습니다. 초반에는 이자 비중이 크고 뒤로 갈수록 원금 비중이 커집니다. 매달 지출이 일정해 예산 짜기가 편하지만 원금이 천천히 줄어드는 만큼 총이자가 조금 더 많습니다.</p>
    <p><strong>원금균등</strong>은 매달 갚는 원금이 같고 이자는 남은 잔액에 붙습니다. 그래서 첫 달 납입금이 가장 크고 매달 조금씩 줄어듭니다. 초반 부담을 견딜 수 있다면 총이자는 원리금균등보다 적습니다. 이 계산기는 두 방식의 총이자 차이를 함께 보여줍니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>차량 가격</strong>과 <strong>선수금</strong>을 넣습니다. 취득세·보험료는 별도이므로 따로 준비해야 합니다.</li>
      <li>계약서의 <strong>연이율</strong>과 <strong>할부 개월수</strong>를 입력합니다.</li>
      <li>상환 방식을 바꿔가며 총이자 차이를 비교하세요.</li>
      <li>회차별 스케줄은 CSV로 내보내 가계부에 붙여 쓸 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "월 납입금이 계약서와 조금 다릅니다.", a: "금융사마다 원 단위 처리 방식(반올림·절상), 이자 계산 기준일, 취급수수료 포함 여부가 달라 소액 차이가 납니다. 이 계산기는 월 단위 복리 기준 표준 산식(원리금균등)을 사용합니다." },
    { q: "선수금을 늘리면 얼마나 이득인가요?", a: "이자는 남은 원금에 붙기 때문에 선수금을 늘리면 총이자가 비례해 줄어듭니다. 값을 바꿔가며 총이자 항목을 비교해 보세요." },
    { q: "유예할부(잔가보장형)도 계산되나요?", a: "이 계산기는 만기 잔존원금이 0이 되는 표준 할부만 계산합니다. 유예할부는 만기에 목돈이 남으므로 리스·렌트 vs 구매 비교 도구에서 잔가를 넣어 비교해 보세요." },
    { q: "중도상환하면 이자가 줄어드나요?", a: "남은 기간의 이자는 줄지만 중도상환수수료가 붙을 수 있습니다. 스케줄 표의 해당 회차 잔액이 중도상환 시 갚아야 할 원금입니다." },
  ],
  sourceHtml: `<h2>계산 기준</h2>
    <p class="src">월 이율 = 연이율 ÷ 12, 원리금균등 = P × i ÷ (1 − (1+i)^-n) 표준 산식. 회차별 원 단위는 반올림하고 마지막 회차에서 잔액을 정리합니다. 취급수수료·인지세·중도상환수수료는 포함하지 않습니다. (확인일 ${TODAY})</p>`,
  disclaimerHtml: DISC("실제 승인 금리·수수료는 금융사 심사 결과에 따라 달라집니다."),
  related: [REL.refi, { slug: "lease-vs-buy", e: "⚖️", n: "리스·렌트 vs 구매 비교" }, { slug: "acquisition", e: "🏷️", n: "취등록세 계산기" }, REL.ins],
});

/* 6 ─ 중고차 감가 계산기 ─────────────────────────────────── */
TOOLS.push({
  slug: "depreciation", emoji: "📉", nav: "중고차 감가 계산기",
  title: "중고차 감가 계산기 — 산식을 공개한 단순 감가 모델 (시세 아님)",
  ogTitle: "중고차 감가 계산기 — 산식 공개",
  desc: "신차가와 연식, 주행거리를 넣으면 단순 감가 모델로 잔존가치를 추정합니다. 1년차 감가율과 이후 연 감가율을 직접 조정할 수 있고 계산에 쓰인 산식을 전부 공개합니다. 실거래 시세가 아닙니다.",
  h1: "중고차 감가 계산기",
  lead: "실거래 시세 데이터가 아니라 <strong>공개된 산식으로 계산한 참고 모델</strong>입니다. 감가율을 직접 바꿔가며 감을 잡는 용도입니다.",
  bodyHtml: `
  <p class="notice">⚠ 이 도구는 <strong>실거래 시세가 아닙니다.</strong> 중고차 가격은 트림·옵션·사고 이력·색상·지역·계절에 따라 크게 달라집니다. 아래 결과는 공개된 단순 산식으로 계산한 참고값이며, 실제 매매가는 반드시 여러 매물 시세를 직접 비교해 확인하세요.</p>
  <div class="card">
    <div class="row2">
      <div class="field"><label for="price">신차 가격 <span class="hint">원</span></label><input type="number" id="price" inputmode="numeric" placeholder="35000000" value="35000000" /></div>
      <div class="field"><label for="age">연식 <span class="hint">년 (경과 연수)</span></label><input type="number" id="age" step="0.5" placeholder="3" value="3" /></div>
    </div>
    <div class="field"><label for="km">누적 주행거리 <span class="hint">km</span></label><input type="number" id="km" inputmode="numeric" placeholder="60000" value="60000" /></div>
    <details class="card" style="margin:0 0 14px">
      <summary>감가율 직접 조정 (모델 파라미터)</summary>
      <div class="row3">
        <div class="field"><label for="r1">1년차 감가율 <span class="hint">%</span></label><input type="number" id="r1" step="1" value="20" /></div>
        <div class="field"><label for="r2">이후 연 감가율 <span class="hint">%</span></label><input type="number" id="r2" step="1" value="10" /></div>
        <div class="field"><label for="std">연 기준 주행 <span class="hint">km</span></label><input type="number" id="std" step="1000" value="15000" /></div>
      </div>
    </details>
    <button class="btn full" id="go" type="button">잔존가치 추정하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `import { depreciation } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
function run() {
  const price = C.num($('price')), age = C.num($('age')), km = C.num($('km'));
  const r1 = C.num($('r1')) / 100, r2 = C.num($('r2')) / 100, std = C.num($('std')) || 15000;
  if (price <= 0) { alert('신차 가격을 입력하세요.'); return; }
  const d = depreciation({ price: price, ageYears: age, mileage: km, rateFirst: r1, rateAfter: r2, stdKmPerYear: std });
  const expected = std * age;
  const rows = [];
  for (let y = 1; y <= Math.min(10, Math.max(5, Math.ceil(age) + 2)); y++) {
    const v = depreciation({ price: price, ageYears: y, mileage: std * y, rateFirst: r1, rateAfter: r2, stdKmPerYear: std });
    rows.push([y + '년차', C.won(v.value), (v.lossPct).toFixed(1) + '%']);
  }
  C.result('out', {
    big: C.won(d.value),
    sub: age + '년 · ' + C.fmt(km) + 'km 기준 추정 잔존가치 (실거래 시세 아님)',
    rows: [
      ['신차 가격', C.won(price)],
      ['연식 감가 계수', (d.factor * 100).toFixed(1) + '%'],
      ['주행거리 보정', (d.mileageAdj >= 0 ? '+' : '') + (d.mileageAdj * 100).toFixed(1) + '%'],
      ['총 감가액', C.won(price - d.value) + ' (' + d.lossPct.toFixed(1) + '%)'],
      ['추정 잔존가치', C.won(d.value), 'total'],
    ],
    foot: C.steps([
      '연식 계수 = (1 − ' + (r1 * 100) + '%) × (1 − ' + (r2 * 100) + '%)^(' + age + '−1) = ' + d.factor.toFixed(4),
      '기준 주행거리 = ' + C.fmt(std) + 'km × ' + age + '년 = ' + C.fmt(expected) + 'km, 실제 ' + C.fmt(km) + 'km',
      '주행 보정 = 1만km 편차당 ∓2%, 상하한 ±10% → ' + (d.mileageAdj * 100).toFixed(1) + '%',
      '잔존가치 = 신차가 × 연식계수 × (1 + 주행보정) = ' + C.won(d.value),
    ]) + C.tbl(['경과', '기준 주행 시 잔존가치', '감가율'], rows) +
      '<p class="src">위 표는 매년 기준 주행거리(' + C.fmt(std) + 'km)를 탔다고 가정한 참고 곡선입니다.</p>',
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>이 계산기가 쓰는 감가 모델</h2>
    <p>중고차 가격을 정확히 맞히는 공식은 존재하지 않습니다. 이 도구는 시세 데이터를 흉내 내는 대신, <strong>누구나 검증할 수 있는 단순 산식</strong>을 공개하고 그 결과를 보여줍니다. 산식은 두 부분입니다.</p>
    <ul>
      <li><strong>연식 감가</strong>: 첫 해에 20%가 빠지고, 그 다음부터는 남은 가치에서 매년 10%씩 줄어드는 기하급수 모델입니다. 신차가 출고 직후 크게 떨어지고 이후 완만해지는 실제 패턴을 단순화한 것입니다.</li>
      <li><strong>주행거리 보정</strong>: 연 15,000km를 기준선으로 두고, 이보다 1만km 더 탔으면 2%를 빼고 덜 탔으면 2%를 더합니다. 보정 폭은 최대 ±10%로 제한합니다.</li>
    </ul>
    <p>세 파라미터(1년차 감가율·이후 감가율·기준 주행거리)는 직접 바꿀 수 있습니다. 인기 차종은 감가율을 낮추고, 감가가 빠른 차종은 높여서 시나리오를 비교해 보세요.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>신차 가격</strong>에는 옵션 포함 출고가를 넣는 편이 현실적입니다.</li>
      <li><strong>연식</strong>은 경과 연수입니다. 6개월은 0.5로 넣을 수 있습니다.</li>
      <li>실제 매물 시세와 맞춰보고 싶다면 감가율 파라미터를 조정해 결과가 비슷해지는 값을 찾아보세요.</li>
    </ol>`,
  faq: [
    { q: "이 값으로 중고차를 팔거나 사도 되나요?", a: "안 됩니다. 이 결과는 실거래 시세가 아니라 단순 산식의 출력입니다. 실제 거래에는 동일 연식·트림 매물의 실제 시세, 성능점검기록부, 사고 이력을 반드시 확인하세요." },
    { q: "왜 첫 해 감가가 가장 큰가요?", a: "신차가 등록되는 순간 '중고차'가 되면서 신차 프리미엄과 각종 할인·판촉 조건의 차이가 한 번에 반영되기 때문입니다. 이후에는 상태와 주행거리에 따라 완만하게 떨어집니다." },
    { q: "주행거리가 적으면 무조건 비싼가요?", a: "일반적으로는 그렇지만 지나치게 적으면 장기 방치로 고무·오일 계통이 나빠졌을 수 있어 오히려 감점 요인이 되기도 합니다. 이 모델은 보정 폭을 ±10%로 제한해 과도한 왜곡을 막았습니다." },
    { q: "감가율 기본값 20%·10%의 근거는 무엇인가요?", a: "특정 기관의 공식 수치가 아니라, 널리 쓰이는 관행적 경험칙을 기본값으로 둔 것입니다. 그래서 값을 고정하지 않고 직접 바꿀 수 있게 만들었습니다." },
  ],
  sourceHtml: `<h2>산식과 한계 <span class="badge ref">모델</span></h2>
    <p class="src">잔존가치 = 신차가 × (1 − 1년차감가율) × (1 − 연감가율)^(연식−1) × (1 + 주행보정). 주행보정 = clamp(−0.02 × (실주행 − 기준주행×연식) ÷ 10,000, −10%, +10%). 시세 데이터·API를 사용하지 않으며 트림·사고이력·옵션·색상·지역·계절 수요를 반영하지 않습니다. (확인일 ${TODAY})</p>`,
  disclaimerHtml: DISC("실거래 시세가 아니며 매매 가격을 보증하지 않습니다."),
  related: [{ slug: "car-tax", e: "🧾", n: "자동차세 계산기" }, { slug: "lease-vs-buy", e: "⚖️", n: "리스·렌트 vs 구매 비교" }, REL.ins, REL.maint],
});

/* 7 ─ 타이어 규격 해독기 ─────────────────────────────────── */
const LOAD_INDEX = [[75,387],[80,450],[82,475],[84,500],[85,515],[87,545],[88,560],[89,580],[91,615],[92,630],[94,670],[95,690],[96,710],[97,730],[98,750],[99,775],[100,800],[101,825],[102,850],[103,875],[104,900],[105,925],[107,975],[108,1000],[109,1030],[110,1060]];
const SPEED_SYM = [["Q",160],["R",170],["S",180],["T",190],["H",210],["V",240],["W",270],["Y",300]];

TOOLS.push({
  slug: "tire-decoder", emoji: "🛞", nav: "타이어 규격 해독기",
  title: "타이어 규격 해독기 — 205/55R16 91V 읽는 법과 대체 규격 지름 오차",
  ogTitle: "타이어 규격 해독기 — 대체 규격 오차",
  desc: "205/55R16 91V 같은 타이어 표기를 폭·편평비·휠 인치·하중지수·속도기호로 풀어 읽고, 다른 규격으로 바꿨을 때 전체 지름이 몇 % 달라지는지, 속도계 오차는 얼마나 생기는지 계산합니다.",
  h1: "타이어 규격 해독기",
  lead: "옆면의 <strong>205/55R16 91V</strong>가 무슨 뜻인지 풀어 읽고, 다른 규격으로 바꿨을 때 <strong>지름 오차와 속도계 오차</strong>까지 계산합니다.",
  bodyHtml: `
  <div class="card">
    <div class="field">
      <label for="orig">현재 타이어 규격 <span class="hint">예: 205/55R16 91V</span></label>
      <input type="text" id="orig" placeholder="205/55R16 91V" value="205/55R16 91V" autocomplete="off" />
    </div>
    <div class="field">
      <label for="alt">바꾸려는 규격 <span class="hint">선택 — 비우면 해독만</span></label>
      <input type="text" id="alt" placeholder="225/45R17" value="225/45R17" autocomplete="off" />
    </div>
    <button class="btn full" id="go" type="button">규격 해독하기</button>
  </div>
  <div class="result" id="out" hidden></div>

  <section class="about">
    <h2>하중지수(Load Index) 표</h2>
    <p>규격 뒤 두 자리 숫자는 타이어 한 개가 견딜 수 있는 최대 하중을 나타내는 코드입니다. <strong>순정보다 낮은 하중지수를 쓰면 안 됩니다.</strong></p>
    ${(() => {
      const cells = LOAD_INDEX.map(([i, kg]) => `<tr><td>${i}</td><td class="num">${kg} kg</td></tr>`);
      const half = Math.ceil(cells.length / 2);
      return `<div class="row2"><div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th>지수</th><th>최대하중</th></tr></thead><tbody>${cells.slice(0, half).join("")}</tbody></table></div><div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th>지수</th><th>최대하중</th></tr></thead><tbody>${cells.slice(half).join("")}</tbody></table></div></div>`;
    })()}
    <h2>속도기호(Speed Symbol) 표</h2>
    <p>규격 맨 뒤 알파벳은 타이어가 견디는 최고 속도 등급입니다.</p>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>기호</th>${SPEED_SYM.map(([s]) => `<th>${s}</th>`).join("")}</tr></thead><tbody><tr><td>최고속도</td>${SPEED_SYM.map(([, v]) => `<td class="num">${v}km/h</td>`).join("")}</tr></tbody></table></div>
    <p class="src">국제 표준 하중지수·속도기호 대응표 기준의 참고값입니다. 실제 장착 가능 규격은 차량 취급설명서와 타이어 제조사 적합표를 따르세요.</p>
  </section>`,
  script: `import { parseTire, tireDiameter, tireDiff } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
const LI = ${JSON.stringify(Object.fromEntries(LOAD_INDEX))};
const SS = ${JSON.stringify(Object.fromEntries(SPEED_SYM))};
function desc(t) {
  const parts = ['단면 폭 ' + t.width + 'mm', '편평비 ' + t.aspect + '% (사이드월 높이 ' + (t.width * t.aspect / 100).toFixed(1) + 'mm)', '휠(림) 지름 ' + t.rim + '인치'];
  if (t.loadIndex) parts.push('하중지수 ' + t.loadIndex + (LI[t.loadIndex] ? ' = 개당 최대 ' + LI[t.loadIndex] + 'kg' : ''));
  if (t.speedSymbol) parts.push('속도기호 ' + t.speedSymbol + (SS[t.speedSymbol] ? ' = 최고 ' + SS[t.speedSymbol] + 'km/h' : ''));
  return parts;
}
function run() {
  const o = parseTire($('orig').value);
  if (!o) { alert('규격을 205/55R16 또는 205/55R16 91V 형식으로 입력하세요.'); return; }
  const d1 = tireDiameter(o);
  const a = $('alt').value.trim() ? parseTire($('alt').value) : null;
  if ($('alt').value.trim() && !a) { alert('바꾸려는 규격 형식을 확인하세요. 예: 225/45R17'); return; }
  const rows = [
    ['현재 규격', o.width + '/' + o.aspect + 'R' + o.rim + (o.loadIndex ? ' ' + o.loadIndex + (o.speedSymbol || '') : '')],
    ['전체 지름', d1.toFixed(1) + ' mm'],
    ['둘레(1회전 거리)', (d1 * Math.PI / 1000).toFixed(3) + ' m'],
  ];
  const st = desc(o).map(function (x) { return x; });
  st.unshift('전체 지름 = 림 인치 × 25.4 + 2 × (폭 × 편평비%) = ' + o.rim + '×25.4 + 2×(' + o.width + '×' + o.aspect + '%) = ' + d1.toFixed(1) + 'mm');
  let big = d1.toFixed(1) + ' mm', sub = '현재 타이어 전체 지름';
  let extra = '';
  if (a) {
    const df = tireDiff(o, a);
    const ok = Math.abs(df.diffPct) <= 3;
    rows.push(['대체 규격', a.width + '/' + a.aspect + 'R' + a.rim]);
    rows.push(['대체 규격 지름', df.d2.toFixed(1) + ' mm']);
    rows.push(['지름 차이', (df.diffMm >= 0 ? '+' : '') + df.diffMm.toFixed(1) + ' mm']);
    rows.push(['지름 오차율', (df.diffPct >= 0 ? '+' : '') + df.diffPct.toFixed(2) + '% ' + (ok ? '<span class="badge ok">±3% 이내</span>' : '<span class="badge bad">±3% 초과</span>'), 'total']);
    const shown = 100, real = shown * df.d2 / df.d1;
    big = (df.diffPct >= 0 ? '+' : '') + df.diffPct.toFixed(2) + '%';
    sub = ok ? '통상 권장 범위(±3%) 안입니다.' : '통상 권장 범위(±3%)를 벗어납니다. 속도계·ABS 오차가 커질 수 있습니다.';
    st.push('대체 규격 지름 = ' + a.rim + '×25.4 + 2×(' + a.width + '×' + a.aspect + '%) = ' + df.d2.toFixed(1) + 'mm');
    st.push('오차율 = (대체 − 현재) ÷ 현재 × 100 = (' + df.d2.toFixed(1) + ' − ' + df.d1.toFixed(1) + ') ÷ ' + df.d1.toFixed(1) + ' × 100 = ' + df.diffPct.toFixed(2) + '%');
    st.push('속도계 오차: 계기판 ' + shown + 'km/h일 때 실제 약 ' + real.toFixed(1) + 'km/h');
    if (a.loadIndex && o.loadIndex && a.loadIndex < o.loadIndex) extra = '<p class="src"><span class="badge bad">주의</span> 대체 규격의 하중지수가 현재보다 낮습니다. 순정보다 낮은 하중지수는 사용하지 마세요.</p>';
  }
  C.result('out', {
    big: big, sub: sub, rows: rows,
    foot: C.steps(st) + '<p class="src">' + desc(o).join(' · ') + '</p>' + extra,
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>205/55R16 91V를 한 글자씩 읽으면</h2>
    <ul>
      <li><strong>205</strong> — 타이어 단면 폭(mm). 숫자가 클수록 접지면이 넓습니다.</li>
      <li><strong>55</strong> — 편평비(%). 사이드월 높이가 폭의 55%라는 뜻이라 숫자가 작을수록 옆면이 얇습니다.</li>
      <li><strong>R</strong> — 래디얼 구조. 승용차용은 거의 전부 R입니다.</li>
      <li><strong>16</strong> — 휠(림) 지름(인치).</li>
      <li><strong>91</strong> — 하중지수. 타이어 한 개가 견디는 최대 하중 코드(91 = 615kg).</li>
      <li><strong>V</strong> — 속도기호. 견딜 수 있는 최고 속도 등급(V = 240km/h).</li>
    </ul>
    <h2>규격을 바꿀 때 지름이 중요한 이유</h2>
    <p>타이어 <strong>전체 지름</strong>이 달라지면 바퀴 한 바퀴에 나아가는 거리가 달라집니다. 속도계와 주행거리계는 바퀴 회전수를 기준으로 계산하므로, 지름이 커지면 계기판보다 실제로 더 빨리·더 멀리 달리게 되고 작아지면 반대가 됩니다. ABS·차체자세제어 같은 전자장비도 바퀴 회전 정보를 쓰기 때문에 오차가 커지면 개입 시점이 어긋날 수 있습니다. 그래서 대체 규격은 <strong>지름 오차 ±3% 이내</strong>로 맞추는 것이 일반적인 권장 기준입니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>타이어 옆면에 새겨진 규격을 그대로 입력합니다. 예: <code>205/55R16 91V</code></li>
      <li>바꾸려는 규격을 두 번째 칸에 넣으면 지름 차이와 오차율, 속도계 오차가 계산됩니다.</li>
      <li>오차가 ±3%를 넘으면 경고가 표시됩니다. 하중지수가 낮아지는 조합도 함께 경고합니다.</li>
    </ol>`,
  faq: [
    { q: "지름 오차 ±3%는 법으로 정해진 기준인가요?", a: "법정 수치라기보다 업계에서 널리 쓰이는 실무 권장 범위입니다. 오차가 커질수록 속도계 표시와 실제 속도의 차이, 주행거리계 오차가 커지므로 보수적으로 잡는 것이 안전합니다." },
    { q: "인치업을 하면 왜 편평비를 낮추나요?", a: "휠이 커진 만큼 사이드월을 얇게 해야 전체 지름이 유지되기 때문입니다. 예를 들어 205/55R16을 17인치로 올린다면 편평비를 45~50 근처로 낮춰 지름을 맞춥니다." },
    { q: "폭을 넓히면 무조건 좋은가요?", a: "접지력은 늘 수 있지만 연비가 나빠지고 노면 소음과 젖은 노면 배수 성능에 영향이 갑니다. 또 휠하우스·서스펜션 간섭 여부를 반드시 확인해야 합니다." },
    { q: "하중지수를 낮춰도 되나요?", a: "안 됩니다. 순정 하중지수 이상을 유지해야 합니다. 낮은 하중지수는 과부하 상태에서 타이어 손상 위험을 높입니다." },
  ],
  sourceHtml: SRC_LIST([{ label: "자동차 및 자동차부품의 성능과 기준에 관한 규칙 (타이어 안전기준)", url: "https://www.law.go.kr/법령/자동차및자동차부품의성능과기준에관한규칙" }]),
  disclaimerHtml: DISC("장착 가능 여부는 차량 취급설명서와 제조사 적합표를 확인하세요."),
  related: [{ slug: "maintenance", e: "🔧", n: "소모품 교체 주기 기록" }, REL.maint, REL.ins],
});

/* 8 ─ 소모품 교체 주기 기록 ──────────────────────────────── */
TOOLS.push({
  slug: "maintenance", emoji: "🔧", nav: "소모품 교체 주기 기록",
  title: "소모품 교체 주기 기록 — 주행거리 기반 D-day 알림",
  ogTitle: "소모품 교체 주기 기록 — D-day",
  desc: "엔진오일·에어컨 필터·브레이크액 등 12개 소모품의 마지막 교체 시점을 기록하면 현재 주행거리와 월 평균 주행거리로 다음 교체까지 남은 거리와 D-day를 계산합니다. 기록은 내 브라우저에만 저장되고 CSV로 내보낼 수 있습니다.",
  h1: "소모품 교체 주기 기록",
  lead: "언제 갈았는지만 적어두면 <strong>다음 교체까지 남은 거리와 D-day</strong>를 계산합니다. 서버 저장 없음.",
  bodyHtml: `
  <p class="notice">${MAINT_LABEL}. 가혹조건(짧은 거리 반복 주행, 잦은 공회전, 비포장·먼지 많은 환경)에서는 주기를 절반 가까이 당겨야 할 수 있습니다.</p>
  <div class="card">
    <div class="row2">
      <div class="field"><label for="odo">현재 주행거리 <span class="hint">km</span></label><input type="number" id="odo" inputmode="numeric" placeholder="62000" value="62000" /></div>
      <div class="field"><label for="avg">월 평균 주행 <span class="hint">km/월</span></label><input type="number" id="avg" inputmode="numeric" placeholder="1200" value="1200" /></div>
    </div>
    <p class="src">아래 표에서 <strong>기억나는 항목만</strong> 채우면 됩니다. 마지막 교체 시점의 주행거리(km) 또는 날짜 중 하나만 있어도 계산합니다.</p>
    <div id="mTbl"></div>
    <div class="btnrow">
      <button class="btn" id="go" type="button">교체 시기 계산</button>
      <button class="btn ghost" id="save" type="button">기록 저장</button>
      <button class="btn ghost" id="csv" type="button">CSV 내보내기</button>
      <button class="btn danger" id="clear" type="button">전체 삭제</button>
    </div>
  </div>
  <div class="result" id="out" hidden></div>
  ${NO_SERVER}`,
  script: `import { MAINT_ITEMS } from "__U__data/maintenance.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
const KEY = 'cc-maint';
const saved = C.lsGet(KEY, { odo: 0, avg: 0, items: {} });
if (saved.odo) $('odo').value = saved.odo;
if (saved.avg) $('avg').value = saved.avg;

let html = '<div class="tblwrap"><table class="tbl"><thead><tr><th>소모품</th><th>권장 주기</th><th>마지막 교체 (km)</th><th>마지막 교체일</th></tr></thead><tbody>';
for (const it of MAINT_ITEMS) {
  const cyc = (it.km ? C.fmt(it.km) + 'km' : '') + (it.km && it.months ? ' / ' : '') + (it.months ? it.months + '개월' : '');
  const s = saved.items[it.key] || {};
  html += '<tr><td><strong>' + it.name + '</strong><br /><span class="src">' + C.esc(it.note) + '</span></td>' +
    '<td class="num">' + cyc + '</td>' +
    '<td><input type="number" id="k_' + it.key + '" inputmode="numeric" value="' + (s.km || '') + '" placeholder="예: 52000" /></td>' +
    '<td><input type="date" id="d_' + it.key + '" value="' + (s.date || '') + '" /></td></tr>';
}
$('mTbl').innerHTML = html + '</tbody></table></div>';

function collect() {
  const items = {};
  for (const it of MAINT_ITEMS) {
    const km = C.num($('k_' + it.key));
    const date = $('d_' + it.key).value;
    if (km > 0 || date) items[it.key] = { km: km || 0, date: date || '' };
  }
  return { odo: C.num($('odo')), avg: C.num($('avg')), items: items };
}
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function run() {
  const s = collect();
  if (s.odo <= 0) { alert('현재 주행거리를 입력하세요.'); return; }
  const perDay = s.avg > 0 ? s.avg / 30.4 : 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const list = [];
  for (const it of MAINT_ITEMS) {
    const rec = s.items[it.key];
    if (!rec) continue;
    let remainKm = null, remainDays = null, nextKm = null, nextDate = null;
    if (rec.km > 0 && it.km) { nextKm = rec.km + it.km; remainKm = nextKm - s.odo; if (perDay > 0) remainDays = Math.round(remainKm / perDay); }
    if (rec.date && it.months) {
      const d = new Date(rec.date + 'T00:00:00'); d.setMonth(d.getMonth() + it.months);
      nextDate = d; const dd = daysBetween(today, d);
      remainDays = remainDays == null ? dd : Math.min(remainDays, dd);
    }
    if (remainKm == null && remainDays == null) continue;
    const urgent = (remainKm != null && remainKm <= 0) || (remainDays != null && remainDays <= 0);
    const soon = !urgent && ((remainKm != null && remainKm <= 1000) || (remainDays != null && remainDays <= 30));
    list.push({ it: it, nextKm: nextKm, remainKm: remainKm, nextDate: nextDate, remainDays: remainDays, rank: urgent ? 0 : soon ? 1 : 2,
      badge: urgent ? '<span class="badge bad">교체 시기 지남</span>' : soon ? '<span class="badge todo">임박</span>' : '<span class="badge ok">여유</span>' });
  }
  if (!list.length) { alert('마지막 교체 주행거리 또는 날짜를 한 개 이상 입력하세요.'); return; }
  list.sort(function (a, b) { return a.rank - b.rank || ((a.remainKm == null ? 1e9 : a.remainKm) - (b.remainKm == null ? 1e9 : b.remainKm)); });
  const rows = list.map(function (x) {
    return [x.it.name + ' ' + x.badge,
      x.nextKm != null ? C.fmt(x.nextKm) + 'km' : '-',
      x.remainKm != null ? (x.remainKm <= 0 ? C.fmt(-x.remainKm) + 'km 초과' : C.fmt(x.remainKm) + 'km') : '-',
      x.remainDays != null ? (x.remainDays <= 0 ? 'D+' + (-x.remainDays) : 'D-' + x.remainDays) : '-'];
  });
  const top = list[0];
  C.result('out', {
    big: top.it.name,
    sub: top.rank === 0 ? '교체 시기가 지났습니다. 가장 먼저 점검하세요.' : top.rank === 1 ? '교체 시기가 임박했습니다.' : '가장 먼저 돌아오는 교체 항목입니다.',
    rows: [
      ['현재 주행거리', C.fmt(s.odo) + ' km'],
      ['월 평균 주행', s.avg > 0 ? C.fmt(s.avg) + ' km/월 (일 ' + perDay.toFixed(1) + 'km)' : '미입력 — D-day 계산 제외'],
      ['점검 대상 항목', list.length + '건'],
      ['가장 급한 항목', top.it.name + (top.remainKm != null ? ' (' + (top.remainKm <= 0 ? C.fmt(-top.remainKm) + 'km 초과' : '남은 ' + C.fmt(top.remainKm) + 'km') + ')' : ''), 'total'],
    ],
    foot: C.tbl(['소모품 / 상태', '다음 교체 주행거리', '남은 거리', 'D-day'], rows) +
      C.steps([
        '남은 거리 = (마지막 교체 주행거리 + 권장 주기) − 현재 주행거리',
        '일 평균 주행 = 월 평균 ÷ 30.4 = ' + perDay.toFixed(1) + 'km/일',
        'D-day = 남은 거리 ÷ 일 평균 주행 (기간 주기가 있는 항목은 날짜 기준과 비교해 더 이른 쪽 표시)',
      ]),
  });
}
$('go').addEventListener('click', run);
$('save').addEventListener('click', function () { C.lsSet(KEY, collect()); alert('이 브라우저에 저장했습니다.'); });
$('csv').addEventListener('click', function () {
  const s = collect();
  const rows = [['소모품', '권장주기(km)', '권장주기(개월)', '마지막교체(km)', '마지막교체일', '다음교체(km)', '현재주행(km)']];
  for (const it of MAINT_ITEMS) {
    const r = s.items[it.key] || {};
    rows.push([it.name, it.km || '', it.months || '', r.km || '', r.date || '', r.km && it.km ? r.km + it.km : '', s.odo]);
  }
  C.downloadCsv('carcalc-maintenance.csv', rows);
});
$('clear').addEventListener('click', function () {
  if (!confirm('저장된 정비 기록을 모두 삭제할까요? 되돌릴 수 없습니다.')) return;
  try { localStorage.removeItem(KEY); } catch (e) {}
  location.reload();
});`,
  introHtml: `<h2>교체 주기를 놓치는 이유는 기억이 아니라 기록의 문제</h2>
    <p>엔진오일을 언제 갈았는지는 대개 기억나지만, 브레이크액이나 냉각수는 몇 년 전인지 가물가물합니다. 정비소에서 "이제 갈 때 됐다"는 말을 들어도 근거를 확인하기 어렵습니다. 이 도구는 <strong>마지막 교체 시점의 주행거리(또는 날짜)</strong>만 적어두면, 현재 주행거리와 월 평균 주행량으로 남은 거리와 D-day를 계산해 우선순위대로 정렬해 줍니다.</p>
    <p>수록된 주기는 제조사 일반 권고 수준의 참고값입니다. <strong>가혹조건</strong>—왕복 8km 이하 짧은 거리 반복, 잦은 공회전, 험로·먼지 많은 지역, 극단적 기온—에 해당하면 권장 주기를 절반 가까이 당기는 것이 안전합니다. 최종 기준은 언제나 내 차 취급설명서입니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>현재 주행거리</strong>와 <strong>월 평균 주행거리</strong>를 입력합니다. 월 평균은 D-day 환산에 쓰입니다.</li>
      <li>표에서 기억나는 항목의 <strong>마지막 교체 주행거리</strong>나 <strong>교체일</strong>을 채웁니다. 전부 채울 필요는 없습니다.</li>
      <li>"교체 시기 계산"을 누르면 급한 순서대로 정렬됩니다. "기록 저장"을 누르면 다음 방문 때 그대로 불러옵니다.</li>
      <li>정비 이력을 남기려면 CSV로 내보내 보관하세요.</li>
    </ol>`,
  faq: [
    { q: "엔진오일은 정말 5,000km마다 갈아야 하나요?", a: "일반 조건이라면 제조사 권고는 대체로 1만km 또는 12개월입니다. 다만 짧은 거리 위주 주행 등 가혹조건에서는 5,000~7,500km 권고가 붙습니다. 내 주행 패턴이 어디에 해당하는지부터 판단하세요." },
    { q: "타이어는 주행거리로 갈면 되나요?", a: "거리보다 마모 상태가 기준입니다. 트레드 마모한계선(1.6mm)에 닿으면 법정 안전기준상 교체 대상입니다. 편마모를 줄이려면 1만km마다 위치 교환을 함께 하세요." },
    { q: "기록은 다른 기기에서도 보이나요?", a: "보이지 않습니다. 기록은 사용 중인 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다. 기기를 옮기려면 CSV로 내보낸 뒤 새 기기에서 다시 입력하세요." },
    { q: "주기가 지났는데 아직 멀쩡해 보입니다.", a: "브레이크액이나 냉각수처럼 겉으로 상태를 알기 어려운 항목이 있습니다. 주기가 지났다면 교체 전에 최소한 점검은 받아보는 편이 안전합니다." },
  ],
  sourceHtml: SRC_LIST([
    { label: "현대자동차 오너스 매뉴얼", url: "https://www.hyundai.com/kr/ko/e/customer/center/manual" },
    { label: "기아 취급설명서", url: "https://www.kia.com/kr/customer-service/center/manual" },
    { label: "자동차 및 자동차부품의 성능과 기준에 관한 규칙", url: "https://www.law.go.kr/법령/자동차및자동차부품의성능과기준에관한규칙" },
  ]),
  disclaimerHtml: DISC("주기는 참고용이며 최종 기준은 차량 취급설명서와 정비 지침입니다."),
  related: [REL.maint, { slug: "tire-decoder", e: "🛞", n: "타이어 규격 해독기" }, REL.ins],
});

/* 9 ─ 과태료·범칙금 조회표 ──────────────────────────────── */
const FINE_CATS = [...new Set(FINES.map((f) => f.cat))];
const fineRowHtml = (f, depthPrefix) => `<tr data-cat="${esc(f.cat)}" data-name="${esc(f.name)}">
        <td><a href="${depthPrefix}fine/${f.slug}/">${esc(f.name)}</a><br /><span class="src">${esc(f.cat)}</span></td>
        <td class="num">${f.fine == null ? "-" : won(f.fine)}</td>
        <td class="num">${f.penalty == null ? "-" : won(f.penalty)}</td>
        <td class="num">${f.points == null ? "-" : f.points + "점"}</td>
      </tr>`;

TOOLS.push({
  slug: "fine-table", emoji: "🚨", nav: "과태료·범칙금 조회표",
  title: `과태료·범칙금 조회표 — 위반유형 ${FINES.length}종 금액·벌점 한눈에`,
  ogTitle: "과태료·범칙금 조회표 — 위반유형별 금액",
  desc: `속도위반·신호위반·주정차·스쿨존·안전띠 등 승용차 기준 위반유형 ${FINES.length}종의 과태료와 범칙금, 벌점을 한 표에서 검색합니다. 과태료와 범칙금이 왜 다른지, 자진납부 감경은 어떻게 적용되는지도 함께 정리했습니다.`,
  h1: "과태료·범칙금 조회표",
  lead: `승용차 기준 위반유형 <strong>${FINES.length}종</strong>의 과태료·범칙금·벌점을 한 표에 모았습니다. 항목을 누르면 상세 설명으로 이동합니다.`,
  bodyHtml: `
  <p class="notice">⚠ 이 표는 <strong>승용차 기준 참고용</strong>입니다. 승합·화물·이륜차는 금액이 다릅니다. 실제 단속 내역과 납부 금액은 <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24(이파인)</a>에서 확인하세요.</p>
  <div class="card">
    <div class="field">
      <label for="q">위반유형 검색</label>
      <input type="text" id="q" placeholder="예: 신호, 속도, 주정차, 스쿨존" autocomplete="off" />
    </div>
    <div class="filters" id="cats">
      <button type="button" data-c="" aria-pressed="true">전체</button>
      ${FINE_CATS.map((c) => `<button type="button" data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("\n      ")}
    </div>
  </div>
  <div class="tblwrap">
    <table class="tbl" id="ftbl">
      <thead><tr><th>위반유형</th><th>과태료</th><th>범칙금</th><th>벌점</th></tr></thead>
      <tbody>
      ${FINES.map((f) => fineRowHtml(f, "__U__")).join("\n      ")}
      </tbody>
    </table>
  </div>
  <p class="src" id="cnt"></p>`,
  script: `const $ = (id) => document.getElementById(id);
const C = window.CC;
const rows = Array.from(document.querySelectorAll('#ftbl tbody tr'));
let cat = '';
function apply() {
  const q = $('q').value.trim();
  let n = 0;
  for (const tr of rows) {
    const okC = !cat || tr.dataset.cat === cat;
    const okQ = !q || tr.dataset.name.indexOf(q) >= 0 || tr.dataset.cat.indexOf(q) >= 0;
    const show = okC && okQ;
    tr.hidden = !show;
    if (show) n++;
  }
  $('cnt').textContent = '표시 중: ' + n + '건 / 전체 ' + rows.length + '건';
}
$('q').addEventListener('input', apply);
for (const b of document.querySelectorAll('#cats button')) {
  b.addEventListener('click', function () {
    cat = this.dataset.c;
    for (const x of document.querySelectorAll('#cats button')) x.setAttribute('aria-pressed', String(x === this));
    apply();
  });
}
apply();
C.showAd();`,
  introHtml: `<h2>과태료와 범칙금은 무엇이 다른가</h2>
    <p>같은 위반이라도 <strong>어떻게 적발됐는지</strong>에 따라 처분이 갈립니다. 무인 단속 카메라에 찍히면 운전자가 누구인지 특정할 수 없으므로 차량 소유주에게 <strong>과태료</strong>가 부과되고 벌점은 없습니다. 반면 경찰관에게 현장에서 적발되면 운전자 본인에게 <strong>범칙금</strong>이 부과되고 <strong>벌점</strong>이 함께 매겨질 수 있습니다.</p>
    <p>표를 보면 대체로 과태료가 범칙금보다 1만원 정도 비쌉니다. 그럼에도 많은 사람이 과태료를 택하는 이유는 벌점이 붙지 않아 보험료 할증과 면허 정지에서 자유롭기 때문입니다. 벌점은 1년간 40점 이상이면 면허 정지 대상이 됩니다.</p>
    <h2>자진납부 감경</h2>
    <p>과태료는 의견 제출 기한 안에 자진납부하면 질서위반행위규제법에 따라 <strong>20% 감경</strong>을 받을 수 있습니다. 반대로 납부 기한을 넘기면 가산금이 붙습니다. 고지서를 받았다면 기한부터 확인하는 것이 이득입니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>검색창에 <strong>위반유형 키워드</strong>(신호, 속도, 주정차 등)를 넣으면 표가 즉시 걸러집니다.</li>
      <li>카테고리 버튼으로 속도위반·어린이보호구역·주정차 등 묶음별로 볼 수 있습니다.</li>
      <li>위반유형 이름을 누르면 해당 항목의 상세 설명 페이지로 이동합니다.</li>
    </ol>`,
  faq: [
    { q: "과태료와 범칙금 중 무엇을 내야 하나요?", a: "무인 단속으로 고지서를 받았다면 보통 과태료와 범칙금 중 선택할 수 있게 안내됩니다. 과태료는 금액이 조금 더 비싸지만 벌점이 없고, 범칙금은 싸지만 벌점이 부과되어 누적 시 면허 정지로 이어질 수 있습니다." },
    { q: "벌점은 언제 사라지나요?", a: "벌점은 처분 벌점으로 누적 관리되며 1년간 40점 이상이면 면허 정지 대상입니다. 위반 없이 1년이 지나면 소멸하는 등 관리 규정이 있으므로 경찰청 교통민원24에서 본인 누적 상태를 확인하는 것이 정확합니다." },
    { q: "스쿨존은 왜 금액이 두 배인가요?", a: "어린이보호구역에서는 오전 8시부터 오후 8시 사이 위반에 대해 가중 처분이 적용되기 때문입니다. 이 표의 어린이보호구역 항목은 가중된 금액입니다." },
    { q: "이 표의 금액이 제 고지서와 다릅니다.", a: "차종(승합·화물·이륜), 위반 시각, 자진납부 감경, 가산금 여부에 따라 달라집니다. 실제 부과액은 경찰청 교통민원24에서 본인 건으로 확인하세요." },
  ],
  sourceHtml: SRC_LIST([FINE_SOURCES.decree, FINE_SOURCES.rule, FINE_SOURCES.law, FINE_SOURCES.efine].map((s) => ({ label: s.label, url: s.url }))),
  disclaimerHtml: DISC(`실제 부과 내역은 <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24</a>에서 확인하세요.`),
  related: [REL.test, REL.ins, { slug: "car-tax", e: "🧾", n: "자동차세 계산기" }],
});

/* 10 ─ 리스·렌트 vs 구매 ───────────────────────────────── */
TOOLS.push({
  slug: "lease-vs-buy", emoji: "⚖️", nav: "리스·렌트 vs 구매 비교",
  title: "리스·렌트 vs 구매 비교 — 보유 기간 총비용으로 따져보기",
  ogTitle: "리스·렌트 vs 구매 총비용 비교",
  desc: "할부 구매와 리스·렌트를 보유 기간 전체의 총 지출로 비교합니다. 선수금·이자·월 유지비·만기 잔존가치·인수금을 모두 넣어 월 평균 실부담까지 계산하고 산출 과정을 공개합니다.",
  h1: "리스·렌트 vs 구매 비교",
  lead: "월 납입금만 보면 리스가 싸 보입니다. <strong>보유 기간 전체의 총 지출</strong>로 다시 계산해 보세요.",
  bodyHtml: `
  <div class="card">
    <div class="row2">
      <div class="field"><label for="price">차량 가격 <span class="hint">원</span></label><input type="number" id="price" inputmode="numeric" value="40000000" /></div>
      <div class="field"><label for="months">보유 기간 <span class="hint">개월</span></label><input type="number" id="months" inputmode="numeric" value="48" /></div>
    </div>
    <h3>① 할부 구매</h3>
    <div class="row3">
      <div class="field"><label for="down">선수금 <span class="hint">원</span></label><input type="number" id="down" inputmode="numeric" value="10000000" /></div>
      <div class="field"><label for="rate">할부 연이율 <span class="hint">%</span></label><input type="number" id="rate" step="0.01" value="5.9" /></div>
      <div class="field"><label for="resale">만기 매각가 <span class="hint">원</span></label><input type="number" id="resale" inputmode="numeric" value="20000000" /></div>
    </div>
    <div class="field"><label for="ownCost">구매 시 월 유지비 <span class="hint">원/월 · 보험·자동차세·정비</span></label><input type="number" id="ownCost" inputmode="numeric" value="150000" /></div>
    <h3>② 리스 / 장기렌트</h3>
    <div class="row3">
      <div class="field"><label for="lInit">초기비용 <span class="hint">원 · 미반환분</span></label><input type="number" id="lInit" inputmode="numeric" value="4000000" /></div>
      <div class="field"><label for="lMon">월 납입금 <span class="hint">원</span></label><input type="number" id="lMon" inputmode="numeric" value="750000" /></div>
      <div class="field"><label for="lCost">월 유지비 <span class="hint">원/월</span></label><input type="number" id="lCost" inputmode="numeric" value="30000" /></div>
    </div>
    <div class="field"><label for="lBuy">만기 인수금 <span class="hint">원 · 반납하면 0</span></label><input type="number" id="lBuy" inputmode="numeric" value="0" /></div>
    <button class="btn full" id="go" type="button">총비용 비교하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `import { loanSchedule } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
function run() {
  const price = C.num($('price')), months = Math.round(C.num($('months')));
  const down = C.num($('down')), rate = C.num($('rate')) / 100, resale = C.num($('resale')), ownCost = C.num($('ownCost'));
  const lInit = C.num($('lInit')), lMon = C.num($('lMon')), lCost = C.num($('lCost')), lBuy = C.num($('lBuy'));
  if (price <= 0 || months <= 0) { alert('차량 가격과 보유 기간을 입력하세요.'); return; }
  const principal = Math.max(0, price - down);
  const loan = principal > 0 ? loanSchedule({ principal: principal, annualRate: rate, months: months, method: 'equalPayment' }) : { totalPay: 0, totalInterest: 0, firstPay: 0 };
  const buyOut = down + loan.totalPay + ownCost * months;
  const buyNet = buyOut - resale;
  const leaseOut = lInit + (lMon + lCost) * months + lBuy;
  const leaseNet = leaseOut - (lBuy > 0 ? resale : 0);
  const diff = buyNet - leaseNet;
  const win = diff === 0 ? '동일' : diff < 0 ? '할부 구매' : '리스·렌트';
  C.result('out', {
    big: win + (diff === 0 ? '' : '가 ' + C.won(Math.abs(diff)) + ' 유리'),
    sub: months + '개월(' + (months / 12).toFixed(1) + '년) 보유 기준 · 잔존가치 반영 실부담 비교',
    rows: [
      ['① 할부 구매 — 총 지출', C.won(buyOut)],
      ['① 만기 매각가 차감 후 실부담', C.won(buyNet) + ' (월 ' + C.won(buyNet / months) + ')'],
      ['② 리스·렌트 — 총 지출', C.won(leaseOut)],
      ['② 인수·잔존가치 반영 실부담', C.won(leaseNet) + ' (월 ' + C.won(leaseNet / months) + ')'],
      ['차이', C.won(Math.abs(diff)) + ' — ' + win + ' 유리', 'total'],
    ],
    foot: C.steps([
      '할부 원금 = ' + C.won(price) + ' − ' + C.won(down) + ' = ' + C.won(principal) + ', 총이자 ' + C.won(loan.totalInterest) + ' (월납 ' + C.won(loan.firstPay) + ')',
      '① 총 지출 = 선수금 + 할부 총상환 + 월 유지비×개월 = ' + C.won(down) + ' + ' + C.won(loan.totalPay) + ' + ' + C.won(ownCost * months) + ' = ' + C.won(buyOut),
      '① 실부담 = 총 지출 − 만기 매각가 ' + C.won(resale) + ' = ' + C.won(buyNet),
      '② 총 지출 = 초기비용 + (월납+월유지비)×개월 + 인수금 = ' + C.won(lInit) + ' + ' + C.won((lMon + lCost) * months) + ' + ' + C.won(lBuy) + ' = ' + C.won(leaseOut),
      lBuy > 0 ? '② 인수 시 차를 보유하므로 잔존가치 ' + C.won(resale) + ' 차감 → ' + C.won(leaseNet) : '② 반납 시 남는 자산이 없으므로 차감 없음 → ' + C.won(leaseNet),
    ]) + '<p class="src">리스·렌트는 사업자의 비용 처리, 보험료 산정 방식, 중도 해지 위약금, 주행거리 초과 정산 조건이 계약마다 달라 금액만으로 우열을 단정할 수 없습니다. 계약서의 조건을 함께 확인하세요.</p>',
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>월 납입금 비교는 왜 함정인가</h2>
    <p>리스와 렌트의 월 납입금이 할부보다 낮게 느껴지는 이유는 <strong>차값 전부가 아니라 감가된 부분만 나눠 내기 때문</strong>입니다. 대신 만기에 차가 남지 않습니다. 할부 구매는 매달 더 내지만 만기에 <strong>중고차 한 대</strong>가 자산으로 남습니다. 그래서 두 방식은 월 납입금이 아니라 <strong>보유 기간 전체의 실부담(총 지출 − 남은 자산)</strong>으로 비교해야 공평합니다.</p>
    <p>이 계산기는 그 계산을 대신합니다. 할부 쪽에는 선수금·이자·유지비를 더하고 만기 매각가를 빼며, 리스·렌트 쪽에는 초기비용·월 납입금·월 유지비·인수금을 더하고 인수했을 때만 잔존가치를 뺍니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>보유 기간</strong>은 리스·렌트 계약 기간과 맞추면 비교가 정확해집니다(보통 36~60개월).</li>
      <li>구매 쪽 <strong>월 유지비</strong>에는 자동차보험료·자동차세·정비비를 12로 나눠 넣습니다.</li>
      <li>렌트는 보험·정비가 포함된 경우가 많으므로 ② 월 유지비를 낮게 잡습니다.</li>
      <li><strong>만기 매각가</strong>는 중고차 감가 계산기로 대략 추정한 값을 넣어보세요.</li>
    </ol>`,
  faq: [
    { q: "리스와 장기렌트는 무엇이 다른가요?", a: "리스는 차량 등록 명의와 번호판이 일반 자가용과 같고, 장기렌트는 렌터카(하, 허, 호) 번호판을 씁니다. 렌트는 보험과 정비가 요금에 포함되는 상품이 많아 월 유지비가 낮게 잡힙니다." },
    { q: "만기 매각가는 어떻게 정하나요?", a: "정답은 없습니다. 중고차 감가 계산기에서 보유 기간과 예상 주행거리를 넣어 나온 값을 출발점으로 삼고, 실제 매물 시세와 비교해 조정하세요." },
    { q: "사업자면 리스가 유리한가요?", a: "비용 처리 관점에서 유리할 수 있지만 업종·차종·한도 요건이 있어 단정할 수 없습니다. 이 계산기는 세무 효과를 반영하지 않은 현금 흐름 비교입니다. 세무 판단은 전문가와 상담하세요." },
    { q: "중도 해지하면 어떻게 되나요?", a: "리스·렌트는 대개 위약금이 발생하며 잔여 기간에 비례해 커집니다. 보유 기간이 불확실하다면 이 점을 반드시 계약서에서 확인하세요." },
  ],
  sourceHtml: `<h2>계산 기준</h2>
    <p class="src">할부는 원리금균등 표준 산식(월복리)으로 계산합니다. 세금 효과(비용 처리·부가세 환급), 중도 해지 위약금, 주행거리 초과 정산, 보증금 반환 시점의 기회비용은 반영하지 않습니다. 취득세·등록 부대비용은 차량 가격에 포함해 입력하세요. (확인일 ${TODAY})</p>`,
  disclaimerHtml: DISC("계약 조건에 따라 실제 부담은 달라집니다."),
  related: [{ slug: "loan", e: "💳", n: "자동차 할부 계산기" }, { slug: "depreciation", e: "📉", n: "중고차 감가 계산기" }, REL.refi, REL.ins],
});

/* 11 ─ 전기차 vs 내연기관 유지비 ────────────────────────── */
TOOLS.push({
  slug: "ev-vs-ice", emoji: "🔌", nav: "전기차 유지비 비교",
  title: "전기차 vs 내연기관 유지비 비교 — 연간 연료비·세금·정비비 총액",
  ogTitle: "전기차 vs 내연기관 유지비 비교",
  desc: "연간 주행거리를 기준으로 전기차 충전비와 내연기관 연료비, 자동차세, 정비비를 더해 연간·5년 유지비를 비교합니다. 차량 가격 차이를 넣으면 몇 년 만에 회수되는지 손익분기 연수까지 계산합니다.",
  h1: "전기차 유지비 비교",
  lead: "충전비만 싼 게 아니라 <strong>자동차세와 정비비</strong>도 다릅니다. 대신 차값이 비쌉니다. 몇 년 타야 회수될까요?",
  bodyHtml: `
  <div class="card">
    <div class="field"><label for="km">연간 주행거리 <span class="hint">km/년</span></label><input type="number" id="km" inputmode="numeric" value="15000" /></div>
    <h3>🔌 전기차</h3>
    <div class="row3">
      <div class="field"><label for="ev1">전비 <span class="hint">km/kWh</span></label><input type="number" id="ev1" step="0.1" value="5.0" /></div>
      <div class="field"><label for="ev2">충전 단가 <span class="hint">원/kWh</span></label><input type="number" id="ev2" inputmode="numeric" value="320" /></div>
      <div class="field"><label for="ev3">연 정비·보험 <span class="hint">원/년</span></label><input type="number" id="ev3" inputmode="numeric" value="900000" /></div>
    </div>
    <div class="field"><label for="ev4">연 자동차세 <span class="hint">원 · 비영업용 전기차 13만원</span></label><input type="number" id="ev4" inputmode="numeric" value="130000" /></div>
    <h3>⛽ 내연기관</h3>
    <div class="row3">
      <div class="field"><label for="ic1">연비 <span class="hint">km/L</span></label><input type="number" id="ic1" step="0.1" value="12" /></div>
      <div class="field"><label for="ic2">유가 <span class="hint">원/L</span></label><input type="number" id="ic2" inputmode="numeric" value="1700" /></div>
      <div class="field"><label for="ic3">연 정비·보험 <span class="hint">원/년</span></label><input type="number" id="ic3" inputmode="numeric" value="1200000" /></div>
    </div>
    <div class="field"><label for="ic4">연 자동차세 <span class="hint">원 · 자동차세 계산기 참고</span></label><input type="number" id="ic4" inputmode="numeric" value="291200" /></div>
    <div class="field"><label for="gap">차량 가격 차이 <span class="hint">원 · 전기차가 더 비싼 금액(보조금 반영 후)</span></label><input type="number" id="gap" inputmode="numeric" value="5000000" /></div>
    <button class="btn full" id="go" type="button">유지비 비교하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `const $ = (id) => document.getElementById(id);
const C = window.CC;
function run() {
  const km = C.num($('km'));
  const evEff = C.num($('ev1')), evP = C.num($('ev2')), evM = C.num($('ev3')), evT = C.num($('ev4'));
  const icEff = C.num($('ic1')), icP = C.num($('ic2')), icM = C.num($('ic3')), icT = C.num($('ic4'));
  const gap = C.num($('gap'));
  if (km <= 0 || evEff <= 0 || icEff <= 0) { alert('연간 주행거리·전비·연비를 입력하세요.'); return; }
  const evEnergy = km / evEff * evP;
  const icEnergy = km / icEff * icP;
  const evYear = evEnergy + evM + evT;
  const icYear = icEnergy + icM + icT;
  const save = icYear - evYear;
  const be = save > 0 ? gap / save : null;
  C.result('out', {
    big: save >= 0 ? '연 ' + C.won(save) + ' 절약' : '연 ' + C.won(-save) + ' 더 지출',
    sub: C.fmt(km) + 'km/년 기준 · 전기차 ' + C.won(evYear) + ' vs 내연기관 ' + C.won(icYear),
    rows: [
      ['🔌 연료(충전)비', C.won(evEnergy) + ' — ' + (km / evEff).toFixed(0) + 'kWh'],
      ['⛽ 연료비', C.won(icEnergy) + ' — ' + (km / icEff).toFixed(0) + 'L'],
      ['🔌 연간 총 유지비', C.won(evYear) + ' (월 ' + C.won(evYear / 12) + ')'],
      ['⛽ 연간 총 유지비', C.won(icYear) + ' (월 ' + C.won(icYear / 12) + ')'],
      ['5년 누적 차이', C.won(Math.abs(save) * 5) + (save >= 0 ? ' 절약' : ' 추가 지출')],
      ['차값 차이 회수 시점', be == null ? '유지비가 더 들어 회수 불가' : be.toFixed(1) + '년 (' + C.fmt(km * be) + 'km)', 'total'],
    ],
    foot: C.steps([
      '전기차 충전비 = 연 주행 ÷ 전비 × 단가 = ' + C.fmt(km) + ' ÷ ' + evEff + ' × ' + C.fmt(evP) + ' = ' + C.won(evEnergy),
      '내연기관 연료비 = 연 주행 ÷ 연비 × 유가 = ' + C.fmt(km) + ' ÷ ' + icEff + ' × ' + C.fmt(icP) + ' = ' + C.won(icEnergy),
      '연간 총액 = 연료비 + 정비·보험 + 자동차세',
      '1km당 에너지 비용: 전기차 ' + (evP / evEff).toFixed(1) + '원 vs 내연기관 ' + (icP / icEff).toFixed(1) + '원',
      be == null ? '연간 유지비가 전기차 쪽이 더 커서 차값 차이를 회수하지 못합니다.' : '손익분기 = 차값 차이 ' + C.won(gap) + ' ÷ 연 절감액 ' + C.won(save) + ' = ' + be.toFixed(1) + '년',
    ]) + '<p class="src">충전 단가는 완속·급속·가정용에 따라 크게 다릅니다. 배터리 교체 비용, 잔존가치 차이, 보조금·개소세 감면 조건은 반영하지 않았습니다.</p>',
  });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>전기차가 싸다는 말, 어디까지 사실인가</h2>
    <p>에너지 비용만 보면 전기차가 확실히 유리합니다. 전비 5km/kWh에 완속 충전 단가 320원이면 1km당 64원, 연비 12km/L에 휘발유 1,700원이면 1km당 142원으로 두 배 넘게 차이 납니다. 자동차세도 비영업용 전기차는 정액 10만원에 지방교육세를 더해 13만원인 반면, 1,600cc 초과 내연기관은 30만원을 넘기기 쉽습니다.</p>
    <p>대신 <strong>차값이 비쌉니다.</strong> 보조금을 받아도 동급 대비 수백만 원 차이가 나는 경우가 많습니다. 그래서 실제 질문은 "어느 쪽이 싸냐"가 아니라 <strong>"내 주행거리로 몇 년을 타야 차값 차이를 회수하냐"</strong>입니다. 이 계산기는 그 손익분기 연수를 계산합니다. 연 5,000km만 타는 사람과 연 30,000km를 타는 사람의 답은 완전히 다릅니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li><strong>연간 주행거리</strong>를 실제에 가깝게 넣습니다. 이 값이 결과를 가장 크게 좌우합니다.</li>
      <li><strong>충전 단가</strong>는 주로 쓰는 충전 방식에 맞춥니다. 가정용 완속과 고속도로 급속은 단가 차이가 큽니다.</li>
      <li><strong>자동차세</strong>는 자동차세 계산기에서 구한 값을 넣으면 정확합니다.</li>
      <li><strong>차량 가격 차이</strong>에는 보조금을 반영한 실구매가 차이를 넣습니다.</li>
    </ol>`,
  faq: [
    { q: "충전 단가는 얼마로 잡아야 하나요?", a: "가정용 완속, 아파트 공용 충전기, 공공 급속 충전기의 단가가 모두 다르고 시기별로 조정됩니다. 실제 결제 내역의 kWh당 단가를 확인해 넣는 것이 가장 정확합니다. 이 사이트는 외부 API를 쓰지 않으므로 값을 직접 입력합니다." },
    { q: "전기차 정비비가 정말 적나요?", a: "엔진오일·점화플러그·타이밍벨트 같은 항목이 없어 소모품 정비가 줄어드는 것은 사실입니다. 다만 타이어는 차체 중량 때문에 더 빨리 닳는 편이고, 보험료는 차량가가 높아 더 나올 수 있습니다. 기본값은 참고용이니 본인 견적으로 바꿔 넣으세요." },
    { q: "배터리 교체 비용은 반영되나요?", a: "반영하지 않았습니다. 보증 기간과 실제 열화 속도, 교체 단가의 편차가 너무 커서 임의의 값을 넣으면 결과를 왜곡하기 때문입니다. 장기 보유를 전제한다면 이 변수를 별도로 고려하세요." },
    { q: "잔존가치 차이는 왜 빠졌나요?", a: "전기차의 중고 시세는 배터리 상태와 신차 가격 정책 변화에 민감해 예측이 어렵습니다. 이 계산기는 유지비만 다루며, 잔존가치는 중고차 감가 계산기에서 별도로 따져보세요." },
  ],
  sourceHtml: SRC_LIST([
    { label: "지방세법 제127조 (그 밖의 승용자동차 정액 세율)", url: "https://www.law.go.kr/법령/지방세법/제127조" },
    { label: "오피넷 — 실시간 유가 조회", url: PRICE_LOOKUP.url },
  ]),
  disclaimerHtml: DISC("보조금·개소세 감면·배터리 교체·잔존가치는 반영하지 않았습니다."),
  related: [{ slug: "car-tax", e: "🧾", n: "자동차세 계산기" }, { slug: "fuel-cost", e: "🛣️", n: "유류비 계산기" }, REL.ins, REL.refi],
});

/* 12 ─ 여행 기름값 N빵 ─────────────────────────────────── */
TOOLS.push({
  slug: "trip-share", emoji: "🧮", nav: "여행 기름값 N빵",
  title: "여행 기름값 N빵 계산기 — 기름값·톨비·주차비를 인원수로",
  ogTitle: "여행 기름값 N빵 계산기",
  desc: "거리와 연비, 유가, 통행료, 기타 비용을 넣으면 왕복 총액과 1인당 정산 금액을 계산합니다. 운전자 몫을 빼고 나누는 옵션과 정산 문구 복사 기능을 제공합니다.",
  h1: "여행 기름값 N빵 계산기",
  lead: "\"기름값 얼마씩 보내면 돼?\" — <strong>거리·연비·유가·톨비</strong>를 넣으면 1인당 금액과 정산 문구까지 나옵니다.",
  bodyHtml: `
  <div class="card">
    <div class="row2">
      <div class="field"><label for="km">편도 거리 <span class="hint">km</span></label><input type="number" id="km" inputmode="decimal" step="0.1" value="220" /></div>
      <div class="field"><label for="kpl">연비 <span class="hint">km/L</span></label><input type="number" id="kpl" inputmode="decimal" step="0.1" value="11" /></div>
    </div>
    <div class="row2">
      <div class="field"><label for="price">유가 <span class="hint">원/L</span></label><input type="number" id="price" inputmode="numeric" value="1700" /></div>
      <div class="field"><label for="toll">편도 통행료 <span class="hint">원</span></label><input type="number" id="toll" inputmode="numeric" value="11000" /></div>
    </div>
    <div class="row2">
      <div class="field"><label for="etc">기타 비용 <span class="hint">원 · 주차비 등</span></label><input type="number" id="etc" inputmode="numeric" value="10000" /></div>
      <div class="field"><label for="n">인원 <span class="hint">명 (운전자 포함)</span></label><input type="number" id="n" inputmode="numeric" min="1" value="4" /></div>
    </div>
    <div class="field"><label class="chk"><input type="checkbox" id="rt" checked /> 왕복으로 계산</label></div>
    <div class="field"><label class="chk"><input type="checkbox" id="free" /> 운전자는 정산에서 제외 (나머지가 나눠 부담)</label></div>
    <button class="btn full" id="go" type="button">N빵 계산하기</button>
  </div>
  <div class="result" id="out" hidden></div>`,
  script: `import { fuelCost } from "__U__lib/calc.mjs";
const $ = (id) => document.getElementById(id);
const C = window.CC;
let msg = '';
function run() {
  const km = C.num($('km')), kpl = C.num($('kpl')), price = C.num($('price'));
  const toll = C.num($('toll')), etc = C.num($('etc'));
  const n = Math.max(1, Math.round(C.num($('n'))));
  const rt = $('rt').checked, free = $('free').checked;
  if (km <= 0 || kpl <= 0 || price <= 0) { alert('거리·연비·유가를 입력하세요.'); return; }
  const f = fuelCost({ km: km, kmPerL: kpl, pricePerL: price, roundTrip: rt, toll: toll });
  const total = f.total + etc;
  const payers = free ? Math.max(1, n - 1) : n;
  const each = Math.ceil(total / payers / 100) * 100;
  msg = '[여행 정산] ' + (rt ? '왕복 ' : '편도 ') + C.fmt(f.dist) + 'km\\n' +
    '· 기름값 ' + C.won(f.fuel) + ' (' + f.liters.toFixed(1) + 'L × ' + C.fmt(price) + '원)\\n' +
    (f.toll > 0 ? '· 통행료 ' + C.won(f.toll) + '\\n' : '') +
    (etc > 0 ? '· 기타 ' + C.won(etc) + '\\n' : '') +
    '· 합계 ' + C.won(total) + ' ÷ ' + payers + '명 = 1인당 ' + C.won(each) + (free ? ' (운전자 제외)' : '');
  C.result('out', {
    big: C.won(each) + ' / 1인',
    sub: '총 ' + C.won(total) + ' ÷ ' + payers + '명 (100원 단위 올림)',
    rows: [
      ['총 주행거리', C.fmt(f.dist) + ' km'],
      ['기름값', C.won(f.fuel) + ' — ' + f.liters.toFixed(1) + 'L'],
      f.toll > 0 ? ['통행료', C.won(f.toll)] : null,
      etc > 0 ? ['기타 비용', C.won(etc)] : null,
      ['합계', C.won(total)],
      ['1인당 정산액', C.won(each), 'total'],
    ],
    foot: C.steps([
      '기름값 = ' + C.fmt(f.dist) + 'km ÷ ' + kpl + 'km/L × ' + C.fmt(price) + '원 = ' + C.won(f.fuel),
      '합계 = 기름값 + 통행료 + 기타 = ' + C.won(total),
      '1인당 = ' + C.won(total) + ' ÷ ' + payers + '명 = ' + C.won(total / payers) + ' → 100원 단위 올림 ' + C.won(each),
      free ? '운전자를 제외해 ' + payers + '명이 나눠 부담합니다.' : '운전자를 포함한 ' + payers + '명이 균등 부담합니다.',
    ]) + '<div class="btnrow"><button class="btn ghost" id="copy" type="button">정산 문구 복사</button></div>',
  });
  document.getElementById('copy').addEventListener('click', function () { C.copyText(this, msg); });
}
$('go').addEventListener('click', run);`,
  introHtml: `<h2>기름값 정산, 왜 매번 애매한가</h2>
    <p>주유소에서 결제한 금액 전부가 이번 여행에 쓴 기름값은 아닙니다. 가득 채운 기름 중 일부는 다음 주행에 쓰이기 때문입니다. 그래서 정확한 정산은 <strong>이번 여행에서 실제로 소모한 연료량</strong>을 기준으로 해야 합니다. 이 계산기는 주행거리를 연비로 나눠 소모 연료량을 구하고 여기에 유가를 곱하는 방식으로 계산합니다.</p>
    <p>통행료와 주차비까지 합치고 인원수로 나누면 정산액이 나옵니다. 운전자는 차량 감가와 운전 노동을 부담하므로 정산에서 빼는 문화도 흔합니다. 그 경우도 체크박스 하나로 계산됩니다.</p>`,
  howtoHtml: `<h2>사용 방법</h2>
    <ol>
      <li>내비게이션 기준 <strong>편도 거리</strong>를 넣고 왕복 여부를 체크합니다.</li>
      <li><strong>연비</strong>는 실측 평균이 정확합니다. 짐과 인원이 많으면 실제 연비는 조금 떨어집니다.</li>
      <li>통행료·주차비 등을 넣고 인원수를 지정하면 1인당 금액이 100원 단위로 올림되어 나옵니다.</li>
      <li><strong>정산 문구 복사</strong>를 눌러 단체 채팅방에 그대로 붙여넣으세요.</li>
    </ol>`,
  faq: [
    { q: "운전자도 기름값을 내야 하나요?", a: "정해진 규칙은 없습니다. 차량 감가·보험·정비 부담과 운전 노동을 고려해 운전자를 제외하는 경우가 많습니다. 이 계산기는 두 방식 모두 지원하니 미리 합의한 쪽으로 계산하세요." },
    { q: "왜 100원 단위로 올리나요?", a: "10원 단위까지 나누면 송금하기 번거롭기 때문입니다. 올림 처리로 총액보다 조금 더 걷히는 금액은 보통 간식비 등으로 처리합니다." },
    { q: "연비를 모르면 어떻게 하나요?", a: "국산 준중형 가솔린은 대체로 11~13km/L, 중형 SUV는 9~11km/L 근처입니다. 정확한 값은 연비 계산기로 실측 평균을 구해두면 다음부터 편합니다." },
    { q: "전기차 여행도 계산되나요?", a: "연비 자리에 전비(km/kWh), 유가 자리에 충전 단가(원/kWh)를 넣으면 그대로 계산됩니다." },
  ],
  sourceHtml: SRC_LIST([{ label: "오피넷 — 실시간 유가 조회", url: PRICE_LOOKUP.url }, { label: "한국도로공사 통행료 조회", url: "https://www.ex.co.kr" }]),
  disclaimerHtml: DISC("실제 연료 소모는 짐 무게·정체·에어컨 사용에 따라 달라집니다."),
  related: [{ slug: "fuel-cost", e: "🛣️", n: "유류비 계산기" }, REL.yeon, { slug: "fuel-economy", e: "⛽", n: "연비 계산기" }, REL.maint],
});

/* ── 과태료 롱테일 페이지 ───────────────────────────────────── */
const CAT_INTRO = {
  "속도위반": "속도위반은 무인 단속 카메라와 이동식 단속 모두에서 가장 흔하게 적발되는 위반입니다. 초과 속도 구간이 올라갈수록 금액과 벌점이 계단식으로 뛰기 때문에, 20km/h를 넘는 순간부터 부담이 크게 달라집니다.",
  "어린이보호구역": "어린이보호구역(스쿨존)에서는 오전 8시부터 오후 8시 사이의 위반에 대해 일반 도로보다 가중된 처분이 적용됩니다. 같은 행위라도 금액과 벌점이 두 배 수준으로 올라갑니다.",
  "신호·지시": "신호기와 안전표지의 지시를 따르지 않은 경우입니다. 교차로 사고와 직결되는 항목이라 벌점이 함께 부과되는 경우가 많습니다.",
  "주정차": "주정차 위반은 대부분 무인 단속이나 주민 신고로 적발되어 차량 소유주에게 과태료가 부과됩니다. 운전자를 특정하지 않으므로 벌점은 없습니다.",
  "운전 중 주의분산": "운전 중 휴대전화 사용과 영상 시청은 현장 단속 대상이며 범칙금과 벌점이 함께 부과됩니다. 전방 주시 태만은 사고 위험을 직접적으로 높입니다.",
  "안전띠": "안전띠와 유아 보호장구는 사고 시 생존율을 좌우하는 항목입니다. 동승자 미착용은 운전자에게 책임이 돌아갑니다.",
  "차로·통행": "지정차로·전용차로·갓길 등 통행 방법 위반입니다. 고속도로에서 적발되면 일반 도로보다 처분이 무겁습니다.",
  "안전운전": "안전거리 확보, 등화 점등, 방향지시등 사용처럼 기본 운전 수칙에 해당하는 항목입니다. 금액은 크지 않지만 사고 시 과실 비율에 영향을 줍니다.",
  "보행자 보호": "횡단보도와 어린이통학버스 관련 규정은 보행자·어린이 안전과 직결되어 처분이 강화되어 왔습니다.",
  "형사처벌": "이 항목은 과태료나 범칙금으로 끝나지 않고 형사처벌 대상입니다. 벌금·징역과 함께 면허 정지 또는 취소가 따릅니다.",
};

function finePage(f) {
  const sameCat = FINES.filter((x) => x.cat === f.cat && x.slug !== f.slug).slice(0, 8);
  const nums = [
    { l: "과태료 (무인단속)", v: f.fine == null ? "해당 없음" : won(f.fine), na: f.fine == null },
    { l: "범칙금 (현장단속)", v: f.penalty == null ? "해당 없음" : won(f.penalty), na: f.penalty == null },
    { l: "벌점", v: f.points == null ? "없음" : f.points + "점", na: f.points == null || f.points === 0 },
  ];
  const early = f.fine != null ? Math.floor(f.fine * 0.8) : null;
  const desc = f.criminal
    ? `${f.name}은 과태료·범칙금이 아니라 형사처벌 대상입니다. 도로교통법상 처벌 근거와 면허 정지·취소 기준, 흔한 오해를 정리했습니다.`
    : `${f.name}의 과태료는 ${f.fine == null ? "부과 대상 아님" : won(f.fine)}, 범칙금은 ${f.penalty == null ? "부과 대상 아님" : won(f.penalty)}, 벌점은 ${f.points == null ? "없음" : f.points + "점"}입니다(승용차 기준). 과태료와 범칙금 중 무엇을 내야 하는지, 자진납부 감경은 얼마인지 정리했습니다.`;

  const faq = [];
  if (f.criminal) {
    faq.push({ q: `${f.name}은 벌금이 얼마인가요?`, a: `${f.name}은 범칙금 통고 대상이 아니라 형사처벌 대상이므로 정액표가 없습니다. ${f.note || ""} 구체적인 처벌 수위는 사안과 전력에 따라 법원이 정합니다.`.trim() });
    faq.push({ q: `${f.name}으로 면허는 어떻게 되나요?`, a: `${f.name}은 면허 정지 또는 취소 처분이 따르는 사안입니다. 처분 기준과 본인 상태는 경찰청 교통민원24(efine.go.kr)에서 확인하고, 법률적 판단이 필요하면 전문가와 상담하세요.` });
  } else {
    faq.push({
      q: `${f.name} 과태료는 얼마인가요?`,
      a: f.fine == null
        ? `${f.name}은 무인 단속 과태료 부과 대상이 아니며 현장 단속 시 범칙금 ${won(f.penalty)}이 부과됩니다(승용차 기준).`
        : `승용차 기준 과태료 ${won(f.fine)}입니다. 의견 제출 기한 안에 자진납부하면 20% 감경되어 ${won(early)}이 됩니다.`,
    });
    faq.push({
      q: `${f.name}에 벌점이 붙나요?`,
      a: f.points == null
        ? `무인 단속에 따른 과태료 처분에는 벌점이 없습니다. 현장에서 운전자가 특정되어 범칙금이 부과되는 경우에만 벌점이 문제가 됩니다.`
        : f.points === 0
          ? `이 위반은 범칙금은 있으나 벌점은 부과되지 않습니다(승용차 기준).`
          : `현장 단속으로 범칙금 ${won(f.penalty)}이 부과되는 경우 벌점 ${f.points}점이 함께 부과됩니다. 1년간 누적 40점 이상이면 면허 정지 대상입니다.`,
    });
    faq.push({
      q: `${f.name}은 과태료와 범칙금 중 어느 쪽이 유리한가요?`,
      a: f.fine != null && f.penalty != null
        ? `과태료 ${won(f.fine)}은 범칙금 ${won(f.penalty)}보다 ${won(f.fine - f.penalty)} 비싸지만 벌점이 없습니다. 벌점 ${f.points || 0}점이 누적에 부담이 된다면 과태료 납부가 일반적으로 선택됩니다.`
        : f.fine != null
          ? `이 항목은 과태료만 부과되며 선택의 여지가 없습니다. 자진납부 기한 안에 납부해 20% 감경을 받는 편이 이득입니다.`
          : `이 항목은 현장 단속 범칙금만 부과되며 무인 단속 과태료 대상이 아닙니다.`,
    });
  }

  return {
    path: `fine/${f.slug}/`, emoji: "🚨", ad: true,
    title: f.criminal ? `${f.name} — 처벌 기준과 면허 처분 정리` : `${f.name} 과태료·범칙금·벌점은 얼마인가`,
    ogTitle: `${f.name} — 과태료·범칙금·벌점`,
    desc: desc,
    h1: f.name,
    appName: `${f.name} 과태료 조회`,
    lead: f.criminal ? `<strong>${esc(f.cat)}</strong> — 과태료·범칙금이 아닌 형사처벌 대상입니다.` : `<strong>${esc(f.cat)}</strong> · 승용차 기준 과태료·범칙금·벌점`,
    crumbs: [
      { name: "과태료·범칙금", rel: "fine/", item: `${SITE_ORIGIN}/fine/` },
      { name: f.name, rel: `fine/${f.slug}/`, item: `${SITE_ORIGIN}/fine/${f.slug}/` },
    ],
    bodyHtml: `
  <div class="fine-nums">
    ${nums.map((n) => `<div class="fine-num"><p class="l">${n.l}</p><p class="v${n.na ? " na" : ""}">${n.v}</p></div>`).join("\n    ")}
  </div>
  ${f.note ? `<p class="notice">${esc(f.note)}</p>` : ""}
  ${early != null ? `<div class="result" id="out"><p class="big">${won(early)}</p><p class="sub">의견 제출 기한 내 자진납부 시 (과태료 ${won(f.fine)}의 20% 감경)</p>
    <table class="kv"><tbody>
      <tr><th>과태료 (무인단속)</th><td>${won(f.fine)}</td></tr>
      <tr><th>자진납부 감경 20%</th><td>-${won(f.fine - early)}</td></tr>
      <tr><th>범칙금 (현장단속)</th><td>${f.penalty == null ? "해당 없음" : won(f.penalty)}</td></tr>
      <tr><th>벌점</th><td>${f.points == null ? "없음" : f.points + "점"}</td></tr>
      <tr class="total"><th>자진납부 시 납부액</th><td>${won(early)}</td></tr>
    </tbody></table></div>` : ""}
  <p class="src"><a href="__U__fine-table/">← 전체 위반유형 조회표로 돌아가기</a></p>`,
    script: `window.CC.showAd();`,
    introHtml: `<h2>${esc(f.name)} — 어떤 위반인가</h2>
    <p>${esc(CAT_INTRO[f.cat] || "도로교통법상 위반 항목입니다.")}</p>
    <p>${f.criminal
      ? `<strong>${esc(f.name)}</strong>은 범칙금 통고처분으로 끝나는 사안이 아니라 형사처벌 대상입니다. 정액 금액표가 존재하지 않으며, 사안에 따라 벌금·징역과 면허 정지·취소가 함께 따릅니다.`
      : `<strong>${esc(f.name)}</strong>의 승용차 기준 처분은 과태료 ${f.fine == null ? "없음(무인 단속 대상 아님)" : won(f.fine)}, 범칙금 ${f.penalty == null ? "없음(현장 단속 통고 대상 아님)" : won(f.penalty)}, 벌점 ${f.points == null ? "없음" : f.points + "점"}입니다. 승합·화물·이륜차는 금액이 다릅니다.`}</p>
    <h2>과태료가 붙을 때와 범칙금이 붙을 때</h2>
    <p>무인 단속 카메라나 신고로 적발되면 운전자를 특정할 수 없으므로 <strong>차량 소유주에게 과태료</strong>가 부과되고 벌점은 없습니다. 경찰관이 현장에서 운전자를 확인해 단속하면 <strong>운전자에게 범칙금</strong>이 부과되며 벌점이 함께 매겨질 수 있습니다. 같은 행위라도 적발 방식에 따라 결과가 달라지는 이유입니다.</p>`,
    howtoHtml: `<h2>고지서를 받았다면</h2>
    <ol>
      <li><a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24(이파인)</a>에서 본인 명의 단속 내역과 부과액을 확인합니다.</li>
      <li>고지서의 <strong>의견 제출 기한</strong>을 확인합니다. 기한 내 자진납부하면 과태료가 20% 감경됩니다.</li>
      <li>위반 사실에 다툼이 있으면 기한 안에 의견을 제출할 수 있습니다.</li>
      <li>기한을 넘기면 가산금이 붙고 체납 시 차량 압류 등으로 이어질 수 있습니다.</li>
    </ol>
    ${sameCat.length ? `<h2>같은 분류의 다른 위반유형</h2>
    <div class="catlist"><ul>
      ${sameCat.map((x) => `<li><a href="__U__fine/${x.slug}/">${esc(x.name)}</a> — 과태료 ${x.fine == null ? "-" : won(x.fine)} / 범칙금 ${x.penalty == null ? "-" : won(x.penalty)} / 벌점 ${x.points == null ? "-" : x.points + "점"}</li>`).join("\n      ")}
    </ul></div>` : ""}`,
    faq: faq,
    sourceHtml: SRC_LIST([FINE_SOURCES.decree, FINE_SOURCES.rule, FINE_SOURCES.efine].map((s) => ({ label: s.label, url: s.url }))),
    disclaimerHtml: DISC(`승용차 기준 참고용이며 차종·시간대·적발 방식에 따라 달라집니다. 실제 부과 내역은 <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24</a>에서 확인하세요.`),
    related: [{ slug: "fine-table", e: "🚨", n: "과태료·범칙금 전체 조회표" }, REL.test, REL.ins],
  };
}

function fineIndexPage() {
  const byCat = FINE_CATS.map((c) => {
    const list = FINES.filter((f) => f.cat === c);
    return `<h3>${esc(c)}</h3>
      <ul>
        ${list.map((f) => `<li><a href="__U__fine/${f.slug}/">${esc(f.name)}</a> — 과태료 ${f.fine == null ? "-" : won(f.fine)} / 범칙금 ${f.penalty == null ? "-" : won(f.penalty)} / 벌점 ${f.points == null ? "-" : f.points + "점"}</li>`).join("\n        ")}
      </ul>`;
  }).join("\n      ");
  return {
    path: "fine/", emoji: "📋",
    title: `위반유형별 과태료·범칙금 목록 — ${FINE_CATS.length}개 분류 ${FINES.length}종`,
    ogTitle: "위반유형별 과태료·범칙금 목록",
    desc: `속도위반부터 주정차·안전띠·차로 통행까지 ${FINE_CATS.length}개 분류 ${FINES.length}종의 위반유형별 과태료·범칙금·벌점을 목록으로 정리했습니다. 항목마다 상세 설명 페이지로 연결됩니다.`,
    h1: "위반유형별 과태료·범칙금 목록",
    appName: "위반유형별 과태료 목록",
    lead: `${FINE_CATS.length}개 분류 <strong>${FINES.length}종</strong>의 위반유형을 분류별로 정리했습니다.`,
    crumbs: [{ name: "과태료·범칙금", rel: "fine/", item: `${SITE_ORIGIN}/fine/` }],
    bodyHtml: `
  <p class="notice">승용차 기준 참고용입니다. 검색·필터로 찾으려면 <a href="__U__fine-table/">과태료·범칙금 조회표</a>를 이용하세요.</p>
  <section class="catlist">
      ${byCat}
  </section>`,
    script: `window.CC.showAd();`,
    introHtml: `<h2>분류별로 훑어보기</h2>
    <p>위반유형은 크게 속도, 신호·지시, 주정차, 차로 통행, 안전운전, 보행자 보호로 나뉩니다. 어린이보호구역은 같은 행위라도 가중 처분이 적용되어 별도 분류로 두었습니다. 각 항목을 누르면 과태료와 범칙금의 차이, 자진납부 감경 금액, 벌점 누적 영향까지 정리한 상세 페이지로 이동합니다.</p>`,
    howtoHtml: `<h2>이 목록을 쓰는 법</h2>
    <ul>
      <li>고지서에 적힌 위반 내용과 가장 가까운 항목을 찾습니다.</li>
      <li>금액이 다르다면 차종(승합·화물·이륜) 또는 시간대(어린이보호구역) 차이일 수 있습니다.</li>
      <li>실제 부과 내역은 반드시 <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24</a>에서 확인하세요.</li>
    </ul>`,
    faq: [
      { q: "이 목록은 어떤 차종 기준인가요?", a: "승용차 기준입니다. 승합차·화물차·이륜차는 같은 위반이라도 금액이 다르게 정해져 있습니다." },
      { q: "금액이 바뀌기도 하나요?", a: "도로교통법 시행령 별표가 개정되면 바뀝니다. 이 목록은 데이터 확인일 기준이며, 최신 부과액은 경찰청 교통민원24에서 확인하는 것이 정확합니다." },
      { q: "벌점이 '-'로 표시된 항목은 무엇인가요?", a: "무인 단속 과태료만 부과되어 벌점 개념이 적용되지 않거나, 형사처벌 대상이라 벌점표로 다루지 않는 항목입니다." },
    ],
    sourceHtml: SRC_LIST([FINE_SOURCES.decree, FINE_SOURCES.rule, FINE_SOURCES.efine].map((s) => ({ label: s.label, url: s.url }))),
    disclaimerHtml: DISC(`실제 부과 내역은 <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24</a>에서 확인하세요.`),
    related: [{ slug: "fine-table", e: "🚨", n: "과태료·범칙금 조회표" }, REL.test, REL.ins],
  };
}

/* ── 허브 · 정책 페이지 ─────────────────────────────────────── */
function hubPage() {
  const cards = TOOL_META.map((t) => `<a class="tool-card" href="${t.slug}/"><p class="t"><span class="e">${t.emoji}</span>${esc(t.name)}</p><p class="d">${esc(t.desc)}</p></a>`).join("\n    ");
  return {
    path: "", emoji: "🚗", ad: false,
    title: `${SITE_NAME} | 자동차세·연비·할부·과태료 계산기 ${TOOL_META.length}종`,
    ogTitle: SITE_NAME,
    desc: `자동차 생활에 필요한 계산기 ${TOOL_META.length}종 무료 모음. 자동차세·취득세·연비·유류비·할부 스케줄·타이어 규격·소모품 교체 주기·과태료 범칙금 조회까지 회원가입 없이 바로 사용하고, 모든 계산의 산출 과정을 공개합니다.`,
    h1: SITE_NAME,
    appName: SITE_NAME,
    lead: `자동차세부터 연비·할부·과태료까지. 차 살 때, 탈 때, 팔 때 필요한 계산기 <strong>${TOOL_META.length}종</strong>을 한곳에. 회원가입 없음, 서버 전송 없음, <strong>산출 과정 공개</strong>.`,
    crumbs: [],
    bodyHtml: `
  <nav class="tool-grid" aria-label="자동차 계산기 목록">
    ${cards}
    <a class="tool-card" href="fine/"><p class="t"><span class="e">📋</span>위반유형별 과태료 목록</p><p class="d">${FINES.length}종 위반유형의 과태료·범칙금·벌점 상세 페이지 모음</p></a>
  </nav>`,
    introHtml: `<h2>카캘크는 이런 도구입니다</h2>
    <p>자동차와 관련된 돈 계산은 은근히 자주 필요합니다. 1월이면 자동차세 연납 할인이 궁금하고, 차를 바꿀 때는 취득세와 할부 월납입금을 따져야 하고, 장거리 여행 뒤에는 기름값을 나눠야 합니다. 카캘크는 이런 순간마다 검색하게 되는 계산기들을 한 사이트에 모아, 광고로 뒤덮인 페이지를 헤매지 않고 바로 답을 얻도록 만든 무료 도구 모음입니다.</p>
    <p>다른 계산기와 다른 점은 <strong>결과 숫자 하나로 끝내지 않는다</strong>는 것입니다. 모든 계산기가 "산출 과정" 블록에 cc × 세율 → 차령 경감 → 지방교육세 → 연납 공제처럼 단계별 계산을 그대로 펼쳐 보여줍니다. 고지서와 나란히 놓고 어디에서 차이가 나는지 대조할 수 있습니다.</p>
    <p>또 하나의 원칙은 <strong>모르는 값은 지어내지 않는다</strong>는 것입니다. 승합·화물차 세율표나 유류세 탄력세율처럼 확인이 끝나지 않았거나 수시로 바뀌는 값은 임의의 기본값을 넣는 대신 "확인 필요" 표시와 직접 입력란, 공식 확인처 링크를 제공합니다.</p>
    <p>모든 계산은 브라우저 안에서만 이루어집니다. 입력한 차량 정보나 금액이 서버로 전송되지 않고, 연비·소모품 기록도 내 브라우저(localStorage)에만 저장됩니다. 세율·과태료 같은 수치는 지방세법·도로교통법 등 법령 출처와 확인 일자를 각 페이지에 명시했습니다.</p>`,
    howtoHtml: `<h2>이런 질문에 답합니다</h2>
    <ul>
      <li>내 차 자동차세는 얼마이고, 1월에 연납하면 얼마나 깎이나?</li>
      <li>1,600cc를 1cc 넘기면 세금이 얼마나 뛰나?</li>
      <li>3,000만원짜리 차를 사면 취득세는 얼마인가?</li>
      <li>선수금 1,000만원에 60개월 할부면 월 얼마이고 이자는 총 얼마인가?</li>
      <li>이번 주유 실연비는? 지난 1년 평균은 어떻게 변했나?</li>
      <li>서울에서 부산까지 왕복하면 기름값과 톨비는 얼마이고 4명이면 1인당 얼마인가?</li>
      <li>205/55R16을 225/45R17로 바꾸면 지름 오차가 몇 %인가?</li>
      <li>엔진오일 다음 교체까지 몇 km 남았나?</li>
      <li>신호위반 과태료는 얼마이고 범칙금과 무엇이 다른가?</li>
      <li>전기차로 바꾸면 몇 년 만에 차값 차이를 회수하나?</li>
      <li>리스가 정말 싼가, 할부로 사서 되파는 게 나은가?</li>
      <li>3년 탄 내 차의 대략적인 잔존가치는?</li>
    </ul>`,
    faq: [
      { q: "카캘크는 무료인가요?", a: "네. 모든 계산기는 회원가입·설치 없이 무료로 사용할 수 있습니다. 입력값은 서버로 전송되지 않고 브라우저 안에서만 계산됩니다." },
      { q: "세금 계산 결과를 그대로 신고·납부에 써도 되나요?", a: "아니요. 자동차세·취득세 계산기는 지방세법 세율을 기준으로 한 참고용 추정치입니다. 실제 세액은 위택스(wetax.go.kr)나 관할 지자체에서 확인해야 합니다." },
      { q: "기록형 도구의 데이터는 어디에 저장되나요?", a: "연비 기록과 소모품 교체 기록은 사용 중인 브라우저의 localStorage에만 저장됩니다. 서버 저장이 없어 기기·브라우저를 바꾸면 보이지 않으며, CSV로 내보내 백업할 수 있습니다." },
      { q: "계산 결과가 실제 고지서와 다를 수 있나요?", a: "있습니다. 10원 미만 절사 처리나 지자체별 감면 등으로 차이가 날 수 있고, 법 개정이 반영되기 전일 수도 있습니다. 세금은 위택스·지자체에서, 과태료는 경찰청 교통민원24에서 최종 확인하세요." },
      { q: "모바일에서도 되나요?", a: "네. 모든 도구는 모바일 우선으로 설계되어 스마트폰 브라우저에서 그대로 동작합니다." },
      { q: "데이터 출처는 어떻게 되나요?", a: "자동차세·취득세는 지방세법, 과태료·범칙금은 도로교통법 시행령, 소모품 주기는 제조사 일반 권고를 참고했으며 각 페이지 하단에 출처 링크와 확인 일자를 표기합니다." },
    ],
    sourceHtml: SRC_LIST([
      { label: "지방세법 (자동차세·취득세)", url: "https://www.law.go.kr/법령/지방세법" },
      { label: "도로교통법 시행령 (과태료·범칙금)", url: "https://www.law.go.kr/법령/도로교통법시행령" },
      { label: "위택스", url: WETAX },
      { label: "경찰청 교통민원24", url: EFINE },
    ]),
    disclaimerHtml: `<p class="disclaimer">본 사이트의 모든 계산 결과는 참고용입니다. 세금·과태료 등 실제 금액은 위택스, 경찰청 교통민원24 등 공식 채널에서 확인하세요.</p>`,
    related: [REL.maint, REL.ins, REL.refi, REL.yeon, REL.test],
  };
}

const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ad: false, app: false, about: false,
    title: "개인정보처리방침 — 카캘크 자동차 계산기 허브",
    desc: "카캘크는 개인정보를 수집하지 않습니다. 모든 계산은 브라우저에서 처리되며, 기록형 도구의 localStorage 사용과 광고 쿠키에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    crumbs: [{ name: "개인정보처리방침", rel: "privacy.html", item: `${SITE_ORIGIN}/privacy.html` }],
    bodyHtml: `
  <section class="about" style="margin-top:8px">
    <h2>1. 수집하는 개인정보</h2>
    <p>본 사이트는 회원가입 절차가 없으며 이름·연락처·이메일·주민등록번호·차량번호 등 개인을 식별할 수 있는 정보를 일절 수집하지 않습니다. 계산기에 입력하는 배기량·차량가액·주행거리 등의 값은 브라우저 안에서만 처리되며 서버로 전송되거나 저장되지 않습니다.</p>
    <h2>2. 로컬 저장소(localStorage) 이용</h2>
    <p>연비 계산기와 소모품 교체 주기 기록은 사용자가 직접 저장을 누른 경우에 한해 입력값을 브라우저의 localStorage에 보관합니다. 이 데이터는 사용자의 기기 안에만 존재하며 서버로 전송되지 않습니다. 각 도구의 "전체 삭제" 버튼이나 브라우저 설정에서 언제든 삭제할 수 있고, CSV로 내보내 백업할 수 있습니다. 화면 테마 설정도 같은 방식으로 저장됩니다.</p>
    <h2>3. 쿠키와 광고</h2>
    <p>본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다.</p>
    <h2>4. 접속 분석</h2>
    <p>호스팅 사업자가 제공하는 기본적인 접속 통계(방문 수, 페이지 조회 수 등)가 집계될 수 있으며, 이는 개인을 식별하지 않는 형태입니다.</p>
    <h2>5. 문의</h2>
    <p>개인정보 관련 문의는 <a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a>을 통해 연락하실 수 있습니다.</p>
    <p class="src">시행일: ${TODAY}</p>
  </section>`,
  },
  {
    path: "terms.html", emoji: "📜", ad: false, app: false, about: false,
    title: "이용약관 — 카캘크 자동차 계산기 허브",
    desc: "카캘크가 제공하는 자동차세·취득세·과태료 등 계산 결과의 성격과 책임 범위, 데이터 갱신과 저작권에 관한 안내입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 추정치입니다.",
    crumbs: [{ name: "이용약관", rel: "terms.html", item: `${SITE_ORIGIN}/terms.html` }],
    bodyHtml: `
  <section class="about" style="margin-top:8px">
    <h2>1. 서비스의 성격</h2>
    <p>본 사이트는 공개된 법령·기준과 이용자가 입력한 값에 근거해 자동차 관련 금액을 계산해 주는 무료 도구입니다. 계산 결과는 <strong>참고용 추정치</strong>이며 실제 부과·청구 금액을 확정하거나 보증하지 않습니다. 특히 세금·과태료·중고차 시세에 관한 결과는 법적·재무적 확정 판단이 아닙니다.</p>
    <h2>2. 데이터의 갱신</h2>
    <p>자동차세·취득세 세율은 지방세법, 과태료·범칙금은 도로교통법 시행령을 기준으로 하며 데이터 확인일은 ${TODAY}입니다. 법령 개정으로 값이 달라질 수 있으므로 최신 금액은 <a href="${WETAX}" target="_blank" rel="noopener">위택스</a>, <a href="${EFINE}" target="_blank" rel="noopener">경찰청 교통민원24</a> 등 공식 채널에서 확인하시기 바랍니다. 확인이 끝나지 않은 항목은 "확인 필요" 표시와 함께 직접 입력하도록 하고 있습니다.</p>
    <h2>3. 책임의 한계</h2>
    <p>이용자가 본 사이트의 계산 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다. 세금 납부, 차량 구매·매각, 정비 시점 결정 등 중요한 판단은 반드시 관계 기관과 전문가의 확인을 거치시기 바랍니다.</p>
    <h2>4. 기록형 도구의 데이터</h2>
    <p>연비 기록과 정비 기록은 이용자의 브라우저에만 저장되며 운영자는 이를 백업하거나 복구할 수 없습니다. 브라우저 데이터 삭제, 시크릿 모드 종료, 기기 변경으로 데이터가 사라질 수 있으므로 CSV 내보내기로 직접 백업하시기 바랍니다.</p>
    <h2>5. 저작권</h2>
    <p>본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 법령·공공 데이터의 권리는 각 기관에 있습니다.</p>
    <h2>6. 광고</h2>
    <p>본 사이트는 Google AdSense 광고를 게재하며, 광고 내용에 대한 책임은 광고주에게 있습니다. 광고는 계산 결과가 표시된 이후 결과 하단에만 노출됩니다.</p>
    <p class="src">시행일: ${TODAY}</p>
  </section>`,
  },
];

/* ── 페이지 조립 ────────────────────────────────────────────── */
const pages = [];
pages.push(hubPage());
for (const t of TOOLS) {
  pages.push({
    path: `${t.slug}/`, emoji: t.emoji, title: t.title, ogTitle: t.ogTitle, desc: t.desc,
    h1: t.h1, appName: t.nav, lead: t.lead,
    crumbs: [{ name: t.nav, rel: `${t.slug}/`, item: `${SITE_ORIGIN}/${t.slug}/` }],
    bodyHtml: t.bodyHtml, introHtml: t.introHtml, howtoHtml: t.howtoHtml, faq: t.faq,
    sourceHtml: t.sourceHtml, disclaimerHtml: t.disclaimerHtml,
    script: t.script, related: t.related,
  });
}
pages.push(fineIndexPage());
for (const f of FINES) pages.push(finePage(f));
for (const p of POLICY) pages.push(p);

/* ── 쓰기 ───────────────────────────────────────────────────── */
let written = 0;
for (const p of pages) {
  const file = join(ROOT, p.path === "" ? "index.html" : p.path.endsWith("/") ? p.path + "index.html" : p.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(p), "utf8");
  written++;
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => {
  const loc = SITE_ORIGIN + "/" + p.path;
  const pr = p.path === "" ? "1.0"
    : p.path.startsWith("fine/") && p.path !== "fine/" ? "0.5"
    : p.path.endsWith(".html") ? "0.3" : "0.8";
  return `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${pr}</priority></url>`;
}).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap, "utf8");

writeFileSync(join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, "utf8");

const known = new Set(pages.filter((p) => p.path.endsWith("/") && p.path).map((p) => p.path.split("/")[0]));
const RESERVED = new Set(["assets", "data", "lib", "tests", "node_modules"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

console.log(`생성 완료: HTML ${written}개 (허브 1 · 도구 ${TOOLS.length} · 과태료 목록 1 · 과태료 롱테일 ${FINES.length} · 정책 ${POLICY.length})`);
console.log(`sitemap.xml: ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
