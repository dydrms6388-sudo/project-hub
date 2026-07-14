// hub.mjs — TomatoEggCat 허브(index.html) 렌더러. 순수 함수 1개, 외부 import 없음.
//
// export function renderHub({ site, adsense, verifyMeta, total, builtinCats, dailyByCat })
//   site       : "https://tomatoeggcat.com"
//   adsense    : "ca-pub-5567719201265106"
//   verifyMeta : head에 그대로 주입할 site-verification 메타 문자열
//   total      : 전체 도구 수(숫자)
//   builtinCats: [{ title, tag, items:[{slug,emoji,name,desc,k}] }]   링크 href="/${slug}/"
//   dailyByCat : [{ cat, items:[{slug,emoji,name,desc,domain}] }]     링크 href="/${slug}/"
//
// 카드/카테고리/검색/그리드 전부 위 데이터로 렌더(하드코딩 목록 없음).
// 검색은 .tool 카드 textContent + data-k 필터(기존 방식 유지). 다크 기본 + 라이트 토글.

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 카테고리 헤더/필터칩에서 이모지·구분자 제거한 짧은 라벨
const cleanLabel = (s) =>
  String(s ?? "")
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

// 안정적인 슬러그(필터 data-속성/스크롤 타깃용)
const catId = (label, i) =>
  "c" + i + "-" + cleanLabel(label).replace(/[^0-9A-Za-z가-힣]+/g, "-").toLowerCase().replace(/^-|-$/g, "");

export function renderHub({ site, adsense, verifyMeta, total, builtinCats, dailyByCat }) {
  // ── 통합 섹션 목록(내장 먼저, 그다음 데일리) ──
  const sections = [];

  for (const c of builtinCats || []) {
    sections.push({
      label: c.title,
      tag: c.tag || "",
      featured: true,
      items: (c.items || []).map((b) => ({
        slug: b.slug,
        emoji: b.emoji || "🔧",
        name: b.name,
        desc: b.desc || b.name,
        k: b.k || `${b.name}`,
      })),
    });
  }

  // 데일리: 단일 항목뿐인 자잘한 카테고리가 너무 많으면 칩바가 길어진다.
  // 큰 카테고리는 그대로, 항목 1개짜리 꼬리 카테고리는 "기타"로 합쳐 칩/섹션을 정돈.
  const mapDailyItem = (d) => ({
    slug: d.slug,
    emoji: d.emoji || "🔧",
    name: d.name,
    desc: String(d.desc || d.name).replace(/\s+/g, " ").slice(0, 64),
    k: `${d.name} ${d.domain || ""}`.trim(),
  });
  const dailyMain = [];
  const etcItems = [];
  for (const c of dailyByCat || []) {
    const items = (c.items || []).map(mapDailyItem);
    if (items.length >= 2) dailyMain.push({ label: c.cat, items });
    else etcItems.push(...items);
  }
  // 큰 카테고리 먼저(건수 내림차순)
  dailyMain.sort((a, b) => b.items.length - a.items.length);
  for (const c of dailyMain) {
    sections.push({ label: c.label, tag: "", featured: false, items: c.items });
  }
  if (etcItems.length) {
    sections.push({ label: "기타", tag: "", featured: false, items: etcItems });
  }

  const counted = sections.filter((s) => s.items.length);

  // ── 필터 칩(전체 + 카테고리별) ──
  const chips = [
    `<button class="chip is-on" data-filter="*" type="button">전체 <span class="n">${total}</span></button>`,
  ];
  counted.forEach((s, i) => {
    const id = catId(s.label, i);
    s._id = id;
    chips.push(
      `<button class="chip" data-filter="${id}" type="button">${esc(
        cleanLabel(s.label)
      )} <span class="n">${s.items.length}</span></button>`
    );
  });

  // ── 추천(인기) 픽: 내장 featured 카테고리에서 상위 6개 ──
  const picks = [];
  for (const s of counted) {
    if (!s.featured) continue;
    for (const it of s.items) {
      if (picks.length < 6) picks.push(it);
    }
  }

  const card = (it, extra = "") =>
    `<a class="tool${extra}" href="/${it.slug}/" data-k="${esc(it.k)}">` +
    `<span class="te">${it.emoji}</span>` +
    `<span class="tb"><span class="tn">${esc(it.name)}</span>` +
    `<span class="td">${esc(it.desc)}</span></span>` +
    `<span class="go" aria-hidden="true">→</span></a>`;

  // ── 추천 섹션 ──
  const picksHtml = picks.length
    ? `
    <section class="cat picks" data-cat data-id="featured" aria-label="추천 도구">
      <h2><span class="dot"></span>추천 도구 <span class="tag">인기</span></h2>
      <div class="grid">
${picks.map((it) => "        " + card(it, " feat")).join("\n")}
      </div>
    </section>`
    : "";

  // ── 전체 카테고리 섹션 ──
  let body = "";
  counted.forEach((s) => {
    const cards = s.items.map((it) => "        " + card(it)).join("\n");
    const tag = s.tag
      ? ` <span class="tag">${esc(s.tag)}</span>`
      : s.featured
      ? ` <span class="tag">기본</span>`
      : "";
    body += `
    <section class="cat" data-cat data-id="${s._id}">
      <h2><span class="dot"></span>${esc(cleanLabel(s.label))}${tag} <span class="c-n">${s.items.length}</span></h2>
      <div class="grid">
${cards}
      </div>
    </section>\n`;
  });

  const title = `TomatoEggCat — 무료 계산기·생활 도구 ${total}종 모음`;
  const desc = `연봉 실수령액·DSR·세금·만나이·BMI부터 건강·교육·심리테스트·생활 도구까지 ${total}종. 설치도 가입도 없이 브라우저에서 바로 쓰는 무료 도구 모음.`;

  return `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#08090c" media="(prefers-color-scheme: dark)" />
  <meta name="theme-color" content="#f7f6f3" media="(prefers-color-scheme: light)" />
  ${verifyMeta}
  <meta name="google-adsense-account" content="${adsense}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}" crossorigin="anonymous"></script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${site}/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TomatoEggCat" />
  <meta property="og:title" content="TomatoEggCat — 무료 도구 ${total}종 모음" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${site}/" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="TomatoEggCat — 무료 도구 ${total}종 모음" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TomatoEggCat",
    url: site + "/",
    description: desc,
    potentialAction: {
      "@type": "SearchAction",
      target: site + "/?q={query}",
      "query-input": "required name=query",
    },
  }).replace(/</g, "\\u003c")}</script>
  <style>
    :root{
      --bg:#08090c; --bg2:#0c0e13; --panel:#101218; --panel2:#13161d;
      --line:#1d212b; --line2:#262b37;
      --tx:#e9ecf1; --tx2:#aab1bf; --tx3:#6b7280;
      --acc:#34e0a1; --acc2:#28c4e8; --acc-dim:#0c2b22; --acc-ln:#11503e;
      --warm:#ffb84d; --warm-dim:#2a2008; --warm-ln:#4f3d0f;
      --glow1:rgba(52,224,161,.16); --glow2:rgba(40,196,232,.13);
      --shadow:0 8px 30px rgba(0,0,0,.45);
      --r:18px; color-scheme:dark;
    }
    html[data-theme="light"]{
      --bg:#f7f6f3; --bg2:#fbfaf8; --panel:#ffffff; --panel2:#fbfbfa;
      --line:#e7e4dd; --line2:#dcd8cf;
      --tx:#171a20; --tx2:#566072; --tx3:#8a93a3;
      --acc:#0f9d6f; --acc2:#0a93b8; --acc-dim:#e3f6ee; --acc-ln:#bfe8d7;
      --warm:#c47a12; --warm-dim:#fbf1dc; --warm-ln:#ecdcb3;
      --glow1:rgba(15,157,111,.12); --glow2:rgba(10,147,184,.10);
      --shadow:0 8px 28px rgba(40,40,40,.10);
      color-scheme:light;
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0; background:var(--bg); color:var(--tx);
      font-family:"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
      line-height:1.6; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
      transition:background .3s ease,color .3s ease;
    }
    /* 배경 오로라 글로우 */
    body::before{
      content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
      background:
        radial-gradient(60% 42% at 18% 0%, var(--glow1), transparent 70%),
        radial-gradient(52% 40% at 92% 6%, var(--glow2), transparent 72%);
    }
    a{color:inherit}
    .wrap{max-width:1080px; margin:0 auto; padding:0 20px 80px}

    /* ── 상단 바 ── */
    .top{
      display:flex; align-items:center; justify-content:space-between;
      padding:18px 0 4px; gap:12px;
    }
    .brand{display:flex; align-items:center; gap:9px; font-weight:800; letter-spacing:-.02em; font-size:15px}
    .brand .bm{font-size:19px; line-height:1; filter:saturate(1.1)}
    .toggle{
      width:42px; height:42px; flex:0 0 auto; border-radius:12px; cursor:pointer;
      background:var(--panel); border:1px solid var(--line2); color:var(--tx2);
      display:flex; align-items:center; justify-content:center; font-size:17px;
      transition:border-color .15s, color .15s, transform .15s, background .15s;
    }
    .toggle:hover{color:var(--acc); border-color:var(--acc-ln); transform:translateY(-1px)}
    .toggle:focus-visible{outline:2px solid var(--acc); outline-offset:2px}
    .toggle .ti{display:none}
    html[data-theme="dark"] .toggle .ti-sun{display:block}
    html[data-theme="light"] .toggle .ti-moon{display:block}

    /* ── 히어로 ── */
    .hero{text-align:center; padding:42px 0 8px}
    .logo{font-size:46px; line-height:1; letter-spacing:6px}
    h1{
      font-size:clamp(30px,6vw,48px); font-weight:900; letter-spacing:-.035em;
      margin:16px 0 0; line-height:1.04;
      background:linear-gradient(98deg,var(--tx) 18%,var(--acc) 62%,var(--acc2));
      -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    }
    .sub{color:var(--tx2); margin:16px auto 0; max-width:560px; font-size:clamp(14px,2.4vw,16px)}

    /* ── 사이트 소개 ── */
    .site-intro{max-width:760px; margin:40px auto 8px; padding:24px 22px; border:1px solid var(--line); border-radius:16px; background:var(--panel)}
    .site-intro h2{font-size:clamp(17px,3vw,20px); font-weight:800; color:var(--tx); margin:0 0 14px}
    .site-intro p{color:var(--tx2); font-size:14.5px; line-height:1.75; margin:0 0 12px}
    .site-intro p:last-child{margin-bottom:0}
    .site-intro strong{color:var(--tx); font-weight:700}
    .count{
      display:inline-flex; align-items:center; gap:7px; margin-top:18px;
      font-size:12.5px; font-weight:700; color:var(--acc);
      background:var(--acc-dim); border:1px solid var(--acc-ln);
      padding:6px 14px; border-radius:999px;
    }
    .count .pulse{width:7px; height:7px; border-radius:50%; background:var(--acc); box-shadow:0 0 0 0 var(--acc); animation:pulse 2.2s infinite}
    @keyframes pulse{0%{box-shadow:0 0 0 0 var(--glow1)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}}

    /* ── 검색 ── */
    .searchbar{position:relative; max-width:540px; margin:30px auto 0}
    .searchbar .ic{position:absolute; left:18px; top:50%; transform:translateY(-50%); font-size:17px; opacity:.7; pointer-events:none}
    .search{
      width:100%; background:var(--panel); border:1px solid var(--line2); border-radius:16px;
      color:var(--tx); padding:16px 48px 16px 48px; font-size:15.5px; font-family:inherit;
      box-shadow:var(--shadow); transition:border-color .15s, box-shadow .15s;
    }
    .search::placeholder{color:var(--tx3)}
    .search:focus{outline:none; border-color:var(--acc); box-shadow:0 0 0 4px var(--acc-dim)}
    .clr{position:absolute; right:12px; top:50%; transform:translateY(-50%); display:none;
      width:28px; height:28px; border:none; border-radius:8px; cursor:pointer;
      background:var(--line2); color:var(--tx2); font-size:14px; line-height:1}
    .clr:hover{color:var(--tx)}
    .searchbar.has-val .clr{display:block}

    /* ── 카테고리 필터칩(스티키) ── */
    .filters-sticky{position:sticky; top:0; z-index:20; margin:18px -20px 0; padding:10px 20px;
      background:linear-gradient(var(--bg) 78%,transparent); backdrop-filter:blur(6px)}
    .filters{display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; padding-bottom:2px}
    .filters::-webkit-scrollbar{display:none}
    .chip{
      flex:0 0 auto; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600;
      color:var(--tx2); background:var(--panel); border:1px solid var(--line2);
      padding:8px 14px; border-radius:999px; white-space:nowrap;
      transition:color .14s, border-color .14s, background .14s, transform .14s;
    }
    .chip .n{font-size:11px; color:var(--tx3); margin-left:3px; font-weight:700}
    .chip:hover{color:var(--tx); border-color:var(--acc-ln); transform:translateY(-1px)}
    .chip.is-on{color:#04130d; background:linear-gradient(120deg,var(--acc),var(--acc2)); border-color:transparent}
    .chip.is-on .n{color:rgba(4,19,13,.65)}
    html[data-theme="light"] .chip.is-on{color:#fff}
    html[data-theme="light"] .chip.is-on .n{color:rgba(255,255,255,.8)}

    /* ── 카테고리 섹션 ── */
    .cat{margin-top:34px; scroll-margin-top:70px}
    .cat h2{
      display:flex; align-items:center; gap:9px; font-size:15px; font-weight:800;
      letter-spacing:-.01em; color:var(--tx); margin:0 0 15px;
    }
    .cat h2 .dot{width:8px; height:8px; border-radius:3px; background:linear-gradient(135deg,var(--acc),var(--acc2)); flex:0 0 auto}
    .cat h2 .tag{font-size:10.5px; font-weight:800; letter-spacing:.02em; color:var(--warm);
      background:var(--warm-dim); border:1px solid var(--warm-ln); padding:2px 8px; border-radius:999px}
    .cat h2 .c-n{margin-left:auto; font-size:12px; font-weight:700; color:var(--tx3)}
    .picks h2 .dot{background:linear-gradient(135deg,var(--warm),var(--acc))}

    .grid{display:grid; grid-template-columns:repeat(3,1fr); gap:13px}

    /* ── 카드 ── */
    .tool{
      position:relative; display:flex; align-items:flex-start; gap:13px;
      text-decoration:none; border:1px solid var(--line); background:var(--panel);
      border-radius:var(--r); padding:16px 16px 15px; overflow:hidden;
      transition:transform .16s ease, border-color .16s, background .16s, box-shadow .16s;
    }
    .tool::after{content:""; position:absolute; inset:0; border-radius:var(--r); padding:1px;
      background:linear-gradient(130deg,var(--acc),var(--acc2)); opacity:0;
      -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
      -webkit-mask-composite:xor; mask-composite:exclude; transition:opacity .16s}
    .tool:hover{transform:translateY(-3px); background:var(--panel2); box-shadow:var(--shadow); border-color:transparent}
    .tool:hover::after{opacity:1}
    .tool:focus-visible{outline:2px solid var(--acc); outline-offset:2px}
    .tool .te{font-size:26px; line-height:1; flex:0 0 auto; margin-top:1px;
      filter:drop-shadow(0 2px 6px rgba(0,0,0,.25))}
    .tool .tb{min-width:0; flex:1}
    .tool .tn{display:block; font-weight:700; color:var(--tx); font-size:15px; letter-spacing:-.01em;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .tool .td{display:block; color:var(--tx2); font-size:12.5px; margin-top:4px; line-height:1.5;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}
    .tool .go{position:absolute; right:14px; bottom:13px; color:var(--acc); font-size:15px;
      opacity:0; transform:translateX(-4px); transition:opacity .16s, transform .16s}
    .tool:hover .go{opacity:1; transform:translateX(0)}
    .tool.feat{background:linear-gradient(160deg,var(--panel2),var(--panel))}

    /* ── 진입 애니메이션 ── */
    @media (prefers-reduced-motion:no-preference){
      .cat{animation:rise .5s cubic-bezier(.22,.61,.36,1) both}
      .cat:nth-of-type(2){animation-delay:.05s}
      .cat:nth-of-type(3){animation-delay:.1s}
      .cat:nth-of-type(4){animation-delay:.14s}
      @keyframes rise{from{opacity:0; transform:translateY(14px)}to{opacity:1; transform:none}}
    }

    /* ── 광고/쿠팡/푸터 ── */
    .ad{margin:40px 0 0; min-height:90px; display:flex; align-items:center; justify-content:center;
      border:1px dashed var(--line2); border-radius:14px; color:var(--tx3); font-size:12px}
    .empty{display:none; text-align:center; color:var(--tx2); padding:48px 16px; font-size:14px}
    .empty.show{display:block}
    .empty .eb{font-size:34px; display:block; margin-bottom:10px; opacity:.7}
    footer{margin-top:52px; text-align:center; color:var(--tx3); font-size:12.5px;
      border-top:1px solid var(--line); padding-top:26px}
    footer .fb{font-weight:700; color:var(--tx2); margin:0 0 9px}
    footer a{color:var(--acc2); margin:0 8px; text-decoration:none}
    footer a:hover{text-decoration:underline}

    @media (max-width:860px){ .grid{grid-template-columns:repeat(2,1fr)} }
    @media (max-width:520px){
      .wrap{padding:0 14px 64px}
      .grid{grid-template-columns:1fr}
      .hero{padding:30px 0 6px}
      .filters-sticky{margin:16px -14px 0; padding:10px 14px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="brand"><span class="bm">🍅🥚🐈</span> TomatoEggCat</div>
      <button class="toggle" id="theme" type="button" aria-label="라이트/다크 테마 전환" title="테마 전환">
        <span class="ti ti-sun" aria-hidden="true">☀️</span>
        <span class="ti ti-moon" aria-hidden="true">🌙</span>
      </button>
    </header>

    <div class="hero">
      <div class="logo">🍅🥚🐈</div>
      <h1>필요한 도구,<br>바로 여기서.</h1>
      <p class="sub">연봉·대출·세금부터 건강·교육·심리테스트·생활 도구까지 — 설치도 가입도 없이 브라우저에서 즉시.</p>
      <div class="count"><span class="pulse"></span>무료 도구 ${total}종 · 매일 추가 중</div>

      <div class="searchbar" id="sbar">
        <span class="ic" aria-hidden="true">🔍</span>
        <input class="search" id="q" type="search" inputmode="search"
          placeholder="도구 검색 (예: 연봉, 대출, 나이, 운세…)" autocomplete="off" aria-label="도구 검색" />
        <button class="clr" id="clr" type="button" aria-label="검색어 지우기">✕</button>
      </div>
    </div>

    <nav class="filters-sticky" aria-label="카테고리 필터">
      <div class="filters" id="filters">
        ${chips.join("\n        ")}
      </div>
    </nav>

    <main>
${picksHtml}
${body}
      <p class="empty" id="empty"><span class="eb">🔎</span>검색 결과가 없어요. 다른 키워드로 찾아보세요.</p>

      <div class="ad">광고 영역</div>
      <div class="coupang-slot" data-subid="home" style="margin:28px 0 0"></div>

      <section class="site-intro" aria-label="사이트 소개">
        <h2>TomatoEggCat은 어떤 사이트인가요?</h2>
        <p><strong>TomatoEggCat</strong>은 일상에서 자주 필요한 계산·변환·진단 도구를 한곳에 모은 한국어 웹 도구 모음입니다. 연봉 실수령액·DSR·전세대출 한도·양도소득세 같은 금융 계산기부터 만나이·평수 변환·BMI 같은 생활 계산기, 건강·운동, 교육·학습, 운세·심리, 연애·관계, 반려동물까지 폭넓은 주제의 도구를 제공합니다. 필요한 도구를 위 검색창에서 이름이나 키워드(예: 연봉, 대출, 나이, 운세)로 바로 찾을 수 있습니다.</p>
        <p>모든 도구는 <strong>회원가입과 설치 없이</strong> 웹 브라우저에서 즉시 실행되며 완전 무료로 이용할 수 있습니다. 대부분의 계산기는 입력한 값을 브라우저 안에서 바로 처리해 결과를 보여 주므로, 복잡한 절차 없이 필요한 순간에 빠르게 답을 얻을 수 있도록 설계했습니다. 각 도구 페이지에는 사용 방법, 알아두면 좋은 배경지식, 자주 묻는 질문을 함께 정리해 처음 쓰는 분도 어렵지 않게 활용할 수 있습니다.</p>
        <p>금융·세금·건강처럼 정확도가 중요한 주제의 계산 결과는 일반적인 기준에 따른 <strong>참고용 추정치</strong>이며, 실제 적용 기준은 관계 기관이나 전문가를 통해 확인하시기를 권장합니다. 서비스와 콘텐츠는 꾸준히 추가·개선되고 있으며, 문의 사항은 <a href="/contact.html">문의 페이지</a>를 통해 보내 주실 수 있습니다.</p>
      </section>
    </main>

    <footer>
      <p class="fb">🍅🥚🐈 TomatoEggCat — 일상에 유용한 무료 도구 모음</p>
      <p style="margin:0">
        <a href="/about.html">소개</a>·
        <a href="/privacy.html">개인정보처리방침</a>·
        <a href="/terms.html">이용약관</a>·
        <a href="/contact.html">문의</a>
      </p>
    </footer>
  </div>

  <script>
  (function(){
    // ── 테마 토글(시스템 기본값 따름, 선택 시 localStorage 저장) ──
    var root = document.documentElement, KEY = 'tec-theme';
    try{
      var saved = localStorage.getItem(KEY);
      if(saved){ root.setAttribute('data-theme', saved); }
      else if(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches){ root.setAttribute('data-theme','light'); }
    }catch(e){}
    var tbtn = document.getElementById('theme');
    if(tbtn) tbtn.addEventListener('click', function(){
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try{ localStorage.setItem(KEY, next); }catch(e){}
    });

    // ── 검색 필터(.tool textContent + data-k) ──
    var q = document.getElementById('q');
    var sbar = document.getElementById('sbar');
    var clr = document.getElementById('clr');
    var tools = [].slice.call(document.querySelectorAll('.tool'));
    var cats  = [].slice.call(document.querySelectorAll('[data-cat]'));
    var empty = document.getElementById('empty');
    var chips = [].slice.call(document.querySelectorAll('.chip'));
    var activeFilter = '*';

    function apply(){
      var v = (q.value || '').trim().toLowerCase();
      sbar.classList.toggle('has-val', !!v);
      var any = false;
      tools.forEach(function(t){
        var hay = (t.textContent + ' ' + (t.getAttribute('data-k')||'')).toLowerCase();
        var show = !v || hay.indexOf(v) > -1;
        t.style.display = show ? '' : 'none';
        if(show) any = true;
      });
      cats.forEach(function(c){
        var id = c.getAttribute('data-id');
        // 검색 중이면 칩 필터 무시(전체 대상 검색). 비검색 시 칩 필터 적용.
        var passFilter = v ? true : (activeFilter === '*' || activeFilter === id);
        var visibleCards = c.querySelectorAll('.tool:not([style*="none"])').length;
        c.style.display = (passFilter && visibleCards) ? '' : 'none';
      });
      empty.classList.toggle('show', !any);
    }

    q.addEventListener('input', apply);
    if(clr) clr.addEventListener('click', function(){ q.value=''; apply(); q.focus(); });

    chips.forEach(function(ch){
      ch.addEventListener('click', function(){
        chips.forEach(function(x){ x.classList.remove('is-on'); });
        ch.classList.add('is-on');
        activeFilter = ch.getAttribute('data-filter');
        if(q.value){ q.value=''; sbar.classList.remove('has-val'); }
        apply();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // ?q= 딥링크 지원(검색 액션)
    try{
      var pq = new URLSearchParams(location.search).get('q');
      if(pq){ q.value = pq; apply(); }
    }catch(e){}
  })();
  </script>
  <script src="/coupang.js"></script>
</body>
</html>
`;
}
