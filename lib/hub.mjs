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

// 카테고리별 한 줄 설명(칩 라벨 기준). 없으면 기본 문구.
const CAT_DESC = {
  "금융·세금": "연봉·대출·세금 실수령까지, 돈과 관련된 계산을 빠르게",
  "금융·부동산": "전세·청약·대출 한도 등 부동산·금융 판단을 돕는 계산기",
  "기본 계산기": "만나이·D-day·BMI·평수 변환 등 매일 쓰는 기본 계산 도구",
  "생활·계산기": "이사비용·경조사비·단위 변환 등 실생활 계산 모음",
  "건강·운동": "BMI·체지방·칼로리·운동 기록으로 챙기는 건강 관리",
  "교육·학습": "입시·자격증·어학·한자까지 공부를 돕는 도우미",
  "엔터·바이럴": "밸런스 게임·이상형 월드컵·팬덤까지 가볍게 즐기는 놀이",
  "운세·심리": "오늘의 운세·사주·타로·성격 테스트로 보는 나",
  "취업·생산성": "자소서·근무·업무 정리까지 일과 커리어를 돕는 도구",
  "연애·관계": "궁합·썸·결혼까지 관계를 재미있게 들여다보기",
  "반려·식물": "반려동물 나이·식물 물주기 등 돌봄에 필요한 계산과 알림",
  "뷰티·패션": "퍼스널컬러·피부 타입 등 나에게 맞는 스타일 찾기",
  "여행·문화": "여행 경비·짐싸기·일정까지 떠나기 전 준비",
  "기타": "여러 주제를 아우르는 다양한 생활 도구 모음",
};
// 라벨의 가운뎃점 주변 공백을 정규화("금융 · 세금" → "금융·세금")해 매칭
const catDesc = (label) => CAT_DESC[cleanLabel(label).replace(/\s*·\s*/g, "·")] || "일상에 유용한 무료 도구 모음";

export function renderHub({ site, adsense, verifyMeta, total, builtinCats, dailyByCat, coreSlugs = [] }) {
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

  // ── 주요 도구 픽: 핵심 도구를 카테고리 전반에서 고르게 뽑아 편중 방지 ──
  // (기존엔 금융 내장 6개만 뽑혀 바로 아래 금융 섹션과 중복됐다 → 카테고리별 라운드로빈으로 다양화)
  const coreSet = new Set(coreSlugs);
  const pickPool = counted.map((s) => s.items.filter((it) => coreSet.has(it.slug)));
  const picks = [];
  for (let round = 0, guard = 0; picks.length < 9 && guard < 300; guard++) {
    const bucket = pickPool[guard % pickPool.length];
    if (bucket && bucket.length) picks.push(bucket.shift());
    if (guard % pickPool.length === pickPool.length - 1) round++;
    if (!pickPool.some((p) => p.length)) break;
  }
  // 폴백: 핵심 slug가 전달되지 않았거나 부족하면 앞쪽 카테고리에서 채움
  if (picks.length < 6) {
    for (const s of counted) for (const it of s.items) {
      if (picks.length < 8 && !picks.includes(it)) picks.push(it);
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
    <section class="cat picks" data-cat data-id="featured" aria-label="주요 도구">
      <h2><span class="dot"></span>주요 도구 <span class="tag">가장 많이 찾는</span></h2>
      <p class="cat-desc">가장 수요가 많은 대표 도구를 카테고리별로 모았습니다. 아래에서 주제별 전체 목록을 볼 수 있습니다.</p>
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
      <h2><span class="dot"></span>${esc(cleanLabel(s.label))}${tag} <span class="c-n">${s.items.length}개</span></h2>
      <p class="cat-desc">${esc(catDesc(s.label))}</p>
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
      margin:0; background:var(--bg); color:var(--tx); overflow-x:hidden;
      font-family:"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;
      line-height:1.6; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
      transition:background .3s ease,color .3s ease;
    }
    img,svg,table{max-width:100%}
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
    .brand{display:flex; align-items:center; gap:9px; font-weight:800; letter-spacing:-.02em; font-size:15px; color:var(--tx); text-decoration:none}
    .brand .bm{font-size:19px; line-height:1; filter:saturate(1.1)}
    .topnav{display:flex; align-items:center; gap:4px}
    .topnav a{color:var(--tx2); font-size:13px; font-weight:600; text-decoration:none; padding:8px 10px; border-radius:9px; white-space:nowrap; transition:color .14s, background .14s}
    .topnav a:hover{color:var(--tx); background:var(--panel)}
    @media (max-width:520px){ .topnav a{padding:6px 7px; font-size:12px} .topnav a:last-of-type{display:none} }
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
    .hero{text-align:center; padding:34px 0 8px}
    .logo{font-size:46px; line-height:1; letter-spacing:6px}
    h1{
      font-size:clamp(30px,6vw,48px); font-weight:900; letter-spacing:-.035em;
      margin:16px 0 0; line-height:1.04;
      background:linear-gradient(98deg,var(--tx) 18%,var(--acc) 62%,var(--acc2));
      -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    }
    .sub{color:var(--tx2); margin:14px auto 0; max-width:600px; font-size:clamp(14.5px,2.4vw,16.5px);
      line-height:1.6; word-break:keep-all; overflow-wrap:anywhere; padding:0 6px}
    .br-m{display:none}

    /* ── 사이트 소개 ── */
    .site-intro{max-width:760px; margin:26px auto 6px; padding:22px 22px; border:1px solid var(--line); border-radius:16px; background:var(--panel)}
    .site-intro h2{font-size:clamp(17px,3vw,20px); font-weight:800; color:var(--tx); margin:0 0 14px}
    .site-intro p{color:var(--tx2); font-size:14.5px; line-height:1.75; margin:0 0 12px}
    .site-intro p:last-child{margin-bottom:0}
    .site-intro strong{color:var(--tx); font-weight:700}
    .intro-points{list-style:none; padding:0; margin:0 0 16px; display:grid; gap:9px}
    .intro-points li{position:relative; padding-left:24px; color:var(--tx2); font-size:14px; line-height:1.6}
    .intro-points li::before{content:"✓"; position:absolute; left:0; top:0; color:var(--acc); font-weight:900}
    .intro-points strong{color:var(--tx)}
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

    /* ── 인기 검색 힌트 ── */
    .hints{display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:7px; max-width:600px; margin:12px auto 0}
    .hints .hint-l{font-size:12px; color:var(--tx3); font-weight:700; margin-right:1px}
    .hint{cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--tx2);
      background:var(--panel); border:1px solid var(--line2); padding:6px 12px; border-radius:999px;
      transition:color .14s, border-color .14s, transform .14s}
    .hint:hover{color:var(--acc); border-color:var(--acc-ln); transform:translateY(-1px)}
    .hint:focus-visible{outline:2px solid var(--acc); outline-offset:2px}

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
    .cat h2 .tag{font-size:10.5px; font-weight:700; letter-spacing:.01em; color:var(--tx3);
      background:var(--panel2); border:1px solid var(--line2); padding:2px 8px; border-radius:999px}
    .picks h2 .tag{color:var(--warm); background:var(--warm-dim); border-color:var(--warm-ln)}
    .cat h2 .c-n{margin-left:auto; font-size:12px; font-weight:700; color:var(--tx3)}
    .cat-desc{margin:-8px 0 15px; color:var(--tx2); font-size:13px; line-height:1.55; max-width:640px}
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
      .hero{padding:22px 0 4px}
      h1{font-size:clamp(26px,8vw,34px)}
      .br-m{display:inline}
      .searchbar{margin-top:22px}
      .filters-sticky{margin:16px -14px 0; padding:10px 14px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="/"><span class="bm">🍅🥚🐈</span> TomatoEggCat</a>
      <nav class="topnav" aria-label="사이트 메뉴">
        <a href="/about.html">소개</a>
        <a href="/contact.html">문의</a>
        <a href="/privacy.html">개인정보처리방침</a>
        <button class="toggle" id="theme" type="button" aria-label="라이트/다크 테마 전환" title="테마 전환">
          <span class="ti ti-sun" aria-hidden="true">☀️</span>
          <span class="ti ti-moon" aria-hidden="true">🌙</span>
        </button>
      </nav>
    </header>

    <div class="hero">
      <h1>필요한 도구,<br>바로 여기서.</h1>
      <p class="sub">설치도 가입도 없이, 브라우저에서 바로 쓰는 무료 도구 ${total}종.</p>

      <div class="searchbar" id="sbar">
        <span class="ic" aria-hidden="true">🔍</span>
        <input class="search" id="q" type="search" inputmode="search"
          placeholder="도구 검색 (예: 연봉, 대출, 나이, 운세…)" autocomplete="off" aria-label="도구 검색" />
        <button class="clr" id="clr" type="button" aria-label="검색어 지우기">✕</button>
      </div>
      <div class="hints" aria-label="인기 검색어">
        <span class="hint-l">인기 검색</span>
        <button class="hint" type="button" data-q="연봉 실수령액">연봉 실수령액</button>
        <button class="hint" type="button" data-q="DSR">DSR</button>
        <button class="hint" type="button" data-q="만나이">만나이</button>
        <button class="hint" type="button" data-q="BMI">BMI</button>
        <button class="hint" type="button" data-q="오늘의 운세">오늘의 운세</button>
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
        <ul class="intro-points">
          <li><strong>설치·회원가입 없이 즉시</strong> — 링크만 열면 브라우저에서 바로 실행됩니다.</li>
          <li><strong>완전 무료 ${total}종</strong> — 금융·부동산·건강·교육·운세·연애·반려까지 폭넓게.</li>
          <li><strong>입력값은 내 브라우저에서만</strong> — 대부분의 계산기는 값을 서버로 보내지 않고 기기 안에서 계산합니다.</li>
        </ul>
        <p><strong>TomatoEggCat</strong>은 일상에서 자주 필요한 계산·변환·진단 도구를 한곳에 모은 한국어 웹 도구 모음입니다. 연봉 실수령액·DSR·전세대출 한도·양도소득세 같은 금융 계산기부터 만나이·평수 변환·BMI 같은 생활 계산기, 그리고 교육·운세·연애·반려동물 도구까지 갖췄습니다. 검색창에 키워드를 넣거나 카테고리를 고르면 원하는 도구로 바로 이동합니다.</p>
        <p>각 도구 페이지에는 사용 방법, 알아두면 좋은 배경지식, 자주 묻는 질문을 함께 정리해 처음 쓰는 분도 어렵지 않게 활용할 수 있습니다. 금융·세금·건강처럼 정확도가 중요한 결과는 참고용 추정치이며, 실제 적용 기준은 관계 기관이나 전문가를 통해 확인하시길 권장합니다. 문의는 <a href="/contact.html">문의 페이지</a>로, 광고·쿠키 처리 방식은 <a href="/privacy.html">개인정보처리방침</a>에서 확인할 수 있습니다.</p>
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

    // 인기 검색 힌트 → 검색창 채우고 필터 적용
    [].slice.call(document.querySelectorAll('.hint')).forEach(function(b){
      b.addEventListener('click', function(){
        q.value = b.getAttribute('data-q') || b.textContent;
        activeFilter = '*';
        [].slice.call(document.querySelectorAll('.chip')).forEach(function(x){ x.classList.toggle('is-on', x.getAttribute('data-filter')==='*'); });
        apply();
        var m = document.querySelector('main'); if(m) m.scrollIntoView({behavior:'smooth', block:'start'});
      });
    });

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
