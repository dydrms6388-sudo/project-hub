#!/usr/bin/env node
// FitCalc 정적 페이지 생성기 (의존성 0). 실행: node gen.mjs
// src/tools/*.mjs 의 도구 정의 → <slug>/index.html + index.html + privacy/terms + sitemap/robots 생성.
// 산출물은 커밋한다. 링크는 전부 상대 경로(서브패스/독립 도메인 양쪽 동작).
import { readdirSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
export const SITE_ORIGIN = "https://fitcalc-kr.vercel.app"; // ← 도메인 변경 시 이 상수 하나만 수정
const SITE_NAME = "FitCalc 운동 계산기";
const ADS_CLIENT = "ca-pub-5567719201265106";
const TODAY = "2026-08-19";

const FAVICON = `<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💪</text></svg>">`;
const THEME_SCRIPT = `<script>try{var t=localStorage.getItem('tec-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>`;
const ADS_LOADER = `<meta name="google-adsense-account" content="${ADS_CLIENT}" />\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>`;
// 결과 하단 반응형 광고 1개 (data-ad-slot 은 애드센스 승인 후 발급되는 유닛 ID를 추가)
const AD_UNIT = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEALTH_NOTICE = `<div class="notice no-print"><strong>⚠ 참고용 안내</strong> — 이 결과는 일반적인 공식·공개 자료에 따른 <b>참고용 추정</b>이며 개인차가 큽니다. 의료·진단 정보가 아니며, 운동 중 통증·어지럼 등 이상 증상이 있으면 즉시 중단하고 의사·전문 트레이너 등 전문가와 상담하세요.</div>`;

function jsonLd(tool) {
  const url = `${SITE_ORIGIN}/${tool.slug}/`;
  const graph = [
    {
      "@type": "SoftwareApplication",
      name: tool.name,
      url,
      description: tool.desc,
      applicationCategory: "HealthApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      isAccessibleForFree: true,
    },
    {
      "@type": "FAQPage",
      mainEntity: tool.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: tool.name, item: url },
      ],
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

function head({ title, desc, path, jsonld, cssHref }) {
  const url = `${SITE_ORIGIN}${path}`;
  return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)" />
${THEME_SCRIPT}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
${FAVICON}
${ADS_LOADER}
<link rel="stylesheet" href="${cssHref}" />
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}`;
}

function footer(rel) {
  return `<footer class="no-print">
  <p style="margin:0 0 8px">💪 <a href="${rel}">${SITE_NAME}</a> — 러닝·헬스 계산기 모음 (무료 · 서버 저장 없음)</p>
  <p style="margin:0"><a href="${rel}">홈</a>·<a href="${rel}privacy.html">개인정보처리방침</a>·<a href="${rel}terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/" target="_blank" rel="noopener">TomatoEggCat</a></p>
</footer>`;
}

function sourcesBox(sources) {
  if (!sources || !sources.length) return "";
  const items = sources
    .map((s) => (s.url && /^https?:/.test(s.url) ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>` : `${esc(s.label)}`))
    .join(" · ");
  return `<div class="edbox no-print"><p class="ed-by"><strong>수치 출처 · 확인일 ${TODAY}</strong></p><p class="ed-src">${items}</p></div>`;
}

function relatedSection(tool, toolsById) {
  const internal = (tool.related || [])
    .map((id) => toolsById[id])
    .filter(Boolean)
    .map((t) => `<a class="rel" href="../${t.slug}/"><span class="re">${t.emoji}</span>${esc(t.name)}</a>`);
  const external = (tool.external || []).map(
    (e) => `<a class="rel" href="${e.url}" target="_blank" rel="noopener"><span class="re">🔗</span>${esc(e.name)}</a>`
  );
  return `<section class="related no-print"><h2>관련 도구</h2><div class="rel-grid">${internal.join("")}${external.join("")}</div></section>`;
}

function toolPage(tool, toolsById) {
  const howto = tool.howto?.length ? `<h2>사용법</h2><ol>${tool.howto.map((s) => `<li>${s}</li>`).join("")}</ol>` : "";
  const faq = `<h2>자주 묻는 질문</h2>` + tool.faq.map((f) => `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">A. ${esc(f.a)}</p></div>`).join("");
  return `<!doctype html>
<!-- ⚠ 자동 생성 파일: fitcalc-kr/gen.mjs 가 재생성합니다. 수정은 src/tools/${tool.slug}.mjs 에서. -->
<html lang="ko">
<head>
${head({ title: tool.title, desc: tool.desc, path: `/${tool.slug}/`, jsonld: jsonLd(tool), cssHref: "../assets/style.css" })}
</head>
<body>
<div class="wrap">
  <nav class="crumb no-print" aria-label="breadcrumb"><a href="../">${SITE_NAME}</a> <span class="sep">›</span> <span class="c-cur">${esc(tool.name)}</span></nav>
  <header class="hero">
    <div class="emoji" aria-hidden="true">${tool.emoji}</div>
    <h1>${esc(tool.name)}</h1>
    <p class="lead">${esc(tool.lead || tool.desc)}</p>
  </header>
  ${HEALTH_NOTICE}
${tool.body}
  <section class="ad-box no-print" id="adBox" hidden aria-label="광고">${AD_UNIT}</section>
  <section class="about no-print">
    <h2>소개</h2>
    ${tool.intro}
    ${howto}
    ${faq}
    ${sourcesBox(tool.sources)}
  </section>
  ${relatedSection(tool, toolsById)}
  ${footer("../")}
</div>
<script type="module">
${tool.script}
</script>
</body>
</html>
`;
}

function hubPage(tools) {
  const cards = tools
    .map((t) => `<a class="card" href="${t.slug}/"><span class="ce">${t.emoji}</span><div class="cn">${esc(t.name)}</div><div class="cd">${esc(t.card || t.desc)}</div></a>`)
    .join("\n    ");
  const faq = [
    { q: "FitCalc 은 무료인가요?", a: "네, 모든 계산기는 무료이며 회원가입 없이 사용합니다. 운동 기록장·챌린지 체크는 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다." },
    { q: "계산 결과를 훈련 처방으로 믿어도 되나요?", a: "아니요. 모든 결과는 공개된 공식·자료 기반의 참고용 추정입니다. 개인차가 크므로 실제 훈련·건강 관련 결정은 의사·전문 트레이너와 상담하세요." },
    { q: "어떤 도구가 있나요?", a: "1RM 계산기, 러닝 페이스·완주 예측·스플릿 계획, 인터벌 타이머(화면 꺼짐 방지), 심박수 존, 운동 기록장, 소모 칼로리, 걸음수 변환, 30일 챌린지, 단백질 분배, 휴식일 계산 등 12종입니다." },
  ];
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE_NAME, url: `${SITE_ORIGIN}/`, description: "러닝·헬스 필수 계산기 12종 — 1RM, 러닝 페이스, 인터벌 타이머, 심박수 존, 운동 기록장." },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  });
  return `<!doctype html>
<!-- ⚠ 자동 생성 파일: fitcalc-kr/gen.mjs 가 재생성합니다. -->
<html lang="ko">
<head>
${head({ title: "FitCalc — 러닝·헬스 운동 계산기 12종 (1RM·페이스·인터벌 타이머)", desc: "1RM 5공식 비교, 러닝 페이스·마라톤 완주 예측(Riegel), 인터벌 타이머(화면 꺼짐 방지·음성), 심박수 존, 운동 기록장, 소모 칼로리(MET) 등 무료 운동 계산기 모음.", path: "/", jsonld, cssHref: "assets/style.css" })}
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="emoji" aria-hidden="true">💪</div>
    <h1>FitCalc 운동 계산기</h1>
    <p class="lead">러닝·헬스에 꼭 필요한 계산기 12종. 회원가입 없이 무료, 기록은 내 브라우저에만 저장됩니다.</p>
  </header>
  <div class="notice"><strong>⚠ 참고용 안내</strong> — 모든 결과는 공개 공식·자료 기반의 참고용 추정입니다. 개인차가 크며 의료 정보가 아닙니다. 통증 등 이상 증상이 있으면 전문가와 상담하세요.</div>
  <nav class="cards" aria-label="도구 목록">
    ${cards}
  </nav>
  <section class="about">
    <h2>FitCalc 소개</h2>
    <p>FitCalc 은 러닝과 웨이트 트레이닝에 필요한 계산을 한곳에 모은 무료 도구 모음입니다. 1RM(Epley·Brzycki 등 5공식), 러닝 페이스와 Riegel 완주 예측, 화면이 꺼지지 않는 인터벌 타이머, 심박수 존, MET 기반 소모 칼로리까지 — 근거가 되는 공식과 출처를 각 페이지에 그대로 공개합니다.</p>
    <p>운동 기록장과 30일 챌린지 체크는 서버 없이 브라우저 저장소(localStorage)에만 보관되어 개인정보 걱정이 없습니다. 언제든 CSV 로 내보내거나 전체 삭제할 수 있습니다.</p>
    ${faq.map((f) => `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">A. ${esc(f.a)}</p></div>`).join("")}
  </section>
  ${footer("")}
</div>
</body>
</html>
`;
}

function staticPage({ file, title, desc, bodyHtml }) {
  return `<!doctype html>
<!-- ⚠ 자동 생성 파일: fitcalc-kr/gen.mjs 가 재생성합니다. -->
<html lang="ko">
<head>
${head({ title, desc, path: `/${file}`, jsonld: "", cssHref: "assets/style.css" })}
</head>
<body>
<div class="wrap">
  <nav class="crumb" aria-label="breadcrumb"><a href="./">${SITE_NAME}</a> <span class="sep">›</span> <span class="c-cur">${esc(title)}</span></nav>
  <section class="about">
  ${bodyHtml}
  </section>
  ${footer("")}
</div>
</body>
</html>
`;
}

const PRIVACY_BODY = `<h1 style="font-size:24px">개인정보처리방침</h1>
<p>시행일: ${TODAY}</p>
<h2>1. 수집하는 개인정보</h2>
<p>FitCalc(${SITE_ORIGIN.replace("https://", "")})은 회원가입·로그인 기능이 없으며, 이름·전화번호·이메일 등 개인정보를 서버에 수집·저장하지 않습니다.</p>
<h2>2. 브라우저 저장소(localStorage)</h2>
<p>운동 기록장, 30일 챌린지 체크, 테마 설정 등 일부 기능은 이용자의 브라우저 저장소(localStorage)에만 데이터를 저장합니다. 이 데이터는 서버로 전송되지 않으며, 각 페이지의 "전체 삭제" 버튼 또는 브라우저 설정에서 언제든 삭제할 수 있습니다.</p>
<h2>3. 광고 및 쿠키</h2>
<p>본 사이트는 Google AdSense 광고를 게재합니다. Google 을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록에 기반한 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다. 자세한 내용은 <a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener">Google 광고 정책</a>을 참고하세요.</p>
<h2>4. 문의</h2>
<p>개인정보 관련 문의는 운영 허브인 <a href="https://tomatoeggcat.com/contact.html" target="_blank" rel="noopener">TomatoEggCat 문의 페이지</a>를 이용해 주세요.</p>`;

const TERMS_BODY = `<h1 style="font-size:24px">이용약관</h1>
<p>시행일: ${TODAY}</p>
<h2>1. 서비스 성격</h2>
<p>FitCalc 이 제공하는 모든 계산 결과는 공개된 공식·자료에 기반한 <b>참고용 추정치</b>입니다. 의료·진단·치료·훈련 처방 정보가 아니며, 결과의 정확성·완전성을 보증하지 않습니다.</p>
<h2>2. 건강 관련 고지</h2>
<p>운동 수행 능력과 신체 반응에는 큰 개인차가 있습니다. 본 서비스의 결과를 근거로 한 운동·식이 결정으로 발생하는 손해에 대해 운영자는 책임지지 않습니다. 통증, 어지럼 등 이상 증상이 있으면 즉시 운동을 중단하고 의사 등 전문가와 상담하세요.</p>
<h2>3. 데이터</h2>
<p>기록형 도구의 데이터는 이용자의 브라우저에만 저장되며, 브라우저·기기 변경 및 삭제로 유실될 수 있습니다. 중요한 기록은 CSV 내보내기로 별도 보관하세요.</p>
<h2>4. 지식재산권</h2>
<p>사이트의 구성·코드·콘텐츠의 권리는 운영자에게 있으며, 계산 공식 등 공개 자료의 출처는 각 페이지에 표기합니다.</p>`;

async function main() {
  const toolFiles = readdirSync(join(ROOT, "src/tools")).filter((f) => f.endsWith(".mjs")).sort();
  const tools = [];
  for (const f of toolFiles) {
    const mod = await import(pathToFileURL(join(ROOT, "src/tools", f)).href);
    tools.push(mod.default);
  }
  const order = ["one-rm", "running-pace", "race-predict", "split-plan", "interval", "hr-zone", "workout-log", "calorie-burn", "step-convert", "plank-challenge", "protein-timing", "rest-day"];
  tools.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  const toolsById = Object.fromEntries(tools.map((t) => [t.slug, t]));

  let warnings = 0;
  for (const t of tools) {
    for (const key of ["slug", "name", "title", "desc", "body", "script", "faq"]) {
      if (!t[key]) { console.warn(`⚠ ${t.slug || "?"}: ${key} 누락`); warnings++; }
    }
    mkdirSync(join(ROOT, t.slug), { recursive: true });
    writeFileSync(join(ROOT, t.slug, "index.html"), toolPage(t, toolsById));
  }

  writeFileSync(join(ROOT, "index.html"), hubPage(tools));
  writeFileSync(join(ROOT, "privacy.html"), staticPage({ file: "privacy.html", title: "개인정보처리방침", desc: "FitCalc 개인정보처리방침 — 서버 수집 없음, localStorage 및 광고 쿠키 안내.", bodyHtml: PRIVACY_BODY }));
  writeFileSync(join(ROOT, "terms.html"), staticPage({ file: "terms.html", title: "이용약관", desc: "FitCalc 이용약관 — 참고용 정보 고지, 건강 관련 면책, 데이터 보관 안내.", bodyHtml: TERMS_BODY }));

  const urls = ["/", ...tools.map((t) => `/${t.slug}/`), "/privacy.html", "/terms.html"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_ORIGIN}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`;
  writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
  writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);

  // 가드: 금칙 문자열 / 절대경로 링크 검사
  const banned = ["광고 " + "영역", "REPLACE" + "_"];
  const htmlFiles = ["index.html", "privacy.html", "terms.html", ...tools.map((t) => `${t.slug}/index.html`)];
  for (const f of htmlFiles) {
    const html = readFileSync(join(ROOT, f), "utf8");
    for (const b of banned) if (html.includes(b)) { console.warn(`⚠ ${f}: 금칙 문자열 "${b}" 발견`); warnings++; }
    const badHref = html.match(/(?:href|src)="\/(?!\/)/g);
    if (badHref) { console.warn(`⚠ ${f}: "/" 로 시작하는 절대경로 링크 ${badHref.length}건`); warnings++; }
  }

  console.log(`✅ 생성 완료: 도구 ${tools.length}종 + 허브/약관/사이트맵 (경고 ${warnings}건)`);
  if (warnings > 0) process.exitCode = 1;
}

main();
