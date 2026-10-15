/* BabyCalc KR — 정적 페이지 생성기 (Node, 의존성 0)
 * 실행: node gen.mjs
 * 공통 HTML 셸 1개 + 도구별 설정으로 전 페이지를 생성한다.
 * 생성물: index.html, <slug>/index.html, weaning-stage/<재료>/index.html,
 *         guide/<slug>/index.html, privacy.html, terms.html, sitemap.xml, robots.txt
 * ⚠ vaccine-schedule/index.html 은 손으로 완성된 페이지 → 생성기가 건드리지 않는다.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOOLS_A } from './content/tools-a.mjs';
import { TOOLS_B } from './content/tools-b.mjs';
import { GUIDES } from './content/guides.mjs';
import { INGREDIENTS, STAGE_LABEL, SOURCE as WEAN_SRC } from './data/weaning.mjs';

export const SITE_ORIGIN = 'https://babycalc-kr.vercel.app';
const SITE_NAME = 'BabyCalc 육아 계산기 허브';
const AD_CLIENT = 'ca-pub-5567719201265106';
const BASE = dirname(fileURLToPath(import.meta.url));

/* vaccine-schedule 는 완성본 유지 (생성 대상에서 제외, 허브·사이트맵에는 포함) */
const PRESERVE = new Set(['vaccine-schedule/index.html']);

const warnings = [];
const written = [];

/* ───────────────────────── 유틸 ───────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonld = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function upFor(file) {
  const depth = file.split('/').length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

function write(file, content) {
  const full = join(BASE, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  written.push(file);
}

/* ───────────────────────── 공통 셸 ─────────────────────────
 * 모든 내부 링크는 @UP@ 토큰을 쓴다 → 파일 깊이에 맞는 상대경로로 치환.
 */
function shell(p) {
  const up = upFor(p.file);
  const urlPath = p.file.replace(/index\.html$/, '');
  const canonical = SITE_ORIGIN + '/' + urlPath;

  const crumbHtml = p.crumbs && p.crumbs.length
    ? '<nav class="crumb" aria-label="breadcrumb">' +
      p.crumbs.map((c, i) => (c.href ? '<a href="' + c.href + '">' + esc(c.name) + '</a>' : '<span class="cur">' + esc(c.name) + '</span>') +
        (i < p.crumbs.length - 1 ? ' <span class="sep">›</span> ' : '')).join('') + '</nav>'
    : '';

  const faqHtml = (p.faq || []).map((f) =>
    '<div class="qa"><p class="q">Q. ' + f.q + '</p><p class="a">' + f.a + '</p></div>').join('\n      ');

  const aboutParts = [];
  if (p.introHtml) aboutParts.push('<h2>' + (p.introTitle || '이 도구는') + '</h2>\n    ' + p.introHtml);
  if (p.howtoHtml) aboutParts.push('<h2>사용법</h2>\n    ' + p.howtoHtml);
  if (p.extraHtml) aboutParts.push(p.extraHtml);
  if (faqHtml) aboutParts.push('<h2>자주 묻는 질문</h2>\n      ' + faqHtml);
  if (p.srcHtml) aboutParts.push('<div class="src-box">' + p.srcHtml + '</div>');
  if (p.disclaimer !== false) {
    aboutParts.push('<p class="disclaimer">' + (p.disclaimer || '이 페이지의 계산·안내는 일반적인 참고 정보이며 진단·의료 자문이 아닙니다. 아이의 건강과 관련한 판단은 반드시 소아과 전문의와 상담하세요.') + '</p>');
  }
  const aboutHtml = aboutParts.length ? '<section class="about">\n    ' + aboutParts.join('\n\n    ') + '\n  </section>' : '';

  const relHtml = (p.related && p.related.length)
    ? '<section class="related">\n    <h2>관련 도구</h2>\n    <div class="rel-grid">\n      ' +
      p.related.map((r) => '<a class="rel" href="' + r.href + '"><span class="ic">' + r.ic + '</span>' + esc(r.name) + '</a>').join('\n      ') +
      '\n    </div>\n  </section>'
    : '';

  let adHtml = '';
  if (p.ad === 'result') {
    adHtml = '<div class="ad-wrap" id="adWrap" hidden>\n    <ins class="adsbygoogle" style="display:block" data-ad-client="' + AD_CLIENT + '" data-ad-format="auto" data-full-width-responsive="true"></ins>\n  </div>';
  } else if (p.ad === 'inline') {
    adHtml = '<div class="ad-wrap" id="adWrap">\n    <ins class="adsbygoogle" style="display:block" data-ad-client="' + AD_CLIENT + '" data-ad-format="auto" data-full-width-responsive="true"></ins>\n  </div>\n  <script>try{(adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}</script>';
  }
  const adLoader = p.ad
    ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + AD_CLIENT + '" crossorigin="anonymous"></script>\n'
    : '';

  /* JSON-LD: 앱/문서 + FAQPage + BreadcrumbList */
  const graph = [];
  if (p.kind === 'article') {
    graph.push({
      '@type': 'Article', headline: p.h1, description: p.desc,
      inLanguage: 'ko-KR', datePublished: p.published || '2026-08-19', dateModified: p.modified || '2026-08-19',
      mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: SITE_NAME },
    });
  } else if (p.kind === 'website') {
    graph.push({
      '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN + '/', inLanguage: 'ko-KR', description: p.desc,
    });
    graph.push({
      '@type': 'ItemList', name: '육아 계산기 목록',
      itemListElement: HUB.map((h, i) => ({
        '@type': 'ListItem', position: i + 1, name: h.name, url: SITE_ORIGIN + '/' + h.slug + '/',
      })),
    });
  } else if (p.kind !== 'plain') {
    graph.push({
      '@type': 'SoftwareApplication', name: p.appName || p.h1,
      applicationCategory: p.appCategory || 'HealthApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      description: p.desc, url: canonical, inLanguage: 'ko-KR',
    });
  }
  if (p.faq && p.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: p.faq.map((f) => ({
        '@type': 'Question', name: stripTags(f.q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
      })),
    });
  }
  if (p.crumbs && p.crumbs.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: p.crumbs.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name,
        item: c.abs || canonical,
      })),
    });
  }

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f7f8fa" media="(prefers-color-scheme: light)">
<script>try{var t=localStorage.getItem('tec-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${p.kind === 'article' ? 'article' : 'website'}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(p.ogTitle || p.h1)}">
<meta property="og:description" content="${esc(p.ogDesc || p.desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="@UP@assets/style.css">
${adLoader}<script type="application/ld+json">
${jsonld({ '@context': 'https://schema.org', '@graph': graph })}
</script>
</head>
<body>
<div class="wrap">
  ${crumbHtml}
  <div class="hero">
    <div class="emoji" aria-hidden="true">${p.emoji}</div>
    <h1>${esc(p.h1)}</h1>
    ${p.lead ? '<p class="lead">' + p.lead + '</p>' : ''}
  </div>
  ${p.notice ? '<p class="med-notice">' + p.notice + '</p>' : ''}

  ${p.bodyHtml}

  ${adHtml}

  ${aboutHtml}

  ${relHtml}

  <footer>
    <p style="margin:0 0 8px">👶 <a href="@UP@">BabyCalc</a> — 육아 계산기 허브</p>
    <p style="margin:0"><a href="@UP@privacy.html">개인정보처리방침</a>·<a href="@UP@terms.html">이용약관</a>·<a href="https://tomatoeggcat.com/">TomatoEggCat</a></p>
  </footer>
</div>
<script src="@UP@assets/app.js"></script>
${p.script ? '<script type="module">\n' + p.script + '\n</script>' : ''}
</body>
</html>
`;
  return html.replace(/@UP@/g, up === '' ? './' : up);
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/* 공통 조각 */
export const MED_NOTICE = '⚠ 이 페이지는 <strong>참고용이며 진단이 아닙니다</strong>. 아이의 건강·발달과 관련한 판단은 반드시 <strong>소아과 전문의와 상담</strong>하세요.';
export const LOCAL_NOTE = '<p class="local-note">✅ 입력·기록은 이 브라우저(localStorage)에만 저장됩니다. <strong>서버 저장 없음.</strong></p>';

/* ───────────────────────── 페이지 목록 ───────────────────────── */
const ALL_TOOLS = [...TOOLS_A, ...TOOLS_B];

/* 허브 카드용 메타 (vaccine-schedule 포함, 표시 순서) */
const HUB = [
  { slug: 'vaccine-schedule', emoji: '💉', name: '예방접종 일정표', desc: '생년월일로 접종 시기·D-day, .ics 내보내기' },
  { slug: 'months-age', emoji: '📅', name: '아기 개월수 계산기', desc: '개월·주·일수와 이른둥이 교정연령까지' },
  { slug: 'growth-percentile', emoji: '📈', name: '성장 백분위 계산기', desc: 'LMS z점수로 백분위 + 표준곡선 그래프' },
  { slug: 'formula-amount', emoji: '🍼', name: '분유 수유량 계산기', desc: '체중 기준 하루 총량과 1회 수유량 참고 범위' },
  { slug: 'weaning-stage', emoji: '🥣', name: '이유식 단계 계산기', desc: '지금 단계와 재료별 시작 시기 60종' },
  { slug: 'sleep-schedule', emoji: '😴', name: '수면 스케줄 만들기', desc: '월령별 권장 수면시간과 낮잠 타임라인' },
  { slug: 'fever-guide', emoji: '🌡️', name: '아기 발열 대처 가이드', desc: '월령·체온·증상으로 보는 진료 판단 기준' },
  { slug: 'diaper-size', emoji: '🧷', name: '기저귀 사이즈 찾기', desc: '체중으로 보는 사이즈 구간과 교체 신호' },
  { slug: 'daycare-dday', emoji: '🏫', name: '어린이집 입소 D-day', desc: '입소일 D-day와 우선순위 점수 계산' },
  { slug: 'baby-cost', emoji: '💰', name: '육아 비용 계산기', desc: '월 지출과 부모급여·아동수당 차감 계산' },
  { slug: 'name-check', emoji: '✨', name: '아기 이름 느낌 체크', desc: '오락용 이름 분석 — 작명·사주 아님' },
  { slug: 'milestone', emoji: '🧸', name: '발달 이정표 체크', desc: '월령별 대표 발달 항목 체크리스트' },
];

/* ───────────────────────── 빌드 ───────────────────────── */
function buildTools() {
  ALL_TOOLS.forEach((t) => {
    const file = t.slug + '/index.html';
    if (PRESERVE.has(file)) return;
    write(file, shell({
      file,
      title: t.title, desc: t.desc,
      ogTitle: t.ogTitle, ogDesc: t.ogDesc,
      emoji: t.emoji, h1: t.h1, lead: t.lead,
      notice: t.notice === null ? null : (t.notice || MED_NOTICE),
      crumbs: [
        { name: 'BabyCalc 육아 허브', href: '@UP@', abs: SITE_ORIGIN + '/' },
        { name: t.crumbName || t.h1, abs: SITE_ORIGIN + '/' + t.slug + '/' },
      ],
      bodyHtml: t.bodyHtml,
      ad: 'result',
      introTitle: t.introTitle, introHtml: t.introHtml, howtoHtml: t.howtoHtml,
      extraHtml: t.extraHtml, faq: t.faq, srcHtml: t.srcHtml, disclaimer: t.disclaimer,
      related: t.related, script: t.script,
      appCategory: t.appCategory,
    }));
  });
}

/* 이유식 재료 롱테일 — weaning-stage/<slug>/ */
const VERDICT = {
  ok: { badge: '<span class="badge ok">해당 단계부터 가능</span>', word: '가능' },
  caution: { badge: '<span class="badge warn">주의해서 소량부터</span>', word: '주의' },
  no: { badge: '<span class="badge danger">이 시기 금지</span>', word: '금지' },
};

function buildIngredients() {
  INGREDIENTS.forEach((ing) => {
    const file = 'weaning-stage/' + ing.slug + '/index.html';
    const stageLabel = STAGE_LABEL[ing.stage] || ing.stage;
    const v = VERDICT[ing.verdict];
    const isNo = ing.verdict === 'no';
    const others = INGREDIENTS.filter((o) => o.stage === ing.stage && o.slug !== ing.slug).slice(0, 6);
    const title = ing.name + ' 이유식, 언제부터? — ' + stageLabel + ' 시작 시기·주의사항 | BabyCalc';
    const desc = ing.name + ' 이유식 도입 시기는 ' + stageLabel + ' 기준입니다. ' + stripTags(ing.summary).slice(0, 90) + ' 알레르기·질식 주의사항과 조리 요령을 정리했습니다.';

    const bodyHtml = `<section class="card">
    <h2>${esc(ing.name)} — 언제부터?</h2>
    <p class="res-big">${esc(stageLabel)}</p>
    <p class="res-sub">${v.badge}${ing.checked ? ' <span class="badge ok">출처 확인됨</span>' : ' <span class="badge todo">일반 안내 · 확인 필요</span>'}</p>
    <div class="kv"><span class="k">권장 단계</span><span class="v">${esc(stageLabel)}</span></div>
    <div class="kv"><span class="k">판정</span><span class="v">${v.word}</span></div>
    <div class="kv"><span class="k">분류</span><span class="v">${isNo ? '돌 이전 제공 금지 품목' : '단계 도달 후 도입'}</span></div>
    <p class="res-sub" style="margin-top:12px">${ing.summary}</p>
    ${ing.caution ? '<p class="med-notice" style="margin-top:12px">⚠ ' + ing.caution + '</p>' : ''}
  </section>

  <section class="card">
    <h2>새 재료를 처음 줄 때 3원칙</h2>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      <li><strong>한 번에 하나씩</strong> — 새 재료는 하루에 하나만 추가합니다.</li>
      <li><strong>아침·오전에 소량</strong> — 반응이 생겨도 낮에 병원에 갈 수 있는 시간대에.</li>
      <li><strong>2~3일 관찰</strong> — 발진·구토·설사·호흡 변화가 없으면 다음 재료로.</li>
    </ul>
    <p class="local-note">두드러기·입술 부종·호흡곤란 등 급성 반응이 보이면 즉시 진료(심하면 119)를 받으세요.</p>
  </section>`;

    write(file, shell({
      file, title, desc,
      ogTitle: ing.name + ' 이유식 시작 시기',
      ogDesc: stageLabel + ' 기준 · 알레르기와 질식 주의사항 정리',
      emoji: '🥄', h1: ing.name + ' 이유식, 언제부터?',
      lead: esc(ing.name) + ' 도입 시기와 주의사항을 한 장으로 정리했습니다.',
      notice: MED_NOTICE,
      crumbs: [
        { name: 'BabyCalc 육아 허브', href: '@UP@', abs: SITE_ORIGIN + '/' },
        { name: '이유식 단계', href: '@UP@weaning-stage/', abs: SITE_ORIGIN + '/weaning-stage/' },
        { name: ing.name, abs: SITE_ORIGIN + '/weaning-stage/' + ing.slug + '/' },
      ],
      bodyHtml,
      ad: 'result',
      introTitle: ing.name + ' 도입 시기 정리',
      introHtml: '<p>' + ing.summary + ' 위 시기는 <strong>일반적으로 안내되는 기준</strong>이며 아이의 소화·알레르기 상태에 따라 달라집니다. ' +
        (isNo ? '특히 이 재료는 <strong>돌(생후 12개월) 이전에는 주지 않는 것</strong>이 권고입니다.' : '단계에 도달했더라도 아이가 아직 준비되지 않았다면 서두르지 않아도 됩니다.') + '</p>',
      howtoHtml: '<ol><li><a href="@UP@weaning-stage/">이유식 단계 계산기</a>에서 아기의 현재 단계를 먼저 확인하세요.</li>' +
        '<li>단계가 <strong>' + esc(stageLabel) + '</strong> 이상이면 소량(1~2작은술)부터 시도합니다.</li>' +
        '<li>2~3일 관찰 후 이상이 없으면 양을 늘리고 다음 재료로 넘어갑니다.</li></ol>',
      extraHtml: others.length ? '<h2>같은 단계의 다른 재료</h2>\n    <div class="rel-grid">' +
        others.map((o) => '<a class="rel" href="@UP@weaning-stage/' + o.slug + '/"><span class="ic">🥄</span>' + esc(o.name) + '</a>').join('') + '</div>' : '',
      faq: [
        { q: esc(ing.name) + ' 이유식은 몇 개월부터 가능한가요?', a: '일반적인 안내 기준으로는 ' + esc(stageLabel) + '부터입니다. 다만 자료마다 시기 안내가 조금씩 다르고 아이마다 준비 시점이 달라 절대적인 기준은 아닙니다.' },
        { q: '알레르기 반응이 걱정되면 어떻게 하나요?', a: '새 재료는 하나씩·소량으로 시작해 2~3일 관찰하는 것이 원칙입니다. 가족 중 식품 알레르기가 있거나 이전에 반응이 있었다면 도입 전에 소아과 전문의와 상담하세요.' },
        { q: '질식 위험은 어떻게 줄이나요?', a: '둥글고 단단하거나 미끄러운 음식(통포도·방울토마토·통견과·통콩 등)은 그대로 주지 않고 잘게 자르거나 갈아서 제공합니다. 먹는 동안에는 반드시 앉힌 상태로 옆에서 지켜보세요.' },
      ],
      srcHtml: '<strong>출처</strong> · ' + WEAN_SRC.name + ' — <a href="' + WEAN_SRC.url + '" target="_blank" rel="noopener">' + WEAN_SRC.url + '</a> (확인일 ' + WEAN_SRC.checkedAt + ')' +
        (ing.checked ? '' : ' · 이 재료의 도입 시기는 <strong>공식 표준이 아닌 일반적 육아 안내 수준</strong>이라 "확인 필요"로 표기합니다.'),
      related: [
        { href: '@UP@weaning-stage/', ic: '🥣', name: '이유식 단계 계산기' },
        { href: '@UP@guide/weaning-start/', ic: '📖', name: '이유식 시작 가이드' },
        { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
        { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
        { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미' },
      ],
      appCategory: 'LifestyleApplication',
    }));
  });
}

function buildGuides() {
  GUIDES.forEach((g) => {
    const file = 'guide/' + g.slug + '/index.html';
    write(file, shell({
      file, kind: 'article',
      title: g.title, desc: g.desc, ogTitle: g.ogTitle || g.h1, ogDesc: g.ogDesc,
      emoji: g.emoji, h1: g.h1, lead: g.lead,
      notice: g.notice === null ? null : (g.notice || MED_NOTICE),
      crumbs: [
        { name: 'BabyCalc 육아 허브', href: '@UP@', abs: SITE_ORIGIN + '/' },
        { name: '가이드', abs: SITE_ORIGIN + '/guide/' + g.slug + '/' },
        { name: g.crumbName || g.h1, abs: SITE_ORIGIN + '/guide/' + g.slug + '/' },
      ],
      bodyHtml: g.bodyHtml,
      ad: 'inline',
      faq: g.faq, srcHtml: g.srcHtml, related: g.related,
      published: g.published, modified: g.modified,
    }));
  });
}

function buildHub() {
  const cards = HUB.map((h) =>
    '<a class="tool-card" href="@UP@' + h.slug + '/"><div class="t-emoji" aria-hidden="true">' + h.emoji + '</div>' +
    '<p class="t-name">' + esc(h.name) + '</p><p class="t-desc">' + esc(h.desc) + '</p></a>').join('\n      ');

  const guideCards = GUIDES.map((g) =>
    '<a class="tool-card" href="@UP@guide/' + g.slug + '/"><div class="t-emoji" aria-hidden="true">' + g.emoji + '</div>' +
    '<p class="t-name">' + esc(g.hubName) + '</p><p class="t-desc">' + esc(g.hubDesc) + '</p></a>').join('\n      ');

  const popular = ['rice', 'beef', 'egg-yolk', 'honey', 'milk', 'strawberry', 'peanut', 'tofu']
    .map((s) => INGREDIENTS.find((i) => i.slug === s)).filter(Boolean);

  const bodyHtml = `<div class="tool-grid">
      ${cards}
    </div>

  <section class="about" style="margin-top:36px">
    <h2>가이드</h2>
  </section>
  <div class="tool-grid" style="margin-top:12px">
      ${guideCards}
    </div>

  <section class="card">
    <h2>많이 찾는 이유식 재료</h2>
    <div class="rel-grid">
      ${popular.map((i) => '<a class="rel" href="@UP@weaning-stage/' + i.slug + '/"><span class="ic">🥄</span>' + esc(i.name) + ' 언제부터?</a>').join('\n      ')}
    </div>
    <p class="local-note">전체 ${INGREDIENTS.length}종 재료는 <a href="@UP@weaning-stage/">이유식 단계 계산기</a>에서 검색할 수 있어요.</p>
  </section>`;

  write('index.html', shell({
    file: 'index.html',
    title: 'BabyCalc — 육아 계산기 허브 | 예방접종·성장 백분위·이유식·수면',
    desc: '아기 생년월일 하나로 예방접종 일정, 개월수·교정연령, 성장 백분위, 분유량, 이유식 단계, 수면 스케줄, 발열 대처, 육아 비용까지. 설치·가입 없이 브라우저에서 바로 쓰는 무료 육아 계산기 12종.',
    ogTitle: 'BabyCalc — 육아 계산기 허브',
    ogDesc: '예방접종·성장 백분위·이유식·수면·발열까지 육아 계산기 12종을 한곳에서.',
    emoji: '👶', h1: 'BabyCalc 육아 계산기 허브',
    lead: '아기 생년월일 하나면 충분해요. 접종 일정부터 이유식·수면·비용까지, 설치 없이 바로 쓰는 무료 계산기 12종.',
    notice: MED_NOTICE,
    crumbs: null,
    bodyHtml,
    ad: false,
    kind: 'website',
    introTitle: 'BabyCalc은 어떤 곳인가요?',
    introHtml: '<p>BabyCalc은 <strong>0~36개월 아기를 키우며 자주 검색하게 되는 계산</strong>을 한곳에 모은 무료 도구 모음입니다. 모든 계산은 여러분의 브라우저 안에서만 이뤄지고, 입력한 값은 서버로 전송되지 않습니다. 회원가입도, 앱 설치도 필요 없습니다.</p>' +
      '<p>수치의 근거가 되는 자료는 페이지마다 <strong>출처와 확인일</strong>을 함께 적었습니다. 공식 표준이 아닌 일반적 육아 안내 수준의 정보에는 <span class="badge todo">확인 필요</span> 배지를 달아 구분합니다.</p>',
    howtoHtml: '<ol><li>위 카드에서 필요한 계산기를 고릅니다.</li><li>생년월일 등 최소한의 값만 입력하면 결과가 바로 나옵니다.</li><li>접종 체크·성장 기록·발달 체크는 브라우저에 저장되고, CSV·JSON·캘린더(.ics)로 내보낼 수 있습니다.</li></ol>',
    faq: [
      { q: '입력한 아기 정보는 어디에 저장되나요?', a: '서버로 전송되지 않습니다. 접종 체크·성장 기록 등 일부 기능은 사용 중인 브라우저의 localStorage에만 저장되며, 각 페이지의 "기록 전체 삭제" 버튼이나 브라우저 데이터 삭제로 지울 수 있습니다.' },
      { q: '의료 상담을 대신할 수 있나요?', a: '아니요. 모든 페이지는 참고용 계산·정보 제공이며 진단이 아닙니다. 아이의 건강 상태에 대한 판단은 소아과 전문의와 상담하세요.' },
      { q: '무료인가요?', a: '네, 전부 무료입니다. 운영 비용은 결과 화면 하단의 광고로 충당합니다.' },
    ],
    disclaimer: 'BabyCalc의 모든 계산기는 참고용입니다. 진단·의료 자문·법률 자문이 아니며, 지원금·제도 관련 금액은 신청 전 반드시 공식 기관에서 확인하세요.',
    related: [
      { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미 (TomatoEggCat)' },
      { href: 'https://tomatoeggcat.com/due-date-calc/', ic: '🍅', name: '출산 예정일 계산기' },
      { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
      { href: 'https://tomatoeggcat.com/dydrms-taemyeong/', ic: '🍅', name: '태명 짓기' },
      { href: 'https://tomatoeggcat.com/ovulation-calendar/', ic: '🍅', name: '배란일 계산기' },
    ],
  }));
}

function buildLegal() {
  const legalShell = (file, title, desc, h1, emoji, bodyHtml) => write(file, shell({
    file, kind: 'plain', title, desc, emoji, h1, lead: null, notice: null,
    crumbs: [{ name: 'BabyCalc 육아 허브', href: '@UP@', abs: SITE_ORIGIN + '/' }, { name: h1, abs: SITE_ORIGIN + '/' + file }],
    bodyHtml, ad: false, disclaimer: false,
  }));

  legalShell('privacy.html',
    '개인정보처리방침 | BabyCalc 육아 계산기 허브',
    'BabyCalc은 이용자가 입력한 아기 정보를 서버로 전송하거나 저장하지 않습니다. 브라우저 로컬 저장, 광고 쿠키, 이용자 권리에 대한 안내입니다.',
    '개인정보처리방침', '🔒', `<section class="card">
    <h2>1. 수집하지 않는 정보</h2>
    <p class="res-sub">BabyCalc은 회원가입이 없으며, <strong>실명·전화번호·주민등록번호·이메일 등 개인을 식별할 수 있는 정보를 수집하지 않습니다</strong>. 계산기에 입력하는 생년월일·체중·체온 등의 값은 브라우저 안에서만 사용되며 서버로 전송되지 않습니다.</p>
    <h2 style="font-size:16px;margin-top:18px">2. 브라우저 로컬 저장(localStorage)</h2>
    <p class="res-sub">접종 완료 체크, 성장 기록, 발달 체크리스트, 마지막 입력값 등 일부 기능은 편의를 위해 <strong>이용자의 브라우저 localStorage</strong>에 저장됩니다. 이 데이터는 이용자의 기기를 벗어나지 않으며, 각 페이지의 "기록 전체 삭제" 버튼이나 브라우저의 사이트 데이터 삭제로 언제든 지울 수 있습니다.</p>
    <h2 style="font-size:16px;margin-top:18px">3. 광고 및 쿠키</h2>
    <p class="res-sub">본 사이트는 Google AdSense 광고를 게재합니다. Google 및 협력사는 광고 게재를 위해 쿠키를 사용할 수 있으며, 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다. 자세한 내용은 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">Google 광고 정책</a>을 참고하세요.</p>
    <h2 style="font-size:16px;margin-top:18px">4. 접근 로그</h2>
    <p class="res-sub">사이트가 배포된 호스팅(Vercel) 환경에서 서비스 운영·보안 목적의 접속 로그가 생성될 수 있습니다. 이 로그는 호스팅 제공자의 정책에 따라 처리되며 BabyCalc이 별도로 수집·활용하지 않습니다.</p>
    <h2 style="font-size:16px;margin-top:18px">5. 아동 정보</h2>
    <p class="res-sub">본 사이트는 보호자가 사용하는 계산 도구로, 아동으로부터 직접 개인정보를 수집하지 않습니다. 아기 관련 입력값 또한 서버로 전송되지 않습니다.</p>
    <h2 style="font-size:16px;margin-top:18px">6. 문의</h2>
    <p class="res-sub">개인정보 관련 문의는 운영 사이트 <a href="https://tomatoeggcat.com/">TomatoEggCat</a>의 안내를 통해 접수할 수 있습니다.</p>
    <p class="local-note">시행일 2026-08-19</p>
  </section>`);

  legalShell('terms.html',
    '이용약관 | BabyCalc 육아 계산기 허브',
    'BabyCalc 육아 계산기 허브의 이용 조건, 정보의 참고용 성격과 책임 한계, 저작권에 대한 안내입니다.',
    '이용약관', '📄', `<section class="card">
    <h2>1. 서비스의 성격</h2>
    <p class="res-sub">BabyCalc(이하 "본 사이트")은 육아 관련 계산과 일반 정보를 제공하는 <strong>무료 참고용 도구</strong>입니다. 본 사이트가 제공하는 어떤 결과도 <strong>의학적 진단·치료·처방, 법률 자문, 금융 자문이 아닙니다</strong>.</p>
    <h2 style="font-size:16px;margin-top:18px">2. 정보의 정확성과 책임의 한계</h2>
    <p class="res-sub">본 사이트는 공개된 공공기관 자료를 근거로 정보를 정리하되, 제도·지침은 개정될 수 있고 자료마다 안내가 다를 수 있습니다. 공식 표준이 아닌 항목에는 "확인 필요" 표시를 하고 있으나, 결과의 정확성·최신성을 보증하지 않습니다. 이용자가 본 사이트의 정보에 근거해 내린 판단과 그 결과에 대해 운영자는 책임을 지지 않습니다. 아이의 건강 문제는 반드시 소아과 전문의와, 지원금·제도는 관할 기관과 확인하세요.</p>
    <h2 style="font-size:16px;margin-top:18px">3. 응급 상황</h2>
    <p class="res-sub">응급 상황에서는 본 사이트를 이용하지 말고 즉시 119 또는 가까운 응급실에 연락하세요.</p>
    <h2 style="font-size:16px;margin-top:18px">4. 이용자의 의무</h2>
    <p class="res-sub">이용자는 본 사이트를 법령을 위반하거나 서비스 운영을 방해하는 방식으로 이용해서는 안 됩니다. 자동화된 대량 요청, 무단 복제·재배포는 금지됩니다.</p>
    <h2 style="font-size:16px;margin-top:18px">5. 저작권</h2>
    <p class="res-sub">본 사이트의 텍스트·디자인·코드에 대한 권리는 운영자에게 있습니다. 인용한 공공기관 자료의 권리는 각 기관에 있으며, 출처를 함께 표기합니다.</p>
    <h2 style="font-size:16px;margin-top:18px">6. 약관의 변경</h2>
    <p class="res-sub">본 약관은 사전 고지 없이 변경될 수 있으며, 변경된 약관은 본 페이지 게시 시점부터 적용됩니다.</p>
    <p class="local-note">시행일 2026-08-19</p>
  </section>`);
}

function buildSitemap() {
  const urls = [];
  const add = (path, priority, freq) => urls.push({ path, priority, freq });
  add('', '1.0', 'weekly');
  HUB.forEach((h) => add(h.slug + '/', '0.9', 'monthly'));
  GUIDES.forEach((g) => add('guide/' + g.slug + '/', '0.7', 'monthly'));
  INGREDIENTS.forEach((i) => add('weaning-stage/' + i.slug + '/', '0.6', 'monthly'));
  add('privacy.html', '0.3', 'yearly');
  add('terms.html', '0.3', 'yearly');

  const today = '2026-08-19';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url>\n    <loc>' + SITE_ORIGIN + '/' + u.path + '</loc>\n    <lastmod>' + today +
      '</lastmod>\n    <changefreq>' + u.freq + '</changefreq>\n    <priority>' + u.priority + '</priority>\n  </url>').join('\n') +
    '\n</urlset>\n';
  write('sitemap.xml', xml);

  write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_ORIGIN + '/sitemap.xml\n');
  return urls;
}

/* ───────────────────────── 실행 ───────────────────────── */
buildHub();
buildTools();
buildIngredients();
buildGuides();
buildLegal();
buildSitemap();

/* 자체 가드: 금지 문구 검사 */
const BANNED = ['광고 영역', 'REPLACE_'];
written.filter((f) => f.endsWith('.html')).forEach((f) => {
  const txt = readFileSync(join(BASE, f), 'utf8');
  BANNED.forEach((b) => { if (txt.includes(b)) warnings.push(f + ': 금지 문구 "' + b + '"'); });
  if (/(href|src)="\//.test(txt)) warnings.push(f + ': 절대경로("/") 링크 발견');
});
if (!existsSync(join(BASE, 'vaccine-schedule/index.html'))) warnings.push('vaccine-schedule/index.html 없음');

console.log('생성 완료: HTML ' + written.filter((f) => f.endsWith('.html')).length + '개 (+ vaccine-schedule 유지) / sitemap·robots 포함 총 ' + written.length + '개 파일');
console.log(' - 도구: ' + (ALL_TOOLS.length + 1) + '종, 이유식 재료 롱테일: ' + INGREDIENTS.length + '개, 가이드: ' + GUIDES.length + '편');
if (warnings.length) {
  console.log('\n⚠ 경고 ' + warnings.length + '건');
  warnings.forEach((w) => console.log('  - ' + w));
  process.exitCode = 1;
} else {
  console.log('경고 0건 ✅');
}
