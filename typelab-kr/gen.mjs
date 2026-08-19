#!/usr/bin/env node
/**
 * typelab-kr 정적 페이지 생성기
 * assets/data/tests/<id>.js 를 읽어 아래 페이지를 생성한다.
 *   index.html                              허브(테스트 카드 그리드)
 *   tests/<id>/index.html                   테스트 시작 페이지
 *   tests/<id>/q/index.html                 진행 페이지(클라이언트 상태)
 *   tests/<id>/result/<key>/index.html      결과별 정적 페이지
 *   privacy.html  terms.html  robots.txt  sitemap.xml
 *
 * 사용: node gen.mjs   (멱등 — 같은 입력이면 항상 같은 출력)
 */
import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'assets', 'data', 'tests');
const SITE = 'https://typelab-kr.vercel.app';
const SITE_NAME = 'TypeLab';
const SITE_TAGLINE = '유형 테스트 허브';
const YEAR = 2026;

/* 허브 노출 순서 */
const ORDER = [
  'mbti-lite', 'work-type', 'travel-type', 'spending-type', 'coffee-type',
  'study-type', 'morning-night', 'communication', 'stress-type', 'dating-style'
];

const warnings = [];
const written = [];

/* ---------- 유틸 ---------- */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const jsonld = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

async function emit(rel, content) {
  const abs = path.join(ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf8');
  written.push(rel);
}

/* ---------- 공용 조각 ---------- */
function head({ title, desc, root, ld }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${root}assets/style.css">
${ld.map(jsonld).join('\n')}`;
}

function header(root) {
  return `<header class="site-head"><div class="wrap head-in">
<a class="brand" href="${root}index.html">🧪 ${SITE_NAME} <small>${SITE_TAGLINE}</small></a>
<nav><a href="${root}index.html">전체 테스트</a></nav>
</div></header>`;
}

function footer(root, tests, currentId) {
  const links = tests.filter((t) => t.id !== currentId).slice(0, 9)
    .map((t) => `<li><a href="${root}tests/${t.id}/">${esc(t.title)}</a></li>`).join('');
  return `<footer class="site-foot"><div class="wrap">
<p style="margin:0 0 8px;font-weight:700;color:var(--ink)">다른 테스트도 해 보세요</p>
<ul class="foot-links">${links}</ul>
<p style="margin:0">${SITE_NAME}의 모든 테스트는 자체 제작한 문항으로 만든 재미용 콘텐츠이며, 심리검사나 의학적·전문적 진단이 아닙니다.</p>
<p class="foot-legal"><a href="${root}privacy.html">개인정보처리방침</a> · <a href="${root}terms.html">이용약관</a></p>
<p class="copy">© ${YEAR} ${SITE_NAME}. 문항과 결과 텍스트는 자체 제작 콘텐츠입니다.</p>
</div></footer>`;
}

function faqBlock(faq) {
  return `<section class="section faq"><h2>자주 묻는 질문</h2>
${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}
</section>`;
}

function faqLd(faq) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };
}

function appLd(name, desc) {
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name, description: desc, applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Web', inLanguage: 'ko',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' }
  };
}

function crumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.url
    }))
  };
}

const funNotice = (extra) =>
  `<p class="notice">🎈 재미로 보는 결과입니다. 심리검사가 아닌 오락용 콘텐츠이며, 성격·능력·건강을 진단하지 않습니다.${extra ? ' ' + esc(extra) : ''}</p>`;

function page({ title, desc, root, ld, body, tests, currentId }) {
  return `${head({ title, desc, root, ld })}
${header(root)}
<main>${body}</main>
${footer(root, tests, currentId)}`;
}

/* ---------- 데이터 로드 ---------- */
async function loadTests() {
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.js')).sort();
  const map = new Map();
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(DATA_DIR, f)).href);
    const t = mod.default;
    if (!t || !t.id) { warnings.push(`${f}: default export 또는 id 없음`); continue; }
    if (t.id !== path.basename(f, '.js')) warnings.push(`${f}: id(${t.id})와 파일명 불일치`);
    map.set(t.id, t);
  }
  const ordered = [];
  for (const id of ORDER) {
    if (map.has(id)) { ordered.push(map.get(id)); map.delete(id); }
    else warnings.push(`ORDER에 있으나 데이터 파일 없음: ${id}`);
  }
  for (const t of map.values()) { warnings.push(`ORDER 미등록 테스트(허브 뒤에 붙임): ${t.id}`); ordered.push(t); }
  return ordered;
}

/* 축 조합으로 가능한 모든 결과 키 */
function allKeys(test) {
  let keys = [''];
  for (const ax of test.axes) {
    const next = [];
    for (const k of keys) { next.push(k + ax.left.key); next.push(k + ax.right.key); }
    keys = next;
  }
  return keys.map((k) => k.toLowerCase());
}

function validate(test) {
  const tag = test.id;
  const need = allKeys(test);
  for (const k of need) if (!test.results[k]) warnings.push(`${tag}: 결과 키 누락 ${k}`);
  for (const k of Object.keys(test.results)) if (!need.includes(k)) warnings.push(`${tag}: 사용되지 않는 결과 키 ${k}`);

  const axisKeys = new Set(test.axes.flatMap((a) => [a.left.key, a.right.key]));
  test.questions.forEach((q, i) => {
    if (!q.options || q.options.length < 2) warnings.push(`${tag}: Q${i + 1} 선택지 부족`);
    q.options.forEach((o, j) => {
      const ks = Object.keys(o.scores || {});
      if (!ks.length) warnings.push(`${tag}: Q${i + 1} 선택지 ${j + 1} 점수 없음`);
      ks.forEach((k) => { if (!axisKeys.has(k)) warnings.push(`${tag}: Q${i + 1} 미정의 축 점수 ${k}`); });
    });
  });

  for (const [k, r] of Object.entries(test.results)) {
    const len = r.detail.replace(/\s/g, '').length;
    if (len < 300) warnings.push(`${tag}/${k}: detail 본문 ${len}자 (300자 미만)`);
    if (!r.tips || r.tips.length < 2) warnings.push(`${tag}/${k}: tips 부족`);
    (r.match || []).forEach((m) => { if (!test.results[m]) warnings.push(`${tag}/${k}: match 대상 없음 ${m}`); });
  }
  if (!test.faq || test.faq.length < 3) warnings.push(`${tag}: FAQ 3개 미만`);
  if (!test.intro || test.intro.length < 2) warnings.push(`${tag}: intro 문단 부족`);
}

/* ---------- 허브 ---------- */
async function genHub(tests) {
  const title = `유형 테스트 모음 ${tests.length}종 | ${SITE_NAME} 무료 성향 테스트`;
  const desc = `MBTI 간단 테스트, 직장인 유형, 여행 스타일, 소비 성향 등 무료 유형 테스트 ${tests.length}종. 가입 없이 바로 하고 결과 카드까지 저장하세요.`;
  const cards = tests.map((t) => `<a class="tcard" href="tests/${t.id}/">
<span class="emo">${t.emoji}</span>
<h2>${esc(t.title)}</h2>
<p>${esc(t.description)}</p>
<span class="meta"><span>${t.questions.length}문항</span><span>결과 ${Object.keys(t.results).length}종</span><span>약 ${t.minutes}분</span></span>
</a>`).join('\n');

  const faq = [
    { q: '테스트 결과가 정확한 심리검사인가요?', a: '아니요. TypeLab의 모든 테스트는 자체 제작 문항으로 만든 오락용 콘텐츠입니다. 공인 심리검사나 진단 도구가 아니며, 결과는 재미로만 봐 주세요.' },
    { q: '회원가입이나 개인정보 입력이 필요한가요?', a: '전혀 필요하지 않습니다. 이름·전화번호·이메일 등 어떤 개인정보도 수집하지 않으며, 답변은 서버로 전송되지 않고 브라우저 안에서만 계산됩니다.' },
    { q: '결과를 친구에게 공유할 수 있나요?', a: '네. 결과 페이지마다 고유 주소가 있어 링크를 복사해 보낼 수 있고, 결과 카드를 PNG 이미지로 저장해 SNS나 메신저에 올릴 수도 있습니다.' },
    { q: '테스트는 계속 추가되나요?', a: `현재 ${tests.length}종이 공개되어 있으며, 갈등 대처 유형·반려동물 궁합·리더십 유형 등을 순차적으로 추가할 예정입니다.` }
  ];

  const body = `<div class="wrap">
<section class="hero">
<span class="badge">가입 없이 무료 · 결과 카드 저장</span>
<h1>유형 테스트 모음 ${tests.length}종</h1>
<p>MBTI 간단 테스트부터 직장인·여행·소비 성향까지. 문항과 결과를 직접 만든 오락용 유형 테스트 허브입니다.</p>
</section>
${funNotice()}
<div class="grid">
${cards}
</div>
<!-- ad-slot -->
<section class="section">
<h2>TypeLab은 어떤 사이트인가요?</h2>
<p>TypeLab은 성향 테스트를 좋아하는 사람들을 위해 만든 작은 실험실입니다. 시중의 유료 검사 문항을 가져오지 않고, 모든 질문과 결과 텍스트를 직접 작성했습니다. 그래서 결과가 학문적으로 검증된 것은 아니지만, 대신 한국에서 실제로 겪는 상황(월급날, 시험 기간, 회사 워크숍, 카페 주문대 앞)을 소재로 삼아 읽는 재미를 살렸습니다.</p>
<p>모든 테스트는 10~24문항으로 3~5분 안에 끝나고, 결과는 축 조합에 따라 고유한 페이지로 연결됩니다. 결과 페이지에는 유형 설명, 생활 팁, 잘 맞는 유형이 함께 담겨 있어 친구와 비교하며 이야기하기에 좋습니다. 로그인도, 광고 팝업도, 개인정보 입력도 없습니다.</p>
<h2>이용 방법</h2>
<ol class="steps">
<li>위 카드에서 마음에 드는 테스트를 고릅니다.</li>
<li>시작 페이지에서 문항 수와 소요 시간을 확인하고 '테스트 시작하기'를 누릅니다.</li>
<li>질문에 답하면 결과 페이지로 자동 이동합니다.</li>
<li>결과 카드를 PNG로 저장하거나 링크를 복사해 친구에게 공유합니다.</li>
</ol>
</section>
${faqBlock(faq)}
</div>`;

  await emit('index.html', page({
    title, desc, root: '', ld: [appLd(SITE_NAME + ' 유형 테스트', desc), faqLd(faq),
      crumbLd([{ name: '홈', url: '/' }])],
    body, tests, currentId: null
  }));
}

/* ---------- 테스트 시작 페이지 ---------- */
async function genStart(test, tests) {
  const rk = Object.keys(test.results);
  const title = `${test.title} - ${test.questions.length}문항 무료 유형 테스트 | ${SITE_NAME}`;
  const desc = test.description;
  const root = '../../';
  const preview = rk.map((k) => `<a href="result/${k}/">${esc(test.results[k].title)}</a>`).join('\n');

  const body = `<div class="wrap">
<section class="test-hero">
<div class="emo">${test.emoji}</div>
<h1>${esc(test.title)}</h1>
<p class="desc">${esc(test.description)}</p>
<div class="meta-chips">
<span class="chip">${test.questions.length}문항</span>
<span class="chip">약 ${test.minutes}분</span>
<span class="chip">결과 ${rk.length}종</span>
<span class="chip">가입 없이 무료</span>
</div>
<div class="start-cta"><a class="btn btn-primary" href="q/">테스트 시작하기</a></div>
</section>
${funNotice(test.adultNote)}
<!-- ad-slot -->
<section class="section">
<h2>${esc(test.title)} 소개</h2>
${test.intro.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<h2>이렇게 진행됩니다</h2>
<ol class="steps">${test.howto.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<h2>결과 유형 미리 보기</h2>
<p>이 테스트에서 나올 수 있는 결과는 다음 ${rk.length}가지입니다. 결과 페이지에는 유형별 상세 설명과 생활 팁, 잘 맞는 유형이 담겨 있습니다.</p>
<div class="rlist">${preview}</div>
</section>
${faqBlock(test.faq)}
<div class="start-cta" style="margin:26px auto"><a class="btn btn-primary" href="q/">${esc(test.title)} 시작하기</a></div>
</div>`;

  await emit(`tests/${test.id}/index.html`, page({
    title, desc, root, ld: [appLd(test.title, desc), faqLd(test.faq),
      crumbLd([{ name: '홈', url: '/' }, { name: test.title, url: `/tests/${test.id}/` }])],
    body, tests, currentId: test.id
  }));
}

/* ---------- 진행 페이지 ---------- */
async function genQuiz(test, tests) {
  const title = `${esc(test.title)} 진행 중 (${test.questions.length}문항) | ${SITE_NAME}`;
  const desc = `${test.title}의 ${test.questions.length}개 질문에 답하고 내 유형을 확인하세요. 가입 없이 무료, 결과는 바로 확인됩니다.`;
  const root = '../../../';

  const body = `<div class="wrap">
<div id="quiz"><div class="q-loading"><div class="spin"></div><div>테스트를 불러오는 중...</div></div></div>
<noscript><p class="notice">이 테스트는 자바스크립트로 동작합니다. 브라우저의 자바스크립트를 켜고 다시 시도해 주세요.</p></noscript>
<p style="text-align:center;margin:20px 0"><a href="../">← ${esc(test.title)} 소개로 돌아가기</a></p>
${funNotice(test.adultNote)}
</div>
<script type="module">
import test from '${root}assets/data/tests/${test.id}.js';
import { runQuiz } from '${root}assets/quiz.js';
runQuiz(test, document.getElementById('quiz'));
</script>`;

  await emit(`tests/${test.id}/q/index.html`, page({
    title, desc, root, ld: [crumbLd([
      { name: '홈', url: '/' },
      { name: test.title, url: `/tests/${test.id}/` },
      { name: '테스트 진행', url: `/tests/${test.id}/q/` }
    ])],
    body, tests, currentId: test.id
  }));
}

/* ---------- 결과 페이지 ---------- */
async function genResult(test, key, tests) {
  const r = test.results[key];
  const root = '../../../../';
  const title = `${esc(r.title)} - ${esc(test.title)} 결과 | ${SITE_NAME}`;
  const desc = `${test.title} 결과: ${r.title}. ${r.summary}`.slice(0, 155);

  const paras = r.detail.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('\n');
  const matches = (r.match || []).filter((m) => test.results[m])
    .map((m) => `<a href="../${m}/">${esc(test.results[m].title)}</a>`).join('');

  /* 다른 테스트 추천 3개 */
  const idx = tests.findIndex((t) => t.id === test.id);
  const recs = [1, 2, 3].map((n) => tests[(idx + n) % tests.length]);
  const recCards = recs.map((t) => `<a class="tcard" href="${root}tests/${t.id}/">
<span class="emo">${t.emoji}</span><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p>
<span class="meta"><span>${t.questions.length}문항</span><span>약 ${t.minutes}분</span></span></a>`).join('\n');

  const faq = [
    { q: `'${r.title}' 결과는 어떻게 나온 건가요?`, a: `${test.title}의 ${test.questions.length}개 문항에서 고른 답을 ${test.axes.map((a) => a.left.name + '/' + a.right.name).join(', ')} 축으로 합산해, 각 축에서 점수가 높은 쪽을 조합한 결과입니다. 자체 제작 채점 방식이며 공인 검사와는 무관합니다.` },
    { q: '결과가 마음에 들지 않으면 다시 할 수 있나요?', a: '네. 아래 다시 하기 버튼으로 언제든 재응답할 수 있습니다. 문항 수가 적은 간단 테스트라 경계에 있는 성향은 결과가 바뀔 수 있습니다.' },
    { q: '이 결과를 친구에게 어떻게 공유하나요?', a: '결과 카드를 PNG 이미지로 저장해 SNS나 메신저에 올리거나, 링크 복사 버튼으로 이 페이지 주소를 그대로 보낼 수 있습니다. 공유해도 답변 내용은 전달되지 않습니다.' },
    { q: '결과를 실제 판단 근거로 써도 되나요?', a: '안 됩니다. 오락용 콘텐츠이므로 진로·채용·건강·관계에 관한 결정의 근거로 사용하지 마세요.' }
  ];

  const body = `<div class="wrap">
<section class="r-hero">
<div class="test-name">${esc(test.title)}</div>
<div class="emo">${test.emoji}</div>
<h1>${esc(r.title)}</h1>
<p class="summary">${esc(r.summary)}</p>
</section>

<div class="card card-canvas-box">
<canvas id="card-canvas" aria-label="결과 카드 이미지"></canvas>
<div class="btn-row">
<button class="btn" id="btn-save" type="button">이미지 저장</button>
<button class="btn" id="btn-link" type="button">링크 복사</button>
<button class="btn" id="btn-text" type="button">공유 문구 복사</button>
<button class="btn" id="btn-share" type="button">공유하기</button>
<a class="btn" id="btn-x" href="https://twitter.com/intent/tweet" target="_blank" rel="noopener">X에 올리기</a>
</div>
</div>

<div class="start-cta">
<a class="btn btn-primary" href="${root}tests/${test.id}/q/">나도 해보기 · ${esc(test.title)}</a>
</div>
<!-- ad-slot -->
${funNotice(test.adultNote)}

<section class="section">
<h2>${esc(r.title)} 상세 설명</h2>
${paras}
<h2>이런 점을 기억해 보세요</h2>
<ul class="tips">${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
${matches ? `<h2>결이 잘 맞는 유형</h2>
<p>같은 테스트의 다른 결과 중, ${esc(r.title)}과 서로 보완이 잘 되는 유형입니다.</p>
<div class="match-row">${matches}</div>` : ''}
<h2>다른 결과도 궁금하다면</h2>
<p>${esc(test.title)}에는 ${Object.keys(test.results).length}가지 결과가 있습니다. 각 결과 페이지에서 유형별 설명을 모두 읽어 볼 수 있습니다.</p>
<div class="rlist">${Object.keys(test.results).map((k) => k === key
    ? `<a href="./" aria-current="page">${esc(test.results[k].title)} (현재)</a>`
    : `<a href="../${k}/">${esc(test.results[k].title)}</a>`).join('\n')}</div>
</section>

${faqBlock(faq)}

<section class="section">
<h2>이어서 해 볼 만한 테스트 3개</h2>
<div class="grid">${recCards}</div>
</section>

<div class="btn-row" style="margin:24px 0">
<a class="btn" href="${root}tests/${test.id}/q/">다시 테스트하기</a>
<a class="btn" href="${root}index.html">전체 테스트 보기</a>
</div>
</div>
<script type="module">
import { bindResultActions } from '${root}assets/common.js';
var host = location.host || 'typelab-kr.vercel.app';
bindResultActions({
  emoji: ${JSON.stringify(test.emoji)},
  testTitle: ${JSON.stringify(test.title)},
  resultTitle: ${JSON.stringify(r.title)},
  summary: ${JSON.stringify(r.summary)},
  color: ${JSON.stringify(test.color)},
  watermark: host + '/tests/${test.id}',
  url: location.href.split('#')[0]
});
</script>`;

  await emit(`tests/${test.id}/result/${key}/index.html`, page({
    title, desc, root, ld: [appLd(`${test.title} 결과 · ${r.title}`, desc), faqLd(faq),
      crumbLd([
        { name: '홈', url: '/' },
        { name: test.title, url: `/tests/${test.id}/` },
        { name: r.title, url: `/tests/${test.id}/result/${key}/` }
      ])],
    body, tests, currentId: test.id
  }));
}

/* ---------- 정책 페이지 ---------- */
async function genLegal(tests) {
  const pRoot = '';
  const privacyFaq = [
    { q: '테스트 답변이 서버에 저장되나요?', a: '저장되지 않습니다. 문항 응답은 브라우저 메모리에서만 계산되며 외부로 전송되지 않습니다.' },
    { q: 'localStorage에는 무엇이 저장되나요?', a: '테스트를 완료했을 때 마지막 결과 유형 키(예: enfp)만 저장됩니다. 언제든 브라우저 설정에서 삭제할 수 있습니다.' },
    { q: '쿠키나 광고 추적을 사용하나요?', a: '이 사이트는 자체적으로 추적 쿠키를 설정하지 않습니다. 향후 광고가 게재될 경우 해당 시점에 본 문서를 갱신합니다.' }
  ];
  const privacy = `<div class="wrap">
<section class="section">
<h1>개인정보처리방침</h1>
<p>${SITE_NAME}(이하 '사이트')은 이용자의 개인정보를 수집하지 않는 것을 원칙으로 운영되는 정적 웹사이트입니다. 아래 내용은 사이트가 데이터를 어떻게 다루는지 설명합니다.</p>
<h2>1. 수집하지 않는 정보</h2>
<p>사이트는 이름, 생년월일, 전화번호, 이메일, 주민등록번호 등 개인을 식별할 수 있는 어떠한 정보도 요구하거나 수집하지 않습니다. 회원가입 기능이 없으며 로그인도 제공하지 않습니다.</p>
<h2>2. 테스트 응답의 처리</h2>
<p>모든 유형 테스트의 문항 응답은 이용자의 브라우저 안에서만 계산됩니다. 응답 내용은 서버로 전송되지 않고, 페이지를 벗어나면 사라집니다.</p>
<h2>3. 브라우저 저장소(localStorage)</h2>
<p>테스트를 완료한 경우, 마지막으로 나온 결과 유형 키만 이용자의 브라우저 localStorage에 저장됩니다. 이 값은 사이트 재방문 시 참고 용도로만 쓰이며 외부로 전송되지 않습니다. 브라우저의 사이트 데이터 삭제 기능으로 언제든 지울 수 있습니다.</p>
<h2>4. 결과 카드 이미지</h2>
<p>결과 카드 PNG는 이용자의 기기 안에서 캔버스로 그려져 곧바로 저장됩니다. 이미지가 서버에 업로드되거나 보관되는 일은 없습니다.</p>
<h2>5. 외부 전송 및 제3자 제공</h2>
<p>사이트는 외부 API를 호출하지 않으며, 수집하는 개인정보가 없으므로 제3자에게 제공하는 정보도 없습니다.</p>
<h2>6. 문의</h2>
<p>본 방침에 관한 문의는 사이트 운영자에게 전달해 주세요. 방침이 변경되면 이 페이지에 갱신 내용을 게시합니다.</p>
</section>
${faqBlock(privacyFaq)}
</div>`;

  await emit('privacy.html', page({
    title: `개인정보처리방침 | ${SITE_NAME}`,
    desc: `${SITE_NAME}은 개인정보를 수집하지 않습니다. 테스트 응답 처리 방식과 브라우저 저장소 이용 범위를 안내합니다.`,
    root: pRoot, ld: [faqLd(privacyFaq), crumbLd([{ name: '홈', url: '/' }, { name: '개인정보처리방침', url: '/privacy.html' }])],
    body: privacy, tests, currentId: null
  }));

  const termsFaq = [
    { q: '테스트 결과를 상업적으로 인용해도 되나요?', a: '문항과 결과 텍스트의 저작권은 사이트 운영자에게 있습니다. 개인적인 공유는 자유롭게 하실 수 있으나, 무단 복제·재배포·상업적 이용은 허용되지 않습니다.' },
    { q: '결과를 근거로 어떤 결정을 내려도 되나요?', a: '안 됩니다. 모든 결과는 오락용이며, 채용·진로·건강·법률·재무 등 실제 판단의 근거로 사용해서는 안 됩니다.' },
    { q: '결과가 사실과 다르면 책임을 물을 수 있나요?', a: '사이트는 결과의 정확성을 보증하지 않으며, 이용으로 발생한 판단과 그 결과에 대해 책임을 지지 않습니다.' }
  ];
  const terms = `<div class="wrap">
<section class="section">
<h1>이용약관</h1>
<p>본 약관은 ${SITE_NAME}(이하 '사이트')이 제공하는 유형 테스트 콘텐츠의 이용 조건을 정합니다. 사이트를 이용하는 것으로 아래 내용에 동의한 것으로 봅니다.</p>
<h2>1. 서비스의 성격</h2>
<p>사이트가 제공하는 모든 테스트는 운영자가 직접 작성한 오락용 콘텐츠입니다. 공인된 심리검사, 적성검사, 의학적 진단, 법률·재무 자문이 아니며 그 어떤 전문적 판단도 대체하지 않습니다.</p>
<h2>2. 이용자의 책임</h2>
<p>이용자는 테스트 결과를 재미의 범위에서만 활용해야 합니다. 결과를 근거로 타인을 평가하거나 차별하는 행위, 결과를 사실인 것처럼 왜곡해 유포하는 행위는 금지됩니다.</p>
<h2>3. 저작권</h2>
<p>사이트의 문항, 결과 설명, 디자인, 코드에 대한 권리는 운영자에게 있습니다. 개인적 공유는 허용하되 무단 복제, 대량 스크래핑, 상업적 재배포는 금지합니다.</p>
<h2>4. 면책</h2>
<p>사이트는 결과의 정확성·완전성을 보증하지 않습니다. 콘텐츠 이용으로 발생한 직접·간접 손해에 대해 운영자는 책임을 지지 않습니다.</p>
<h2>5. 콘텐츠 변경</h2>
<p>테스트 문항과 결과는 품질 개선을 위해 사전 통지 없이 수정·추가·삭제될 수 있습니다.</p>
<h2>6. 연령 안내</h2>
<p>연애 관계를 다루는 테스트는 성인 이용자를 대상으로 합니다. 사이트의 모든 콘텐츠에는 외모 평가나 타인을 비하하는 표현을 포함하지 않습니다.</p>
</section>
${faqBlock(termsFaq)}
</div>`;

  await emit('terms.html', page({
    title: `이용약관 | ${SITE_NAME}`,
    desc: `${SITE_NAME} 유형 테스트 콘텐츠의 이용 조건, 저작권, 면책 사항을 안내합니다.`,
    root: pRoot, ld: [faqLd(termsFaq), crumbLd([{ name: '홈', url: '/' }, { name: '이용약관', url: '/terms.html' }])],
    body: terms, tests, currentId: null
  }));
}

/* ---------- robots / sitemap ---------- */
async function genSeo(tests) {
  await emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  const urls = ['/', '/privacy.html', '/terms.html'];
  for (const t of tests) {
    urls.push(`/tests/${t.id}/`);
    urls.push(`/tests/${t.id}/q/`);
    for (const k of Object.keys(t.results)) urls.push(`/tests/${t.id}/result/${k}/`);
  }
  const body = urls.map((u) => {
    const pri = u === '/' ? '1.0' : (u.includes('/result/') ? '0.7' : (u.includes('/q/') ? '0.3' : 0.8));
    return `  <url><loc>${SITE}${u}</loc><changefreq>monthly</changefreq><priority>${pri}</priority></url>`;
  }).join('\n');
  await emit('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  return urls.length;
}

/* ---------- 실행 ---------- */
const tests = await loadTests();
tests.forEach(validate);

/* 이전 산출물 정리 (고아 페이지 제거) */
if (existsSync(path.join(ROOT, 'tests'))) await rm(path.join(ROOT, 'tests'), { recursive: true });

await genHub(tests);
for (const t of tests) {
  await genStart(t, tests);
  await genQuiz(t, tests);
  for (const k of Object.keys(t.results)) await genResult(t, k, tests);
}
await genLegal(tests);
const urlCount = await genSeo(tests);

/* 산출물 가드 */
const bad = [];
for (const rel of written) {
  if (!rel.endsWith('.html')) continue;
  const txt = await import('node:fs/promises').then((fs) => fs.readFile(path.join(ROOT, rel), 'utf8'));
  if (/href="\/|src="\//.test(txt)) bad.push(`${rel}: 절대경로 사용`);
  if (/광고 영역|REPLACE_|lorem ipsum/i.test(txt)) bad.push(`${rel}: 금지 플레이스홀더`);
  if (/rel="canonical"/.test(txt)) bad.push(`${rel}: canonical 금지`);
}
warnings.push(...bad);

const htmlCount = written.filter((f) => f.endsWith('.html')).length;
console.log(`테스트 ${tests.length}종 / HTML ${htmlCount}개 / sitemap URL ${urlCount}개 생성`);
console.log(`  결과 페이지: ${tests.reduce((n, t) => n + Object.keys(t.results).length, 0)}개`);
if (warnings.length) {
  console.log(`\n경고 ${warnings.length}건:`);
  warnings.forEach((w) => console.log('  - ' + w));
  process.exitCode = 1;
} else {
  console.log('경고 0건 ✅');
}
