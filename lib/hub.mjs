// hub.mjs — TomatoEggCat 허브(index.html) 렌더러.
import { iconFor } from "./icons.mjs";

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
  "필수 금융": "연봉 실수령부터 대출 한도·양도세까지, 돈 계산을 한 번에",
  "금융·부동산": "전세·청약·대출을 앞두고 한도와 조건을 미리 따져 봅니다",
  "기본 계산기": "만 나이·D-day·BMI·평수 변환 등 매일 찾는 기본 계산기",
  "생활 도구": "이사비용·경조사비·단위 변환처럼 자잘하지만 자주 쓰는 계산",
  "건강·운동": "BMI·체지방·칼로리·걸음 수를 기록하며 몸 상태를 관리",
  "교육·학습": "입시 등급컷·토익 플래너·자격증·한자까지 공부에 필요한 도우미",
  "엔터·바이럴": "밸런스 게임·이상형 월드컵·팬덤 투표로 가볍게 즐기는 놀이",
  "운세·심리": "오늘의 운세·사주·타로·성격 테스트로 나를 들여다보기",
  "취업·생산성": "자소서·교대근무·업무 정리까지 일과 커리어를 돕는 도구",
  "연애·관계": "궁합·썸·결혼 가능성까지 관계를 재미있게 풀어 봅니다",
  "반려·식물": "반려동물 나이 환산, 식물 물주기 알림 등 돌봄 도우미",
  "뷰티·패션": "퍼스널컬러·피부 타입 진단으로 나에게 맞는 스타일 찾기",
  "여행·문화": "여행 경비·짐싸기·일정 등 떠나기 전 준비를 한곳에서",
  "기타": "여러 주제를 아우르는 다양한 생활 도구 모음",
};
// 라벨의 가운뎃점 주변 공백을 정규화("금융 · 세금" → "금융·세금")해 매칭
const catDesc = (label) => CAT_DESC[cleanLabel(label).replace(/\s*·\s*/g, "·")] || "일상에 유용한 무료 도구 모음";

// 카테고리 강조색(섹션 점 + 아이콘 타일 틴트). 무지개 대신 절제된 2톤:
// 실용·계산 도구 = 브랜드 그린, 재미·라이프스타일 = 브랜드 웜(골드).
const WARM_CATS = new Set(["엔터·바이럴", "운세·심리", "연애·관계", "뷰티·패션"]);
const catColor = (label) => {
  const k = cleanLabel(label).replace(/\s*·\s*/g, "·");
  return WARM_CATS.has(k) ? "#f5b642" : "#34d399";
};

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
        icon: iconFor(c.title),
        name: b.name,
        desc: b.desc || b.name,
        k: b.k || `${b.name}`,
      })),
    });
  }

  // 데일리: 단일 항목뿐인 자잘한 카테고리가 너무 많으면 칩바가 길어진다.
  // 큰 카테고리는 그대로, 항목 1개짜리 꼬리 카테고리는 "기타"로 합쳐 칩/섹션을 정돈.
  const mapDailyItem = (d, cat) => ({
    slug: d.slug,
    emoji: d.emoji || "🔧",
    icon: iconFor(cat),
    name: d.name,
    desc: ((str) => { if (str.length <= 46) return str; const s = str.slice(0, 46).replace(/\s+\S*$/, ""); return s + "…"; })(String(d.desc || d.name).replace(/\s+/g, " ")),
    k: `${d.name} ${d.domain || ""}`.trim(),
  });
  const dailyMain = [];
  const etcItems = [];
  for (const c of dailyByCat || []) {
    const items = (c.items || []).map((it) => mapDailyItem(it, c.cat));
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

  // slug → 도구 항목 조회(상황별 추천 가이드에서 이름/이모지 확인용)
  const bySlug = new Map();
  for (const s of counted) for (const it of s.items) if (!bySlug.has(it.slug)) bySlug.set(it.slug, it);

  // ── 주요 도구 픽: 핵심 도구를 카테고리 전반에서 고르게 뽑아 편중 방지 ──
  const coreSet = new Set(coreSlugs);
  const pickPool = counted.map((s) => s.items.filter((it) => coreSet.has(it.slug)));
  const picks = [];
  for (let guard = 0; picks.length < 9 && guard < 300; guard++) {
    const bucket = pickPool[guard % pickPool.length];
    if (bucket && bucket.length) picks.push(bucket.shift());
    if (!pickPool.some((p) => p.length)) break;
  }
  // 폴백: 핵심 slug가 전달되지 않았거나 부족하면 앞쪽 카테고리에서 채움
  if (picks.length < 6) {
    for (const s of counted) for (const it of s.items) {
      if (picks.length < 8 && !picks.includes(it)) picks.push(it);
    }
  }
  const pickSlugs = new Set(picks.map((it) => it.slug)); // 카테고리 섹션에서 중복 제거용
  const PREVIEW = 6; // 카테고리당 미리보기 카드 수(초기 스크롤 길이 단축)

  // 각 카테고리의 표시 항목(주요 도구 중복 제거)을 미리 계산 → 칩 개수와 섹션 개수를 정합.
  counted.forEach((s, i) => { s._id = catId(s.label, i); s._shown = s.items.filter((it) => !pickSlugs.has(it.slug)); });
  const shownCats = counted.filter((s) => s._shown.length);

  // ── 필터 칩(전체 + 주요 도구 + 카테고리) : 합계가 total과 일치 ──
  const chips = [
    `<button class="chip is-on" data-filter="*" type="button">전체 <span class="n">${total}</span></button>`,
  ];
  if (picks.length) chips.push(
    `<button class="chip" data-filter="featured" type="button">주요 도구 <span class="n">${picks.length}</span></button>`
  );
  shownCats.forEach((s) => {
    chips.push(
      `<button class="chip" data-filter="${s._id}" type="button">${esc(cleanLabel(s.label))} <span class="n">${s._shown.length}</span></button>`
    );
  });

  const card = (it, extra = "") =>
    `<a class="tool${extra}" href="/${it.slug}/" data-k="${esc(it.k)}">` +
    `<span class="te">${it.icon || it.emoji}</span>` +
    `<span class="tb"><span class="tn">${esc(it.name)}</span>` +
    `<span class="td">${esc(it.desc)}</span></span>` +
    `<span class="go" aria-hidden="true">→</span></a>`;

  // ── 추천 섹션 ──
  const picksHtml = picks.length
    ? `
    <section class="cat picks" data-cat data-id="featured" aria-label="주요 도구" style="--cc:#f5b642">
      <h2><span class="dot"></span>주요 도구 <span class="tag">가장 많이 찾는</span></h2>
      <p class="cat-desc">사람들이 가장 많이 찾는 대표 도구입니다. 전체 목록은 아래 카테고리에서 확인하세요.</p>
      <div class="grid">
${picks.map((it) => "        " + card(it, " feat")).join("\n")}
      </div>
    </section>`
    : "";

  // ── 상황별 추천 가이드(에디토리얼): 목적별로 도구를 묶어 흐름을 제안 → 홈 자체의 독립 콘텐츠 가치 + 핵심 도구 간 내부 링크 ──
  const GUIDES = [
    { emoji: "💼", title: "이직·연봉 협상을 준비한다면", lead: "제안받은 연봉이 실제로 통장에 얼마 들어오는지부터, 내 소득의 위치와 대출 여력, 지원 서류까지 순서대로 점검하세요.", slugs: ["salary", "salary-rank", "dsr", "jasoseo-doctor"] },
    { emoji: "🏠", title: "내 집 마련·전월세를 알아본다면", lead: "청약 가점을 먼저 확인하고, 전세대출 한도와 이사 비용, 매도 시 양도세까지 미리 가늠하면 자금 계획이 또렷해집니다.", slugs: ["cheongyak-score-calc", "jeonse-loan", "moving-cost-calc", "yangdo"] },
    { emoji: "🏃", title: "건강 습관을 새로 시작한다면", lead: "BMI와 체지방으로 현재 상태를 파악하고, 목표 체중까지의 경로와 하루 걸음 목표로 실천 계획을 세워 보세요.", slugs: ["bmi", "body-fat-check", "weight-roadmap", "manbo-steps"] },
    { emoji: "📚", title: "시험·자기계발을 계획한다면", lead: "수능 등급컷과 토익 목표 플랜, 한자 급수, 교대 근무 일정까지 학습·일정 관리를 한 번에 정리할 수 있습니다.", slugs: ["suneung-gradecut", "toeic-planner", "hanja-grade-master", "shift-work-calendar"] },
    { emoji: "🎉", title: "가볍게 즐기고 싶다면", lead: "MBTI 궁합과 오늘의 운세, 퍼스널 컬러, 우리 연애 이야기까지 부담 없이 즐기는 재미 도구를 모았습니다.", slugs: ["mbti-match", "today-fortune", "personal-color-test", "love-story-board"] },
  ];
  const guideCards = GUIDES.map((g) => {
    const links = g.slugs.map((sl) => bySlug.get(sl)).filter(Boolean);
    if (links.length < 2) return "";
    const chipHtml = links.map((it) => `<a class="g-tool" href="/${it.slug}/"><span class="g-ic" aria-hidden="true">${it.icon || it.emoji}</span>${esc(it.name)}</a>`).join("\n          ");
    return `
      <article class="guide">
        <h3><span class="g-e" aria-hidden="true">${g.emoji}</span>${esc(g.title)}</h3>
        <p>${esc(g.lead)}</p>
        <div class="g-tools">
          ${chipHtml}
        </div>
      </article>`;
  }).filter(Boolean).join("\n");
  const guidesHtml = guideCards
    ? `
    <section class="guides" aria-label="상황별 추천 도구 모음">
      <h2>어떤 상황이신가요? 목적별 추천</h2>
      <p class="guides-sub">비슷한 목적의 도구를 묶어 정리했습니다. 하나씩 따라가면 준비가 한결 수월해집니다.</p>
      <div class="guide-grid">${guideCards}
      </div>
    </section>`
    : "";

  // ── 전체 카테고리 섹션 ── (주요 도구에 노출된 항목은 제외한 s._shown 사용)
  let body = "";
  shownCats.forEach((s) => {
    const items = s._shown;
    // 미리보기 PREVIEW개 + 나머지는 .xtra(기본 숨김, '더보기'로 펼침)
    const cards = items
      .map((it, i) => "        " + card(it, i >= PREVIEW ? " xtra" : ""))
      .join("\n");
    const hiddenN = Math.max(0, items.length - PREVIEW);
    const moreBtn = hiddenN
      ? `\n      <button class="more-btn" type="button" data-more>${hiddenN}개 더보기 <span aria-hidden="true">▾</span></button>`
      : "";
    const tag = s.tag
      ? ` <span class="tag">${esc(s.tag)}</span>`
      : s.featured
      ? ` <span class="tag">기본</span>`
      : "";
    body += `
    <section class="cat" data-cat data-id="${s._id}" style="--cc:${catColor(s.label)}">
      <h2><span class="dot"></span>${esc(cleanLabel(s.label))}${tag} <span class="c-n">${items.length}개</span></h2>
      <p class="cat-desc">${esc(catDesc(s.label))}</p>
      <div class="grid">
${cards}
      </div>${moreBtn}
    </section>\n`;
  });

  const title = `TomatoEggCat — 무료 계산기·생활 도구 ${total}종 모음`;
  const desc = `연봉 실수령액·DSR·세금·만나이·BMI부터 건강·교육·심리테스트·생활 도구까지 ${total}종. 설치도 가입도 없이 브라우저에서 바로 쓰는 무료 도구 모음.`;

  return `<!doctype html>
<!-- ⚠ 자동 생성 파일: gen-pages.mjs가 배포 때마다 재생성합니다. 직접 수정 금지 —
     허브 UI는 lib/hub.mjs 에서 고치세요. -->
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
  <meta property="og:image" content="${site}/og/default.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="TomatoEggCat — 무료 도구 ${total}종 모음" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${site}/og/default.png" />
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
      font-family:"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji";
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
    .menu-m{display:none; position:relative}
    .menu-m summary{list-style:none; cursor:pointer; width:34px; height:34px; border-radius:10px;
      border:1px solid var(--line2); color:var(--tx2); display:flex; align-items:center; justify-content:center; font-size:16px}
    .menu-m summary::-webkit-details-marker{display:none}
    .menu-m[open] summary{color:var(--acc); border-color:var(--acc-ln)}
    .menu-drop{position:absolute; right:0; top:calc(100% + 8px); z-index:40; min-width:170px;
      background:var(--panel); border:1px solid var(--line2); border-radius:12px; padding:6px; box-shadow:var(--shadow); display:flex; flex-direction:column}
    .menu-drop a{padding:10px 12px; border-radius:8px; color:var(--tx); font-size:13.5px; font-weight:600; text-decoration:none}
    .menu-drop a:hover{background:var(--panel2); color:var(--acc)}
    @media (max-width:520px){ .topnav > a{display:none} .menu-m{display:block} }
    .toggle{
      width:34px; height:34px; flex:0 0 auto; border-radius:10px; cursor:pointer;
      background:transparent; border:1px solid var(--line2); color:var(--tx2);
      display:flex; align-items:center; justify-content:center; font-size:15px;
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
    .nowrap{white-space:nowrap}

    /* ── 사이트 소개 ── */
    .guides{margin:38px 0 6px}
    .guides>h2{font-size:clamp(18px,3.4vw,22px); font-weight:800; color:var(--tx); margin:0 0 6px; text-align:center}
    .guides-sub{color:var(--tx2); font-size:14px; text-align:center; margin:0 auto 20px; max-width:560px}
    .guide-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px}
    .guide{border:1px solid var(--line); border-radius:15px; background:var(--panel); padding:18px 18px 16px}
    .guide h3{display:flex; align-items:center; gap:9px; font-size:16px; font-weight:800; color:var(--tx); margin:0 0 8px}
    .guide h3 .g-e{font-size:20px}
    .guide>p{color:var(--tx2); font-size:13.5px; line-height:1.7; margin:0 0 13px}
    .g-tools{display:flex; flex-wrap:wrap; gap:8px}
    .g-tool{display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--tx); text-decoration:none; padding:7px 12px; border-radius:999px; background:var(--panel2); border:1px solid var(--line); transition:border-color .14s, transform .14s}
    .g-tool span{font-size:15px}
    .g-tool .g-ic{display:inline-flex;color:var(--acc)}
    .g-tool .g-ic .ic{width:16px;height:16px}
    .g-tool:hover{border-color:var(--acc); transform:translateY(-1px)}
    .coupang-slot{min-height:184px}
    @media (max-width:640px){.coupang-slot{min-height:224px}}
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

    /* ── 신뢰 포인트(무설치·무료·프라이버시) ── */
    .trust{list-style:none; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px 16px; margin:18px 0 0; padding:0}
    .trust li{position:relative; padding-left:18px; color:var(--tx2); font-size:12.5px; font-weight:600}
    .trust li::before{content:"✓"; position:absolute; left:0; color:var(--acc); font-weight:900}

    /* ── 카테고리 필터칩(스티키) ── */
    .filters-sticky{position:sticky; top:0; z-index:20; margin:18px -20px 0; padding:10px 20px;
      background:linear-gradient(var(--bg) 78%,transparent); backdrop-filter:blur(6px)}
    .filters-wrap{position:relative}
    .filters{display:flex; flex-wrap:wrap; gap:8px; padding-bottom:2px}
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
    .cat{margin-top:34px; scroll-margin-top:70px; --cc:var(--acc)}
    .cat h2{
      display:flex; align-items:center; gap:9px; font-size:15px; font-weight:800;
      letter-spacing:-.01em; color:var(--tx); margin:0 0 15px;
    }
    .cat h2 .dot{width:9px; height:9px; border-radius:3px; background:var(--cc); flex:0 0 auto}
    .cat h2 .tag{font-size:10.5px; font-weight:700; letter-spacing:.01em; color:var(--tx3);
      background:var(--panel2); border:1px solid var(--line2); padding:2px 8px; border-radius:999px}
    .picks h2 .tag{color:var(--warm); background:var(--warm-dim); border-color:var(--warm-ln)}
    .cat h2 .c-n{margin-left:auto; font-size:11.5px; font-weight:700; color:var(--tx2);
      background:var(--panel2); border:1px solid var(--line2); padding:2px 9px; border-radius:999px}
    .cat-desc{margin:-8px 0 15px; color:var(--tx2); font-size:13px; line-height:1.55; max-width:640px; word-break:keep-all}

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
    .tool .te{width:46px; height:46px; flex:0 0 auto; border-radius:13px; font-size:23px; line-height:1;
      display:flex; align-items:center; justify-content:center; color:var(--cc);
      background:color-mix(in srgb, var(--cc) 13%, var(--panel2));
      border:1px solid color-mix(in srgb, var(--cc) 26%, var(--line))}
    .ic{width:24px; height:24px; display:block}
    .tool .te .ic{width:23px; height:23px}
    .tool .tb{min-width:0; flex:1}
    .tool .tn{display:block; font-weight:700; color:var(--tx); font-size:15px; letter-spacing:-.01em;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
    .tool .td{display:block; color:var(--tx2); font-size:12.5px; margin-top:4px; line-height:1.5;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}
    .tool .go{position:absolute; right:14px; bottom:13px; color:var(--acc); font-size:15px;
      opacity:0; transform:translateX(-4px); transition:opacity .16s, transform .16s}
    .tool:hover .go{opacity:1; transform:translateX(0)}
    .tool.feat{background:linear-gradient(160deg,var(--panel2),var(--panel))}
    .tool .td{min-height:2.6em}

    /* ── 카테고리 미리보기 접기/펼치기 ── */
    .tool.xtra{display:none}
    .cat.show-all .tool.xtra{display:flex}
    body.searching .tool.xtra{display:flex}
    .more-btn{margin:14px auto 0; display:block; cursor:pointer; font-family:inherit;
      font-size:13px; font-weight:700; color:var(--tx2); background:var(--panel);
      border:1px solid var(--line2); border-radius:999px; padding:9px 18px; transition:color .14s, border-color .14s, background .14s}
    .more-btn:hover{color:var(--acc); border-color:var(--acc-ln)}
    .more-btn:focus-visible{outline:2px solid var(--acc); outline-offset:2px}
    .cat.show-all .more-btn{display:none}
    body.searching .more-btn{display:none}

    /* ── 진입 애니메이션 ── */
    @media (prefers-reduced-motion:no-preference){
      .cat{animation:rise .5s cubic-bezier(.22,.61,.36,1) both}
      .cat:nth-of-type(2){animation-delay:.05s}
      .cat:nth-of-type(3){animation-delay:.1s}
      .cat:nth-of-type(4){animation-delay:.14s}
      @keyframes rise{from{opacity:0; transform:translateY(14px)}to{opacity:1; transform:none}}
    }

    /* ── 광고/쿠팡/푸터 ── */
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
      h1{font-size:clamp(24px,7.5vw,32px)}
      .br-m{display:inline}
      .searchbar{margin-top:22px}
      .trust{margin-top:14px; gap:6px 14px}
      .filters-sticky{margin:16px -14px 0; padding:10px 14px}
      /* 모바일에선 칩 가로 스크롤 + 우측 페이드 어포던스 */
      .filters{flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch}
      .filters::-webkit-scrollbar{display:none}
      .filters-wrap::after{content:""; position:absolute; top:0; right:0; width:34px; height:100%;
        background:linear-gradient(to right, transparent, var(--bg)); pointer-events:none}
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
        <a href="/terms.html">이용약관</a>
        <a href="/privacy.html">개인정보처리방침</a>
        <details class="menu-m">
          <summary aria-label="메뉴 열기">☰</summary>
          <div class="menu-drop">
            <a href="/about.html">소개</a>
            <a href="/contact.html">문의</a>
            <a href="/terms.html">이용약관</a>
            <a href="/privacy.html">개인정보처리방침</a>
          </div>
        </details>
        <button class="toggle" id="theme" type="button" aria-label="라이트/다크 테마 전환" title="테마 전환">
          <span class="ti ti-sun" aria-hidden="true">☀️</span>
          <span class="ti ti-moon" aria-hidden="true">🌙</span>
        </button>
      </nav>
    </header>

    <div class="hero">
      <h1>필요한 도구,<br>바로 여기서.</h1>
      <p class="sub">연봉·세금·나이·운세까지, 바로 꺼내 쓰는 <span class="nowrap">무료 생활 도구 ${total}종.</span></p>

      <div class="searchbar" id="sbar">
        <span class="ic" aria-hidden="true">🔍</span>
        <input class="search" id="q" type="search" inputmode="search"
          placeholder="도구 검색 (예: 연봉, 나이, 운세…)" autocomplete="off" aria-label="도구 검색" />
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
      <ul class="trust" aria-label="특징">
        <li>설치·회원가입 없음</li>
        <li>결제·구독 없이 무료</li>
        <li>입력값을 서버로 보내지 않음</li>
      </ul>
    </div>

    <nav class="filters-sticky" aria-label="카테고리 필터">
      <div class="filters-wrap">
        <div class="filters" id="filters">
          ${chips.join("\n          ")}
        </div>
      </div>
    </nav>

    <main>
${picksHtml}
${body}
      <p class="empty" id="empty"><span class="eb">🔎</span>검색 결과가 없어요. 다른 키워드로 찾아보세요.</p>

      <div class="coupang-slot" data-subid="home" style="margin:28px 0 0"></div>
${guidesHtml}
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
      document.body.classList.toggle('searching', !!v); // 검색 중엔 접힌 카드도 대상에 포함
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

    // 카테고리 '더보기' → 해당 섹션의 숨은 카드 펼치기
    [].slice.call(document.querySelectorAll('[data-more]')).forEach(function(b){
      b.addEventListener('click', function(){
        var sec = b.closest('.cat'); if(sec) sec.classList.add('show-all');
      });
    });

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
