// housecalc-kr 정적 페이지 생성기 (Node 내장만 사용, 의존성 0)
// 실행: node housecalc-kr/gen.mjs
// 생성물: index.html, <tool>/index.html × 12, privacy.html, terms.html, robots.txt, sitemap.xml
import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acquisition } from "./data/acquisition.mjs";
import { brokerFee } from "./data/brokerfee.mjs";
import { loanRules } from "./data/loan.mjs";
import { registration } from "./data/registration.mjs";
import { subscription } from "./data/subscription.mjs";
import { jeonseInsurance } from "./data/insurance.mjs";
import { holding } from "./data/holding.mjs";

const SITE_ORIGIN = "https://housecalc-kr.vercel.app";
const SITE_NAME = "부동산 계산기 허브";
const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 본가(TomatoEggCat) 크로스링크 ─────────────────────────── */
const T = {
  dsr:      { url: "https://tomatoeggcat.com/dsr/", e: "📉", n: "DSR 계산기 (TomatoEggCat)" },
  dsrLimit: { url: "https://tomatoeggcat.com/dsr-limit-check/", e: "🚦", n: "DSR 한도 점검 (TomatoEggCat)" },
  jeonse:   { url: "https://tomatoeggcat.com/jeonse-loan/", e: "🏦", n: "전세자금대출 계산기 (TomatoEggCat)" },
  yangdo:   { url: "https://tomatoeggcat.com/yangdo/", e: "🧾", n: "양도소득세 계산기 (TomatoEggCat)" },
  refi:     { url: "https://tomatoeggcat.com/refinance/", e: "🔁", n: "대출 갈아타기 (TomatoEggCat)" },
  cheongyak:{ url: "https://tomatoeggcat.com/cheongyak-score-calc/", e: "🎯", n: "청약 가점 계산기 (TomatoEggCat)" },
  loanRefi: { url: "https://tomatoeggcat.com/loan-refi-calc/", e: "💱", n: "대출 갈아타기 비교 (TomatoEggCat)" },
  convert:  { url: "https://tomatoeggcat.com/jeonse-monthly-convert/", e: "🔄", n: "전월세 전환 계산기 (TomatoEggCat)" },
  capital:  { url: "https://tomatoeggcat.com/capital-gains-tax/", e: "📊", n: "양도세 시뮬레이터 (TomatoEggCat)" },
};

/* ── 모든 페이지 상단 고정 고지 (문구 변경 금지: 배포 게이트가 검사) ── */
const NOTICE = `<p class="topnotice"><strong>고지</strong> — 이 사이트의 모든 계산은 <strong>참고용 추정이며 실제 세액·한도는 위택스·국세청·금융기관에서 확인</strong>해야 합니다.
  세율·한도·요율은 법령 개정과 정책 변경으로 수시로 바뀌며, 개별 사정(감면·특례·심사 기준)에 따라 결과가 달라집니다.
  <a href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스</a> ·
  <a href="https://www.hometax.go.kr" target="_blank" rel="noopener">홈택스</a> ·
  <a href="https://www.iros.go.kr" target="_blank" rel="noopener">인터넷등기소</a></p>`;

/* ── 데이터 출처 표 ────────────────────────────────────────── */
function srcTable(entries) {
  const rows = entries.map(([label, d, memo]) => {
    const v = typeof d.value === "object" ? "표/구간 데이터" : String(d.value);
    return `<tr><td>${esc(label)}${d.todo ? ' <span class="badge warn">확인 필요</span>' : ""}</td>` +
      `<td>${esc(memo || v)}</td>` +
      `<td><a href="${d.source}" target="_blank" rel="noopener">근거 보기</a></td>` +
      `<td>${d.checkedAt}</td></tr>`;
  }).join("\n        ");
  const todos = entries.filter(([, d]) => d.todo).map(([label, d]) => `<li><strong>${esc(label)}</strong> — ${esc(d.todoNote || "최신 개정 확인 필요")}</li>`).join("\n        ");
  return `<h2>계산에 쓰인 값과 출처</h2>
    <div class="tbwrap"><table class="tb">
      <thead><tr><th>항목</th><th>값</th><th>근거</th><th>확인일</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table></div>` +
    (todos ? `\n    <div class="note warn"><strong>확인 필요 항목</strong> — 아래 값은 개정·변동 가능성이 있어 이 사이트가 임의로 확정하지 않습니다. 계산에서 제외하거나 직접 입력하도록 했습니다.
      <ul>
        ${todos}
      </ul>
    </div>` : "");
}

/* ── 공통 HTML 셸 ─────────────────────────────────────────── */
function shell(p) {
  const path = p.path; // "" | "acquisition-tax/" | "privacy.html"
  const depth = path.endsWith("/") ? path.split("/").filter(Boolean).length : 0;
  const U = "../".repeat(depth);
  const HOME = U || "./";
  const canonical = SITE_ORIGIN + "/" + path;

  const graph = [
    {
      "@type": "SoftwareApplication", name: p.appName || p.h1, description: p.desc,
      applicationCategory: "FinanceApplication", operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" }, url: canonical,
    },
    {
      "@type": "FAQPage",
      mainEntity: (p.faq || []).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "홈", item: SITE_ORIGIN + "/" }].concat(p.crumbs || [])
        .map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
    },
  ];

  const crumbNav = `<nav class="crumb" aria-label="breadcrumb"><a href="${HOME}">🏠 ${SITE_NAME}</a>` +
    (p.crumbs || []).map((c) => ` <span class="sep">›</span> <span>${esc(c.name)}</span>`).join("") + `</nav>`;

  const adHead = p.ad === false ? "" :
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>`;
  const ad = p.ad === false ? "" : `
  <div class="adbox" id="adbox" hidden>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </div>`;

  const faqHtml = (p.faq || []).map((f) =>
    `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${esc(f.a)}</p></div>`).join("\n    ");

  const about = `
  <section class="about">
    ${p.intro || ""}
    ${p.howto || ""}
    ${faqHtml ? `<h2>자주 묻는 질문</h2>\n    ${faqHtml}` : ""}
    ${p.sources || ""}
    ${p.disclaimer || DISC}
  </section>`;

  const rel = (p.related || []).map((r) =>
    r.url
      ? `<a class="rel" href="${r.url}" target="_blank" rel="noopener"><span>${r.e}</span> ${esc(r.n)}</a>`
      : `<a class="rel" href="${U}${r.slug}/"><span>${r.e}</span> ${esc(r.n)}</a>`).join("\n      ");
  const related = rel ? `
  <section class="related">
    <h2>관련 계산기</h2>
    <div class="rel-grid">
      ${rel}
    </div>
  </section>` : "";

  const script = p.script ? `
<script type="module">
${p.script.replace(/__U__/g, U)}
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
<meta name="google-adsense-account" content="${ADS_CLIENT}" />
${adHead}
<link rel="stylesheet" href="${U}assets/style.css" />
<script defer src="${U}assets/common.js"></script>
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}
</script>
</head>
<body>
<div class="wrap">
  ${crumbNav}
  ${NOTICE}
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
    <p style="margin:0 0 8px">🏠 <a href="${HOME}">${SITE_NAME}</a></p>
    <p style="margin:0"><a href="${U}privacy.html">개인정보처리방침</a>·<a href="${U}terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a></p>
  </footer>
</div>
${script}
</body>
</html>
`;
}

const DISC = `<p class="note warn">이 계산기의 결과는 <strong>참고용 추정치</strong>이며 실제 부과·승인 금액을 확정하지 않습니다.
    세금은 <a href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스</a>(지방세)·<a href="https://www.hometax.go.kr" target="_blank" rel="noopener">홈택스</a>(국세),
    대출 한도는 거래 금융기관, 등기 비용은 <a href="https://www.iros.go.kr" target="_blank" rel="noopener">인터넷등기소</a>에서 반드시 확인하세요.
    이 사이트는 이름·연락처·주민등록번호 등 개인정보를 수집하지 않으며 모든 계산은 브라우저 안에서만 이뤄집니다.</p>`;

/* ── 공통 조각 ────────────────────────────────────────────── */
const GO = (label) => `<div class="btnrow"><button class="btn" id="go">${label}</button></div>`;
const RESULT = `
  <section class="result" id="result" hidden aria-live="polite">
    <p class="sub">계산 결과 (참고용 추정)</p>
    <p class="big" id="big"></p>
    <p class="sub" id="sub"></p>
    <div id="detail"></div>
  </section>`;
const IMPORTS = `import { $, raw, man, txt, on, won, manwon, eok, pctStr, fbox, srcLine, setHtml, setText, showResult, echo, chips } from "__U__assets/ui.mjs";`;

/* ── 도구 정의 ────────────────────────────────────────────── */
const TOOLS = [

/* 1 ─────────────────────────── 취득세 */
{
  slug: "acquisition-tax", emoji: "🧾", nav: "취득세 계산기",
  hubName: "취득세 계산기", hubDesc: "주택 매매 취득세 + 지방교육세 + 농어촌특별세를 <strong>구간 산식 그대로</strong> 계산합니다.",
  title: "취득세 계산기 — 주택 매매 취득세·지방교육세·농특세 산식 전부 표시",
  ogTitle: "주택 취득세 계산기 (6·9억 구간 산식 반영)",
  desc: "매매가만 넣으면 주택 유상취득 취득세를 6억 이하 1%, 6~9억 구간 산식((가액×2/3억−3)%), 9억 초과 3% 그대로 계산하고 지방교육세·농어촌특별세까지 항목별로 보여줍니다. 다주택 중과세율은 직접 입력할 수 있습니다.",
  h1: "취득세 계산기",
  lead: `주택 매매 취득세를 <strong>6·9억 구간 산식 그대로</strong> 계산하고, 지방교육세·농어촌특별세까지 한 줄씩 펼쳐 보여드립니다.`,
  body: `
  <section class="panel">
    <h2>주택·취득 조건</h2>
    <label for="price">매매가 <span class="opt">(만원)</span></label>
    <input type="text" id="price" data-comma value="50,000" />
    <p class="src" id="priceEcho"></p>
    <div class="row2">
      <div>
        <label for="homes">취득 후 보유 주택 수</label>
        <select id="homes">
          <option value="1">1주택 (표준세율)</option>
          <option value="2">2주택</option>
          <option value="3">3주택</option>
          <option value="4">4주택 이상</option>
        </select>
      </div>
      <div>
        <label for="override">취득세율 직접 입력 <span class="opt">(%, 비우면 자동)</span></label>
        <input type="number" id="override" step="0.0001" min="0" placeholder="예: 8" />
      </div>
    </div>
    <label><input type="checkbox" id="adjusted" /> 조정대상지역 주택</label>
    <label><input type="checkbox" id="over85" /> 전용면적 85㎡ 초과 (농어촌특별세 대상)</label>
    <div class="note warn" id="surWrap" hidden>
      <span class="badge warn">확인 필요</span> <strong>다주택·조정대상지역 중과세율(8%·12%)</strong>은 완화 개정 논의가 이어져 온 항목입니다.
      이 계산기는 지방세법 제13조의2 조문값을 그대로 쓰되 <strong>확정값으로 보증하지 않습니다</strong>.
      적용 여부·세율은 <a href="https://www.wetax.go.kr" target="_blank" rel="noopener">위택스</a>와
      <a href="${acquisition.surchargeRates.source}" target="_blank" rel="noopener">지방세법 제13조의2</a>에서 확인한 뒤,
      다르면 위의 <strong>취득세율 직접 입력</strong> 칸에 넣어 계산하세요.
    </div>
    ${GO("취득세 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>이 계산기는 무엇을 계산하나요?</h2>
    <p>집을 살 때 내는 세금은 취득세 하나가 아닙니다. 취득세 본세에 <strong>지방교육세</strong>가 따라붙고, 전용면적 85㎡를 넘으면 <strong>농어촌특별세</strong>가 추가됩니다. 이 계산기는 세 가지를 각각 계산해 합계까지 보여주고, 어떤 세율이 왜 적용됐는지 산식을 그대로 표시합니다.</p>
    <p>특히 6억 초과 9억 이하 구간은 고정 세율이 아니라 <strong>(취득가액 × 2 ÷ 3억 − 3)%</strong> 라는 산식으로 세율이 매끄럽게 올라갑니다. 7억 5천만원이면 정확히 2%가 됩니다. 이 구간을 1.x% 같은 어림값으로 계산하는 표는 실제 세액과 수백만원까지 차이 날 수 있습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>매매가를 만원 단위로 입력합니다(5억이면 50,000).</li>
      <li>취득 후 보유하게 될 주택 수를 고릅니다. 취득하는 주택을 포함한 숫자입니다.</li>
      <li>조정대상지역·전용 85㎡ 초과 여부를 체크합니다.</li>
      <li>중과세율이 최근 개정된 경우 세율을 직접 입력해 다시 계산합니다.</li>
    </ol>`,
  faq: [
    { q: "6억 초과 9억 이하 구간 세율은 어떻게 나오나요?", a: "지방세법 제11조에 따라 (취득가액 × 2 ÷ 3억 − 3)%로 계산하고 소수점 다섯째 자리에서 반올림합니다. 7억이면 약 1.6667%, 7억 5천이면 2%, 8억이면 약 2.3333%입니다." },
    { q: "지방교육세는 얼마인가요?", a: "표준세율이 적용되는 주택 유상취득은 취득세율의 1/2에 20%를 곱한 값, 즉 취득가액 × 취득세율 × 0.1 입니다. 1% 구간이면 0.1%, 3% 구간이면 0.3%입니다. 중과세율(8·12%)이 적용되면 0.4%가 붙습니다." },
    { q: "농어촌특별세는 언제 붙나요?", a: "전용면적 85㎡ 이하 주택은 비과세입니다. 85㎡를 넘으면 표준세율 구간에서 0.2%, 8% 중과 시 0.6%, 12% 중과 시 1.0%가 추가됩니다." },
    { q: "생애최초 감면은 반영되나요?", a: "반영하지 않습니다. 요건과 한도가 자주 개정되기 때문입니다. 12억 이하 주택을 생애최초로 취득하면 200만원 한도 감면이 적용될 수 있으니 위택스와 관할 시군구에서 확인하세요." },
    { q: "분양권·입주권도 같은가요?", a: "분양권으로 취득하는 주택은 잔금일 기준으로 주택 취득세가 부과되며, 주택 수 판정 시점 등 별도 규정이 많습니다. 이 계산기는 일반 매매 기준이므로 개별 사안은 세무 상담이 필요합니다." },
  ],
  sources: srcTable([
    ["주택 유상취득 표준세율", acquisition.standardRates, "6억 이하 1% / 6~9억 (가액×2/3억−3)% / 9억 초과 3%"],
    ["다주택·조정지역 중과세율", acquisition.surchargeRates, "8% · 12% (조문값, 직접 입력 가능)"],
    ["지방교육세", acquisition.eduTaxRule, "표준분 취득세율×0.1 / 중과 0.4%"],
    ["농어촌특별세", acquisition.ruralTaxRule, "85㎡ 초과 0.2% / 0.6% / 1.0%"],
    ["생애최초 감면", acquisition.firstHomeRelief, "200만원 한도 (계산 미반영)"],
  ]),
  script: `import { acquisitionTax } from "__U__assets/calc.mjs";
import { acquisition } from "__U__data/acquisition.mjs";
${IMPORTS}
echo("price", "priceEcho");
function homesN() { return Number($("homes").value); }
function tog() { $("surWrap").hidden = !(homesN() > 1 || on("adjusted")); }
$("homes").addEventListener("change", tog);
$("adjusted").addEventListener("change", tog);
tog();
$("go").addEventListener("click", function () {
  var price = man("price");
  if (price <= 0) { setText("big", "매매가를 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var ov = txt("override").trim();
  var r = acquisitionTax(price, { homes: homesN(), adjusted: on("adjusted"), areaOver85: on("over85"), overrideRatePct: ov === "" ? null : Number(ov) });
  setText("big", won(r.total));
  setText("sub", "취득가액 " + eok(price) + " · " + r.basis);
  var rows = [
    ["취득가액", eok(price)],
    ["적용 취득세율", pctStr(r.ratePct, 4) + " — " + r.basis],
    ["① 취득세 = 취득가액 × " + pctStr(r.ratePct, 4), won(r.tax)],
    ["② 지방교육세 = 취득가액 × " + pctStr(r.eduPct, 4), won(r.eduTax)],
    ["③ 농어촌특별세 = 취득가액 × " + pctStr(r.ruralPct, 2) + (on("over85") ? " (85㎡ 초과)" : " (85㎡ 이하 비과세)"), won(r.ruralTax)],
    ["합계 ①+②+③", won(r.total)]
  ];
  var foot = "생애최초 감면(200만원 한도)·일시적 2주택 등 개별 감면은 계산에 반영하지 않았습니다.";
  setHtml("detail", fbox("산출 과정", rows, foot)
    + srcLine("표준세율", acquisition.standardRates)
    + (r.surcharged ? srcLine("중과세율", acquisition.surchargeRates) : "")
    + srcLine("지방교육세", acquisition.eduTaxRule)
    + srcLine("농어촌특별세", acquisition.ruralTaxRule));
  showResult();
});`,
  related: [{ slug: "move-in-cost", e: "📦", n: "입주 총비용 계산기" }, { slug: "registration", e: "📑", n: "등기비용 계산기" }, T.yangdo, T.capital],
},

/* 2 ─────────────────────────── 중개보수 */
{
  slug: "broker-fee", emoji: "🤝", nav: "중개보수 계산기",
  hubName: "부동산 중개보수 계산기", hubDesc: "매매·전월세·오피스텔 <strong>법정 상한 요율</strong>과 한도액을 적용해 중개수수료 상한을 계산합니다.",
  title: "부동산 중개보수(복비) 계산기 — 법정 상한 요율·한도액 적용",
  ogTitle: "중개보수 계산기 — 매매·전월세 법정 상한",
  desc: "매매가 또는 보증금·월세를 넣으면 공인중개사법 시행규칙 별표1의 상한 요율과 한도액을 적용해 중개보수 상한을 계산합니다. 월세 거래금액 환산(보증금+월세×100, 5천만 미만은 ×70)과 부가세까지 함께 보여줍니다.",
  h1: "부동산 중개보수 계산기",
  lead: `법정 <strong>상한 요율</strong>과 한도액을 그대로 적용합니다. 실제 보수는 상한 안에서 협의하는 금액입니다.`,
  body: `
  <section class="panel">
    <h2>거래 정보</h2>
    <label for="kind">거래 유형</label>
    <select id="kind">
      <option value="sale">주택 매매·교환</option>
      <option value="lease">주택 임대차(전세·월세)</option>
      <option value="osale">오피스텔 매매 (0.5%)</option>
      <option value="olease">오피스텔 임대차 (0.4%)</option>
      <option value="etc">주택 외(상가·토지 등, 0.9% 이내)</option>
    </select>
    <div id="saleWrap">
      <label for="price">매매가 <span class="opt">(만원)</span></label>
      <input type="text" id="price" data-comma value="50,000" />
      <p class="src" id="priceEcho"></p>
    </div>
    <div id="leaseWrap" hidden>
      <div class="row2">
        <div>
          <label for="deposit">보증금 <span class="opt">(만원)</span></label>
          <input type="text" id="deposit" data-comma value="30,000" />
        </div>
        <div>
          <label for="monthly">월세 <span class="opt">(만원, 전세면 0)</span></label>
          <input type="text" id="monthly" data-comma value="0" />
        </div>
      </div>
    </div>
    <label><input type="checkbox" id="vat" /> 부가가치세 10% 포함해 보기 (일반과세 중개사무소)</label>
    ${GO("중개보수 상한 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>중개보수는 "정해진 금액"이 아닙니다</h2>
    <p>공인중개사법 시행규칙 별표1이 정하는 것은 <strong>상한 요율</strong>입니다. 실제 보수는 그 한도 안에서 의뢰인과 중개사가 협의해 정하며, 거래계약서 작성 전에 확정하는 것이 원칙입니다. 이 계산기가 보여주는 금액은 "받을 수 있는 최대치"이므로, 협의의 출발점으로 사용하세요.</p>
    <p>월세 거래는 보증금과 월세를 하나의 거래금액으로 환산합니다. 기본은 <strong>보증금 + 월세 × 100</strong>이고, 그 값이 5천만원 미만이면 <strong>보증금 + 월세 × 70</strong>으로 다시 계산합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>거래 유형을 고릅니다. 오피스텔은 전용 85㎡ 이하 등 요건을 갖춘 주거용에 별도 요율이 적용됩니다.</li>
      <li>매매면 매매가를, 임대차면 보증금과 월세를 입력합니다(전세는 월세 0).</li>
      <li>결과에서 적용 구간·요율·한도액과 상한 금액을 확인합니다.</li>
      <li>세금계산서를 받는 경우 부가세 10%가 별도로 붙을 수 있습니다.</li>
    </ol>`,
  faq: [
    { q: "한도액은 무엇인가요?", a: "5천만원 미만 매매(0.6%)와 5천만~2억 매매(0.5%) 등 저가 구간에는 요율로 계산한 금액이 한도액을 넘지 못하도록 상한이 걸려 있습니다. 예를 들어 매매 5천만원 미만 구간의 한도액은 25만원입니다." },
    { q: "지자체마다 요율이 다른가요?", a: "시·도 조례로 별표1과 다르게 정할 수 있습니다. 특히 9억 이상 고가 구간은 지자체 조례를 확인하는 것이 좋습니다." },
    { q: "부가세는 꼭 내야 하나요?", a: "중개사무소가 일반과세자이면 중개보수와 별도로 10%가 부과될 수 있습니다. 간이과세자는 다른 요율이 적용되므로 사업자 유형을 확인하세요." },
    { q: "매수·매도 양쪽에서 각각 받나요?", a: "네. 중개보수는 거래 당사자 쌍방에게 각각 청구되며, 이 계산기의 금액은 한쪽이 부담하는 상한입니다." },
  ],
  sources: srcTable([
    ["주택 매매 상한 요율", brokerFee.saleBrackets, "0.6~0.7% 구간별 + 한도액"],
    ["주택 임대차 상한 요율", brokerFee.leaseBrackets, "0.5~0.6% 구간별 + 한도액"],
    ["월세 거래금액 환산", brokerFee.monthlyConversion, "보증금+월세×100 (5천만 미만은 ×70)"],
    ["오피스텔 요율", brokerFee.officetel, "매매 0.5% / 임대차 0.4%"],
    ["주택 외 요율", brokerFee.nonHousing, "0.9% 이내 협의"],
    ["부가가치세", brokerFee.vatNote, "별도 부과 가능"],
  ]),
  script: `import { brokerFeeCalc, leaseAmount } from "__U__assets/calc.mjs";
import { brokerFee } from "__U__data/brokerfee.mjs";
${IMPORTS}
echo("price", "priceEcho");
function isLease() { var k = $("kind").value; return k === "lease" || k === "olease"; }
function tog() { $("saleWrap").hidden = isLease(); $("leaseWrap").hidden = !isLease(); }
$("kind").addEventListener("change", tog); tog();
$("go").addEventListener("click", function () {
  var k = $("kind").value;
  var amount = isLease() ? leaseAmount(man("deposit"), man("monthly"), brokerFee.monthlyConversion.value) : man("price");
  if (amount <= 0) { setText("big", "거래금액을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var rows = [];
  if (isLease()) {
    var base = man("deposit") + man("monthly") * brokerFee.monthlyConversion.value.multiplier;
    var small = base < brokerFee.monthlyConversion.value.smallThreshold;
    rows.push(["보증금", eok(man("deposit"))]);
    rows.push(["월세 환산 (월세 × " + (small ? brokerFee.monthlyConversion.value.smallMultiplier : brokerFee.monthlyConversion.value.multiplier) + ")", eok(amount - man("deposit"))]);
    rows.push(["거래금액 합계" + (small ? " (5천만 미만이라 ×70 재환산)" : ""), eok(amount)]);
  } else {
    rows.push(["거래금액", eok(amount)]);
  }
  var fee, ratePct, cap = null, capped = false, basis;
  if (k === "sale" || k === "lease") {
    var br = k === "sale" ? brokerFee.saleBrackets.value : brokerFee.leaseBrackets.value;
    var r = brokerFeeCalc(amount, br);
    fee = r.fee; ratePct = r.ratePct; cap = r.cap; capped = r.capped;
    basis = "공인중개사법 시행규칙 별표1 구간 요율";
  } else if (k === "osale" || k === "olease") {
    ratePct = k === "osale" ? brokerFee.officetel.value.salePct : brokerFee.officetel.value.leasePct;
    fee = Math.round(amount * ratePct / 100);
    basis = "오피스텔 고정 요율";
  } else {
    ratePct = brokerFee.nonHousing.value.maxPct;
    fee = Math.round(amount * ratePct / 100);
    basis = "주택 외 상한 0.9% 이내 협의";
  }
  rows.push(["적용 상한 요율", pctStr(ratePct, 2) + " — " + basis]);
  rows.push(["요율 계산 = 거래금액 × 요율", won(amount * ratePct / 100)]);
  if (cap != null) rows.push(["한도액", won(cap) + (capped ? " (한도 적용됨)" : " (미달, 요율 적용)")]);
  rows.push(["중개보수 상한", won(fee)]);
  var total = fee;
  if (on("vat")) { rows.push(["부가가치세 10%", won(fee * 0.1)]); total = fee * 1.1; rows.push(["부가세 포함 합계", won(total)]); }
  setText("big", won(total));
  setText("sub", "거래금액 " + eok(amount) + " · 상한 요율 " + pctStr(ratePct, 2) + (on("vat") ? " · 부가세 포함" : " · 부가세 별도"));
  setHtml("detail", fbox("산출 과정", rows, "상한 금액입니다. 실제 보수는 이 범위 안에서 협의하며, 시·도 조례로 요율이 다를 수 있습니다.")
    + srcLine("요율표", k === "sale" ? brokerFee.saleBrackets : k === "lease" ? brokerFee.leaseBrackets : k === "etc" ? brokerFee.nonHousing : brokerFee.officetel)
    + (isLease() ? srcLine("월세 환산", brokerFee.monthlyConversion) : ""));
  showResult();
});`,
  related: [{ slug: "move-in-cost", e: "📦", n: "입주 총비용 계산기" }, { slug: "acquisition-tax", e: "🧾", n: "취득세 계산기" }, T.convert, T.jeonse],
},

/* 3 ─────────────────────────── DSR */
{
  slug: "dsr", emoji: "📉", nav: "DSR 계산기",
  hubName: "DSR 계산기", hubDesc: "기존 대출까지 합산한 <strong>연간 원리금 ÷ 연소득</strong>을 계산하고 한도 초과 여부를 판정합니다.",
  title: "DSR 계산기 — 기존 대출 합산 연간 원리금 상환비율",
  ogTitle: "DSR 계산기 — 내 총부채원리금상환비율은?",
  desc: "연소득과 기존 주택담보대출·신용대출, 새로 받을 대출 조건을 넣으면 연간 원리금 상환액 합계와 DSR(%)을 계산하고 은행 40%·2금융 50% 한도 초과 여부를 보여줍니다. 스트레스 가산금리는 직접 입력합니다.",
  h1: "DSR 계산기",
  lead: `DSR = <strong>연간 원리금 상환액 ÷ 연소득 × 100</strong>. 기존 대출을 빠뜨리면 은행 심사에서 숫자가 완전히 달라집니다.`,
  body: `
  <section class="panel">
    <h2>1. 소득과 한도</h2>
    <div class="row2">
      <div>
        <label for="income">연소득 <span class="opt">(만원, 세전)</span></label>
        <input type="text" id="income" data-comma value="5,000" />
      </div>
      <div>
        <label for="limit">적용 DSR 한도</label>
        <select id="limit">
          <option value="40">은행권 40%</option>
          <option value="50">제2금융권 50%</option>
        </select>
      </div>
    </div>
  </section>
  <section class="panel">
    <h2>2. 기존 대출</h2>
    <div class="row3">
      <div>
        <label for="exBal">주담대 잔액 <span class="opt">(만원)</span></label>
        <input type="text" id="exBal" data-comma value="0" />
      </div>
      <div>
        <label for="exRate">금리 <span class="opt">(%)</span></label>
        <input type="number" id="exRate" step="0.01" value="4" />
      </div>
      <div>
        <label for="exYears">잔여기간 <span class="opt">(년)</span></label>
        <input type="number" id="exYears" step="1" value="25" />
      </div>
    </div>
    <div class="row3">
      <div>
        <label for="crBal">신용대출 잔액 <span class="opt">(만원)</span></label>
        <input type="text" id="crBal" data-comma value="0" />
      </div>
      <div>
        <label for="crRate">신용대출 금리 <span class="opt">(%)</span></label>
        <input type="number" id="crRate" step="0.01" value="5.5" />
      </div>
      <div>
        <label for="crYears">분할상환 가정 <span class="opt">(년)</span></label>
        <input type="number" id="crYears" step="1" value="${loanRules.dsrAssumptions.value.creditLoanYears}" />
      </div>
    </div>
    <p class="note"><span class="badge warn">확인 필요</span> 대출 종류별 연 원리금 환산 방식(신용대출 만기 가정, 마이너스통장, 전세대출 이자만 산입 등)은 감독규정 세칙과 은행 내규에 따라 다릅니다. 이 계산기는 <strong>신용대출을 분할상환으로 환산</strong>하는 단순 가정만 사용합니다.</p>
  </section>
  <section class="panel">
    <h2>3. 새로 받을 대출</h2>
    <div class="row3">
      <div>
        <label for="newBal">대출금액 <span class="opt">(만원)</span></label>
        <input type="text" id="newBal" data-comma value="30,000" />
      </div>
      <div>
        <label for="newRate">금리 <span class="opt">(%)</span></label>
        <input type="number" id="newRate" step="0.01" value="4.2" />
      </div>
      <div>
        <label for="newYears">기간 <span class="opt">(년)</span></label>
        <input type="number" id="newYears" step="1" value="30" />
      </div>
    </div>
    <label for="stress">스트레스 DSR 가산금리 <span class="opt">(%p)</span> <span class="badge warn">확인 필요</span></label>
    <input type="number" id="stress" step="0.01" value="0" />
    <p class="note warn">스트레스 DSR 가산금리는 시행 단계·지역·상품별로 달라지고 발표에 따라 바뀝니다. 이 사이트는 <strong>임의 값을 넣지 않고 기본 0으로 두었습니다</strong>. 적용 값은 <a href="${loanRules.stressRate.source}" target="_blank" rel="noopener">금융위원회 보도자료</a>나 거래 은행에서 확인해 직접 입력하세요.</p>
    ${GO("DSR 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>DSR은 왜 중요한가</h2>
    <p>DSR(총부채원리금상환비율)은 내가 1년 동안 갚아야 하는 <strong>모든 대출의 원금과 이자</strong>를 연소득으로 나눈 비율입니다. LTV가 "집값 대비 얼마"를 정한다면 DSR은 "내 소득으로 감당 가능한가"를 정합니다. 두 규제 중 <strong>더 빡빡한 쪽</strong>이 실제 한도가 되므로, 집값 기준으로는 나오는데 소득 때문에 막히는 경우가 흔합니다.</p>
    <p>핵심은 기존 대출입니다. 신용대출 5천만원은 잔액만 보면 작아 보여도 분할상환으로 환산하면 연 1천만원 이상의 원리금으로 잡혀 주담대 한도를 크게 깎습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>세전 연소득을 입력합니다. 소득 인정 방식(근로·사업·연금 등)은 은행마다 서류 요건이 다릅니다.</li>
      <li>기존 주택담보대출의 잔액·금리·잔여기간, 신용대출 잔액을 입력합니다.</li>
      <li>새로 받을 대출 조건을 넣습니다.</li>
      <li>스트레스 가산금리를 확인해 입력하면 그만큼 원리금이 늘어난 기준으로 재계산됩니다.</li>
    </ol>`,
  faq: [
    { q: "DSR 한도는 40%인가요 50%인가요?", a: "차주단위 DSR은 은행권 40%, 제2금융권 50%가 기준입니다. 다만 대출 종류·금액에 따라 적용 제외 대상이 있고 규정이 개정될 수 있으므로 거래 금융기관 확인이 필요합니다." },
    { q: "전세자금대출도 DSR에 들어가나요?", a: "전세대출은 원금이 제외되고 이자만 산입되는 등 종류별로 산입 방식이 다릅니다. 이 계산기는 그 세부 규정을 반영하지 않으므로 해당 대출이 있다면 은행에 직접 확인하세요." },
    { q: "스트레스 DSR이 뭔가요?", a: "미래 금리 상승 위험을 반영해 실제 금리에 가산금리를 더한 값으로 원리금을 계산하는 제도입니다. 가산 폭이 단계적으로 시행·조정되어 왔기 때문에 이 계산기는 값을 고정하지 않고 직접 입력하도록 했습니다." },
    { q: "결과가 은행 심사와 다를 수 있나요?", a: "네. 소득 인정 범위, 대출 종류별 산입 방식, 만기 가정 등이 은행 내규에 따라 달라 실제 심사 결과와 차이가 납니다. 참고용 추정치로만 사용하세요." },
  ],
  sources: srcTable([
    ["차주단위 DSR 한도", loanRules.dsrLimit, "은행 40% / 비은행 50%"],
    ["스트레스 DSR 가산금리", loanRules.stressRate, "계산 제외 — 직접 입력 (기본 0)"],
    ["대출 종류별 연 원리금 환산", loanRules.dsrAssumptions, "신용대출 분할상환 가정만 사용"],
  ]),
  script: `import { monthlyPayment, dsrPct } from "__U__assets/calc.mjs";
import { loanRules } from "__U__data/loan.mjs";
${IMPORTS}
$("go").addEventListener("click", function () {
  var income = man("income");
  if (income <= 0) { setText("big", "연소득을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var stress = raw("stress");
  var exYear = 0, crYear = 0, newYear = 0;
  var rows = [["연소득(세전)", eok(income)]];
  if (man("exBal") > 0 && raw("exYears") > 0) {
    exYear = monthlyPayment(man("exBal"), raw("exRate"), raw("exYears") * 12) * 12;
    rows.push(["기존 주담대 연 원리금 (" + eok(man("exBal")) + " · " + raw("exRate") + "% · " + raw("exYears") + "년)", won(exYear)]);
  }
  if (man("crBal") > 0 && raw("crYears") > 0) {
    crYear = monthlyPayment(man("crBal"), raw("crRate"), raw("crYears") * 12) * 12;
    rows.push(["신용대출 연 원리금 (" + raw("crYears") + "년 분할 가정)", won(crYear)]);
  }
  var appliedRate = raw("newRate") + stress;
  if (man("newBal") > 0 && raw("newYears") > 0) {
    newYear = monthlyPayment(man("newBal"), appliedRate, raw("newYears") * 12) * 12;
    rows.push(["신규 대출 연 원리금 (" + eok(man("newBal")) + " · " + pctStr(appliedRate, 2) + (stress > 0 ? " = 금리 + 스트레스 " + pctStr(stress, 2) : "") + " · " + raw("newYears") + "년)", won(newYear)]);
  }
  var totalYear = exYear + crYear + newYear;
  var d = dsrPct(income, totalYear);
  var lim = Number($("limit").value);
  rows.push(["연간 원리금 합계", won(totalYear)]);
  rows.push(["DSR = 연간 원리금 ÷ 연소득 × 100", pctStr(d, 1)]);
  rows.push(["적용 한도", lim + "%"]);
  rows.push(["한도까지 남은 연 원리금", won(Math.max(0, income * lim / 100 - totalYear))]);
  setText("big", pctStr(d, 1));
  setText("sub", d > lim ? "한도 " + lim + "% 초과 — 이 조건으로는 승인이 어렵습니다" : "한도 " + lim + "% 이내 — 다만 은행 내규·소득 인정 방식에 따라 달라집니다");
  setHtml("detail", fbox("산출 과정", rows, "신규 대출 월 상환액 " + won(newYear / 12) + " 기준. 스트레스 가산금리를 0으로 두면 실제 심사보다 낙관적인 결과가 나올 수 있습니다.")
    + srcLine("DSR 한도", loanRules.dsrLimit)
    + srcLine("스트레스 DSR", loanRules.stressRate)
    + srcLine("환산 가정", loanRules.dsrAssumptions));
  showResult();
});`,
  related: [{ slug: "affordability", e: "🏡", n: "내 집 마련 예산 계산기" }, { slug: "ltv", e: "📐", n: "LTV 한도 계산기" }, T.dsr, T.dsrLimit],
},

/* 4 ─────────────────────────── LTV */
{
  slug: "ltv", emoji: "📐", nav: "LTV 계산기",
  hubName: "LTV 한도 계산기", hubDesc: "시세 × LTV에서 <strong>방공제(소액임차보증금)</strong>까지 빼서 실제 대출 가능액을 계산합니다.",
  title: "LTV 계산기 — 방공제까지 반영한 주택담보대출 한도",
  ogTitle: "LTV 계산기 — 방공제 반영 실제 한도",
  desc: "시세와 LTV 비율을 넣으면 주택담보대출 한도를 계산하고, 은행이 실제로 차감하는 방공제(소액임차보증금)를 반영한 실행 가능액까지 보여줍니다. LTV·방공제 값은 지역과 시점에 따라 달라 직접 입력할 수 있습니다.",
  h1: "LTV 한도 계산기",
  lead: `"시세 × LTV"가 끝이 아닙니다. 은행은 여기서 <strong>방공제(소액임차보증금)</strong>를 한 번 더 뺍니다.`,
  body: `
  <section class="panel">
    <h2>담보와 비율</h2>
    <label for="price">주택 시세(감정가) <span class="opt">(만원)</span></label>
    <input type="text" id="price" data-comma value="60,000" />
    <p class="src" id="priceEcho"></p>
    <label for="ltv">적용 LTV <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
    <input type="number" id="ltv" step="1" min="0" max="100" value="70" />
    <div class="seg" id="ltvChips">
      ${loanRules.ltvPresets.value.map((p) => `<button type="button" data-v="${p.pct}">${esc(p.label)} ${p.pct}%</button>`).join("\n      ")}
    </div>
    <p class="note warn">LTV 상한은 규제지역 지정·해제와 정책 변경으로 <strong>수시로 바뀝니다</strong>. 위 프리셋은 참고용이며 이 사이트가 현재 적용값을 보증하지 않습니다.
      실제 적용 비율은 거래 은행과 <a href="${loanRules.ltvPresets.source}" target="_blank" rel="noopener">은행업감독규정</a>에서 확인해 직접 입력하세요.</p>
  </section>
  <section class="panel">
    <h2>방공제 (소액임차보증금)</h2>
    <label><input type="checkbox" id="useRoom" checked /> 방공제 차감 적용 (MCI·MCG 미가입 시 통상 차감)</label>
    <div class="row2">
      <div>
        <label for="region">지역 선택</label>
        <select id="region">
          ${loanRules.smallDeposit.value.map((r, i) => `<option value="${r.won}"${i === 0 ? " selected" : ""}>${esc(r.region)} — ${(r.won / 10000).toLocaleString("ko-KR")}만원</option>`).join("\n          ")}
        </select>
      </div>
      <div>
        <label for="room">방공제 금액 <span class="opt">(만원)</span> <span class="badge warn">확인 필요</span></label>
        <input type="text" id="room" data-comma value="5,500" />
      </div>
    </div>
    <p class="note"><span class="badge warn">확인 필요</span> 소액임차보증금 기준은 주택임대차보호법 시행령 개정으로 바뀔 수 있고, 방 개수만큼 차감하는 은행도 있습니다. 최신 금액은 은행에 확인해 직접 수정하세요.</p>
    ${GO("대출 한도 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>왜 계산한 만큼 안 나올까</h2>
    <p>LTV(주택담보인정비율)는 담보 가치 대비 대출 한도의 상한입니다. 그런데 은행은 여기서 임차인이 우선변제받을 수 있는 <strong>소액임차보증금(방공제)</strong>을 뺀 금액까지만 실행합니다. 서울 기준 5,500만원 안팎이 그대로 한도에서 사라지는 셈입니다. MCI(모기지신용보험)나 MCG(모기지신용보증)에 가입하면 방공제 없이 실행되기도 하지만, 상품과 차주 조건에 따라 가입이 제한됩니다.</p>
    <p>그리고 LTV로 나온 금액이 곧 승인액도 아닙니다. <strong>DSR</strong> 한도가 더 낮으면 그쪽이 실제 한도가 됩니다. 두 계산을 반드시 함께 하세요.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>시세(또는 KB시세·감정가)를 입력합니다. 실거래가가 아니라 은행이 인정하는 담보가치가 기준입니다.</li>
      <li>적용 LTV를 확인해 입력합니다. 프리셋은 참고용입니다.</li>
      <li>방공제 지역을 고르거나 금액을 직접 입력합니다.</li>
      <li>결과의 한도와 DSR 계산기 결과 중 <strong>작은 쪽</strong>이 실제 가능액입니다.</li>
    </ol>`,
  faq: [
    { q: "시세는 무엇을 기준으로 하나요?", a: "아파트는 통상 KB시세·한국부동산원 시세의 일반 평균가를, 그 외 주택은 감정평가액을 사용합니다. 매매가보다 낮게 인정되면 한도도 그만큼 줄어듭니다." },
    { q: "방공제를 피할 수 있나요?", a: "MCI·MCG에 가입하면 방공제 없이 한도를 채우는 경우가 있습니다. 다만 보험료가 들고 차주·물건 조건에 따라 가입이 안 될 수 있어 은행 확인이 필요합니다." },
    { q: "LTV 프리셋을 왜 그대로 쓰면 안 되나요?", a: "규제지역 지정과 정책이 바뀔 때마다 비율이 달라지기 때문입니다. 이 사이트는 확정값을 보증하지 않고 직접 입력하도록 만들었습니다." },
    { q: "생애최초면 더 많이 되나요?", a: "생애최초 구입자에게 더 높은 LTV가 적용되어 왔지만 요건과 한도액 상한이 함께 걸립니다. 반드시 은행에서 최신 기준을 확인하세요." },
  ],
  sources: srcTable([
    ["LTV 상한 프리셋", loanRules.ltvPresets, "직접 입력 기본 — 프리셋은 참고용"],
    ["방공제(소액임차보증금)", loanRules.smallDeposit, "지역별 금액, 직접 수정 가능"],
    ["차주단위 DSR 한도", loanRules.dsrLimit, "LTV와 함께 더 낮은 쪽이 실제 한도"],
  ]),
  script: `import { loanRules } from "__U__data/loan.mjs";
${IMPORTS}
echo("price", "priceEcho");
chips("ltvChips", "ltv");
$("region").addEventListener("change", function () {
  $("room").value = (Number($("region").value) / 10000).toLocaleString("ko-KR");
});
$("go").addEventListener("click", function () {
  var price = man("price"), ltv = raw("ltv");
  if (price <= 0 || ltv <= 0) { setText("big", "시세와 LTV를 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var gross = price * ltv / 100;
  var room = on("useRoom") ? man("room") : 0;
  var net = Math.max(0, gross - room);
  var rows = [
    ["주택 시세(감정가)", eok(price)],
    ["적용 LTV", pctStr(ltv, 1)],
    ["① LTV 한도 = 시세 × LTV", won(gross)],
    ["② 방공제 차감" + (on("useRoom") ? "" : " (미적용)"), "− " + won(room)],
    ["실행 가능 예상액 ① − ②", won(net)],
    ["필요 자기자본 = 시세 − 실행액", won(Math.max(0, price - net))]
  ];
  setText("big", won(net));
  setText("sub", "시세 " + eok(price) + " · LTV " + pctStr(ltv, 1) + (on("useRoom") ? " · 방공제 " + manwon(room) + " 차감" : " · 방공제 미적용"));
  setHtml("detail", fbox("산출 과정", rows, "이 금액은 담보 기준 상한입니다. DSR 한도가 더 낮으면 그쪽이 실제 한도가 되므로 DSR 계산기도 함께 확인하세요.")
    + srcLine("LTV 프리셋", loanRules.ltvPresets)
    + srcLine("방공제", loanRules.smallDeposit));
  showResult();
});`,
  related: [{ slug: "dsr", e: "📉", n: "DSR 계산기" }, { slug: "affordability", e: "🏡", n: "내 집 마련 예산 계산기" }, T.dsrLimit, T.jeonse],
},

/* 5 ─────────────────────────── 등기비용 */
{
  slug: "registration", emoji: "📑", nav: "등기비용 계산기",
  hubName: "소유권이전 등기비용 계산기", hubDesc: "등기신청수수료·인지세·국민주택채권·법무사 보수를 <strong>항목별로</strong> 합산합니다.",
  title: "등기비용 계산기 — 등기수수료·인지세·국민주택채권 항목별 합산",
  ogTitle: "소유권이전 등기비용 계산기",
  desc: "주택 매매 소유권이전등기에 드는 등기신청수수료, 인지세, 제1종 국민주택채권 매입액과 즉시매도 시 본인부담, 법무사 보수, 근저당 설정 등록면허세를 항목별로 계산합니다. 채권 할인율은 매일 바뀌므로 직접 입력합니다.",
  h1: "등기비용 계산기",
  lead: `취득세를 뺀 <strong>등기 자체 비용</strong>을 항목별로. 채권 할인율처럼 매일 바뀌는 값은 지어내지 않고 직접 입력받습니다.`,
  body: `
  <section class="panel">
    <h2>거래 정보</h2>
    <div class="row2">
      <div>
        <label for="price">매매가(거래금액) <span class="opt">(만원)</span></label>
        <input type="text" id="price" data-comma value="50,000" />
        <p class="src" id="priceEcho"></p>
      </div>
      <div>
        <label for="stdPrice">시가표준액 <span class="opt">(만원, 채권 기준)</span></label>
        <input type="text" id="stdPrice" data-comma value="35,000" />
      </div>
    </div>
    <div class="row2">
      <div>
        <label for="bondRegion">채권 매입률 지역</label>
        <select id="bondRegion">
          <option value="metro">특별시·광역시</option>
          <option value="other">그 밖의 지역</option>
        </select>
      </div>
      <div>
        <label for="filing">등기 신청 방식</label>
        <select id="filing">
          <option value="${registration.filingFee.value.paperWon}">방문(서면) 신청 — ${registration.filingFee.value.paperWon.toLocaleString("ko-KR")}원</option>
          <option value="${registration.filingFee.value.eFormWon}">전자표준양식(e-Form) — ${registration.filingFee.value.eFormWon.toLocaleString("ko-KR")}원</option>
          <option value="${registration.filingFee.value.fullEWon}">전자신청 — ${registration.filingFee.value.fullEWon.toLocaleString("ko-KR")}원</option>
        </select>
      </div>
    </div>
  </section>
  <section class="panel">
    <h2>직접 확인해 입력하는 값</h2>
    <label for="discount">국민주택채권 즉시매도 할인율 <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
    <input type="number" id="discount" step="0.001" min="0" placeholder="비우면 채권 본인부담 계산 제외" />
    <p class="note warn">채권 할인율(고객부담률)은 <strong>매일 고시</strong>되어 고정할 수 없습니다. 비워 두면 매입금액만 표시하고 본인부담은 계산하지 않습니다.
      당일 값은 <a href="${registration.bondDiscount.source}" target="_blank" rel="noopener">인터넷등기소</a>에서 확인해 입력하세요.</p>
    <div class="row2">
      <div>
        <label for="legal">법무사 보수 <span class="opt">(만원)</span> <span class="badge warn">확인 필요</span></label>
        <input type="text" id="legal" data-comma value="0" />
      </div>
      <div>
        <label for="mortgage">근저당 설정금액 <span class="opt">(만원, 대출 시)</span></label>
        <input type="text" id="mortgage" data-comma value="0" />
      </div>
    </div>
    <p class="note">법무사 보수는 자율 요율이라 정해진 표가 없습니다(견적 비교 권장). 셀프등기를 하면 이 항목은 0입니다.</p>
    ${GO("등기비용 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>등기비용의 정체</h2>
    <p>2011년부터 매매로 인한 소유권이전등기의 등록세는 <strong>취득세에 통합</strong>되었습니다. 그래서 "등기비용"이라고 부르는 돈의 실체는 취득세와 별개인 ① 등기신청수수료, ② 인지세, ③ 제1종 국민주택채권 매입 부담, ④ 법무사 보수, 그리고 대출을 받는다면 ⑤ 근저당권 설정등기의 등록면허세(설정금액의 0.2%)와 지방교육세입니다.</p>
    <p>이 가운데 체감상 가장 큰 변수가 국민주택채권입니다. 채권은 사서 만기까지 보유할 수도 있지만 대부분 즉시 매도하며, 이때 <strong>본인부담 = 매입금액 × 당일 할인율</strong>이 됩니다. 할인율은 시장금리에 따라 매일 바뀌므로 이 계산기는 값을 지어내지 않고 직접 입력받습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>매매가와 시가표준액(공시가격 등 채권 기준 금액)을 입력합니다.</li>
      <li>부동산 소재지가 특별시·광역시인지 고릅니다. 채권 매입률이 다릅니다.</li>
      <li>인터넷등기소에서 당일 채권 할인율을 확인해 입력하면 본인부담까지 계산됩니다.</li>
      <li>법무사 견적을 받았다면 그 금액을 넣어 총액을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "취득세는 왜 여기 없나요?", a: "취득세는 별도의 계산기에서 다룹니다. 취득세와 등기비용을 한 번에 합산하려면 입주 총비용 계산기를 사용하세요." },
    { q: "채권을 꼭 사야 하나요?", a: "일정 금액 이상 부동산 등기에는 제1종 국민주택채권 매입이 의무입니다. 보유하면 만기까지 낮은 이율을 받고, 즉시 매도하면 할인 차액만 부담하고 끝냅니다. 대부분 후자를 택합니다." },
    { q: "인지세가 0으로 나오는데 맞나요?", a: "주택의 경우 기재금액 1억원 이하이면 인지세가 비과세됩니다. 그 외에는 금액 구간별로 2만~35만원이 부과됩니다." },
    { q: "셀프등기가 가능한가요?", a: "가능합니다. 법무사 보수를 0으로 두고 계산해 보세요. 다만 대출을 끼면 은행이 지정 법무사를 요구하는 경우가 많습니다." },
  ],
  sources: srcTable([
    ["등기신청수수료", registration.filingFee, "서면 15,000 / e-Form 13,000 / 전자 10,000원"],
    ["인지세", registration.stampDuty, "기재금액 구간별 2만~35만원"],
    ["주택 인지세 비과세", registration.stampDutyHouseExempt, "1억원 이하 비과세"],
    ["국민주택채권 매입률", registration.bondBrackets, "시가표준액·지역별 1.3~3.1%"],
    ["채권 할인율", registration.bondDiscount, "계산 제외 — 매일 고시, 직접 입력"],
    ["법무사 보수", registration.legalFee, "자율 — 직접 입력"],
    ["근저당 등록면허세", registration.mortgageRegTax, "설정금액 0.2% + 지방교육세 20%"],
  ]),
  script: `import { stampDuty } from "__U__assets/calc.mjs";
import { registration } from "__U__data/registration.mjs";
${IMPORTS}
echo("price", "priceEcho");
$("go").addEventListener("click", function () {
  var price = man("price"), std = man("stdPrice");
  if (price <= 0) { setText("big", "매매가를 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var filing = Number($("filing").value);
  var stamp = stampDuty(price, registration.stampDuty.value, { isHouse: true, houseExemptMax: registration.stampDutyHouseExempt.value.maxPriceWon });
  var metro = $("bondRegion").value === "metro";
  var br = null;
  for (var i = 0; i < registration.bondBrackets.value.length; i++) {
    var b = registration.bondBrackets.value[i];
    if (std >= b[0] && std < b[1]) { br = b; break; }
  }
  var bondPct = br ? (metro ? br[2] : br[3]) : 0;
  var bondBuy = br ? Math.round(std * bondPct / 100 / 10000) * 10000 : 0;
  var disc = raw("discount");
  var bondCost = disc > 0 ? Math.round(bondBuy * disc / 100) : 0;
  var legal = man("legal");
  var mort = man("mortgage");
  var mortTax = Math.round(mort * registration.mortgageRegTax.value.ratePct / 100);
  var mortEdu = Math.round(mortTax * registration.mortgageRegTax.value.eduSurchargePct / 100);
  var total = filing + stamp + bondCost + legal + mortTax + mortEdu;
  var rows = [
    ["① 등기신청수수료 (" + $("filing").selectedOptions[0].textContent.split("—")[0].trim() + ")", won(filing)],
    ["② 인지세 (거래금액 " + eok(price) + ")", won(stamp) + (stamp === 0 ? " — 주택 1억 이하 비과세" : "")],
    ["③ 국민주택채권 매입액 = 시가표준액 " + eok(std) + " × " + pctStr(bondPct, 2) + (metro ? " (특별시·광역시)" : " (그 밖의 지역)"), br ? won(bondBuy) : "매입 대상 아님(2천만원 미만)"],
    ["③-1 채권 즉시매도 본인부담 = 매입액 × 할인율" + (disc > 0 ? " " + pctStr(disc, 3) : ""), disc > 0 ? won(bondCost) : "할인율 미입력 — 계산 제외"],
    ["④ 법무사 보수 (직접 입력)", won(legal)],
    ["⑤ 근저당 등록면허세 = 설정금액 " + eok(mort) + " × " + registration.mortgageRegTax.value.ratePct + "%", won(mortTax)],
    ["⑥ 지방교육세 = ⑤ × " + registration.mortgageRegTax.value.eduSurchargePct + "%", won(mortEdu)],
    ["합계 ①+②+③-1+④+⑤+⑥", won(total)]
  ];
  setText("big", won(total));
  setText("sub", "취득세 제외 · " + (disc > 0 ? "채권 본인부담 포함" : "채권 본인부담 제외(할인율 미입력)"));
  setHtml("detail", fbox("산출 과정", rows, "채권 매입액은 1만원 단위로 정리해 표시했습니다. 실제 매입·할인 처리 단위와 증지·인증 비용 등 소액 항목은 기관 처리 방식에 따라 차이가 납니다.")
    + srcLine("등기신청수수료", registration.filingFee)
    + srcLine("인지세", registration.stampDuty)
    + srcLine("채권 매입률", registration.bondBrackets)
    + srcLine("채권 할인율", registration.bondDiscount)
    + srcLine("근저당 등록면허세", registration.mortgageRegTax));
  showResult();
});`,
  related: [{ slug: "acquisition-tax", e: "🧾", n: "취득세 계산기" }, { slug: "move-in-cost", e: "📦", n: "입주 총비용 계산기" }, T.yangdo, T.refi],
},

/* 6 ─────────────────────────── 청약 가점 */
{
  slug: "subscription", emoji: "🎯", nav: "청약 가점 계산기",
  hubName: "청약 가점 계산기 (84점)", hubDesc: "무주택기간 32 + 부양가족 35 + 통장 17 = <strong>84점</strong> 만점을 항목별로 계산합니다.",
  title: "청약 가점 계산기 — 무주택기간·부양가족·통장 84점 만점 산식",
  ogTitle: "청약 가점 계산기 (84점 만점)",
  desc: "주택공급에 관한 규칙 별표1의 가점 산식 그대로 무주택기간(최대 32점), 부양가족 수(최대 35점), 청약통장 가입기간(최대 17점)을 계산해 84점 만점 기준 총점과 항목별 점수를 보여줍니다.",
  h1: "청약 가점 계산기",
  lead: `무주택기간 <strong>32</strong> + 부양가족 <strong>35</strong> + 통장 <strong>17</strong> = 84점. 각 항목이 어떻게 채워지는지 표로 보여드립니다.`,
  body: `
  <section class="panel">
    <h2>가점 항목 입력</h2>
    <label><input type="checkbox" id="hasHouse" /> 세대 구성원 중 주택 소유자가 있다 (무주택기간 0점)</label>
    <div class="row3">
      <div>
        <label for="noHouseYears">무주택기간 <span class="opt">(년)</span></label>
        <input type="number" id="noHouseYears" step="0.5" min="0" max="30" value="10" />
      </div>
      <div>
        <label for="dependents">부양가족 수 <span class="opt">(명, 본인 제외)</span></label>
        <input type="number" id="dependents" step="1" min="0" max="10" value="2" />
      </div>
      <div>
        <label for="accountYears">청약통장 가입기간 <span class="opt">(년)</span></label>
        <input type="number" id="accountYears" step="0.5" min="0" max="30" value="8" />
      </div>
    </div>
    <p class="note">무주택기간은 <strong>만 30세가 된 날</strong>(그 전에 혼인했다면 혼인신고일)부터 계산합니다. 부양가족은 주민등록등본상 세대원 중 배우자·직계존속(3년 이상 등재)·직계비속(미혼, 만 30세 미만 등 요건) 기준입니다.</p>
    ${GO("가점 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>가점제는 어떻게 채워지나</h2>
    <p>민영주택 일반공급의 가점제는 세 항목의 합으로 84점 만점입니다. 무주택기간은 1년 미만 2점에서 시작해 1년마다 2점씩 올라 15년 이상이면 32점, 부양가족은 0명 5점에서 1명마다 5점씩 올라 6명 이상이면 35점, 청약통장 가입기간은 6개월 미만 1점에서 시작해 15년 이상이면 17점입니다.</p>
    <p>가장 크게 벌어지는 항목은 <strong>부양가족</strong>입니다. 한 명 차이가 5점이라 무주택기간 2년 반을 한 번에 뒤집습니다. 다만 부양가족 요건(등본 등재 기간, 직계비속 연령·혼인 여부)은 까다로우니 청약홈 자료로 반드시 확인하세요.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>세대 내 주택 소유 여부를 체크합니다. 유주택이면 무주택기간 점수는 0점입니다.</li>
      <li>무주택기간을 연 단위로 입력합니다(만 30세 또는 혼인신고일 기산).</li>
      <li>부양가족 수는 본인을 뺀 인원입니다.</li>
      <li>청약통장 가입기간을 연 단위로 입력하면 항목별 점수와 총점이 나옵니다.</li>
    </ol>`,
  faq: [
    { q: "84점 만점은 어떤 경우인가요?", a: "무주택기간 15년 이상(32점) + 부양가족 6명 이상(35점) + 청약통장 15년 이상(17점)이 모두 충족될 때입니다." },
    { q: "무주택기간은 언제부터 세나요?", a: "만 30세가 된 날부터이며, 30세 이전에 혼인했다면 혼인신고일부터입니다. 과거에 집이 있었다면 처분한 날부터 다시 계산합니다." },
    { q: "부양가족에 부모님도 포함되나요?", a: "직계존속은 청약자가 세대주이고 3년 이상 계속 등본에 등재되어 있어야 인정되는 등 요건이 있습니다. 요건을 잘못 판단해 부적격 처리되는 사례가 많습니다." },
    { q: "가점이 낮으면 방법이 없나요?", a: "추첨제 물량, 특별공급(신혼부부·생애최초·다자녀 등), 무순위 청약 등 다른 경로가 있습니다. 가점은 단지·평형별 경쟁률에 따라 당첨선이 크게 다릅니다." },
  ],
  sources: srcTable([
    ["무주택기간 배점", subscription.noHousePeriod, "최대 32점 (1년 미만 2점, 1년당 +2)"],
    ["부양가족 배점", subscription.dependents, "최대 35점 (0명 5점, 1명당 +5)"],
    ["청약통장 배점", subscription.accountPeriod, "최대 17점 (6개월 미만 1점)"],
    ["총점", subscription.totalMax, "84점 만점"],
  ]),
  script: `import { subscriptionScore } from "__U__assets/calc.mjs";
import { subscription } from "__U__data/subscription.mjs";
${IMPORTS}
$("go").addEventListener("click", function () {
  var s = subscriptionScore({ noHouseYears: raw("noHouseYears"), hasHouse: on("hasHouse"), dependents: raw("dependents"), accountYears: raw("accountYears") });
  setText("big", s.total + "점 / 84점");
  setText("sub", "무주택 " + s.noHousePts + " + 부양가족 " + s.dependentsPts + " + 통장 " + s.accountPts);
  var rows = [
    ["① 무주택기간 " + (on("hasHouse") ? "(유주택 → 0점)" : raw("noHouseYears") + "년"), s.noHousePts + "점 / 32점"],
    ["② 부양가족 " + raw("dependents") + "명 (본인 제외)", s.dependentsPts + "점 / 35점"],
    ["③ 청약통장 " + raw("accountYears") + "년", s.accountPts + "점 / 17점"],
    ["총점 ①+②+③", s.total + "점 / 84점"]
  ];
  setHtml("detail", fbox("산출 과정", rows, "부양가족·무주택기간 인정 요건은 청약홈 기준으로 반드시 확인하세요. 요건 착오로 인한 부적격 당첨은 일정 기간 청약이 제한됩니다.")
    + srcLine("무주택기간", subscription.noHousePeriod)
    + srcLine("부양가족", subscription.dependents)
    + srcLine("청약통장", subscription.accountPeriod));
  showResult();
});`,
  related: [{ slug: "affordability", e: "🏡", n: "내 집 마련 예산 계산기" }, { slug: "acquisition-tax", e: "🧾", n: "취득세 계산기" }, T.cheongyak, T.dsr],
},

/* 7 ─────────────────────────── 전세보증보험 */
{
  slug: "jeonse-insurance", emoji: "🛡️", nav: "전세보증보험료 계산기",
  hubName: "전세보증보험료 계산기", hubDesc: "보증금·기간·<strong>직접 확인한 보증료율</strong>로 전세보증금 반환보증 보험료를 계산합니다.",
  title: "전세보증보험료 계산기 — 보증금·기간·요율로 보증료 산출",
  ogTitle: "전세보증보험료 계산기",
  desc: "전세보증금 반환보증(HUG·HF·SGI)의 보증료를 보증금 × 보증료율 × 보증기간으로 계산합니다. 보증료율은 주택유형·부채비율·우대에 따라 달라 공식 요율표에서 확인한 값을 직접 입력하도록 했습니다.",
  h1: "전세보증보험료 계산기",
  lead: `보증료 = <strong>보증금 × 보증료율 × 기간</strong>. 요율은 조건별로 달라 <strong>확인한 값을 직접</strong> 넣습니다.`,
  body: `
  <section class="panel">
    <h2>보증 조건</h2>
    <label for="deposit">전세보증금 <span class="opt">(만원)</span></label>
    <input type="text" id="deposit" data-comma value="30,000" />
    <p class="src" id="depositEcho"></p>
    <div class="row2">
      <div>
        <label for="months">보증기간 <span class="opt">(개월)</span></label>
        <input type="number" id="months" step="1" min="1" value="24" />
      </div>
      <div>
        <label for="rate">보증료율 <span class="opt">(연 %)</span> <span class="badge warn">확인 필요</span></label>
        <input type="number" id="rate" step="0.001" min="0" placeholder="공식 요율표에서 확인" />
      </div>
    </div>
    <div class="seg" id="rateChips">
      ${jeonseInsurance.hugRates.value.map((r) => `<button type="button" data-v="${r.examplePct}">${esc(r.type)} 예시 ${r.examplePct}%</button>`).join("\n      ")}
    </div>
    <p class="note warn"><span class="badge warn">확인 필요</span> 위 예시 요율은 참고값입니다. 실제 요율은 <strong>주택유형·부채비율·우대(사회배려계층 등)</strong>에 따라 달라지고 공시가 개정될 수 있어 이 사이트가 확정하지 않습니다.
      <a href="${jeonseInsurance.hugRates.source}" target="_blank" rel="noopener">HUG 공식 요율표</a>에서 확인한 값을 입력하세요.</p>
    ${GO("보증료 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>전세보증금 반환보증이란</h2>
    <p>계약이 끝났는데 집주인이 보증금을 돌려주지 않을 때, 보증기관이 대신 돌려주고 집주인에게 구상하는 상품입니다. HUG(주택도시보증공사), HF(한국주택금융공사), SGI서울보증 세 곳이 취급하며 가입 요건과 요율이 각각 다릅니다.</p>
    <p>보험료는 <strong>보증금 × 연 보증료율 × 보증기간</strong>으로 계산합니다. 2년 계약이면 요율의 두 배가 든다고 보면 됩니다. 이 계산기는 요율만 정확히 넣으면 나머지는 단순 곱셈이므로, 여러 조건을 비교해 볼 때 유용합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>전세보증금과 보증기간(보통 계약기간과 동일한 24개월)을 입력합니다.</li>
      <li>HUG 요율표나 은행·앱에서 안내받은 보증료율을 입력합니다.</li>
      <li>결과에서 총 보증료와 월 환산 금액을 확인합니다.</li>
      <li>기관별 요율이 다르므로 값을 바꿔 가며 비교해 보세요.</li>
    </ol>`,
  faq: [
    { q: "가입 한도는 얼마인가요?", a: "수도권·비수도권별 보증금 상한과 전세가율(담보인정비율) 요건이 있고 공고로 변경됩니다. 이 계산기는 그 요건을 판정하지 않으므로 가입 가능 여부는 각 기관에서 확인하세요." },
    { q: "요율을 왜 자동으로 안 넣어 주나요?", a: "주택유형(아파트/그 외), 부채비율 구간, 우대 대상 여부에 따라 요율이 달라지고 공시가 개정되기 때문입니다. 잘못된 기본값은 계산 전체를 틀리게 만들어 직접 입력 방식을 택했습니다." },
    { q: "집주인 동의가 필요한가요?", a: "현재는 임대인 동의 없이 가입할 수 있는 상품이 일반적입니다. 다만 계약·전입·확정일자 등 요건이 있어 기관 안내를 확인해야 합니다." },
    { q: "보증료를 나눠 낼 수 있나요?", a: "기관·상품에 따라 분납이 가능한 경우가 있습니다. 이 계산기는 총액과 월 환산액을 함께 보여 줍니다." },
  ],
  sources: srcTable([
    ["HUG 보증료율", jeonseInsurance.hugRates, "직접 입력 — 예시값은 참고용"],
    ["가입 한도·전세가율 요건", jeonseInsurance.limits, "계산 제외 — 공고 확인 필요"],
    ["취급 기관", jeonseInsurance.providers, "HUG · HF · SGI"],
  ]),
  script: `import { jeonseInsurance } from "__U__data/insurance.mjs";
${IMPORTS}
echo("deposit", "depositEcho");
chips("rateChips", "rate");
$("go").addEventListener("click", function () {
  var dep = man("deposit"), mo = raw("months"), rate = raw("rate");
  if (dep <= 0 || mo <= 0) { setText("big", "보증금과 기간을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  if (rate <= 0) { setText("big", "보증료율을 입력하세요"); setText("sub", "요율은 조건별로 달라 자동 입력하지 않습니다"); setHtml("detail", fbox("입력 필요", [["보증료율", "HUG 공식 요율표에서 확인 후 입력"]], "확인처: HUG 주택도시보증공사")); showResult(); return; }
  var total = dep * rate / 100 * (mo / 12);
  var rows = [
    ["보증금", eok(dep)],
    ["연 보증료율 (직접 입력)", pctStr(rate, 3)],
    ["보증기간", mo + "개월 (" + (Math.round(mo / 12 * 100) / 100) + "년)"],
    ["보증료 = 보증금 × 요율 × 기간(년)", won(total)],
    ["월 환산", won(total / mo)]
  ];
  setText("big", won(total));
  setText("sub", "보증금 " + eok(dep) + " · 요율 " + pctStr(rate, 3) + " · " + mo + "개월");
  setHtml("detail", fbox("산출 과정", rows, "기관에 따라 일할 계산(일수/365) 방식이 쓰여 며칠분 차이가 날 수 있습니다. 가입 한도·전세가율 요건은 이 계산에 포함되지 않습니다.")
    + srcLine("보증료율", jeonseInsurance.hugRates)
    + srcLine("가입 요건", jeonseInsurance.limits));
  showResult();
});`,
  related: [{ slug: "broker-fee", e: "🤝", n: "중개보수 계산기" }, { slug: "rent-yield", e: "📈", n: "임대수익률 계산기" }, T.jeonse, T.convert],
},

/* 8 ─────────────────────────── 보유세 */
{
  slug: "holding-tax", emoji: "🏛️", nav: "보유세 계산기",
  hubName: "보유세(재산세·종부세) 계산기", hubDesc: "공시가격에서 <strong>과세표준 → 누진세율</strong>까지 펼쳐 재산세와 종부세를 추정합니다.",
  title: "보유세 계산기 — 재산세·종합부동산세 과세표준과 누진세율 표시",
  ogTitle: "재산세·종부세 계산기",
  desc: "공시가격과 공정시장가액비율로 과세표준을 구하고 재산세 누진세율, 도시지역분, 지방교육세를 계산합니다. 종합부동산세는 기본공제(9억·1주택 12억) 차감 후 세율을 적용하며 재산세 공제·세부담 상한·세액공제는 제외합니다.",
  h1: "보유세 계산기",
  lead: `공시가격 → 과세표준 → 누진세율. <strong>재산세와 종부세</strong>를 항목별로 추정합니다.`,
  body: `
  <section class="panel">
    <h2>1. 재산세 (주택 1채 기준)</h2>
    <label for="pub">공시가격 <span class="opt">(만원)</span></label>
    <input type="text" id="pub" data-comma value="60,000" />
    <p class="src" id="pubEcho"></p>
    <label><input type="checkbox" id="oneHome" checked /> 1세대 1주택 (공시 9억 이하면 특례세율 적용)</label>
    <label><input type="checkbox" id="urban" checked /> 도시지역분(재산세 과세특례 0.14%) 포함</label>
    <label for="fmr">공정시장가액비율 <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
    <input type="number" id="fmr" step="1" min="0" max="100" value="${holding.fairMarketRatio.value.housePct}" />
    <p class="note warn"><span class="badge warn">확인 필요</span> 주택 공정시장가액비율은 시행령 기준 60%이나, <strong>1주택자 한시 특례(43~45%)</strong>가 연도별로 적용된 이력이 있습니다.
      이 계산기는 특례를 자동 적용하지 않으니 당해연도 값을 확인해 직접 수정하세요.</p>
  </section>
  <section class="panel">
    <h2>2. 종합부동산세 (선택)</h2>
    <label for="sumPub">보유 주택 공시가격 합계 <span class="opt">(만원, 0이면 계산 안 함)</span></label>
    <input type="text" id="sumPub" data-comma value="0" />
    <div class="row2">
      <div>
        <label for="jfmr">종부세 공정시장가액비율 <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
        <input type="number" id="jfmr" step="1" min="0" max="100" value="${holding.jongbuFairRatio.value.pct}" />
      </div>
      <div>
        <label for="own">주택 수</label>
        <select id="own">
          <option value="1">2주택 이하 (일반세율)</option>
          <option value="3">3주택 이상 (중과세율)</option>
        </select>
      </div>
    </div>
    <p class="note warn">종부세는 <strong>재산세 공제, 세부담 상한, 1주택 고령자·장기보유 세액공제, 농어촌특별세(종부세액의 20%)</strong>가 결과를 크게 바꿉니다. 이 계산기는 이를 <strong>모두 제외</strong>한 상한 근사치이므로 실제 고지세액보다 클 수 있습니다. 홈택스 모의계산으로 확인하세요.</p>
    ${GO("보유세 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>보유세는 두 개의 세금</h2>
    <p>집을 갖고 있으면 매년 <strong>재산세</strong>(지방세, 7월·9월 분납)와 일정 금액을 넘으면 <strong>종합부동산세</strong>(국세, 12월)를 냅니다. 두 세금 모두 시가가 아니라 <strong>공시가격 × 공정시장가액비율 = 과세표준</strong>에서 출발합니다. 공시가격이 그대로 세금이 되는 게 아니라는 뜻입니다.</p>
    <p>재산세에는 본세 외에 도시지역분(과세표준의 0.14%)과 지방교육세(본세의 20%)가 함께 부과되어 고지서 총액은 본세보다 훨씬 큽니다. 이 계산기는 그 셋을 분리해 보여줍니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>부동산공시가격알리미에서 확인한 공시가격을 입력합니다.</li>
      <li>1세대 1주택 여부를 체크합니다. 공시 9억 이하 1주택은 특례세율이 적용됩니다.</li>
      <li>당해연도 공정시장가액비율을 확인해 수정합니다.</li>
      <li>종부세가 궁금하면 보유 주택 공시가격 합계를 입력합니다(0이면 계산하지 않습니다).</li>
    </ol>`,
  faq: [
    { q: "1세대 1주택 특례세율은 얼마나 차이 나나요?", a: "공시 9억 이하 1주택은 0.05~0.35%의 특례세율이 적용되어 표준세율(0.1~0.4%)보다 낮습니다. 과세표준 1.5억 구간에서 대략 절반 수준입니다." },
    { q: "종부세 기본공제는 얼마인가요?", a: "인별 합산 공시가격에서 9억원(1세대 1주택 단독명의는 12억원)을 공제합니다. 공제 후 금액에 공정시장가액비율을 곱해 과세표준을 구합니다." },
    { q: "왜 실제 고지서보다 크게 나오나요?", a: "종부세는 이미 낸 재산세를 공제하고, 전년 대비 세부담 상한이 걸리며, 고령자·장기보유 세액공제가 최대 80%까지 적용될 수 있습니다. 이 계산기는 그 항목들을 제외한 근사치입니다." },
    { q: "부부 공동명의는 어떻게 되나요?", a: "종부세는 인별 과세라 각자 9억씩 공제받는 방식과 1주택 특례를 신청하는 방식 중 유리한 쪽을 고를 수 있습니다. 이 계산기는 단독 기준입니다." },
  ],
  sources: srcTable([
    ["재산세 표준세율", holding.propertyTaxStandard, "0.1~0.4% 누진"],
    ["1주택 특례세율", holding.propertyTaxOneHome, "공시 9억 이하 0.05~0.35%"],
    ["공정시장가액비율(재산세)", holding.fairMarketRatio, "60% — 1주택 특례는 미반영"],
    ["도시지역분", holding.urbanAreaTax, "과세표준 0.14%"],
    ["지방교육세", holding.localEduTax, "재산세 본세 20%"],
    ["종부세 기본공제", holding.jongbuDeduction, "9억 / 1주택 12억"],
    ["종부세 공정시장가액비율", holding.jongbuFairRatio, "60% — 시행령 변동 가능"],
    ["종부세 세율", holding.jongbuRates, "0.5~5.0% 누진"],
    ["간이계산 제외 항목", holding.simplifiedNote, "재산세 공제·세부담 상한·세액공제 제외"],
  ]),
  script: `import { progressiveTax, marginalTax } from "__U__assets/calc.mjs";
import { holding } from "__U__data/holding.mjs";
${IMPORTS}
echo("pub", "pubEcho");
$("go").addEventListener("click", function () {
  var pub = man("pub"), fmr = raw("fmr");
  if (pub <= 0) { setText("big", "공시가격을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var base = Math.round(pub * fmr / 100);
  var useOne = on("oneHome") && pub <= holding.propertyTaxOneHome.value.maxOfficialPrice;
  var brackets = useOne ? holding.propertyTaxOneHome.value.brackets : holding.propertyTaxStandard.value;
  var main = progressiveTax(base, brackets);
  var urban = on("urban") ? Math.round(base * holding.urbanAreaTax.value.ratePct / 100) : 0;
  var edu = Math.round(main * holding.localEduTax.value.ratePct / 100);
  var propTotal = main + urban + edu;
  var rows = [
    ["공시가격", eok(pub)],
    ["과세표준 = 공시가격 × 공정시장가액비율 " + pctStr(fmr, 0), won(base)],
    ["적용 세율표", useOne ? "1세대 1주택 특례(공시 9억 이하)" : "표준세율"],
    ["① 재산세 본세 (누진)", won(main)],
    ["② 도시지역분 = 과세표준 × " + holding.urbanAreaTax.value.ratePct + "%" + (on("urban") ? "" : " (미포함)"), won(urban)],
    ["③ 지방교육세 = 본세 × " + holding.localEduTax.value.ratePct + "%", won(edu)],
    ["재산세 합계 ①+②+③", won(propTotal)]
  ];
  var sum = man("sumPub"), jongbu = 0;
  if (sum > 0) {
    var ded = on("oneHome") ? holding.jongbuDeduction.value.oneHomeWon : holding.jongbuDeduction.value.basicWon;
    var excess = Math.max(0, sum - ded);
    var jbase = Math.round(excess * raw("jfmr") / 100);
    var jrates = $("own").value === "3" ? holding.jongbuRates.value.multi3 : holding.jongbuRates.value.general;
    jongbu = marginalTax(jbase, jrates);
    rows.push(["④ 종부세 대상 = 합산 공시 " + eok(sum) + " − 기본공제 " + eok(ded), won(excess)]);
    rows.push(["⑤ 종부세 과세표준 = ④ × " + pctStr(raw("jfmr"), 0), won(jbase)]);
    rows.push(["⑥ 종부세액 (누진, 공제·상한 제외)", won(jongbu)]);
  }
  var total = propTotal + jongbu;
  setText("big", won(total));
  setText("sub", "재산세 " + won(propTotal) + (sum > 0 ? " + 종부세(추정) " + won(jongbu) : " · 종부세 미계산"));
  setHtml("detail", fbox("산출 과정", rows, "종부세는 재산세 공제·세부담 상한·고령자/장기보유 세액공제·농어촌특별세를 제외한 근사치입니다. 실제 세액은 홈택스 모의계산으로 확인하세요.")
    + srcLine("재산세 세율", useOne ? holding.propertyTaxOneHome : holding.propertyTaxStandard)
    + srcLine("공정시장가액비율", holding.fairMarketRatio)
    + srcLine("도시지역분", holding.urbanAreaTax)
    + (sum > 0 ? srcLine("종부세 세율", holding.jongbuRates) + srcLine("종부세 공정비율", holding.jongbuFairRatio) : ""));
  showResult();
});`,
  related: [{ slug: "rent-yield", e: "📈", n: "임대수익률 계산기" }, { slug: "acquisition-tax", e: "🧾", n: "취득세 계산기" }, T.yangdo, T.capital],
},

/* 9 ─────────────────────────── 임대수익률 */
{
  slug: "rent-yield", emoji: "📈", nav: "임대수익률 계산기",
  hubName: "임대수익률 계산기", hubDesc: "표면수익률과 <strong>대출·부대비용을 반영한 실질수익률</strong>을 함께 계산합니다.",
  title: "임대수익률 계산기 — 표면·실질(레버리지) 수익률 동시 계산",
  ogTitle: "임대수익률 계산기 (실질 수익률 포함)",
  desc: "매매가·보증금·월세로 표면수익률을 구하고, 대출 이자와 취득 부대비용·운영비까지 반영한 실질수익률(자기자본 대비)을 함께 계산합니다. 월세 수익형 부동산 검토에 쓰는 기본 지표를 산식과 함께 보여줍니다.",
  h1: "임대수익률 계산기",
  lead: `표면수익률은 광고용, 판단 기준은 <strong>내 돈 대비 실질수익률</strong>입니다.`,
  body: `
  <section class="panel">
    <h2>물건 정보</h2>
    <div class="row2">
      <div>
        <label for="price">매매가 <span class="opt">(만원)</span></label>
        <input type="text" id="price" data-comma value="20,000" />
        <p class="src" id="priceEcho"></p>
      </div>
      <div>
        <label for="deposit">임대 보증금 <span class="opt">(만원)</span></label>
        <input type="text" id="deposit" data-comma value="1,000" />
      </div>
    </div>
    <div class="row2">
      <div>
        <label for="monthly">월세 <span class="opt">(만원)</span></label>
        <input type="text" id="monthly" data-comma value="70" />
      </div>
      <div>
        <label for="expense">월 운영비 <span class="opt">(만원, 관리·수선·보험)</span></label>
        <input type="text" id="expense" data-comma value="5" />
      </div>
    </div>
  </section>
  <section class="panel">
    <h2>대출과 부대비용</h2>
    <div class="row2">
      <div>
        <label for="loan">대출금액 <span class="opt">(만원)</span></label>
        <input type="text" id="loan" data-comma value="10,000" />
      </div>
      <div>
        <label for="loanRate">대출금리 <span class="opt">(%, 이자만)</span></label>
        <input type="number" id="loanRate" step="0.01" value="4.5" />
      </div>
    </div>
    <label for="extra">취득 부대비용 <span class="opt">(만원, 취득세·중개보수·등기 등)</span></label>
    <input type="text" id="extra" data-comma value="0" />
    <p class="note">부대비용은 <a href="../move-in-cost/">입주 총비용 계산기</a>에서 계산한 금액을 넣으면 자기자본이 정확해집니다. 공실률·재산세는 이 계산에 포함되지 않으니 운영비에 월 환산해 넣으세요.</p>
    ${GO("수익률 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>표면수익률과 실질수익률</h2>
    <p><strong>표면수익률</strong>은 연 월세를 (매매가 − 보증금)으로 나눈 값입니다. 매물 광고에 적힌 수익률은 대부분 이것이며, 대출 이자도 세금도 공실도 빠져 있습니다.</p>
    <p><strong>실질수익률</strong>은 실제로 들어간 내 돈, 즉 매매가에서 보증금과 대출을 빼고 취득 부대비용을 더한 금액을 분모로 씁니다. 분자에서는 대출 이자와 운영비를 뺍니다. 대출금리가 표면수익률보다 높으면 레버리지를 쓸수록 실질수익률이 <strong>떨어진다</strong>는 사실도 이 계산에서 바로 드러납니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>매매가·보증금·월세를 입력합니다.</li>
      <li>관리비 자부담·수선충당·화재보험 등 월 운영비를 넣습니다. 공실 위험은 월세의 5~10%를 운영비에 더해 보수적으로 잡는 방법이 있습니다.</li>
      <li>대출금액과 금리를 넣습니다(이자만 계산, 원금 상환은 수익률이 아니라 현금흐름 문제입니다).</li>
      <li>취득세·중개보수·등기비용 합계를 부대비용에 넣으면 자기자본 기준이 정확해집니다.</li>
    </ol>`,
  faq: [
    { q: "왜 매매가에서 보증금을 빼나요?", a: "보증금은 임차인에게 받은 돈이라 실제 투입 자본이 줄어드는 효과가 있기 때문입니다. 다만 계약 종료 시 돌려줘야 할 부채이므로 매도 계획과 함께 봐야 합니다." },
    { q: "대출을 많이 받으면 수익률이 올라가나요?", a: "대출금리가 표면수익률보다 낮을 때만 그렇습니다. 금리가 더 높으면 레버리지를 키울수록 실질수익률이 낮아집니다. 금리를 바꿔 가며 확인해 보세요." },
    { q: "세금은 반영되나요?", a: "재산세·종부세·임대소득세는 반영되지 않습니다. 보유세는 보유세 계산기로 따로 구해 월 환산해 운영비에 넣으면 더 현실적인 숫자가 됩니다." },
    { q: "공실은 어떻게 반영하나요?", a: "1년 중 한 달 공실을 가정하면 연 월세가 약 8% 줄어듭니다. 운영비에 월세의 8% 정도를 더하는 방식으로 보수적으로 계산할 수 있습니다." },
  ],
  sources: srcTable([
    ["재산세 표준세율(참고)", holding.propertyTaxStandard, "보유세는 별도 계산 필요"],
    ["중개보수 요율(참고)", brokerFee.saleBrackets, "부대비용 산정 시 사용"],
  ]),
  script: `import { rentYield } from "__U__assets/calc.mjs";
${IMPORTS}
echo("price", "priceEcho");
$("go").addEventListener("click", function () {
  var price = man("price"), dep = man("deposit"), mo = man("monthly"), exp = man("expense");
  var loan = man("loan"), lr = raw("loanRate"), extra = man("extra");
  if (price <= 0 || mo <= 0) { setText("big", "매매가와 월세를 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var r = rentYield({ price: price, deposit: dep, monthly: mo, loan: loan, loanRatePct: lr, expenseMonthly: exp });
  var invested = price - dep - loan + extra;
  var netAnnual = mo * 12 - exp * 12 - loan * lr / 100;
  var netPct = invested > 0 ? netAnnual / invested * 100 : NaN;
  var rows = [
    ["연 월세 수입 = 월세 × 12", won(mo * 12)],
    ["표면수익률 = 연 월세 ÷ (매매가 − 보증금) × 100", pctStr(r.gross, 2)],
    ["연 운영비 = 월 운영비 × 12", "− " + won(exp * 12)],
    ["연 대출이자 = 대출 " + eok(loan) + " × " + pctStr(lr, 2), "− " + won(loan * lr / 100)],
    ["연 순수익", won(netAnnual)],
    ["투입 자기자본 = 매매가 − 보증금 − 대출 + 부대비용", won(invested)],
    ["실질수익률 = 연 순수익 ÷ 자기자본 × 100", pctStr(netPct, 2)],
    ["월 현금흐름 = (월세 − 운영비 − 월 이자)", won(mo - exp - loan * lr / 100 / 12)]
  ];
  setText("big", pctStr(netPct, 2));
  setText("sub", "표면 " + pctStr(r.gross, 2) + " · 자기자본 " + eok(invested) + " 기준 실질수익률");
  setHtml("detail", fbox("산출 과정", rows, "재산세·종부세·임대소득세와 공실은 반영되지 않았습니다. 대출은 이자만 계산했고 원금 상환은 현금흐름에서 별도로 고려해야 합니다."));
  showResult();
});`,
  related: [{ slug: "holding-tax", e: "🏛️", n: "보유세 계산기" }, { slug: "move-in-cost", e: "📦", n: "입주 총비용 계산기" }, T.convert, T.capital],
},

/* 10 ────────────────────────── 예산(DSR 역산) */
{
  slug: "affordability", emoji: "🏡", nav: "내 집 마련 예산",
  hubName: "내 집 마련 예산 계산기", hubDesc: "DSR을 <strong>역산</strong>해 최대 대출을 구하고 LTV와 비교해 살 수 있는 집값을 계산합니다.",
  title: "내 집 마련 예산 계산기 — DSR 역산으로 구하는 최대 대출·집값",
  ogTitle: "얼마짜리 집을 살 수 있을까 (DSR 역산)",
  desc: "연소득과 기존 대출, 자기자본을 넣으면 DSR 한도를 역산해 최대 대출금액을 구하고, LTV 상한과 비교해 실제로 매수 가능한 주택 가격을 계산합니다. 취득 부대비용까지 감안한 현실적인 예산을 보여줍니다.",
  h1: "내 집 마련 예산 계산기",
  lead: `"얼마짜리 집을 살 수 있나"는 <strong>DSR 역산</strong>으로 답합니다. LTV 상한과 비교해 더 낮은 쪽이 정답입니다.`,
  body: `
  <section class="panel">
    <h2>1. 소득과 기존 부채</h2>
    <div class="row2">
      <div>
        <label for="income">연소득 <span class="opt">(만원, 세전)</span></label>
        <input type="text" id="income" data-comma value="6,000" />
      </div>
      <div>
        <label for="limit">적용 DSR 한도</label>
        <select id="limit">
          <option value="40">은행권 40%</option>
          <option value="50">제2금융권 50%</option>
        </select>
      </div>
    </div>
    <label for="existing">기존 대출의 연간 원리금 합계 <span class="opt">(만원)</span></label>
    <input type="text" id="existing" data-comma value="0" />
    <p class="note">기존 원리금이 얼마인지 모르면 <a href="../dsr/">DSR 계산기</a>에서 먼저 구해 오세요.</p>
  </section>
  <section class="panel">
    <h2>2. 대출 조건과 자기자본</h2>
    <div class="row3">
      <div>
        <label for="rate">금리 <span class="opt">(%)</span></label>
        <input type="number" id="rate" step="0.01" value="4.2" />
      </div>
      <div>
        <label for="years">기간 <span class="opt">(년)</span></label>
        <input type="number" id="years" step="1" value="30" />
      </div>
      <div>
        <label for="stress">스트레스 가산 <span class="opt">(%p)</span> <span class="badge warn">확인 필요</span></label>
        <input type="number" id="stress" step="0.01" value="0" />
      </div>
    </div>
    <div class="row2">
      <div>
        <label for="cash">자기자본 <span class="opt">(만원, 현금)</span></label>
        <input type="text" id="cash" data-comma value="20,000" />
      </div>
      <div>
        <label for="ltv">적용 LTV <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
        <input type="number" id="ltv" step="1" min="0" max="100" value="70" />
      </div>
    </div>
    <label for="costPct">취득 부대비용 가정 <span class="opt">(집값의 %, 취득세·중개보수·등기)</span></label>
    <input type="number" id="costPct" step="0.1" value="2" />
    <p class="note warn">스트레스 DSR 가산금리와 LTV 상한은 <strong>확정값을 넣지 않았습니다</strong>. 최신 기준을 확인해 직접 입력해야 현실적인 결과가 나옵니다.</p>
    ${GO("예산 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>집값부터 정하면 틀립니다</h2>
    <p>대부분 "이 집을 사려면 대출이 얼마 필요한가"를 계산하지만, 실제 심사는 반대로 갑니다. 은행은 <strong>내 소득으로 감당 가능한 연 원리금</strong>을 먼저 정하고(DSR 한도), 거기서 역산해 대출 가능액을 뽑습니다. 이 계산기는 그 순서를 그대로 따릅니다.</p>
    <p>계산은 두 갈래입니다. ① DSR 한도로 정해지는 최대 대출액, ② LTV 상한(집값 × LTV)으로 정해지는 최대 대출액. 둘 중 <strong>작은 쪽</strong>이 실제 한도이며, 여기에 자기자본을 더한 값이 매수 가능한 집값의 상한입니다. 취득세·중개보수·등기비로 집값의 2% 안팎이 추가로 나가므로 그만큼 예산을 줄여 잡아야 합니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>세전 연소득과 기존 대출의 연간 원리금을 입력합니다.</li>
      <li>금리·기간을 넣고, 확인한 스트레스 가산금리가 있으면 더합니다.</li>
      <li>보유 현금(자기자본)과 적용 LTV를 입력합니다.</li>
      <li>결과에서 DSR 기준과 LTV 기준 중 어느 쪽이 내 한도를 결정하는지 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "DSR 기준과 LTV 기준 중 뭐가 중요한가요?", a: "둘 중 더 낮은 쪽이 실제 한도입니다. 소득이 낮으면 DSR이, 현금이 적으면 LTV가 발목을 잡습니다. 결과에 어느 쪽이 제약인지 표시됩니다." },
    { q: "부대비용은 왜 빼야 하나요?", a: "취득세·중개보수·등기비·이사비는 대출로 충당하기 어려워 현금에서 나갑니다. 집값의 2% 안팎을 가정으로 두었으니 실제 견적으로 바꿔 계산하세요." },
    { q: "생활비 여유는 반영되나요?", a: "아니요. DSR 한도를 꽉 채우면 월 상환액이 소득의 상당 부분을 차지합니다. 결과의 월 상환액을 보고 감당 가능한지 스스로 판단해야 합니다." },
    { q: "전세를 끼고 사는 경우는요?", a: "이 계산기는 대출 기반 매수 기준입니다. 보증금을 승계하는 방식은 자기자본과 대출 구조가 달라 별도 검토가 필요합니다." },
  ],
  sources: srcTable([
    ["차주단위 DSR 한도", loanRules.dsrLimit, "은행 40% / 비은행 50%"],
    ["스트레스 DSR 가산금리", loanRules.stressRate, "계산 제외 — 직접 입력(기본 0)"],
    ["LTV 상한", loanRules.ltvPresets, "직접 입력 — 프리셋은 참고용"],
  ]),
  script: `import { dsrMaxLoan, monthlyPayment } from "__U__assets/calc.mjs";
import { loanRules } from "__U__data/loan.mjs";
${IMPORTS}
$("go").addEventListener("click", function () {
  var income = man("income"), lim = Number($("limit").value), ex = man("existing");
  var rate = raw("rate"), stress = raw("stress"), years = raw("years");
  var cash = man("cash"), ltv = raw("ltv"), costPct = raw("costPct");
  if (income <= 0 || years <= 0) { setText("big", "연소득과 기간을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var d = dsrMaxLoan({ annualIncome: income, dsrLimitPct: lim, existingAnnual: ex, ratePct: rate, stressAddPct: stress, months: years * 12 });
  var dsrLoan = Math.max(0, d.maxLoan);
  // 집값 P: 대출 L = min(dsrLoan, P×LTV), 자기자본 = P×(1+부대비용%) − L
  var k = 1 + costPct / 100;
  var pLtv = ltv > 0 ? cash / (k - ltv / 100) : cash / k;      // LTV가 제약일 때(ltv 0이면 전액 자기자본)
  var pDsr = (cash + dsrLoan) / k;                              // DSR이 제약일 때
  var price = Math.max(0, Math.min(pLtv, pDsr));
  var loan = Math.min(dsrLoan, price * ltv / 100);
  var bind = pLtv < pDsr ? "LTV(자기자본)" : "DSR(소득)";
  var pay = monthlyPayment(loan, rate + stress, years * 12);
  var rows = [
    ["연소득 × DSR 한도 " + lim + "%", won(income * lim / 100)],
    ["− 기존 대출 연 원리금", "− " + won(ex)],
    ["신규 대출에 쓸 수 있는 연 원리금", won(d.capacityYear)],
    ["월 상환 여력 = ÷ 12", won(d.monthlyBudget)],
    ["① DSR 기준 최대 대출 (금리 " + pctStr(rate + stress, 2) + " · " + years + "년 역산)", won(dsrLoan)],
    ["② LTV 기준 = 집값 × " + pctStr(ltv, 0), won(price * ltv / 100)],
    ["실제 대출 = 둘 중 작은 값", won(loan)],
    ["자기자본", won(cash)],
    ["취득 부대비용 가정 = 집값 × " + pctStr(costPct, 1), won(price * costPct / 100)],
    ["매수 가능 집값 (부대비용 포함 예산 반영)", won(price)],
    ["예상 월 상환액", won(pay)]
  ];
  setText("big", eok(price));
  setText("sub", "제약 조건: " + bind + " · 대출 " + eok(loan) + " · 월 상환 " + won(pay));
  setHtml("detail", fbox("산출 과정", rows, "실제 승인액은 소득 인정 방식·대출 종류별 산입 기준·물건 심사에 따라 달라집니다. 스트레스 가산금리를 0으로 두면 낙관적인 결과가 나옵니다.")
    + srcLine("DSR 한도", loanRules.dsrLimit)
    + srcLine("스트레스 DSR", loanRules.stressRate)
    + srcLine("LTV 상한", loanRules.ltvPresets));
  showResult();
});`,
  related: [{ slug: "dsr", e: "📉", n: "DSR 계산기" }, { slug: "ltv", e: "📐", n: "LTV 한도 계산기" }, T.dsrLimit, T.jeonse],
},

/* 11 ────────────────────────── 대출 비교 */
{
  slug: "loan-compare", emoji: "⚖️", nav: "대출 비교 계산기",
  hubName: "주담대 비교 계산기", hubDesc: "두 대출을 <strong>중도상환수수료까지 포함한 총비용</strong>으로 비교합니다.",
  title: "주택담보대출 비교 계산기 — 중도상환수수료 포함 총비용 비교",
  ogTitle: "대출 비교 계산기 (중도상환수수료 포함)",
  desc: "금리·기간·상환방식이 다른 두 대출을 월 상환액, 총이자, 중도상환 시 잔액과 수수료까지 포함한 총비용으로 비교합니다. 원리금균등·원금균등을 모두 지원하고 수수료 체감(슬라이딩) 방식도 반영합니다.",
  h1: "주택담보대출 비교 계산기",
  lead: `금리만 보면 틀립니다. <strong>중도상환수수료까지 포함한 총비용</strong>으로 비교하세요.`,
  body: `
  <section class="panel">
    <h2>공통 조건</h2>
    <div class="row2">
      <div>
        <label for="amount">대출금액 <span class="opt">(만원)</span></label>
        <input type="text" id="amount" data-comma value="30,000" />
      </div>
      <div>
        <label for="prepayMonth">중도상환(전액) 시점 <span class="opt">(개월, 0이면 만기까지)</span></label>
        <input type="number" id="prepayMonth" step="1" min="0" value="36" />
      </div>
    </div>
    <label><input type="checkbox" id="sliding" checked /> 수수료 체감(슬라이딩) 방식 — 잔여 면제기간 비례로 감소</label>
    <div class="row2">
      <div>
        <label for="exempt">수수료 면제기간 <span class="opt">(개월, 통상 36)</span></label>
        <input type="number" id="exempt" step="1" min="1" value="36" />
      </div>
      <div></div>
    </div>
  </section>
  <section class="panel">
    <h2>A안</h2>
    <div class="row3">
      <div>
        <label for="aRate">금리 <span class="opt">(%)</span></label>
        <input type="number" id="aRate" step="0.01" value="3.9" />
      </div>
      <div>
        <label for="aYears">기간 <span class="opt">(년)</span></label>
        <input type="number" id="aYears" step="1" value="30" />
      </div>
      <div>
        <label for="aFee">중도상환수수료율 <span class="opt">(%)</span></label>
        <input type="number" id="aFee" step="0.01" value="1.2" />
      </div>
    </div>
    <label for="aType">상환방식</label>
    <select id="aType"><option value="ep">원리금균등</option><option value="pp">원금균등</option></select>
  </section>
  <section class="panel">
    <h2>B안</h2>
    <div class="row3">
      <div>
        <label for="bRate">금리 <span class="opt">(%)</span></label>
        <input type="number" id="bRate" step="0.01" value="4.3" />
      </div>
      <div>
        <label for="bYears">기간 <span class="opt">(년)</span></label>
        <input type="number" id="bYears" step="1" value="30" />
      </div>
      <div>
        <label for="bFee">중도상환수수료율 <span class="opt">(%)</span></label>
        <input type="number" id="bFee" step="0.01" value="0" />
      </div>
    </div>
    <label for="bType">상환방식</label>
    <select id="bType"><option value="ep">원리금균등</option><option value="pp">원금균등</option></select>
    <p class="note">수수료율·면제기간·체감 방식은 상품마다 다릅니다. 약정서의 수치를 그대로 넣으세요. 이 계산기는 <strong>보험료·인지세 등 부대비용은 포함하지 않습니다</strong>.</p>
    ${GO("총비용 비교하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>총비용으로 비교해야 하는 이유</h2>
    <p>금리 0.4%p 차이는 3억 30년 기준 월 7만원 안팎입니다. 그런데 3년 안에 갈아타거나 집을 팔 계획이라면 이야기가 달라집니다. 낮은 금리 상품에 <strong>중도상환수수료</strong>가 붙어 있으면, 3년 시점에 남은 원금의 1% 안팎을 한 번에 물어야 하고 그 금액이 이자 절감분을 통째로 삼킬 수 있습니다.</p>
    <p>이 계산기는 두 상품을 ① 월 상환액, ② 보유 기간 동안 낸 이자, ③ 중도상환 시점의 잔액과 수수료, ④ 총비용(이자+수수료)으로 나란히 비교합니다. 상환방식(원리금균등/원금균등)도 각각 고를 수 있습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>대출금액과 중도상환(전액상환) 예정 시점을 개월로 입력합니다. 만기까지 갈 계획이면 0을 넣습니다.</li>
      <li>A·B 각각의 금리·기간·상환방식·중도상환수수료율을 넣습니다.</li>
      <li>수수료가 잔여기간에 비례해 줄어드는 상품이면 체감 방식을 체크하고 면제기간을 맞춥니다.</li>
      <li>결과 표에서 총비용이 낮은 쪽과 차액을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "중도상환수수료는 어떻게 계산되나요?", a: "일반적으로 상환원금 × 수수료율 × (잔여 면제기간 ÷ 전체 면제기간)입니다. 3년이 지나면 대개 면제됩니다. 상품에 따라 정률로만 부과하기도 해 체감 방식 체크를 해제할 수 있습니다." },
    { q: "원금균등이 항상 유리한가요?", a: "총이자는 원금균등이 적지만 초기 상환액이 큽니다. 초기 현금흐름이 빠듯하면 원리금균등이 안전하고, 여유가 있으면 원금균등이 이자 측면에서 유리합니다." },
    { q: "변동금리는 어떻게 비교하나요?", a: "이 계산기는 고정금리 가정입니다. 변동금리는 금리를 몇 가지 시나리오로 바꿔 가며 총비용을 비교해 보는 방식으로 활용하세요." },
    { q: "갈아타기(대환)도 계산되나요?", a: "기존 대출을 중도상환하고 새 대출을 받는 구조이므로, A안에 기존 조건과 수수료를, B안에 새 조건을 넣어 총비용을 비교하면 됩니다." },
  ],
  sources: srcTable([
    ["차주단위 DSR 한도", loanRules.dsrLimit, "대환 시에도 DSR 재심사 대상"],
    ["스트레스 DSR 가산금리", loanRules.stressRate, "계산 제외 — 한도 판정 시 확인"],
  ]),
  script: `import { monthlyPayment, remainingBalance, cumulativeInterest, equalPrincipal, equalPrincipalBalance, equalPrincipalCumInterest, prepayFee, totalInterest } from "__U__assets/calc.mjs";
${IMPORTS}
function plan(pre, amount, months0) {
  var rate = raw(pre + "Rate"), years = raw(pre + "Years"), fee = raw(pre + "Fee"), type = $(pre + "Type").value;
  var months = years * 12;
  var k = months0 > 0 ? Math.min(months0, months) : months;
  var first, interest, bal, totInt;
  if (type === "ep") {
    first = monthlyPayment(amount, rate, months);
    interest = cumulativeInterest(amount, rate, months, k);
    bal = remainingBalance(amount, rate, months, k);
    totInt = totalInterest(amount, rate, months);
  } else {
    var e = equalPrincipal(amount, rate, months);
    first = e.firstPayment;
    interest = equalPrincipalCumInterest(amount, rate, months, k);
    bal = equalPrincipalBalance(amount, months, k);
    totInt = e.totalInterest;
  }
  var fe = prepayFee(bal, fee, { sliding: on("sliding"), exemptMonths: raw("exempt") || 36, paidMonths: k });
  return { rate: rate, years: years, type: type === "ep" ? "원리금균등" : "원금균등", first: first, interest: interest, bal: bal, fee: fe, totInt: totInt, total: interest + fe, months: months, k: k };
}
$("go").addEventListener("click", function () {
  var amount = man("amount"), pm = raw("prepayMonth");
  if (amount <= 0) { setText("big", "대출금액을 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var a = plan("a", amount, pm), b = plan("b", amount, pm);
  var diff = Math.abs(a.total - b.total);
  var winner = a.total <= b.total ? "A안" : "B안";
  setText("big", winner + "이 " + won(diff) + " 유리");
  setText("sub", (pm > 0 ? pm + "개월 시점 전액상환 기준" : "만기까지 보유 기준") + " · 이자 + 중도상환수수료 합계 비교");
  var h = '<div class="tbwrap"><table class="tb"><thead><tr><th>항목</th><th>A안</th><th>B안</th></tr></thead><tbody>';
  function row(label, va, vb) { h += "<tr><td>" + label + "</td><td>" + va + "</td><td>" + vb + "</td></tr>"; }
  row("조건", pctStr(a.rate, 2) + " · " + a.years + "년 · " + a.type, pctStr(b.rate, 2) + " · " + b.years + "년 · " + b.type);
  row("첫 달 상환액", won(a.first), won(b.first));
  row("만기까지 총이자", won(a.totInt), won(b.totInt));
  row((pm > 0 ? pm + "개월간 낸 이자" : "총이자"), won(a.interest), won(b.interest));
  row((pm > 0 ? pm + "개월 시점 잔액" : "만기 잔액"), won(a.bal), won(b.bal));
  row("중도상환수수료", won(a.fee), won(b.fee));
  row("<b>총비용 (이자+수수료)</b>", "<b>" + won(a.total) + "</b>", "<b>" + won(b.total) + "</b>");
  h += "</tbody></table></div>";
  var rows = [
    ["중도상환수수료 산식", "잔액 × 수수료율" + (on("sliding") ? " × (잔여 면제기간 ÷ " + (raw("exempt") || 36) + "개월)" : " (정률)")],
    ["A안 수수료", won(a.bal) + " × " + pctStr(raw("aFee"), 2) + (on("sliding") ? " × " + Math.max(0, (raw("exempt") || 36) - a.k) + "/" + (raw("exempt") || 36) : "") + " = " + won(a.fee)],
    ["B안 수수료", won(b.bal) + " × " + pctStr(raw("bFee"), 2) + (on("sliding") ? " × " + Math.max(0, (raw("exempt") || 36) - b.k) + "/" + (raw("exempt") || 36) : "") + " = " + won(b.fee)],
    ["총비용 차액", won(diff)]
  ];
  setHtml("detail", h + fbox("산출 과정", rows, "인지세·근저당 설정비·보증료 등 부대비용과 세제 혜택(주담대 이자 소득공제)은 포함하지 않았습니다."));
  showResult();
});`,
  related: [{ slug: "dsr", e: "📉", n: "DSR 계산기" }, { slug: "affordability", e: "🏡", n: "내 집 마련 예산 계산기" }, T.refi, T.loanRefi],
},

/* 12 ────────────────────────── 입주 총비용 */
{
  slug: "move-in-cost", emoji: "📦", nav: "입주 총비용",
  hubName: "입주 총비용 계산기", hubDesc: "취득세 + 중개보수 + 등기 + 이사·청소까지 <strong>한 번에 합산</strong>합니다.",
  title: "입주 총비용 계산기 — 취득세·중개보수·등기·이사비 합산",
  ogTitle: "집 살 때 총 얼마 드나 (입주 총비용)",
  desc: "매매가만 넣으면 취득세와 지방교육세·농특세, 중개보수 상한, 등기신청수수료·인지세·국민주택채권, 법무사 보수, 이사비·입주청소까지 한 번에 합산해 실제로 준비해야 할 현금 총액을 보여줍니다.",
  h1: "입주 총비용 계산기",
  lead: `집값 말고 <strong>추가로 나가는 돈</strong>. 취득세·중개보수·등기·이사비를 한 화면에서 합산합니다.`,
  body: `
  <section class="panel">
    <h2>1. 매매 정보</h2>
    <label for="price">매매가 <span class="opt">(만원)</span></label>
    <input type="text" id="price" data-comma value="50,000" />
    <p class="src" id="priceEcho"></p>
    <div class="row2">
      <div>
        <label for="homes">취득 후 보유 주택 수</label>
        <select id="homes">
          <option value="1">1주택 (표준세율)</option>
          <option value="2">2주택</option>
          <option value="3">3주택</option>
          <option value="4">4주택 이상</option>
        </select>
      </div>
      <div>
        <label for="stdPrice">시가표준액 <span class="opt">(만원, 채권 기준)</span></label>
        <input type="text" id="stdPrice" data-comma value="35,000" />
      </div>
    </div>
    <label><input type="checkbox" id="adjusted" /> 조정대상지역</label>
    <label><input type="checkbox" id="over85" /> 전용면적 85㎡ 초과</label>
  </section>
  <section class="panel">
    <h2>2. 중개·등기</h2>
    <label><input type="checkbox" id="useBroker" checked /> 중개보수 포함(법정 상한 기준)</label>
    <label><input type="checkbox" id="vat" /> 중개보수 부가세 10% 포함</label>
    <div class="row2">
      <div>
        <label for="bondRegion">채권 매입률 지역</label>
        <select id="bondRegion">
          <option value="metro">특별시·광역시</option>
          <option value="other">그 밖의 지역</option>
        </select>
      </div>
      <div>
        <label for="discount">채권 할인율 <span class="opt">(%)</span> <span class="badge warn">확인 필요</span></label>
        <input type="number" id="discount" step="0.001" min="0" placeholder="비우면 채권 제외" />
      </div>
    </div>
    <div class="row2">
      <div>
        <label for="legal">법무사 보수 <span class="opt">(만원)</span></label>
        <input type="text" id="legal" data-comma value="0" />
      </div>
      <div>
        <label for="mortgage">근저당 설정금액 <span class="opt">(만원)</span></label>
        <input type="text" id="mortgage" data-comma value="0" />
      </div>
    </div>
  </section>
  <section class="panel">
    <h2>3. 이사·정착 비용</h2>
    <div class="row3">
      <div>
        <label for="moving">이사비 <span class="opt">(만원)</span></label>
        <input type="text" id="moving" data-comma value="120" />
      </div>
      <div>
        <label for="cleaning">입주청소 <span class="opt">(만원)</span></label>
        <input type="text" id="cleaning" data-comma value="40" />
      </div>
      <div>
        <label for="etc">기타(도배·수리 등) <span class="opt">(만원)</span></label>
        <input type="text" id="etc" data-comma value="0" />
      </div>
    </div>
    ${GO("총비용 계산하기")}
  </section>
  ${RESULT}`,
  intro: `<h2>집값 외에 나가는 돈</h2>
    <p>5억짜리 집을 사면 5억만 준비하면 될까요? 취득세와 지방교육세로 550만원, 중개보수 상한으로 200만원, 등기 관련 비용과 법무사 보수로 수십만~수백만원, 이사비와 입주청소로 150만원 안팎이 추가로 나갑니다. 통상 <strong>집값의 1.5~3%</strong>가 별도 현금으로 필요하며, 이 돈은 대출로 충당하기 어렵습니다.</p>
    <p>이 계산기는 다른 계산기들의 로직을 그대로 불러와 한 화면에서 합산합니다. 항목별 근거는 각 계산기 페이지에서 확인할 수 있습니다.</p>`,
  howto: `<h2>사용법</h2>
    <ol>
      <li>매매가와 주택 수, 지역·면적 조건을 입력합니다.</li>
      <li>채권 할인율(인터넷등기소 당일 값)과 법무사 견적을 넣으면 등기비용이 정확해집니다.</li>
      <li>이사비·입주청소 견적을 넣습니다.</li>
      <li>결과에서 항목별 금액과 집값 대비 비율을 확인합니다.</li>
    </ol>`,
  faq: [
    { q: "대출로 부대비용을 충당할 수 있나요?", a: "일반적으로 어렵습니다. 주택담보대출은 매매대금 지급에 쓰이고 취득세·중개보수는 별도 현금이 필요합니다. 신용대출로 메우면 DSR이 올라가 주담대 한도가 줄어드는 역효과가 납니다." },
    { q: "채권 할인율을 비워 두면 어떻게 되나요?", a: "채권 본인부담을 0으로 두고 나머지만 합산합니다. 매일 바뀌는 값을 임의로 넣지 않기 위한 설계입니다. 통상 수십만원 수준이 추가된다고 보면 됩니다." },
    { q: "중개보수를 상한으로 계산하는 이유는?", a: "법정 상한이 계산 가능한 유일한 기준값이기 때문입니다. 실제로는 협의로 낮아지는 경우가 많으니 보수적인 예산으로 보세요." },
    { q: "전세 입주도 계산되나요?", a: "이 계산기는 매매 기준입니다. 전세는 취득세·등기 항목이 빠지고 중개보수와 이사비, 보증보험료가 주된 비용입니다." },
  ],
  sources: srcTable([
    ["취득세 표준세율", acquisition.standardRates, "6억 이하 1% / 6~9억 산식 / 9억 초과 3%"],
    ["다주택 중과세율", acquisition.surchargeRates, "8·12% (조문값, 확인 필요)"],
    ["중개보수 상한", brokerFee.saleBrackets, "구간별 요율·한도액"],
    ["등기신청수수료", registration.filingFee, "서면 15,000 / 전자 10,000원"],
    ["인지세", registration.stampDuty, "1억 이하 주택 비과세"],
    ["국민주택채권 매입률", registration.bondBrackets, "시가표준액·지역별"],
    ["채권 할인율", registration.bondDiscount, "계산 제외 — 직접 입력"],
  ]),
  script: `import { acquisitionTax, brokerFeeCalc, stampDuty } from "__U__assets/calc.mjs";
import { acquisition } from "__U__data/acquisition.mjs";
import { brokerFee } from "__U__data/brokerfee.mjs";
import { registration } from "__U__data/registration.mjs";
${IMPORTS}
echo("price", "priceEcho");
$("go").addEventListener("click", function () {
  var price = man("price");
  if (price <= 0) { setText("big", "매매가를 입력하세요"); setText("sub", ""); setHtml("detail", ""); showResult(); return; }
  var acq = acquisitionTax(price, { homes: Number($("homes").value), adjusted: on("adjusted"), areaOver85: on("over85") });
  var broker = 0, bRate = 0;
  if (on("useBroker")) {
    var bf = brokerFeeCalc(price, brokerFee.saleBrackets.value);
    bRate = bf.ratePct; broker = on("vat") ? Math.round(bf.fee * 1.1) : bf.fee;
  }
  var filing = registration.filingFee.value.eFormWon;
  var stamp = stampDuty(price, registration.stampDuty.value, { isHouse: true, houseExemptMax: registration.stampDutyHouseExempt.value.maxPriceWon });
  var std = man("stdPrice"), metro = $("bondRegion").value === "metro", br = null;
  for (var i = 0; i < registration.bondBrackets.value.length; i++) {
    var b = registration.bondBrackets.value[i];
    if (std >= b[0] && std < b[1]) { br = b; break; }
  }
  var bondPct = br ? (metro ? br[2] : br[3]) : 0;
  var bondBuy = br ? Math.round(std * bondPct / 100 / 10000) * 10000 : 0;
  var disc = raw("discount");
  var bondCost = disc > 0 ? Math.round(bondBuy * disc / 100) : 0;
  var legal = man("legal"), mort = man("mortgage");
  var mortTax = Math.round(mort * registration.mortgageRegTax.value.ratePct / 100);
  var mortEdu = Math.round(mortTax * registration.mortgageRegTax.value.eduSurchargePct / 100);
  var life = man("moving") + man("cleaning") + man("etc");
  var regTotal = filing + stamp + bondCost + legal + mortTax + mortEdu;
  var total = acq.total + broker + regTotal + life;
  var h = '<div class="tbwrap"><table class="tb"><thead><tr><th>항목</th><th>금액</th><th>산출 근거</th></tr></thead><tbody>';
  function row(a1, a2, a3) { h += "<tr><td>" + a1 + "</td><td>" + a2 + "</td><td>" + a3 + "</td></tr>"; }
  row("취득세", won(acq.tax), "매매가 × " + pctStr(acq.ratePct, 4) + " — " + acq.basis);
  row("지방교육세", won(acq.eduTax), "매매가 × " + pctStr(acq.eduPct, 4));
  row("농어촌특별세", won(acq.ruralTax), on("over85") ? "85㎡ 초과 " + pctStr(acq.ruralPct, 2) : "85㎡ 이하 비과세");
  row("중개보수" + (on("vat") ? " (부가세 포함)" : ""), won(broker), on("useBroker") ? "상한 요율 " + pctStr(bRate, 2) : "미포함");
  row("등기신청수수료", won(filing), "e-Form 기준");
  row("인지세", won(stamp), stamp === 0 ? "주택 1억 이하 비과세" : "기재금액 구간");
  row("국민주택채권 본인부담", won(bondCost), disc > 0 ? "매입 " + won(bondBuy) + " × 할인율 " + pctStr(disc, 3) : "할인율 미입력 — 제외");
  row("법무사 보수", won(legal), "직접 입력");
  row("근저당 등록면허세+교육세", won(mortTax + mortEdu), mort > 0 ? "설정금액 " + eok(mort) + " × 0.2% + 20%" : "대출 없음");
  row("이사·청소·기타", won(life), "직접 입력");
  row("<b>합계</b>", "<b>" + won(total) + "</b>", "<b>매매가의 " + pctStr(total / price * 100, 2) + "</b>");
  h += "</tbody></table></div>";
  setText("big", won(total));
  setText("sub", "매매가 " + eok(price) + " 외 추가로 필요한 현금 (매매가의 " + pctStr(total / price * 100, 2) + ")");
  setHtml("detail", h + fbox("요약", [
    ["취득 관련 세금 합계", won(acq.total)],
    ["중개보수", won(broker)],
    ["등기 관련 비용", won(regTotal)],
    ["이사·정착 비용", won(life)],
    ["총 부대비용", won(total)],
    ["집값 + 부대비용", won(price + total)]
  ], "생애최초 감면·일시적 2주택 특례 등은 반영하지 않았습니다. 채권 할인율을 비우면 채권 부담이 빠져 실제보다 적게 나옵니다.")
    + srcLine("취득세", acquisition.standardRates)
    + srcLine("중개보수", brokerFee.saleBrackets)
    + srcLine("채권 매입률", registration.bondBrackets)
    + srcLine("채권 할인율", registration.bondDiscount));
  showResult();
});`,
  related: [{ slug: "acquisition-tax", e: "🧾", n: "취득세 계산기" }, { slug: "registration", e: "📑", n: "등기비용 계산기" }, T.yangdo, T.refi],
},

];

/* ── 허브 ─────────────────────────────────────────────────── */
function hubPage() {
  const cards = TOOLS.map((t) =>
    `<a class="card" href="${t.slug}/"><div class="t"><span class="e">${t.emoji}</span>${esc(t.hubName)}</div><div class="d">${t.hubDesc}</div></a>`).join("\n    ");
  return {
    path: "", emoji: "🏠", ad: false,
    title: "부동산 계산기 허브 — 취득세·중개보수·DSR·LTV·보유세 한 곳에서",
    ogTitle: "부동산 계산기 12종 — 살 때·빌릴 때·가지고 있을 때",
    desc: "집을 살 때 드는 취득세·중개보수·등기비용, 대출 한도를 정하는 DSR·LTV, 매년 내는 재산세·종부세, 청약 가점과 전세보증보험료까지. 법령 출처와 산출 과정을 전부 표시하는 무료 부동산 계산기 12종.",
    h1: "부동산 계산기 허브",
    appName: "부동산 계산기 허브",
    lead: `살 때·빌릴 때·가지고 있을 때 필요한 계산 <strong>12가지</strong>. 모든 결과에 <strong>산식과 법령 출처</strong>를 함께 표시합니다.`,
    crumbs: [],
    body: `
  <section class="panel">
    <h2>계산기 목록</h2>
    <div class="cards">
    ${cards}
    </div>
  </section>`,
    intro: `<h2>이 사이트의 원칙</h2>
    <p>부동산 계산기는 숫자 하나를 던져 주는 것으로 끝나면 쓸모가 없습니다. 취득세가 1,500만원이라고 나왔을 때 <strong>왜 2%가 적용됐는지</strong>, 그 세율이 어느 조문에서 나온 것인지 확인할 수 없다면 그 숫자를 믿고 계약할 수 없기 때문입니다. 그래서 이 사이트의 모든 계산기는 결과와 함께 <strong>산출 과정을 한 줄씩</strong> 펼치고, 사용한 값마다 <strong>법령·공고 링크와 확인일</strong>을 붙입니다.</p>
    <p>두 번째 원칙은 <strong>모르는 값은 지어내지 않는다</strong>입니다. 스트레스 DSR 가산금리, LTV 상한, 국민주택채권 할인율, 전세보증 요율, 다주택 중과세율처럼 정책·시장에 따라 자주 바뀌는 값은 임의의 기본값을 넣지 않고 <span class="badge warn">확인 필요</span> 표시와 함께 계산에서 빼거나 직접 입력하도록 했습니다. 잘못된 기본값이 만든 그럴듯한 숫자가 가장 위험합니다.</p>`,
    howto: `<h2>이런 질문에 답합니다</h2>
    <ul>
      <li>7억 5천만원 아파트를 사면 취득세가 정확히 얼마인가? (6~9억 구간 산식 반영)</li>
      <li>중개보수 상한은 얼마이고 부가세는 따로 붙나?</li>
      <li>내 소득으로 대출이 얼마나 나오나? DSR과 LTV 중 뭐가 걸림돌인가?</li>
      <li>결국 얼마짜리 집을 살 수 있나?</li>
      <li>등기비용은 무슨 항목으로 구성되고 채권 부담은 얼마인가?</li>
      <li>집값 외에 현금이 총 얼마 더 필요한가?</li>
      <li>내 청약 가점은 84점 중 몇 점인가?</li>
      <li>재산세와 종부세는 공시가격에서 어떻게 계산되나?</li>
      <li>금리는 낮지만 중도상환수수료가 있는 상품, 총비용은 어느 쪽이 싼가?</li>
      <li>이 월세 물건의 실질수익률은 몇 %인가?</li>
    </ul>`,
    faq: [
      { q: "계산 결과를 그대로 믿어도 되나요?", a: "아닙니다. 모든 결과는 참고용 추정이며 실제 세액·한도는 위택스·국세청·금융기관에서 확인해야 합니다. 감면·특례·심사 기준 등 개별 사정이 반영되지 않기 때문입니다." },
      { q: "왜 어떤 값은 비워 두고 직접 입력하게 하나요?", a: "스트레스 DSR 가산금리, LTV 상한, 채권 할인율, 전세보증 요율처럼 수시로 바뀌는 값을 임의로 채우면 결과 전체가 틀어집니다. 확인처 링크를 함께 제공하니 확인한 값을 넣어 계산하세요." },
      { q: "개인정보를 수집하나요?", a: "전혀 수집하지 않습니다. 이름·연락처·주민등록번호·이메일을 묻지 않으며 모든 계산은 브라우저 안에서만 이뤄지고 서버로 전송되지 않습니다." },
      { q: "데이터는 언제 기준인가요?", a: `모든 데이터의 확인일은 ${TODAY}입니다. 각 계산기 하단 표에서 항목별 근거 법령과 확인일을 볼 수 있습니다.` },
      { q: "모바일에서도 쓸 수 있나요?", a: "네. 별도 앱 설치 없이 브라우저에서 바로 쓸 수 있고 다크 모드도 지원합니다." },
    ],
    sources: `<h2>데이터 원칙</h2>
    <p>이 사이트가 쓰는 모든 값은 <strong>값 · 근거(법령·공고 URL) · 확인일</strong> 세 가지를 갖춘 형태로만 저장합니다. 근거를 댈 수 없는 값은 계산에 넣지 않습니다. 각 계산기 페이지 하단에 해당 도구가 사용한 값의 표가 있으며, 개정 가능성이 있는 항목은 <span class="badge warn">확인 필요</span>로 표시하고 확인처를 링크합니다.</p>`,
    related: [T.dsr, T.cheongyak, T.yangdo, T.jeonse, T.refi, T.convert],
  };
}

/* ── 정책 페이지 ─────────────────────────────────────────── */
const POLICY = [
  {
    path: "privacy.html", emoji: "🔒", ad: false,
    title: "개인정보처리방침 — 부동산 계산기 허브",
    desc: "부동산 계산기 허브는 개인정보를 수집하지 않습니다. 모든 계산은 브라우저에서 처리되며 광고 쿠키 사용에 대해 안내합니다.",
    h1: "개인정보처리방침", lead: "입력값은 서버로 전송되지 않습니다.",
    appName: "부동산 계산기 허브",
    crumbs: [{ name: "개인정보처리방침", item: `${SITE_ORIGIN}/privacy.html` }],
    body: `
  <section class="panel">
    <h2>1. 수집하는 개인정보</h2>
    <p>본 사이트는 회원가입 절차가 없으며 이름·연락처·이메일·주민등록번호 등 개인을 식별할 수 있는 정보를 <strong>일절 수집하지 않습니다</strong>. 계산기에 입력하는 매매가·소득·대출 조건 등의 값은 브라우저 안에서만 처리되며 서버로 전송되거나 저장되지 않습니다.</p>
    <h2>2. 쿠키와 광고</h2>
    <p>본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>에서 제3자 사업자의 쿠키 사용을 거부할 수 있습니다. 광고는 계산 결과가 표시된 뒤 결과 하단에만 노출됩니다.</p>
    <h2>3. 로컬 저장소</h2>
    <p>화면 테마(밝은/어두운) 설정을 기억하기 위해 브라우저 localStorage에 값 하나를 저장합니다. 개인을 식별하지 않으며 브라우저 설정에서 삭제할 수 있습니다.</p>
    <h2>4. 접속 분석</h2>
    <p>호스팅 사업자가 제공하는 기본 접속 통계(방문 수, 페이지 조회 수)가 집계될 수 있으며 개인을 식별하지 않는 형태입니다.</p>
    <h2>5. 문의</h2>
    <p>개인정보 관련 문의는 <a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a>을 통해 연락하실 수 있습니다.</p>
    <p class="src">시행일: ${TODAY}</p>
  </section>`,
    faq: [
      { q: "입력한 매매가나 소득이 서버에 저장되나요?", a: "저장되지 않습니다. 모든 계산은 브라우저의 자바스크립트로 처리되며 입력값은 전송되지 않습니다." },
      { q: "쿠키를 거부할 수 있나요?", a: "Google 광고 설정과 aboutads.info에서 맞춤 광고용 쿠키 사용을 거부할 수 있습니다." },
      { q: "회원가입이 필요한가요?", a: "필요 없습니다. 모든 계산기는 가입 없이 무료로 이용할 수 있습니다." },
    ],
  },
  {
    path: "terms.html", emoji: "📜", ad: false,
    title: "이용약관 — 부동산 계산기 허브",
    desc: "부동산 계산기 허브가 제공하는 계산 결과의 성격과 책임 범위, 데이터 갱신과 저작권에 관한 안내입니다.",
    h1: "이용약관", lead: "계산 결과는 참고용 추정치입니다.",
    appName: "부동산 계산기 허브",
    crumbs: [{ name: "이용약관", item: `${SITE_ORIGIN}/terms.html` }],
    body: `
  <section class="panel">
    <h2>1. 서비스의 성격</h2>
    <p>본 사이트는 공개된 법령·공고와 이용자가 입력한 값에 근거해 부동산 관련 세금·비용·대출 한도를 계산해 주는 무료 도구입니다. 계산 결과는 <strong>참고용 추정치</strong>이며 실제 부과·승인 금액을 확정하거나 보증하지 않습니다.</p>
    <h2>2. 데이터의 갱신</h2>
    <p>모든 데이터의 확인일은 ${TODAY}입니다. 세율·한도·요율은 법령 개정과 정책 변경으로 수시로 바뀝니다. 개정 가능성이 있는 항목은 "확인 필요"로 표시하고 계산에서 제외하거나 직접 입력하도록 했습니다. 최신 값은 각 페이지에 링크된 확인처에서 직접 확인하시기 바랍니다.</p>
    <h2>3. 책임의 한계</h2>
    <p>이용자가 본 사이트의 계산 결과에 근거해 내린 판단과 그 결과에 대해 운영자는 법적 책임을 지지 않습니다. 매매 계약, 대출 실행, 세금 신고 등 중요한 결정은 반드시 위택스·국세청 홈택스·인터넷등기소·금융기관·세무 전문가의 확인을 거치시기 바랍니다.</p>
    <h2>4. 저작권</h2>
    <p>본 사이트의 문서·계산 로직·디자인에 대한 권리는 운영자에게 있습니다. 법령·공고 등 공공 데이터의 권리는 각 기관에 있습니다.</p>
    <h2>5. 광고</h2>
    <p>본 사이트는 Google AdSense 광고를 게재하며 광고 내용에 대한 책임은 광고주에게 있습니다. 광고는 입력 화면에는 노출되지 않고 계산 결과가 표시된 뒤 결과 하단에만 표시됩니다.</p>
    <p class="src">시행일: ${TODAY}</p>
  </section>`,
    faq: [
      { q: "계산 결과가 실제와 다르면 어떻게 하나요?", a: "본 사이트의 결과는 참고용 추정치이며 개별 사정과 최신 개정이 반영되지 않을 수 있습니다. 확정 금액은 반드시 관할 기관과 금융기관에서 확인하세요." },
      { q: "상업적으로 이용해도 되나요?", a: "계산 결과를 참고 자료로 활용하는 것은 자유이나, 사이트의 계산 로직과 콘텐츠를 복제·재배포하는 것은 허용되지 않습니다." },
      { q: "오류를 발견하면 어디로 알리나요?", a: "TomatoEggCat을 통해 알려 주시면 확인 후 데이터와 산식을 갱신합니다." },
    ],
  },
];

/* ── 페이지 조립 ─────────────────────────────────────────── */
const pages = [hubPage()];
for (const t of TOOLS) {
  pages.push({
    path: `${t.slug}/`, emoji: t.emoji, title: t.title, ogTitle: t.ogTitle, desc: t.desc,
    h1: t.h1, appName: t.hubName, lead: t.lead,
    crumbs: [{ name: t.nav, item: `${SITE_ORIGIN}/${t.slug}/` }],
    body: t.body, intro: t.intro, howto: t.howto, faq: t.faq,
    sources: t.sources, script: t.script, related: t.related,
  });
}
for (const p of POLICY) pages.push(p);

/* ── 쓰기 ────────────────────────────────────────────────── */
let written = 0;
for (const p of pages) {
  const file = join(ROOT, p.path === "" ? "index.html" : p.path.endsWith("/") ? p.path + "index.html" : p.path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, shell(p), "utf8");
  written++;
}

/* sitemap */
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => {
  const pr = p.path === "" ? "1.0" : p.path.endsWith(".html") ? "0.3" : "0.8";
  return `  <url><loc>${SITE_ORIGIN}/${p.path}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${pr}</priority></url>`;
}).join("\n")}
</urlset>
`, "utf8");

/* robots */
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, "utf8");

/* 고아 폴더 경고 */
const known = new Set(TOOLS.map((t) => t.slug));
const RESERVED = new Set(["assets", "data", "tests", "node_modules"]);
const orphans = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory() && !known.has(n) && !RESERVED.has(n));

console.log(`생성 완료: HTML ${written}개 (허브 1 · 도구 ${TOOLS.length} · 정책 ${POLICY.length})`);
console.log(`sitemap.xml: ${pages.length} URL · robots.txt · SITE_ORIGIN=${SITE_ORIGIN}`);
if (orphans.length) console.log("⚠ 생성 대상이 아닌 폴더:", orphans.join(", "));
