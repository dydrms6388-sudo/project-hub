// gen-pages.mjs — projects.json → per-service 랜딩(/<slug>/index.html) + 허브 index.html + sitemap.xml
// 사용: node gen-pages.mjs           (생성만)
//       node gen-pages.mjs --ping    (생성 + IndexNow 제출)
// 정적 사이트(빌드 없음). 실행은 project-hub 루트에서.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "https://tomatoeggcat.com";
const ADSENSE = "ca-pub-5567719201265106";

// ── 내장 도구 9개(현 index.html과 동일) ──
const BUILTINS = [
  { slug: "salary", emoji: "💵", name: "연봉 실수령액 계산기", desc: "4대보험·세금 떼고 실제 월급·연봉 실수령", k: "연봉 실수령액 급여 세후 월급", prio: "0.9" },
  { slug: "dsr", emoji: "📊", name: "DSR 계산기", desc: "총부채원리금상환비율·대출 가능 한도 판정", k: "dsr 대출 한도 총부채", prio: "0.9" },
  { slug: "jeonse-loan", emoji: "🏠", name: "전세대출 한도 계산기", desc: "버팀목·청년·신생아·시중은행 한도 비교", k: "전세 대출 한도 자금 버팀목", prio: "0.9" },
  { slug: "yangdo", emoji: "🧾", name: "양도소득세 계산기", desc: "보유기간·장특공 반영 양도세 추정", k: "양도세 양도소득세 부동산 세금", prio: "0.9" },
  { slug: "refinance", emoji: "🔁", name: "대출 갈아타기 계산기", desc: "대환 시 월 상환액·총이자 절감액 계산", k: "대출 갈아타기 대환 금리 이자", prio: "0.9" },
  { slug: "age", emoji: "🎂", name: "만나이 계산기", desc: "만 나이·연 나이·띠·다음 생일 D-day", k: "만나이 나이 계산 띠 생일", prio: "0.8" },
  { slug: "dday", emoji: "📅", name: "D-day 계산기", desc: "남은 날·지난 날·날짜 사이 일수", k: "디데이 dday 날짜 계산", prio: "0.8" },
  { slug: "bmi", emoji: "⚖️", name: "BMI 계산기", desc: "체질량지수·비만도·표준체중", k: "bmi 비만도 체질량 표준체중", prio: "0.8" },
  { slug: "pyeong", emoji: "📐", name: "평수 변환기", desc: "평 ↔ ㎡ 실시간 변환", k: "평수 평 제곱미터 면적 변환", prio: "0.8" },
];
const BUILTIN_CATS = [
  { title: "💰 금융 · 세금", tag: "실생활 필수", slugs: ["salary", "dsr", "jeonse-loan", "yangdo", "refinance"] },
  { title: "🔢 생활 계산기", tag: "", slugs: ["age", "dday", "bmi", "pyeong"] },
];
const RESERVED = new Set([...BUILTINS.map(b => b.slug), "privacy", "terms", "contact", "sitemap", "robots", "coupang", "ads", "templates", "index", "age", "bmi", "dday", "dsr", "pyeong", "salary", "yangdo", "refinance"]);

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = live => { try { return new URL(live).host.replace(/\.vercel\.app$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase(); } catch { return null; } };
const topcat = d => ((d || "기타").split("/")[0].trim() || "기타");

// ── 데이터 ──
const raw = JSON.parse(readFileSync("projects.json", "utf8"));
const projects = raw.projects || raw;
const tpl = readFileSync("templates/service.html", "utf8");

const daily = [];
const seen = new Set();
for (const p of projects) {
  if (!p.live || !/^https?:\/\//.test(p.live)) continue;
  let s = slugify(p.live);
  if (!s) continue;
  if (RESERVED.has(s)) s = s + "-app";
  while (seen.has(s)) s = s + "-x";
  seen.add(s);
  daily.push({ name: p.name, emoji: p.emoji || "🔧", desc: p.desc || p.name, domain: p.domain || "", live: p.live, slug: s, cat: topcat(p.domain) });
}

// ── per-service 랜딩 생성 ──
let landingCount = 0;
for (const d of daily) {
  let related = daily.filter(x => x.cat === d.cat && x.slug !== d.slug).slice(0, 6);
  if (related.length < 4) related = related.concat(daily.filter(x => x.slug !== d.slug && !related.includes(x)).slice(0, 6 - related.length));
  const relHtml = related.map(r => `<a class="rel" href="/${r.slug}/"><span>${r.emoji}</span> ${esc(r.name)}</a>`).join("\n      ");

  const jsonld = JSON.stringify({
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: d.name, description: d.desc, applicationCategory: "WebApplication",
    operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    url: `${SITE}/${d.slug}/`,
  }).replace(/</g, "\\u003c");

  const sentences = String(d.desc).split(/(?<=[.。!?])\s+/).map(x => x.trim()).filter(Boolean);
  const features = (sentences.length ? sentences : [d.desc]).slice(0, 6).map(s => `<li>${esc(s)}</li>`).join("\n        ");
  const body = `<h2>${esc(d.name)} 소개</h2>
    <p>${esc(d.desc)}</p>
    <h2>주요 특징</h2>
    <ul>
        ${features}
    </ul>
    <p class="cat-note">카테고리: ${esc(d.domain || d.cat)} · 설치·가입 없이 브라우저에서 무료로 바로 사용</p>`;

  const title = `${d.name} — ${d.cat} 무료 도구 | TomatoEggCat`;
  const html = tpl
    .replaceAll("%%TITLE%%", esc(title))
    .replaceAll("%%DESC_ATTR%%", esc(d.desc))
    .replaceAll("%%DESC%%", esc(d.desc))
    .replaceAll("%%SLUG%%", d.slug)
    .replaceAll("%%NAME%%", esc(d.name))
    .replaceAll("%%EMOJI%%", d.emoji)
    .replaceAll("%%LIVE%%", esc(d.live))
    .replaceAll("%%CATEGORY%%", esc(d.cat))
    .replaceAll("%%JSONLD%%", jsonld)
    .replaceAll("%%BODY%%", body)
    .replaceAll("%%RELATED%%", relHtml);

  mkdirSync(d.slug, { recursive: true });
  writeFileSync(`${d.slug}/index.html`, html);
  landingCount++;
}

// ── 허브 index.html 재생성 ──
const card = (slug, emoji, name, desc, k) =>
  `<a class="tool" href="/${slug}/" data-k="${esc(k)}"><span class="te">${emoji}</span><span class="tn">${esc(name)}</span><span class="td">${esc(desc)}</span></a>`;

let sections = "";
for (const c of BUILTIN_CATS) {
  const cards = c.slugs.map(s => { const b = BUILTINS.find(x => x.slug === s); return "        " + card(b.slug, b.emoji, b.name, b.desc, b.k); }).join("\n");
  sections += `
    <section class="cat" data-cat>
      <h2>${c.title}${c.tag ? ` <span class="tag">${c.tag}</span>` : ""}</h2>
      <div class="grid">
${cards}
      </div>
    </section>\n`;
}
// 데일리: 카테고리별 그룹(건수 많은 순)
const byCat = {};
for (const d of daily) (byCat[d.cat] = byCat[d.cat] || []).push(d);
for (const [cat, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  const cards = list.map(d => {
    const short = String(d.desc).replace(/\s+/g, " ").slice(0, 64);
    return "        " + card(d.slug, d.emoji, d.name, short, `${d.name} ${d.domain}`);
  }).join("\n");
  sections += `
    <section class="cat" data-cat>
      <h2>🗂️ ${esc(cat)}</h2>
      <div class="grid">
${cards}
      </div>
    </section>\n`;
}

const total = BUILTINS.length + daily.length;
const indexHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="google-adsense-account" content="${ADSENSE}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}" crossorigin="anonymous"></script>
  <title>TomatoEggCat — 무료 계산기·생활 도구 ${total}종 모음</title>
  <meta name="description" content="연봉 실수령액·DSR·세금·만나이·BMI부터 건강·교육·심리테스트·생활 도구까지 ${total}종. 설치도 가입도 없이 브라우저에서 바로 쓰는 무료 도구 모음." />
  <link rel="canonical" href="${SITE}/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TomatoEggCat" />
  <meta property="og:title" content="TomatoEggCat — 무료 도구 ${total}종 모음" />
  <meta property="og:url" content="${SITE}/" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0a0a0a; color: #ededed;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; line-height: 1.6; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 0 18px 64px; }
    .hero { text-align: center; padding: 56px 0 18px; }
    .logo { font-size: 40px; }
    h1 { font-size: 30px; font-weight: 900; margin: 10px 0 0;
      background: linear-gradient(90deg,#fff,#9ee7c8); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { color: #9ca3af; margin: 12px auto 0; max-width: 520px; font-size: 15px; }
    .count { display: inline-block; margin-top: 16px; font-size: 12px; color: #6ee7b7; background: #06281f; border: 1px solid #0f5132; padding: 5px 12px; border-radius: 999px; }
    .search { margin: 26px auto 0; max-width: 460px; display: block; width: 100%;
      background: #141414; border: 1px solid #2a2a2a; border-radius: 14px; color: #ededed; padding: 13px 16px; font-size: 15px; }
    .search:focus { outline: none; border-color: #10b981; }
    .cat { margin-top: 38px; }
    .cat h2 { font-size: 15px; font-weight: 800; color: #d4d4d4; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
    .cat h2 .tag { font-size: 11px; font-weight: 700; color: #fbbf24; background: #2a230a; border: 1px solid #50410f; padding: 2px 8px; border-radius: 999px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .tool { display: block; text-decoration: none; border: 1px solid #232323; background: #161616; border-radius: 16px; padding: 16px 16px 15px; transition: transform .14s, border-color .14s, background .14s; }
    .tool:hover { transform: translateY(-2px); border-color: #10b981; background: #181a19; }
    .tool .te { font-size: 25px; display: block; }
    .tool .tn { display: block; font-weight: 700; color: #f5f5f5; margin-top: 9px; font-size: 15.5px; }
    .tool .td { display: block; color: #9ca3af; font-size: 12.5px; margin-top: 4px; line-height: 1.45; }
    .ad { margin: 34px 0 0; min-height: 90px; display: flex; align-items: center; justify-content: center; border: 1px dashed #232323; border-radius: 14px; color: #2f2f2f; font-size: 12px; }
    footer { margin-top: 44px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #1c1c1c; padding-top: 22px; }
    footer a { color: #7aa2ff; margin: 0 7px; text-decoration: none; }
    .empty { color: #555; text-align: center; padding: 20px; font-size: 13px; display: none; }
    @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } h1 { font-size: 25px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="logo">🍅🥚🐈</div>
      <h1>TomatoEggCat</h1>
      <p class="sub">연봉·대출·세금부터 건강·교육·심리테스트·생활 도구까지 — 설치도 가입도 없이 브라우저에서 즉시.</p>
      <div class="count">무료 도구 ${total}종 · 매일 추가 중</div>
      <input class="search" id="q" type="search" placeholder="🔍 도구 검색 (예: 연봉, 대출, 나이…)" autocomplete="off" />
    </div>
${sections}
    <p class="empty" id="empty">검색 결과가 없어요. 다른 키워드로 찾아보세요.</p>

    <div class="ad">광고 영역</div>
    <div class="coupang-slot" data-subid="home" style="margin:28px 0 0"></div>

    <footer>
      <p style="margin:0 0 8px">🍅🥚🐈 TomatoEggCat — 일상에 유용한 무료 도구 모음</p>
      <p style="margin:0">
        <a href="/privacy.html">개인정보처리방침</a>·
        <a href="/terms.html">이용약관</a>·
        <a href="/contact.html">문의</a>
      </p>
    </footer>
  </div>

  <script>
    var q = document.getElementById('q');
    var tools = Array.prototype.slice.call(document.querySelectorAll('.tool'));
    var cats = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'));
    var empty = document.getElementById('empty');
    q.addEventListener('input', function () {
      var v = q.value.trim().toLowerCase();
      var any = false;
      tools.forEach(function (t) {
        var hay = (t.textContent + ' ' + (t.getAttribute('data-k') || '')).toLowerCase();
        var show = !v || hay.indexOf(v) > -1;
        t.style.display = show ? '' : 'none';
        if (show) any = true;
      });
      cats.forEach(function (c) {
        var visible = c.querySelectorAll('.tool:not([style*="none"])').length;
        c.style.display = visible ? '' : 'none';
      });
      empty.style.display = any ? 'none' : 'block';
    });
  </script>
  <script src="/coupang.js"></script>
</body>
</html>
`;
writeFileSync("index.html", indexHtml);

// ── sitemap.xml ──
const today = (raw.updatedAt || "").slice(0, 10) || "";
const urls = [];
urls.push(`  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
for (const b of BUILTINS) urls.push(`  <url><loc>${SITE}/${b.slug}/</loc><changefreq>monthly</changefreq><priority>${b.prio}</priority></url>`);
for (const d of daily) urls.push(`  <url><loc>${SITE}/${d.slug}/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
for (const p of ["privacy.html", "terms.html", "contact.html"]) urls.push(`  <url><loc>${SITE}/${p}</loc><priority>0.3</priority></url>`);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
writeFileSync("sitemap.xml", sitemap);

console.log(`landing pages: ${landingCount}`);
console.log(`hub tools: ${total} (builtin ${BUILTINS.length} + daily ${daily.length})`);
console.log(`sitemap urls: ${urls.length}`);
console.log(`skipped (no live): ${projects.length - daily.length}`);

// ── IndexNow 제출(--ping) ──
if (process.argv.includes("--ping")) {
  try {
    const key = readFileSync(".indexnow_key", "utf8").trim();
    const urlList = [`${SITE}/`, ...BUILTINS.map(b => `${SITE}/${b.slug}/`), ...daily.map(d => `${SITE}/${d.slug}/`)];
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: "tomatoeggcat.com", key, keyLocation: `${SITE}/${key}.txt`, urlList }),
    });
    console.log(`IndexNow: HTTP ${res.status} (${urlList.length} urls)`);
  } catch (e) { console.log("IndexNow ping failed:", e.message); }
}
