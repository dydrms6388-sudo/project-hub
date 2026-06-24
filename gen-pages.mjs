// gen-pages.mjs — projects.json → per-service 랜딩(/<slug>/index.html) + 허브 index.html + sitemap.xml
// 사용: node gen-pages.mjs           (생성만)
//       node gen-pages.mjs --ping    (생성 + IndexNow 제출)
// 정적 사이트(빌드 없음). 실행은 project-hub 루트에서.
// slug = slug-map.json(대표명) 우선, 없으면 live 서브도메인. 허브 UI = lib/hub.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { GOOGLE_SITE_VERIFICATION, NAVER_SITE_VERIFICATION } from "./site.config.mjs";
import { renderHub } from "./lib/hub.mjs";

const SITE = "https://tomatoeggcat.com";
const ADSENSE = "ca-pub-5567719201265106";
const VERIFY_META = `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" />\n  <meta name="naver-site-verification" content="${NAVER_SITE_VERIFICATION}" />`;
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
const RESERVED = new Set([...BUILTINS.map(b => b.slug), "privacy", "terms", "contact", "sitemap", "robots", "coupang", "ads", "templates", "index", "api", "lib", "auth-billing", "_next", "404", "og", "site.config"]);

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = live => { try { return new URL(live).host.replace(/\.vercel\.app$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase(); } catch { return null; } };

// Phase 2: apex에서 앱이 직접 서빙되는 slug → 정적 랜딩 생성 스킵(vercel.json rewrite가 처리). sitemap엔 동일 apex URL 유지.
const APEX_SERVED = new Set(["dalian-weekend"]);

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
    <p class="cat-note">카테고리: ${esc(d.cat)} · 설치·가입 없이 브라우저에서 무료로 바로 사용</p>`;

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
  .map(([cat, items]) => ({ cat, items: items.map(d => ({ slug: d.slug, emoji: d.emoji, name: d.name, desc: String(d.desc).replace(/\s+/g, " ").slice(0, 70), domain: d.domain })) }));
const total = BUILTINS.length + daily.length;
const indexHtml = renderHub({ site: SITE, adsense: ADSENSE, verifyMeta: VERIFY_META, total, builtinCats, dailyByCat });
writeFileSync("index.html", indexHtml);

// ── sitemap.xml ──
const urls = [];
urls.push(`  <url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
for (const b of BUILTINS) urls.push(`  <url><loc>${SITE}/${b.slug}/</loc><changefreq>monthly</changefreq><priority>${b.prio}</priority></url>`);
for (const d of daily) urls.push(`  <url><loc>${SITE}/${d.slug}/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
for (const p of ["privacy.html", "terms.html", "contact.html"]) urls.push(`  <url><loc>${SITE}/${p}</loc><priority>0.3</priority></url>`);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
writeFileSync("sitemap.xml", sitemap);

// ── Phase2: apex 서빙 앱 rewrite(vercel.json 자동생성) — APEX_SERVED에 slug만 추가하면 됨 ──
const rewrites = [];
for (const d of daily.filter(d => APEX_SERVED.has(d.slug))) {
  const base = d.live.replace(/\/$/, "");
  rewrites.push({ source: `/${d.slug}`, destination: `${base}/${d.slug}` });
  rewrites.push({ source: `/${d.slug}/:path*`, destination: `${base}/${d.slug}/:path*` });
}
writeFileSync("vercel.json", JSON.stringify({ rewrites }, null, 2) + "\n");

// ── 내장 9개 정적 페이지에 verification 메타 주입(멱등) ──
let patched = 0;
for (const b of BUILTINS) {
  const f = `${b.slug}/index.html`;
  if (!existsSync(f)) continue;
  let h = readFileSync(f, "utf8");
  if (h.includes("google-site-verification")) continue;
  if (h.includes('name="theme-color"')) {
    h = h.replace(/(<meta name="theme-color"[^>]*>)/, `$1\n${VERIFY_META}`);
  } else {
    h = h.replace(/<\/title>/, `</title>\n${VERIFY_META}`);
  }
  writeFileSync(f, h);
  patched++;
}

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
