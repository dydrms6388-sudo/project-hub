// gen-pages.mjs — projects.json → per-service 랜딩(/<slug>/index.html) + 허브 index.html + sitemap.xml
// 사용: node gen-pages.mjs           (생성만)
//       node gen-pages.mjs --ping    (생성 + IndexNow 제출)
// 정적 사이트(빌드 없음). 실행은 project-hub 루트에서.
// slug = slug-map.json(대표명) 우선, 없으면 live 서브도메인. 허브 UI = lib/hub.mjs.
//
// ⚠️ 생성 산출물(손으로 고치지 말 것 — 배포 때 이 스크립트가 덮어씀):
//   index.html, sitemap.xml, vercel.json, 그리고 각 /<slug>/index.html(내장 9종 제외).
//   커밋된 산출물이 projects.json/템플릿과 어긋나(stale) 있을 수 있으며,
//   배포 파이프라인(.github/workflows/deploy.yml + vercel.json buildCommand)이
//   매 배포마다 이 스크립트를 재실행해 최신·정합 상태로 만든다.
//   즉 "커밋된 HTML ≠ 프로덕션 HTML"일 수 있고, placeholder 잔재는 배포 시 제거된다.
//   내장 9종(salary/dsr/jeonse-loan/yangdo/refinance/age/dday/bmi/pyeong)만 손으로 관리하는 실앱이다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { GOOGLE_SITE_VERIFICATION, NAVER_SITE_VERIFICATION } from "./site.config.mjs";
import { renderHub } from "./lib/hub.mjs";

const SITE = "https://tomatoeggcat.com";
const ADSENSE = "ca-pub-5567719201265106";
// 소유확인 메타는 "실제 코드가 설정된 경우에만" 방출한다.
// 미설정 상태의 REPLACE_* 플레이스홀더를 프로덕션에 그대로 싣지 않기 위함
// (가짜 코드는 Search Console 검증을 조용히 실패시키고 페이지에 무의미한 메타만 남긴다).
// 값은 신뢰 소스(소유자 env)이나 방어적으로 영숫자/_/-만 허용해 속성 탈출·주입을 차단한다.
const realVerify = (v) => !!v && !/^REPLACE_/.test(v) && /^[A-Za-z0-9_-]+$/.test(v);
const VERIFY_META = [
  realVerify(GOOGLE_SITE_VERIFICATION) ? `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" />` : "",
  realVerify(NAVER_SITE_VERIFICATION) ? `<meta name="naver-site-verification" content="${NAVER_SITE_VERIFICATION}" />` : "",
].filter(Boolean).join("\n  ");
const SLUG_MAP = JSON.parse(readFileSync("slug-map.json", "utf8"));

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
const RESERVED = new Set([...BUILTINS.map(b => b.slug), "privacy", "terms", "contact", "sitemap", "robots", "coupang", "ads", "templates", "index", "api", "lib", "auth-billing", "_next", "404", "og", "site.config", "prism", "blog"]);

// 블로그(별도 Next.js 앱, blog/)를 /blog 로 rewrite 하려면 이 환경변수에 앱 도메인을 지정.
// 예: BLOG_APP_ORIGIN=https://tomatoeggcat-blog.vercel.app  (미설정 시 rewrite 생략)
const BLOG_APP_ORIGIN = (process.env.BLOG_APP_ORIGIN || "").replace(/\/$/, "");

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = live => { try { return new URL(live).host.replace(/\.vercel\.app$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase(); } catch { return null; } };

// Phase 2: apex에서 앱이 직접 서빙되는 slug → 정적 랜딩 생성 스킵(vercel.json rewrite가 처리). sitemap엔 동일 apex URL 유지.
// 목록은 apex-served.json(데이터)에서 읽음 — 롤아웃이 이 파일에 통과 slug를 누적.
const APEX_SERVED = new Set(existsSync("apex-served.json") ? JSON.parse(readFileSync("apex-served.json", "utf8")) : ["dalian-weekend"]);

// domain(118종 세분) → 상위 카테고리 ~12개
const CATEGORY_RULES = [
  ["건강·운동", /건강|운동|다이어트|피트니스|수면|러닝|습관|영양|임신|육아|웰니스|마음챙김|femcare|bmr|bmi|만성/i],
  ["교육·학습", /교육|입시|자격증|어학|어휘|영어|한국사|타자|맞춤법|과학|개발자|퀴즈|학습|두뇌/i],
  ["금융·부동산", /금융|부동산|대출|세금|보험|청약|전세|급여|dsr|연봉|노동|프리랜서/i],
  ["취업·생산성", /취업|자소서|자기소개서|직장|근무|생산성|미팅|업무|\bai\b/i],
  ["운세·심리", /운세|타로|심리|성격|사주|관상|점\b/i],
  ["연애·관계", /연애|썸|커플|관계|결혼|웨딩|데이팅|궁합/i],
  ["엔터·바이럴", /엔터|바이럴|팬덤|k-?pop|커뮤니티|게임|파티|월드컵|투표|밸런스|추천/i],
  ["반려·식물", /반려|펫|식물|동물|강아지|고양이/i],
  ["여행·문화", /여행|중국|다롄|관광/i],
  ["뷰티·패션", /뷰티|퍼스널컬러|피부|컬러|패션/i],
  ["투자·크립토", /투자|크립토|코인|주식/i],
];
const getCategory = d => { for (const [c, re] of CATEGORY_RULES) if (re.test(d || "")) return c; return "생활·계산기"; };

// ── 데이터 ──
const raw = JSON.parse(readFileSync("projects.json", "utf8"));
const projects = raw.projects || raw;
const tpl = readFileSync("templates/service.html", "utf8");

// per-service 고유 콘텐츠(사용자용): data/landing-content.json = { slug: {intro, steps[], tips[], faq[{q,a}], note} }
const CONTENT = existsSync("data/landing-content.json")
  ? JSON.parse(readFileSync("data/landing-content.json", "utf8")) : {};

// projects.json의 desc는 내부 마케팅/SEO 메모 → 사용자 노출 전 은어 문장 제거(폴백용).
const JARGON = /수익화|애드센스|adsense|ca-pub|쿠팡\s*제휴|제휴\s*링크|\bSEO\b|\bOG\b|JSON-?LD|sitemap|robots|ads\.txt|정조준|파운더|무API|격리스키마|Neon|three-fiber|framer-motion|confetti|Web Audio|9:16|바이럴|키워드/i;
const sanitize = (s) => {
  const parts = String(s ?? "").split(/(?<=[.。!?])\s+/).map(x => x.trim()).filter(Boolean);
  const kept = parts.filter(p => !JARGON.test(p));
  let out = (kept.length ? kept : parts).join(" ")
    .replace(/\([^)]*(ca-pub|adsense|pub-)[^)]*\)/gi, "")
    .replace(/\s{2,}/g, " ").trim();
  return out || String(s ?? "");
};
// 금융·세금·건강·법률·투자류 면책 자동 부여(콘텐츠에 note 없을 때 폴백)
const NEEDS_NOTE = /금융|부동산|대출|세금|보험|청약|전세|급여|연봉|투자|주식|코인|건강|운동|다이어트|의료|임신|영양|혈압|혈당|약|법률/;
const disclaimerFor = (cat, domain, name) =>
  NEEDS_NOTE.test(`${cat} ${domain} ${name}`)
    ? "본 결과는 일반적인 참고용 추정이며, 의료·법률·세무·금융 등 전문가의 진단이나 상담을 대체하지 않습니다."
    : "";

const daily = [];
const seen = new Set();
for (const p of projects) {
  if (!p.live || !/^https?:\/\//.test(p.live)) continue;
  let s = SLUG_MAP[p.live] || slugify(p.live);
  if (!s) continue;
  if (RESERVED.has(s)) s = s + "-app";
  while (seen.has(s)) s = s + "-x";
  seen.add(s);
  daily.push({ name: p.name, emoji: p.emoji || "🔧", desc: p.desc || p.name, domain: p.domain || "", live: p.live, slug: s, cat: getCategory(p.domain) });
}

// ── per-service 랜딩 생성 ──
let landingCount = 0;
for (const d of daily) {
  if (APEX_SERVED.has(d.slug)) { if (existsSync(`${d.slug}/index.html`)) rmSync(d.slug, { recursive: true, force: true }); continue; }
  let related = daily.filter(x => x.cat === d.cat && x.slug !== d.slug).slice(0, 6);
  if (related.length < 4) related = related.concat(daily.filter(x => x.slug !== d.slug && !related.includes(x)).slice(0, 6 - related.length));
  const relHtml = related.map(r => `<a class="rel" href="/${r.slug}/"><span>${r.emoji}</span> ${esc(r.name)}</a>`).join("\n      ");

  // ── 사용자용 콘텐츠 조립(고유 콘텐츠 우선, 없으면 정제된 폴백) ──
  const c = CONTENT[d.slug] || {};
  const cleanDesc = sanitize(d.desc);
  const intro = (c.intro && c.intro.trim()) ? c.intro.trim() : cleanDesc;
  // 히어로 lead는 소개 문단과 중복되지 않도록 첫 문장(길면 절단)만 사용
  const firstSentence = (intro.split(/(?<=[.。!?])\s+/)[0] || intro).trim();
  const lead = firstSentence.length > 120 ? firstSentence.slice(0, 118).replace(/\s+\S*$/, "") + "…" : firstSentence;
  const metaDesc = (intro.replace(/\s+/g, " ").slice(0, 155)).trim();

  const background = (c.background && c.background.trim()) ? c.background.trim() : "";
  const scenarios = Array.isArray(c.scenarios) ? c.scenarios.filter(Boolean) : [];
  const cautions = Array.isArray(c.cautions) ? c.cautions.filter(Boolean) : [];
  const steps = Array.isArray(c.steps) && c.steps.length ? c.steps
    : ["아래 ‘바로 실행하기’를 눌러 도구를 엽니다.", "안내에 따라 값을 입력하거나 항목을 선택합니다.", "결과를 확인하고 필요하면 저장·공유합니다."];
  const tips = Array.isArray(c.tips) ? c.tips.filter(Boolean) : [];
  const faq = Array.isArray(c.faq) ? c.faq.filter(f => f && f.q && f.a) : [];
  const note = (c.note && c.note.trim()) ? c.note.trim() : disclaimerFor(d.cat, d.domain, d.name);

  const secUl = (title, items) => items.length
    ? `<h2>${title}</h2>\n    <ul>\n        ${items.map(x => `<li>${esc(x)}</li>`).join("\n        ")}\n    </ul>` : "";
  const bgHtml = background
    ? `<h2>알아두면 좋은 배경지식</h2>\n    ${background.split(/\n\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("\n    ")}` : "";
  const stepsHtml = `<h2>이렇게 사용하세요</h2>\n    <ol>\n        ${steps.map(s => `<li>${esc(s)}</li>`).join("\n        ")}\n    </ol>`;
  const scenHtml = secUl("이럴 때 유용해요", scenarios);
  const tipsHtml = secUl("활용 팁", tips);
  const cautHtml = cautions.length
    ? `<h2>주의사항</h2>\n    <ul class="cautions">\n        ${cautions.map(x => `<li>${esc(x)}</li>`).join("\n        ")}\n    </ul>` : "";
  const faqHtml = faq.length
    ? `<h2>자주 묻는 질문</h2>\n    ${faq.map(f => `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${esc(f.a)}</p></div>`).join("\n    ")}`
    : "";
  const noteHtml = note ? `<p class="disclaimer">${esc(note)}</p>` : "";

  const body = `<h2>${esc(d.name)} 소개</h2>
    <p>${esc(intro)}</p>
    ${bgHtml}
    ${stepsHtml}
    ${scenHtml}
    ${tipsHtml}
    ${cautHtml}
    ${faqHtml}
    ${noteHtml}
    <p class="cat-note">카테고리: ${esc(d.cat)} · 설치·가입 없이 브라우저에서 무료로 바로 사용</p>`;

  // JSON-LD: SoftwareApplication + FAQPage(있을 때) + BreadcrumbList
  const graph = [{
    "@type": "SoftwareApplication",
    name: d.name, description: metaDesc, applicationCategory: "WebApplication",
    operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    url: `${SITE}/${d.slug}/`,
  }];
  if (faq.length) graph.push({
    "@type": "FAQPage",
    mainEntity: faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: d.cat, item: `${SITE}/` },
      { "@type": "ListItem", position: 3, name: d.name, item: `${SITE}/${d.slug}/` },
    ],
  });
  const jsonld = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");

  const title = `${d.name} — ${d.cat} 무료 도구 | TomatoEggCat`;
  const html = tpl
    .replaceAll("%%TITLE%%", esc(title))
    .replaceAll("%%DESC_ATTR%%", esc(metaDesc))
    .replaceAll("%%DESC%%", esc(lead))
    .replaceAll("%%SLUG%%", d.slug)
    .replaceAll("%%NAME%%", esc(d.name))
    .replaceAll("%%EMOJI%%", d.emoji)
    .replaceAll("%%LIVE%%", esc(d.live))
    .replaceAll("%%CATEGORY%%", esc(d.cat))
    .replaceAll("%%JSONLD%%", jsonld)
    .replaceAll("%%BODY%%", body)
    .replaceAll("%%RELATED%%", relHtml)
    .replaceAll("%%VERIFY%%", VERIFY_META);

  mkdirSync(d.slug, { recursive: true });
  writeFileSync(`${d.slug}/index.html`, html);
  landingCount++;
}

// ── 옛 slug 디렉터리 정리(대표명화로 바뀐 것 제거, 중복콘텐츠 방지) ──
const validSlugs = new Set([...daily.map(d => d.slug), ...BUILTINS.map(b => b.slug)]);
let removed = 0;
for (const p of projects) {
  if (!p.live) continue;
  const old = slugify(p.live);
  if (old && !validSlugs.has(old) && !RESERVED.has(old) && existsSync(`${old}/index.html`)) {
    rmSync(old, { recursive: true, force: true });
    removed++;
  }
}

// ── 허브 index.html (lib/hub.mjs) ──
const builtinCats = BUILTIN_CATS.map(c => ({
  title: c.title, tag: c.tag,
  items: c.slugs.map(s => BUILTINS.find(b => b.slug === s)).filter(Boolean)
    .map(b => ({ slug: b.slug, emoji: b.emoji, name: b.name, desc: b.desc, k: b.k })),
}));
const byCat = {};
for (const d of daily) (byCat[d.cat] = byCat[d.cat] || []).push(d);
const dailyByCat = Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)
  .map(([cat, items]) => ({ cat, items: items.map(d => {
    const intro = CONTENT[d.slug] && CONTENT[d.slug].intro ? CONTENT[d.slug].intro : sanitize(d.desc);
    return { slug: d.slug, emoji: d.emoji, name: d.name, desc: String(intro).replace(/\s+/g, " ").slice(0, 70), domain: d.domain };
  }) }));
const total = BUILTINS.length + daily.length;
const indexHtml = renderHub({ site: SITE, adsense: ADSENSE, verifyMeta: VERIFY_META, total, builtinCats, dailyByCat });
writeFileSync("index.html", indexHtml);

// ── sitemap.xml ──
const urls = [];
urls.push(`  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
for (const b of BUILTINS) urls.push(`  <url><loc>${SITE}/${b.slug}/</loc><changefreq>monthly</changefreq><priority>${b.prio}</priority></url>`);
for (const d of daily) urls.push(`  <url><loc>${SITE}/${d.slug}/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
// 블로그 목록(개별 글은 blog 앱의 동적 sitemap 이 담당 — robots.txt 에서 함께 참조).
urls.push(`  <url><loc>${SITE}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
for (const p of ["about.html", "privacy.html", "terms.html", "contact.html"]) urls.push(`  <url><loc>${SITE}/${p}</loc><priority>0.3</priority></url>`);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
writeFileSync("sitemap.xml", sitemap);

// ── Phase2: apex 서빙 앱 rewrite(vercel.json 자동생성) — APEX_SERVED에 slug만 추가하면 됨 ──
const rewrites = [], headers = [];
for (const d of daily.filter(d => APEX_SERVED.has(d.slug))) {
  const base = d.live.replace(/\/$/, "");
  rewrites.push({ source: `/${d.slug}`, destination: `${base}/${d.slug}` });
  rewrites.push({ source: `/${d.slug}/:path*`, destination: `${base}/${d.slug}/:path*` });
  // canonical→apex (프록시 응답에 Link 헤더 — 앱 코드 무수정으로 vercel.app를 apex에 통합)
  headers.push({ source: `/${d.slug}`, headers: [{ key: "Link", value: `<${SITE}/${d.slug}/>; rel="canonical"` }] });
}
// 블로그(별도 Next.js 앱) rewrite — BLOG_APP_ORIGIN 이 지정된 경우에만 추가.
if (BLOG_APP_ORIGIN) {
  rewrites.push({ source: "/blog", destination: `${BLOG_APP_ORIGIN}/blog` });
  rewrites.push({ source: "/blog/:path*", destination: `${BLOG_APP_ORIGIN}/blog/:path*` });
}
// buildCommand: Vercel의 네이티브 Git 연동 배포도 매번 이 스크립트를 돌려 산출물을 재생성하게 한다
// (GH Action 경로가 아니라 네이티브 경로로 배포돼도 stale/placeholder가 나가지 않도록). outputDirectory=루트.
writeFileSync("vercel.json", JSON.stringify({ buildCommand: "node gen-pages.mjs", outputDirectory: ".", rewrites, headers }, null, 2) + "\n");

// ── 내장 9개 정적 페이지에 verification 메타 주입(멱등) ──
// 기존 google/naver 소유확인 메타는 항상 걷어낸 뒤(플레이스홀더 잔재 제거),
// 실제 코드가 있을 때만(VERIFY_META 비어있지 않을 때) 다시 주입한다.
const STALE_VERIFY = /\s*<meta name="(?:google|naver)-site-verification"[^>]*>/g;
let patched = 0;
for (const b of BUILTINS) {
  const f = `${b.slug}/index.html`;
  if (!existsSync(f)) continue;
  let h = readFileSync(f, "utf8");
  const before = h;
  h = h.replace(STALE_VERIFY, "");
  if (VERIFY_META) {
    if (h.includes('name="theme-color"')) {
      h = h.replace(/(<meta name="theme-color"[^>]*>)/, `$1\n${VERIFY_META}`);
    } else {
      h = h.replace(/<\/title>/, `</title>\n${VERIFY_META}`);
    }
  }
  if (h !== before) { writeFileSync(f, h); patched++; }
}

// ── 고아/스테일 페이지 정리: 재생성 대상이 아닌 디렉터리(예: 옛 슬러그 orphan)에
//    남아 있는 placeholder(REPLACE_) 소유확인 메타를 전 슬러그 디렉터리에서 제거한다.
//    실제 코드가 든 메타(content!=REPLACE_)는 건드리지 않으므로 재생성된 페이지엔 무영향. ──
const PLACEHOLDER_VERIFY = /\s*<meta name="(?:google|naver)-site-verification" content="REPLACE_[^"]*"[^>]*>/g;
let swept = 0;
for (const entry of readdirSync(".", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const f = `${entry.name}/index.html`;
  if (!existsSync(f)) continue;
  const h = readFileSync(f, "utf8");
  const cleaned = h.replace(PLACEHOLDER_VERIFY, "");
  if (cleaned !== h) { writeFileSync(f, cleaned); swept++; }
}

// ── 회귀 가드(경고성·비차단): 재생성/스윕 후에도 placeholder 잔재가 남았는지 전 페이지 스캔.
//    새 손수 페이지가 '광고 영역'을 넣거나 스윕이 놓친 케이스를 배포 로그에서 바로 드러낸다. ──
const JUNK = /REPLACE_(?:GOOGLE|NAVER)_CODE|광고 영역/;
let junkPages = 0;
const scanJunk = (f) => { if (existsSync(f) && JUNK.test(readFileSync(f, "utf8"))) { junkPages++; if (junkPages <= 8) console.warn(`  ⚠️ placeholder 잔재: ${f}`); } };
for (const entry of readdirSync(".", { withFileTypes: true })) { if (entry.isDirectory()) scanJunk(`${entry.name}/index.html`); }
scanJunk("index.html");
if (junkPages) console.warn(`⚠️ 경고: placeholder(REPLACE_/광고 영역) 잔재 ${junkPages}개 페이지 — 배포 전 확인 필요.`);

console.log(`placeholder-verify metas swept (all dirs): ${swept}`);
console.log(`landing pages: ${landingCount}`);
console.log(`removed stale slug dirs: ${removed}`);
console.log(`builtin pages patched(verify): ${patched}`);
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
