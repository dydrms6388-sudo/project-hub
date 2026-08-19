#!/usr/bin/env node
/**
 * familyday-kr/gen.mjs — 정적 페이지 생성기 (Node, 의존성 0)
 *
 * 공통 HTML 셸 1개 + 페이지 설정 배열로 전 페이지를 생성한다.
 *   node gen.mjs
 * 산출물: index.html, 도구 11종, family-title 롱테일, holiday-dday 연도별 롱테일,
 *         가이드 2편, privacy/terms, robots.txt, sitemap.xml
 *
 * 규칙
 *  - 페이지 안의 모든 링크/자산은 상대 경로("/"로 시작 금지) → 하위 경로 배포와
 *    독립 도메인 루트 배포 양쪽에서 동작.
 *  - canonical/og:url/sitemap 은 아래 SITE_ORIGIN 하나로 관리.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TITLES, TITLE_MAP, KINSHIP_META } from "./data/kinship.mjs";
import { EVENTS, CLOSENESS, ENVELOPE, CONDOLENCE_META } from "./data/condolence.mjs";
import { CHARYE_META, PRINCIPLES, traditionalRows, simpleRows, SIMPLE_NOTES, REGIONAL } from "./data/charye.mjs";
import { SEOLLAL, CHUSEOK, HOLIDAY_META, holidayRange } from "./data/holidays.mjs";
import { CATEGORIES, TEMPLATES, MSG_META } from "./data/messages.mjs";
import { computeChon, chonText } from "./assets/js/kinship-core.mjs";
import { solarToLunar, lunarToSolar, dowOf, DOW_KR, KASI_URL } from "./assets/js/lunar-core.mjs";

const SITE_ORIGIN = "https://familyday-kr.vercel.app";
const SITE_NAME = "가족의 날";
const BUILD_DATE = "2026-08-19";
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const warnings = [];
const written = [];
const sitemapUrls = [];

/* ─────────────────────────── 유틸 ─────────────────────────── */
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const jsonld = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const won = (n) => Number(n).toLocaleString("ko-KR") + "원";
const manwon = (n) => (n % 10000 === 0 ? `${n / 10000}만 원` : Number(n).toLocaleString("ko-KR") + "원");

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  written.push(rel);
}
function prefixOf(out) {
  const depth = out.split("/").length - 1;
  return depth === 0 ? "./" : "../".repeat(depth);
}
function urlOf(out) {
  return SITE_ORIGIN + "/" + out.replace(/index\.html$/, "");
}

/* 외부 크로스링크 (절대 URL) */
const EXT = {
  chonsu: ["https://tomatoeggcat.com/dydrms-chonsu/", "촌수각 — 촌수·호칭 계산기"],
  ftf: ["https://tomatoeggcat.com/family-title-finder/", "가족 호칭 찾기"],
  gyeongjosa: ["https://tomatoeggcat.com/dydrms-gyeongjosa/", "경조사각 — 경조사 기록장"],
  giftmoney: ["https://tomatoeggcat.com/gift-money/", "축의금·부의금 도우미"],
  jeryegak: ["https://tomatoeggcat.com/dydrms-jeryegak/", "제례각 — 제사·차례 안내"],
  dday: ["https://tomatoeggcat.com/dday/", "D-day 계산기"],
};

const AD = `<div class="adbox">
<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-5567719201265106" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>`;

const DISCLAIM_REGION = `<div class="note warn">예절과 관행은 <b>지역·가문(집안)·세대마다 다릅니다.</b> 이 페이지의 안내는 널리 알려진 일반적인 기준을 정리한 것이며 “정답”이 아닙니다. 집안 어른께 여쭤보는 것이 가장 정확합니다.</div>`;

/* ─────────────────────── 공통 HTML 셸 ─────────────────────── */
/**
 * @param {object} p
 *  out, title, desc, h1, emoji, lead, type("app"|"article"|"page"),
 *  crumbs[{name,rel,abs}], introHtml, bodyHtml, howtoHtml, faq[{q,a}],
 *  related[{href,label,ext}], scripts[], extraHead, noAd
 */
function shell(p) {
  const pre = prefixOf(p.out);
  const url = urlOf(p.out);
  const crumbs = [{ name: "홈", rel: pre, abs: SITE_ORIGIN + "/" }].concat(p.crumbs || []);
  const crumbHtml = crumbs.map((c, i) =>
    i === crumbs.length - 1 && p.out !== "index.html"
      ? `<span>${esc(c.name)}</span>`
      : `<a href="${c.rel}">${esc(c.name)}</a>`
  ).join('<span class="sep">›</span>') +
    (p.out === "index.html" ? "" : `<span class="sep">›</span><span>${esc(p.h1)}</span>`);

  const graph = [];
  if (p.type === "article") {
    graph.push({
      "@type": "Article", headline: p.title.split(" | ")[0], description: p.desc,
      inLanguage: "ko", url, datePublished: BUILD_DATE, dateModified: BUILD_DATE,
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    });
  } else {
    graph.push({
      "@type": "SoftwareApplication", name: p.h1, description: p.desc,
      applicationCategory: "UtilitiesApplication", operatingSystem: "Web",
      inLanguage: "ko", isAccessibleForFree: true, url,
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      datePublished: BUILD_DATE, dateModified: BUILD_DATE,
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
    });
  }
  if (p.faq && p.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "") },
      })),
    });
  }
  const bcItems = crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.abs }));
  if (p.out !== "index.html") bcItems.push({ "@type": "ListItem", position: bcItems.length + 1, name: p.h1, item: url });
  graph.push({ "@type": "BreadcrumbList", itemListElement: bcItems });

  const faqHtml = (p.faq && p.faq.length)
    ? `<section><h2>자주 묻는 질문</h2>${p.faq.map((f) =>
      `<div class="qa"><p class="q">Q. ${esc(f.q)}</p><p class="a">${f.a}</p></div>`).join("")}</section>`
    : "";

  const relHtml = (p.related && p.related.length)
    ? `<section class="related"><h2>관련 도구 더 보기</h2><div class="rel-grid">${p.related.map((r) =>
      `<a class="rel" href="${r.href}"${r.ext ? ' rel="noopener"' : ""}><span>${r.ext ? "↗" : "→"}</span><span>${esc(r.label)}</span></a>`).join("")}</div></section>`
    : "";

  const scripts = (p.scripts || []).map((s) =>
    s.module ? `<script type="module" src="${pre}${s.src}"></script>` : `<script src="${pre}${s.src}"></script>`).join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta property="og:type" content="${p.type === "article" ? "article" : "website"}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.desc)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(p.title)}" />
<meta name="twitter:description" content="${esc(p.desc)}" />
<meta name="google-adsense-account" content="ca-pub-5567719201265106" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5567719201265106" crossorigin="anonymous"></script>
<link rel="stylesheet" href="${pre}assets/style.css" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E${encodeURIComponent(p.emoji || "🏮").replace(/%/g, "%25")}%3C/text%3E%3C/svg%3E" />
<script type="application/ld+json">${jsonld({ "@context": "https://schema.org", "@graph": graph })}</script>
${p.extraHead || ""}</head>
<body>
<button class="themebtn" id="themebtn" type="button">🌓 테마</button>
<div class="wrap">
<nav class="crumb" aria-label="위치">${crumbHtml}</nav>
<header class="hero">
<div class="emoji" aria-hidden="true">${p.emoji || "🏮"}</div>
<h1>${esc(p.h1)}</h1>
<p class="lead">${p.lead || esc(p.desc)}</p>
</header>
<main>
${p.introHtml || ""}
${p.bodyHtml || ""}
${p.noAd ? "" : AD}
${p.howtoHtml || ""}
${faqHtml}
</main>
${relHtml}
<footer>
<p>${SITE_NAME} — 명절·가족·경조사에서 헷갈리는 것들을 정리합니다.</p>
<p><a href="${pre}">홈</a><a href="${pre}privacy/">개인정보처리방침</a><a href="${pre}terms/">이용약관</a></p>
<p>모든 계산은 여러분의 브라우저 안에서만 이루어집니다. 입력한 내용은 서버로 전송되거나 저장되지 않습니다.</p>
</footer>
</div>
<script src="${pre}assets/js/common.js"></script>
${scripts}
</body>
</html>
`;
}

function emit(p) {
  const html = shell(p);
  write(p.out, html);
  sitemapUrls.push({ loc: urlOf(p.out), priority: p.priority || "0.7" });
  return html;
}

/* ───────────────── 촌수/호칭 롱테일 데이터 구성 ───────────────── */
const PHRASE = {
  f: "아버지", m: "어머니", h: "남편", w: "아내",
  ob: "형·오빠", yb: "남동생", os: "누나·언니", ys: "여동생",
  s: "아들", d: "딸",
};
const ROMAN = {
  f: "abeoji", m: "eomeoni", h: "nampyeon", w: "anae",
  ob: "hyeong", yb: "namdongsaeng", os: "nuna", ys: "yeodongsaeng",
  s: "adeul", d: "ttal",
};
const phraseOf = (p) => p.split(".").map((s) => PHRASE[s]).join("의 ");
const slugOf = (p) => p.split(".").map((s) => ROMAN[s]).join("-");

function lineageOf(p) {
  if (p.startsWith("w.")) return "처가(아내 쪽)";
  if (p.startsWith("h.")) return "시가(남편 쪽)";
  if (p === "w" || p === "h") return "배우자";
  if (p.startsWith("m.")) return "외가(어머니 쪽)";
  if (p.startsWith("f.")) return "친가(아버지 쪽)";
  if (/^(ob|yb|os|ys)/.test(p)) return "형제·자매 계열";
  if (/^(s|d)/.test(p)) return "직계 비속(자녀·손자녀)";
  return "직계 존속(부모·조부모)";
}
const GROUP_ORDER = [
  "직계 존속(부모·조부모)", "직계 비속(자녀·손자녀)", "형제·자매 계열",
  "친가(아버지 쪽)", "외가(어머니 쪽)", "배우자", "시가(남편 쪽)", "처가(아내 쪽)",
];

/** 표준 호칭이 정해진 조합(데이터) */
const BASE_COMBOS = [];
const seenPath = new Set();
for (const t of TITLES) {
  if (seenPath.has(t.path)) continue;
  seenPath.add(t.path);
  BASE_COMBOS.push({ path: t.path, name: t.name, call: t.call, callF: t.callF, hanja: t.hanja, note: t.note, derived: false });
}

/** 파생 조합: 표준 언어 예절에 단일 표제어가 없거나 조합형으로 부르는 관계 */
function derivedName(base, step) {
  const bp = base.path;
  const isCousin = /^[fm]\.(ob|yb|os|ys)\.(s|d)$/.test(bp);
  const isNephew = /^(ob|yb|os|ys)\.(s|d)$/.test(bp);
  const isWifeSib = /^w\.(ob|yb|os|ys)$/.test(bp);
  const isHusSib = /^h\.(ob|yb|os|ys)$/.test(bp);
  if (isCousin && step === "w") return { name: "사촌 형수·사촌 제수(사촌 형제의 아내)", call: "형수님·제수씨 등 나이에 따라", note: "사촌 형제의 아내를 부르는 별도 표제어는 없고, 친형제의 아내에 준해 부르는 것이 일반적입니다." };
  if (isCousin && step === "h") return { name: "사촌 매형·사촌 형부(사촌 자매의 남편)", call: "매형·형부·○서방 등 나이와 성별에 따라", note: "친자매의 남편을 부르는 방식에 준합니다." };
  if (isCousin && step === "s") return { name: "오촌 조카(당질)", call: "이름으로 부름", note: "사촌 형제자매의 아들. 나와는 5촌입니다." };
  if (isCousin && step === "d") return { name: "오촌 조카딸(당질녀)", call: "이름으로 부름", note: "사촌 형제자매의 딸. 나와는 5촌입니다." };
  if (isWifeSib) return { name: step === "s" ? "처조카" : "처조카딸", call: "이름으로 부름", note: "아내 형제자매의 자녀를 처조카라고 합니다." };
  if (isHusSib) return { name: step === "s" ? "시조카(조카)" : "시조카딸(조카딸)", call: "이름으로 부름", note: "남편 형제자매의 자녀로, 보통 그냥 조카라고 부릅니다." };
  if (isNephew && step === "w") return { name: "조카며느리(질부)", call: "아가·조카며느리·이름", note: "조카의 아내." };
  if (isNephew && step === "h") return { name: "조카사위(질서)", call: "○서방·조카사위", note: "조카딸의 남편." };
  return null;
}
const DERIVED_COMBOS = [];
for (const base of BASE_COMBOS) {
  const bp = base.path;
  const steps = [];
  if (/^[fm]\.(ob|yb|os|ys)\.s$/.test(bp)) steps.push("w", "s");
  else if (/^[fm]\.(ob|yb|os|ys)\.d$/.test(bp)) steps.push("h", "s");
  else if (/^[wh]\.(ob|yb|os|ys)$/.test(bp)) steps.push("s", "d");
  else if (/^(ob|yb|os|ys)\.s$/.test(bp)) steps.push("w");
  else if (/^(ob|yb|os|ys)\.d$/.test(bp)) steps.push("h");
  for (const st of steps) {
    const info = derivedName(base, st);
    if (!info) continue;
    const p2 = bp + "." + st;
    if (seenPath.has(p2)) continue;
    seenPath.add(p2);
    DERIVED_COMBOS.push({ path: p2, ...info, derived: true });
  }
}
const COMBOS = BASE_COMBOS.concat(DERIVED_COMBOS).map((c) => {
  const r = computeChon(c.path.split("."));
  return { ...c, slug: slugOf(c.path), phrase: phraseOf(c.path), chon: r, chonLabel: chonText(r), group: lineageOf(c.path) };
});

/* ─────────────────────── 페이지 본문 조각 ─────────────────────── */
function tableOf(head, rows) {
  return `<div class="tbwrap"><table class="tb"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function srcLine(meta, extra) {
  return `<p class="src">자료 근거: ${esc(meta.source)}${(meta.urls || []).map((u) => ` · <a href="${u}" target="_blank" rel="noopener nofollow">${u.replace(/^https?:\/\//, "")}</a>`).join("")} · 확인일 ${meta.checkedAt}${extra ? " · " + extra : ""}</p>`;
}

export function build() {
  buildTools();
  buildFamilyTitleLongtail();
  buildHolidayLongtail();
  buildGuides();
  buildPolicy();
  buildHub();
  buildSitemap();
}

/* ═══════════════════════════ 도구 11종 ═══════════════════════════ */
const TOOL_LIST = [
  { slug: "kinship-calc", emoji: "🌳", name: "촌수 계산기", card: "관계 단계를 눌러 쌓으면 촌수·호칭·가계도를 한 번에" },
  { slug: "family-title", emoji: "📖", name: "가족 호칭 사전", card: "고모부·처형·형수… 자주 찾는 호칭 조합 모음" },
  { slug: "in-law-title", emoji: "💍", name: "시가·처가 호칭표", card: "결혼 뒤 새로 생기는 호칭을 한 표로" },
  { slug: "condolence", emoji: "💌", name: "경조사비 도우미", card: "관계·참석 여부별 관행 범위와 봉투 문구 미리보기" },
  { slug: "charye-table", emoji: "🍎", name: "차례상 차림표", card: "성균관 간소화안과 전통 5열 배치도" },
  { slug: "jesa-date", emoji: "🕯️", name: "제삿날 계산기", card: "음력 기일을 앞으로 10년치 양력으로, 캘린더 저장까지" },
  { slug: "holiday-dday", emoji: "📅", name: "명절 D-day", card: "설날·추석까지 남은 날과 연휴 기간" },
  { slug: "message-temp", emoji: "✉️", name: "인사·부고 문자 템플릿", card: "60가지 문구에 이름만 넣어 바로 복사" },
  { slug: "gift-guide", emoji: "🎁", name: "명절 선물 예산 배분", card: "총예산을 대상별로 나눠 계산" },
  { slug: "seat-map", emoji: "🪑", name: "하객 자리배치도", card: "테이블별 자리표를 만들고 이미지로 저장" },
  { slug: "bow-guide", emoji: "🙇", name: "절하는 법", card: "큰절·평절·반절과 공수법 그림 설명" },
];
const toolMeta = Object.fromEntries(TOOL_LIST.map((t) => [t.slug, t]));
function relTo(fromDepth, slug) {
  return { href: "../".repeat(fromDepth) + slug + "/", label: `${toolMeta[slug].emoji} ${toolMeta[slug].name}` };
}
function extRel(key) { return { href: EXT[key][0], label: EXT[key][1], ext: true }; }

function buildTools() {
  /* ── 1. 촌수 계산기 ── */
  emit({
    out: "kinship-calc/index.html", emoji: "🌳", priority: "0.9",
    title: "촌수 계산기 — 관계 단계로 촌수·호칭·가계도 한 번에 | 가족의 날",
    h1: "촌수 계산기",
    desc: "아버지→형→아내처럼 관계를 한 단계씩 눌러 쌓으면 촌수, 부르는 말(호칭), 가리키는 말(지칭), 가계도 그림까지 자동으로 만들어 주는 무료 계산기입니다.",
    lead: "“나”에서 출발해 관계를 한 단계씩 눌러 보세요. 촌수와 호칭, 가계도가 바로 나옵니다.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>명절에 오랜만에 만난 친척이 “나랑 몇 촌이지?”가 되면 대화가 멈춥니다. 이 계산기는 <b>촌수를 외우는 대신 관계를 조립</b>하게 만듭니다. 나에서 출발해 아버지 → 형 → 아내처럼 단계를 누르면, 민법 제770조·제771조의 촌수 계산 원칙(직계는 세수, 방계는 공동 조상까지 올라간 수 + 내려온 수, 배우자는 무촌)에 따라 촌수를 자동으로 계산합니다.</p>
<p>동시에 국립국어원 『표준 언어 예절』을 기준으로 <b>부를 때 쓰는 말</b>과 <b>남에게 가리킬 때 쓰는 말</b>을 함께 보여 주고, 지금까지 밟은 경로를 <b>가계도 그림</b>으로 그려 줍니다. 계산은 전부 브라우저 안에서 이루어지며 아무것도 저장하지 않습니다.</p>
${DISCLAIM_REGION}</section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 관계 경로 만들기</h2>
<p style="font-size:14px">예) <b>아버지 → 형·오빠 → 아내</b> = 큰어머니(3촌) · <b>아내 → 누나·언니</b> = 처형</p>
<div class="chips" id="steps"></div>
<div class="panel2" id="pathbox" aria-live="polite"><b>나</b></div>
<div class="btnrow">
<button class="btn sec small" type="button" id="undo">↩ 한 단계 취소</button>
<button class="btn sec small" type="button" id="reset">처음부터</button>
<button class="btn sec small" type="button" id="share">🔗 이 관계 링크 복사</button>
</div>
<label for="sex">내 성별 <span style="font-weight:400;color:var(--muted)">(형/오빠처럼 화자에 따라 달라지는 호칭에만 사용)</span></label>
<select id="sex"><option value="M">남성</option><option value="F">여성</option></select>
</section>
<div id="out" aria-live="polite"></div>`,
    howtoHtml: `<section><h2>사용 방법</h2>
<ol>
<li>버튼을 눌러 <b>나 → 상대</b>까지 가는 길을 만듭니다. 순서가 중요합니다(“아버지의 형”과 “형의 아버지”는 다릅니다).</li>
<li>단계를 하나 잘못 눌렀다면 <b>한 단계 취소</b>를 누르세요.</li>
<li>결과 카드에서 촌수, 혈족/인척 구분, 호칭·지칭, 가계도를 확인합니다.</li>
<li><b>이 관계 링크 복사</b>를 누르면 지금 만든 경로가 담긴 주소가 복사됩니다. 가족 단톡방에 붙여넣으면 같은 화면이 열립니다.</li>
</ol>
<h3>촌수를 세는 원리</h3>
<p>부모와 자식 사이가 1촌입니다. 나와 형제는 아버지를 거쳐 올라갔다 내려오므로 2촌, 아버지의 형제(큰아버지·작은아버지)는 3촌, 그 자녀인 사촌은 4촌이 됩니다. <b>배우자 사이는 촌수가 없습니다(무촌)</b>. 배우자를 거쳐 이어지는 관계는 혈족이 아니라 <b>인척</b>이라고 부릅니다.</p>
${srcLine(KINSHIP_META)}</section>`,
    faq: [
      { q: "지역마다 호칭이 다른가요?", a: "네, 다릅니다. 이 도구는 국립국어원 『표준 언어 예절』을 기준으로 안내하지만, 실제로는 지역·가문·세대에 따라 부르는 말이 달라집니다. 예를 들어 아버지의 남동생을 ‘작은아버지’로 부르는 집도, ‘삼촌’으로 부르는 집도 흔합니다. 표준 안내를 참고하되 집안에서 쓰는 말을 따르는 것이 자연스럽습니다." },
      { q: "사촌은 왜 4촌인가요?", a: "나에서 아버지까지 1촌, 아버지에서 할아버지까지 2촌, 할아버지에서 큰아버지까지 3촌, 큰아버지에서 그 아들까지 4촌입니다. 공동 조상(할아버지)까지 올라간 수와 내려온 수를 더하는 방계 촌수 계산 방식입니다." },
      { q: "배우자의 가족은 몇 촌인가요?", a: "배우자와 나는 무촌이고, 배우자의 혈족은 나에게 인척이 됩니다. 촌수는 배우자를 기준으로 셉니다. 예를 들어 아내의 아버지(장인)는 아내 기준 1촌이므로 나에게 1촌 인척입니다." },
      { q: "결과를 저장하면 개인정보가 남나요?", a: "아무것도 저장하지 않습니다. 계산은 전부 브라우저 안에서 이루어지고, 링크 복사 기능도 관계 경로 코드(예: f.ob.w)만 주소에 담습니다. 이름이나 개인정보는 입력받지 않습니다." },
      { q: "6촌, 8촌까지 계산되나요?", a: "됩니다. 단계를 계속 쌓으면 재종(6촌)·삼종(8촌)까지 촌수가 계산됩니다. 다만 표준 호칭이 정해진 조합은 4촌 안팎까지가 대부분이라, 먼 친척은 촌수만 안내하고 호칭은 ‘집안에서 쓰는 말’을 따르도록 안내합니다." },
    ],
    related: [relTo(1, "family-title"), relTo(1, "in-law-title"), extRel("chonsu"), extRel("ftf")],
    scripts: [{ src: "assets/js/kinship-calc.js", module: true }],
  });

  /* ── 2. 가족 호칭 사전 (허브 + 롱테일 진입) ── */
  const groups = GROUP_ORDER.map((g) => ({ g, items: COMBOS.filter((c) => c.group === g) })).filter((x) => x.items.length);
  const listHtml = groups.map((grp) => `<section class="panel"><h2 style="margin-top:0">${grp.g} <span class="badge ok">${grp.items.length}</span></h2>
<div class="chips">${grp.items.map((c) =>
    `<a class="chip ft-item" href="${c.slug}/" data-k="${esc(c.phrase + " " + c.name + " " + (c.call || ""))}">${esc(c.name.split("(")[0])} <span style="color:var(--muted)">· ${esc(c.phrase)}</span></a>`).join("")}</div></section>`).join("");
  emit({
    out: "family-title/index.html", emoji: "📖", priority: "0.9",
    title: `가족 호칭 사전 — 자주 찾는 ${COMBOS.length}가지 조합 | 가족의 날`,
    h1: "가족 호칭 사전",
    desc: `고모의 남편, 아내의 언니, 남편의 형, 사촌 형의 아내처럼 실제로 많이 검색되는 가족 호칭 ${COMBOS.length}가지를 촌수와 함께 정리했습니다. 검색창에 관계나 호칭을 입력해 찾아보세요.`,
    lead: `“그 사람을 뭐라고 부르지?” — 자주 찾는 조합 ${COMBOS.length}가지를 촌수와 함께 모았습니다.`,
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>가족 호칭이 어려운 이유는 <b>같은 사람을 부르는 말과 가리키는 말이 다르고</b>, 내가 남자인지 여자인지에 따라서도 달라지기 때문입니다. 이 사전은 “아버지의 형의 아내”처럼 <b>관계를 풀어쓴 말</b>로 찾을 수 있게 만들었습니다. 각 항목을 누르면 촌수, 부르는 말, 가리키는 말, 한자 표기, 헷갈리기 쉬운 점을 정리한 페이지로 이동합니다.</p>
<p>표제어가 정해지지 않은 조합(예: 사촌 형의 아내)도 관행상 어떻게 부르는지 함께 안내합니다.</p>
${DISCLAIM_REGION}</section>`,
    bodyHtml: `<section class="panel">
<label for="q">관계·호칭으로 찾기</label>
<input type="text" id="q" placeholder="예: 고모부, 처형, 형수, 사촌, 아내의 언니" autocomplete="off" />
<p class="src" id="cnt">${COMBOS.length}개 조합</p>
</section>
${listHtml}`,
    howtoHtml: `<section><h2>사용 방법</h2>
<ol><li>검색창에 <b>호칭</b>(예: 형수) 또는 <b>관계 설명</b>(예: 아내의 언니)을 입력하면 목록이 즉시 걸러집니다.</li>
<li>항목을 누르면 촌수·호칭·주의점을 담은 상세 페이지로 이동합니다.</li>
<li>목록에 없는 조합은 <a href="../kinship-calc/">촌수 계산기</a>에서 단계를 직접 쌓아 확인할 수 있습니다.</li></ol>
${srcLine(KINSHIP_META)}</section>`,
    faq: [
      { q: "지역마다 호칭이 다른가요?", a: "다릅니다. 같은 관계를 두고 지역과 집안에 따라 다른 말을 쓰는 경우가 많습니다. 이 사전은 국립국어원 『표준 언어 예절』 기준의 일반적 안내이며, 집안에서 이미 쓰는 호칭이 있다면 그 말을 쓰는 것이 자연스럽습니다." },
      { q: "‘부르는 말’과 ‘가리키는 말’은 무엇이 다른가요?", a: "부르는 말(호칭어)은 그 사람을 직접 앞에 두고 부를 때 쓰는 말이고, 가리키는 말(지칭어)은 제3자에게 그 사람을 설명할 때 쓰는 말입니다. 예를 들어 남편의 형은 부를 때 ‘아주버님’, 가리킬 때 ‘시아주버니’입니다." },
      { q: "남자와 여자가 부르는 말이 다른 경우가 있나요?", a: "있습니다. 형제자매를 부르는 말(형·오빠, 누나·언니)과 그 배우자를 부르는 말(형수·새언니, 매형·형부)이 대표적입니다. 각 상세 페이지에 화자 성별에 따른 차이를 함께 적어 두었습니다." },
      { q: "표준 호칭이 없는 관계는 어떻게 부르나요?", a: "사촌 형의 아내처럼 표준 표제어가 따로 없는 관계는, 가장 가까운 관계에 준해 부르는 것이 관행입니다(친형의 아내를 부르는 방식에 준해 ‘형수님’). 이런 항목은 상세 페이지에 관행 안내라고 표시했습니다." },
    ],
    related: [relTo(1, "kinship-calc"), relTo(1, "in-law-title"), extRel("ftf"), extRel("chonsu")],
    scripts: [{ src: "assets/js/family-title.js", module: false }],
  });

  /* ── 3. 시가·처가 호칭표 ── */
  const inlawRow = (p) => {
    const t = TITLE_MAP[p];
    if (!t) return null;
    const r = computeChon(p.split("."));
    return [esc(phraseOf(p)), `<b>${esc(t.name)}</b>`, esc(t.call || "-"), chonText(r), esc(t.note || "")];
  };
  const HUS = ["h.f", "h.m", "h.ob", "h.ob.w", "h.yb", "h.yb.w", "h.os", "h.os.h", "h.ys", "h.ys.h"];
  const WIF = ["w.f", "w.m", "w.ob", "w.ob.w", "w.yb", "w.yb.w", "w.os", "w.os.h", "w.ys", "w.ys.h"];
  emit({
    out: "in-law-title/index.html", emoji: "💍", priority: "0.8",
    title: "시가·처가 호칭표 — 결혼 뒤 새로 생기는 호칭 정리 | 가족의 날",
    h1: "시가·처가 호칭표",
    desc: "시아주버니와 도련님, 형님과 아가씨, 처남과 처형·처제, 동서까지. 결혼하면 새로 생기는 시가·처가 호칭을 부르는 말·가리키는 말·촌수와 함께 한 표로 정리했습니다.",
    lead: "결혼 뒤 가장 많이 헷갈리는 호칭만 모았습니다. 부르는 말과 가리키는 말을 구분해 두었습니다.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>결혼하면 하루아침에 처음 듣는 호칭이 쏟아집니다. 특히 <b>남편의 남동생을 도련님이라 부를지 서방님이라 부를지</b>, <b>아내의 오빠를 형님이라 불러도 되는지</b>는 매년 명절마다 검색되는 질문입니다. 이 표는 시가(남편 쪽)와 처가(아내 쪽)를 나눠, 관계를 풀어쓴 말 → 정식 명칭 → 부를 때 쓰는 말 → 촌수 순으로 정리한 것입니다.</p>
<p>호칭 문제는 예민한 주제입니다. 아래 표는 국립국어원 『표준 언어 예절』을 기준으로 한 안내일 뿐이며, 실제로 어떻게 부를지는 <b>양가가 편한 방식으로 합의</b>하는 것이 가장 좋습니다.</p>
${DISCLAIM_REGION}</section>`,
    bodyHtml: `<section><h2>시가(媤家) — 남편 쪽 호칭</h2>
${tableOf(["관계", "정식 명칭(지칭)", "부를 때", "촌수", "참고"], HUS.map(inlawRow).filter(Boolean))}
<h2>처가(妻家) — 아내 쪽 호칭</h2>
${tableOf(["관계", "정식 명칭(지칭)", "부를 때", "촌수", "참고"], WIF.map(inlawRow).filter(Boolean))}
<h2>배우자의 부모를 부르는 말</h2>
<p>표준 언어 예절에서는 시부모를 <b>아버님·어머님</b>으로, 장인·장모를 <b>장인어른·장모님</b> 또는 <b>아버님·어머님</b>으로 부르도록 안내합니다. 남에게 말할 때는 각각 시아버지·시어머니, 장인·장모라고 가리킵니다.</p>
<h2>동서(同壻)는 누구인가요</h2>
<p>동서는 <b>형제의 아내끼리</b>, 또는 <b>자매의 남편끼리</b> 서로를 이르는 말입니다. 손위 동서는 ‘형님’이라 부르고, 손아래 동서는 ‘동서’라고 부릅니다. 나이가 아니라 <b>배우자의 서열</b>을 따르는 것이 원칙이라 실제로는 자주 혼선이 생기는 부분입니다.</p>
${srcLine(KINSHIP_META)}</section>`,
    howtoHtml: `<section><h2>이렇게 활용하세요</h2>
<ol><li>명절 전날, 표를 한 번 훑어보고 <b>직접 부를 말</b> 3~4개만 외워 두면 충분합니다.</li>
<li>헷갈리면 “아버님/어머님”, “형님”처럼 <b>무난한 호칭</b>을 쓰고 이름 부르기는 피하는 것이 안전합니다.</li>
<li>표에 없는 조합은 <a href="../kinship-calc/">촌수 계산기</a>에서 단계를 쌓아 확인하세요.</li></ol>
<h3>호칭 때문에 불편해질 때</h3>
<p>‘도련님·아가씨’ 같은 호칭이 불편하다는 의견이 늘면서, 2019년 이후 여러 공공기관 안내에서도 <b>서로 합의한 호칭</b>을 쓰도록 권하는 흐름이 있습니다. 이름에 ‘씨’를 붙이거나 ‘○○ 삼촌’처럼 아이 기준 호칭을 쓰는 집도 많습니다. 정답은 없고, 양가가 편한 쪽이 맞습니다.</p></section>`,
    faq: [
      { q: "지역마다 호칭이 다른가요?", a: "다릅니다. 특히 손위 동서·시매부를 부르는 말은 집안마다 차이가 큽니다. 표준 안내를 참고하되 배우자에게 그 집에서 쓰는 말을 먼저 물어보는 것이 가장 확실합니다." },
      { q: "남편의 남동생은 도련님인가요, 서방님인가요?", a: "표준 언어 예절 기준으로는 미혼이면 ‘도련님’, 결혼했으면 ‘서방님’입니다. 가리킬 때는 시동생이라고 합니다." },
      { q: "아내의 오빠를 형님이라고 불러도 되나요?", a: "됩니다. 손위 처남은 ‘형님’이라 부르고, 손아래 처남은 ‘처남’이라 부르는 것이 표준 안내입니다. 남에게 말할 때는 손위·손아래 모두 처남이라고 가리킵니다." },
      { q: "나이가 더 많은데 손아래 동서인 경우는 어떻게 하나요?", a: "원칙은 배우자의 서열을 따르지만, 실제로는 나이 차가 클 때 서로 존대하며 이름을 부르지 않는 선에서 합의하는 경우가 많습니다. 어느 쪽도 예의에 어긋나지 않습니다." },
      { q: "사돈은 어떻게 부르나요?", a: "자녀의 배우자의 부모를 사돈이라 하고, 부를 때는 ‘사돈어른’ 또는 ‘사부인’(상대가 여성일 때)을 씁니다. 사돈 사이에는 서로 높임말을 쓰는 것이 관행입니다." },
    ],
    related: [relTo(1, "family-title"), relTo(1, "kinship-calc"), extRel("ftf"), extRel("chonsu")],
  });

  /* ── 4. 경조사비 도우미 ── */
  const evRows = Object.entries(EVENTS).map(([k, ev]) => [
    esc(ev.name),
    ...CLOSENESS.map((c) => {
      const [a, b] = ev.ranges[c.key];
      return a === b ? manwon(a) : `${manwon(a)}~${manwon(b)}`;
    }),
  ]);
  emit({
    out: "condolence/index.html", emoji: "💌", priority: "0.9",
    title: "경조사비 계산기 — 축의금·부의금 얼마가 적당할까 | 가족의 날",
    h1: "경조사비 도우미",
    desc: "결혼식 축의금, 장례식 부의금, 돌잔치 축하금을 관계와 참석 여부에 따라 얼마나 하는지 관행 범위로 안내하고, 봉투 앞면 문구를 미리 그려 볼 수 있는 무료 도구입니다.",
    lead: "관계와 참석 여부를 고르면 일반적으로 오가는 금액 범위를 보여 드립니다. 봉투 문구도 함께 확인하세요.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>청첩장이나 부고를 받고 가장 먼저 검색하는 것이 “얼마 해야 하지?”입니다. 이 도구는 <b>관계의 가까운 정도</b>와 <b>참석해서 식사를 하는지</b>를 기준으로 흔히 오가는 금액 범위를 보여 줍니다. 또 봉투 앞면에 무엇을 쓰는지(祝結婚·賻儀 등)를 고르면 <b>봉투 미리보기 그림</b>을 만들어 저장할 수 있습니다.</p>
<div class="note warn"><b>${esc(CONDOLENCE_META.label)}.</b> 경조사비에는 정해진 액수가 없습니다. 아래 범위는 여러 설문과 보도에서 반복적으로 언급되는 폭을 정리한 참고치일 뿐이며, 본인의 형편과 그동안 주고받은 관계를 기준으로 정하는 것이 맞습니다.</div></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 어떤 자리인가요</h2>
<div class="chips" id="ev"></div>
<h2>2) 상대와 얼마나 가까운가요</h2>
<div class="chips" id="cl"></div>
<h2>3) 참석 방식</h2>
<div class="chips" id="at"></div>
<label for="ppl">함께 가는 인원 (부부 동반 등)</label>
<input type="number" id="ppl" value="1" min="1" max="8" inputmode="numeric" />
</section>
<div id="out" aria-live="polite"></div>
<section class="panel">
<h2 style="margin-top:0">봉투 앞면 미리보기</h2>
<label for="phrase">앞면 문구</label>
<select id="phrase"></select>
<label for="giver">뒷면에 쓸 이름 <span style="font-weight:400;color:var(--muted)">(선택, 저장되지 않습니다)</span></label>
<input type="text" id="giver" placeholder="예: 홍길동" maxlength="20" autocomplete="off" />
<label for="belong">소속 <span style="font-weight:400;color:var(--muted)">(선택)</span></label>
<input type="text" id="belong" placeholder="예: 대학 동기 / ○○팀" maxlength="24" autocomplete="off" />
<canvas class="cv" id="env" width="640" height="960" aria-label="봉투 미리보기"></canvas>
<div class="btnrow">
<button class="btn" type="button" id="dl">PNG로 저장</button>
<button class="btn sec" type="button" id="prt">인쇄</button>
</div>
<p class="note">입력한 이름은 브라우저 안에서 그림으로만 그려집니다. 서버로 전송하거나 저장하지 않습니다.</p>
</section>`,
    howtoHtml: `<section><h2>관행 금액 한눈에 보기</h2>
${tableOf(["행사", ...CLOSENESS.map((c) => esc(c.name))], evRows)}
<p class="note warn">${esc(CONDOLENCE_META.label)}. 표의 숫자는 “이 정도가 흔하다”는 참고 범위이며 기준이나 규칙이 아닙니다.</p>
<h3>봉투에 쓰는 문구</h3>
${tableOf(["행사", "한자", "한글", "참고"], Object.entries(ENVELOPE).flatMap(([k, arr]) =>
      arr.map((e, i) => [i === 0 ? esc(EVENTS[k].name) : "", esc(e.hanja), esc(e.hangul), esc(e.note || "")])))}
<h3>알아두면 좋은 관행</h3>
<ul>${Object.values(EVENTS).flatMap((e) => e.tips).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
${srcLine(CONDOLENCE_META)}</section>`,
    faq: [
      { q: "지역마다 금액이 다른가요?", a: "다릅니다. 지역, 예식장의 식대, 직장 문화, 세대에 따라 통용되는 금액이 다릅니다. 같은 회사 안에서도 팀마다 관행이 다른 경우가 흔하므로, 가까운 동료에게 조용히 물어보는 것이 가장 정확합니다." },
      { q: "참석하지 못할 때는 얼마를 보내나요?", a: "식사를 하지 않으므로 참석할 때보다 적게 보내는 것이 일반적입니다. 5만 원을 보내는 경우가 흔하고, 아주 가까운 사이라면 참석할 때와 비슷하게 보내기도 합니다." },
      { q: "부부가 함께 갈 때는 두 배로 하나요?", a: "식사를 두 사람이 하므로 1인 참석보다 올리는 경우가 많지만, 정확히 두 배일 필요는 없습니다. 이 도구는 인원수를 반영해 범위를 조정해 보여 줍니다." },
      { q: "홀수로 내야 한다는 말이 맞나요?", a: "3·5·7·10만 원처럼 홀수 단위로 맞추는 관습이 있습니다. 음양오행에서 홀수를 길한 수로 본 데서 온 관행이라고 설명되며, 요즘은 10만·20만 원처럼 짝수 단위도 흔히 씁니다. 지키지 않아도 실례가 아닙니다." },
      { q: "이 금액이 공식 기준인가요?", a: "아닙니다. 공식 기준은 존재하지 않습니다. 그동안 그 사람에게 받은 만큼 돌려주는 것이 가장 무난한 기준이며, 형편이 어렵다면 금액보다 참석과 인사가 더 큰 의미를 갖습니다." },
    ],
    related: [relTo(1, "message-temp"), relTo(1, "seat-map"), extRel("giftmoney"), extRel("gyeongjosa")],
    scripts: [{ src: "assets/js/condolence.js", module: true }],
  });

  /* ── 5. 차례상 차림표 ── */
  emit({
    out: "charye-table/index.html", emoji: "🍎", priority: "0.9",
    title: "차례상 차림표 — 성균관 간소화안·전통 5열 배치도 | 가족의 날",
    h1: "차례상 차림표",
    desc: "설·추석 차례상 음식 배치를 그림으로 보여 줍니다. 성균관 의례정립위원회 표준안의 간소화 상차림과 전통 5열 관행 배치를 전환해 보고 인쇄할 수 있습니다.",
    lead: "간소화 상차림과 전통 5열 배치를 그림으로 비교하고, 그대로 인쇄해 부엌에 붙여 두세요.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>차례상은 “어디에 무엇을 놓는가”보다 “<b>무엇까지 해야 하는가</b>”가 더 큰 고민입니다. 성균관 의례정립위원회는 2022년 차례상 표준안을 내면서 <b>음식은 6~9가지면 충분하고, 전을 부치지 않아도 되며, 홍동백서·조율이시 같은 배치 규칙은 옛 예서에 없는 관행</b>이라고 밝혔습니다. 이 도구는 그 간소화 상차림과, 여전히 많은 집에서 따르는 전통 5열 배치를 <b>같은 그림 형식으로 나란히</b> 볼 수 있게 만들었습니다.</p>
<div class="note warn">${esc(CHARYE_META.disclaimer)}</div></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 언제 차리나요</h2>
<div class="chips" id="hol"></div>
<h2>2) 어떤 방식으로 볼까요</h2>
<div class="chips" id="mode"></div>
</section>
<div id="out" aria-live="polite"></div>
<div class="btnrow no-print"><button class="btn" type="button" id="print">🖨 이 배치도 인쇄하기</button></div>`,
    howtoHtml: `<section><h2>전통 배치에서 말하는 원칙들</h2>
${tableOf(["말", "뜻"], PRINCIPLES.map((p) => [`<b>${esc(p.name)}</b>`, esc(p.desc)]))}
<p class="note">성균관 표준안은 위 표현들이 옛 예법 문헌에 없는 <b>민간 관행</b>이라고 설명합니다. 지키지 않아도 예에 어긋나지 않습니다.</p>
<h2>간소화 상차림이 말하는 것</h2>
<ul>${SIMPLE_NOTES.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
<h2>지역마다 다른 상차림</h2>
${tableOf(["지역", "많이 올리는 음식"], REGIONAL.map((r) => [`<b>${esc(r.region)}</b>`, esc(r.items)]))}
<p class="note">위 내용은 “그 지역은 반드시 이렇다”는 뜻이 아니라, 널리 알려진 사례를 요약한 것입니다. 같은 지역 안에서도 집집마다 다릅니다.</p>
${srcLine(CHARYE_META)}</section>`,
    faq: [
      { q: "지역마다 차례상이 다른가요?", a: "많이 다릅니다. 경상도에서는 상어고기(돔배기)와 문어를, 전라도에서는 홍어와 병어를, 제주에서는 옥돔과 빙떡을 올리는 집이 많습니다. 지역뿐 아니라 집안마다 대대로 올리던 음식이 있어, 그 집의 방식이 곧 기준입니다." },
      { q: "전을 꼭 부쳐야 하나요?", a: "성균관 표준안은 전을 부치지 않아도 된다고 밝혔습니다. 기름에 부친 음식은 예서 『주자가례』에도 나오지 않는다는 설명입니다. 준비하는 사람의 부담을 줄이는 것이 취지입니다." },
      { q: "홍동백서·조율이시는 지켜야 하나요?", a: "성균관 표준안에 따르면 이 표현들은 옛 예법 문헌에 근거가 없는 민간 관행입니다. 과일은 편하게 놓아도 된다고 안내합니다. 다만 집안에서 오래 지켜 온 방식이 있다면 그대로 하셔도 좋습니다." },
      { q: "차례를 지내지 않아도 되나요?", a: "가족이 합의해 정할 문제입니다. 성균관 안내에서도 형식보다 조상을 기리는 마음이 중요하다고 설명합니다. 지방(신위) 대신 사진을 놓는 것도 가능합니다." },
      { q: "설과 추석의 차이는 무엇인가요?", a: "가장 큰 차이는 주식입니다. 설에는 떡국, 추석에는 송편을 올립니다. 나머지 구성은 대체로 같으며, 이 도구에서 명절을 바꾸면 배치도에도 반영됩니다." },
    ],
    related: [relTo(1, "jesa-date"), relTo(1, "bow-guide"), extRel("jeryegak"), extRel("dday")],
    scripts: [{ src: "assets/js/charye-table.js", module: true }],
  });

  /* ── 6. 제삿날 계산기 ── */
  emit({
    out: "jesa-date/index.html", emoji: "🕯️", priority: "0.9",
    title: "제삿날 계산기 — 음력 기일을 양력 날짜로, 캘린더 저장까지 | 가족의 날",
    h1: "제삿날 계산기",
    desc: "음력 기일을 넣으면 앞으로 10년치 양력 제삿날을 요일과 함께 계산하고, 캘린더에 넣을 수 있는 .ics 파일로 내려받을 수 있습니다. 양력 날짜를 음력 기일로 바꾸는 것도 됩니다.",
    lead: "음력 기일만 알면 앞으로 10년치 제삿날이 나옵니다. 캘린더에 넣어 두면 매년 잊지 않습니다.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>제사·기제사는 대부분 <b>음력 기일</b>을 기준으로 지내기 때문에, 매년 양력 날짜가 달라집니다. 해마다 달력을 뒤지거나 어른께 여쭤보는 대신, 음력 기일을 한 번만 입력해 두면 앞으로 10년치 날짜를 한 번에 확인할 수 있습니다.</p>
<p>날짜 계산은 천문 계산(삭 시각과 태양 황경)으로 음력 달력을 재구성해 <b>한국 표준시(KST) 기준</b>으로 처리합니다. 설날·추석 실제 날짜로 검증했지만, 삭 시각이 자정에 아주 가까운 해에는 하루 차이가 날 수 있으므로 중요한 날짜는 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">한국천문연구원 음양력 변환기</a>로 한 번 더 확인하시길 권합니다.</p></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 무엇을 계산할까요</h2>
<div class="chips" id="mode"></div>
<div id="panelA">
<label for="sdate">돌아가신 날 (양력)</label>
<input type="date" id="sdate" />
<p class="src">양력 날짜를 넣으면 그 날의 음력 날짜(= 음력 기일)를 알려 드립니다.</p>
</div>
<div id="panelB" hidden>
<div class="row2">
<div><label for="lm">음력 월</label>
<select id="lm">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join("")}</select></div>
<div><label for="ld">음력 일</label>
<select id="ld">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join("")}</select></div>
</div>
<label style="display:flex;align-items:center;gap:8px;margin-top:12px">
<input type="checkbox" id="lleap" style="width:auto" /> 윤달 기일입니다
</label>
</div>
<label for="who">누구의 기일인가요 <span style="font-weight:400;color:var(--muted)">(선택, 캘린더 제목에만 쓰입니다)</span></label>
<input type="text" id="who" placeholder="예: 할아버지" maxlength="20" autocomplete="off" />
<label for="yrs">몇 년치를 볼까요</label>
<select id="yrs"><option value="5">5년</option><option value="10" selected>10년</option><option value="15">15년</option></select>
</section>
<div id="out" aria-live="polite"></div>`,
    howtoHtml: `<section><h2>제사 날짜에 관한 관행</h2>
<p>전통적으로 기제사는 <b>기일 전날 밤 자시(밤 11시~새벽 1시)</b>에 지냈습니다. 옛 시간 관념에서는 자시부터 새 날이 시작되므로, 사실상 <b>기일 당일이 시작되는 시각</b>에 지낸 것입니다. 요즘은 참석을 고려해 <b>기일 전날 저녁</b>이나 <b>기일 당일 저녁</b>에 지내는 집이 많습니다.</p>
<p>이 도구는 <b>기일 당일</b>을 기준으로 날짜를 계산하고, 캘린더 파일에는 전날 저녁 알림도 함께 넣을 수 있게 안내합니다. 어느 쪽이 맞는지는 집안에서 이어 온 방식을 따르면 됩니다.</p>
<h3>사용 방법</h3>
<ol>
<li><b>양력 → 음력</b>: 돌아가신 날(양력)을 넣으면 음력 기일이 나옵니다. 이 값을 적어 두세요.</li>
<li><b>음력 → 양력</b>: 음력 기일을 넣으면 앞으로 10년치 양력 날짜와 요일이 나옵니다.</li>
<li><b>.ics 내려받기</b>를 누르면 캘린더 파일이 저장됩니다. 구글 캘린더·아이폰 캘린더에서 열면 매년 일정이 등록됩니다.</li>
</ol>
<h3>윤달 기일은 어떻게 하나요</h3>
<p>윤달에 돌아가신 경우, 윤달이 없는 해에는 <b>같은 번호의 평달</b>에 지내는 것이 가장 널리 쓰이는 방식입니다. 이 도구도 그 방식으로 계산하고, 윤달이 있는 해는 표에 따로 표시합니다. 집안에 따라 다르게 정하기도 합니다.</p>
<p class="src">음양력 변환: 천문 계산(삭·태양 황경) 기반, 한국 표준시 기준 · 최종 확인은 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">한국천문연구원 음양력 변환기</a></p></section>`,
    faq: [
      { q: "지역마다 제사 지내는 날이 다른가요?", a: "날짜(기일)는 같지만 지내는 시각과 방식은 지역·집안마다 다릅니다. 전날 밤 자시에 지내는 집, 전날 저녁에 지내는 집, 당일 저녁에 모이는 집이 모두 있습니다. 어느 쪽도 틀리지 않습니다." },
      { q: "음력 기일을 모르면 어떻게 하나요?", a: "돌아가신 날의 양력 날짜만 알면 됩니다. 이 도구의 ‘양력 → 음력’ 모드에 넣으면 음력 기일이 나옵니다. 다만 예전에 이미 음력 기준으로 제사를 지내 왔다면 그 날짜를 그대로 쓰는 것이 맞습니다." },
      { q: "계산 결과가 달력과 하루 다를 수 있나요?", a: "드물게 그럴 수 있습니다. 음력 초하루는 삭(달이 태양과 겹치는 순간)이 드는 날로 정하는데, 그 시각이 자정에 아주 가까우면 계산 오차로 하루가 달라질 수 있습니다. 중요한 날짜는 한국천문연구원 변환기로 확인하세요." },
      { q: ".ics 파일은 어떻게 쓰나요?", a: "내려받은 파일을 구글 캘린더의 ‘가져오기’에 넣거나, 아이폰·안드로이드에서 파일을 그냥 열면 일정이 추가됩니다. 파일은 여러분 기기에서 만들어지며 서버로 전송되지 않습니다." },
      { q: "입력한 이름이 저장되나요?", a: "저장되지 않습니다. 이름은 캘린더 파일 제목을 만들 때만 쓰이고, 페이지를 닫으면 사라집니다." },
    ],
    related: [relTo(1, "charye-table"), relTo(1, "holiday-dday"), extRel("jeryegak"), extRel("dday")],
    scripts: [{ src: "assets/js/jesa-date.js", module: true }],
  });

  /* ── 7. 명절 D-day ── */
  const holRow = (arr, label) => arr.map((h) => {
    const r = holidayRange(h.date);
    const calc = solarToLunar(...h.date.split("-").map(Number));
    const g = lunarToSolar(h.year, label === "설날" ? 1 : 8, label === "설날" ? 1 : 15);
    const gs = g ? `${g.y}-${String(g.m).padStart(2, "0")}-${String(g.d).padStart(2, "0")}` : "-";
    if (gs !== h.date) warnings.push(`[holidays] ${label} ${h.year}: 표 ${h.date} ↔ 천문계산 ${gs} 불일치`);
    const badge = h.needsCheck ? ` <span class="badge warn">확인 필요</span>` : "";
    const diff = gs !== h.date ? `<br><span class="badge warn">천문 계산은 ${gs}</span>` : "";
    const [y, m, d] = h.date.split("-").map(Number);
    return [`${h.year}년`, `<b>${h.date}</b> (${DOW_KR[dowOf(y, m, d)]})${badge}${diff}`, `${r.prev} ~ ${r.next}`, calc ? `음력 ${calc.month}월 ${calc.day}일` : "-"];
  });
  emit({
    out: "holiday-dday/index.html", emoji: "📅", priority: "0.9",
    title: "설날·추석 D-day — 명절까지 남은 날과 연휴 기간 | 가족의 날",
    h1: "명절 D-day",
    desc: "다음 설날과 추석까지 며칠 남았는지, 연휴는 언제부터 언제까지인지 한눈에 보여 줍니다. 2025년부터 2030년까지 연도별 날짜와 캘린더 저장도 함께 제공합니다.",
    lead: "다음 명절까지 남은 날과 연휴 기간을 바로 확인하세요.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>설날은 음력 1월 1일, 추석은 음력 8월 15일이라 매년 양력 날짜가 달라집니다. 이 페이지는 다음 명절까지 남은 날을 <b>D-day</b>로 보여 주고, 「관공서의 공휴일에 관한 규정」에 따른 <b>전날·당일·다음 날 3일 연휴</b> 범위를 함께 표시합니다.</p>
<p class="note">대체공휴일은 그해 요일 배치에 따라 달라지므로 이 표에는 반영하지 않았습니다. 실제 연휴는 정부 발표를 확인하세요.</p></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">어떤 명절을 볼까요</h2>
<div class="chips" id="pick"></div>
</section>
<div id="out" aria-live="polite"></div>`,
    howtoHtml: `<section><h2>설날 (음력 1월 1일)</h2>
${tableOf(["연도", "설날 (양력)", "연휴(전날~다음 날)", "음력"], holRow(SEOLLAL, "설날"))}
<h2>추석 (음력 8월 15일)</h2>
${tableOf(["연도", "추석 (양력)", "연휴(전날~다음 날)", "음력"], holRow(CHUSEOK, "추석"))}
<p class="note warn"><span class="badge warn">확인 필요</span> 표시가 붙은 해는 한국천문연구원 음양력 변환으로 재확인하지 못한 값입니다. 확정 일정은 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">한국천문연구원 음양력 변환기</a>와 정부의 공휴일 공고로 확인하세요.</p>
<h3>연도별 자세히 보기</h3>
<div class="chips">${[...SEOLLAL.map((h) => ["seollal", "설날", h]), ...CHUSEOK.map((h) => ["chuseok", "추석", h])]
        .map(([k, n, h]) => `<a class="chip" href="${k}/${h.year}/">${h.year} ${n}</a>`).join("")}</div>
${srcLine(HOLIDAY_META)}</section>`,
    faq: [
      { q: "연휴는 지역마다 다른가요?", a: "공휴일은 전국이 같습니다. 다만 귀성·귀경 일정과 지역 행사, 회사별 휴무는 지역과 직장에 따라 다릅니다. 대체공휴일 적용 여부는 해마다 정부 공고로 확정됩니다." },
      { q: "설날·추석은 왜 매년 날짜가 바뀌나요?", a: "음력 기준 명절이기 때문입니다. 음력 한 달은 약 29.5일이라 양력과 매년 11일 정도 어긋나고, 윤달을 넣어 보정하기 때문에 양력 날짜가 해마다 달라집니다." },
      { q: "‘확인 필요’ 배지는 무슨 뜻인가요?", a: "자료를 정리한 시점에 공식 음양력 변환으로 최종 확인하지 못한 날짜라는 표시입니다. 대략적인 계획에는 쓸 수 있지만, 항공권 예약처럼 중요한 결정 전에는 공식 자료로 확인하시기 바랍니다." },
      { q: "대체공휴일은 언제 생기나요?", a: "설날·추석 연휴가 일요일과 겹치거나 다른 공휴일과 겹칠 때 그다음 비공휴일이 대체공휴일이 됩니다. 해마다 요일 배치가 달라 이 표에서는 계산하지 않았습니다." },
    ],
    related: [relTo(1, "jesa-date"), relTo(1, "gift-guide"), extRel("dday"), extRel("jeryegak")],
    scripts: [{ src: "assets/js/holiday-dday.js", module: true }],
  });

  /* ── 8. 문자 템플릿 ── */
  emit({
    out: "message-temp/index.html", emoji: "✉️", priority: "0.9",
    title: `명절·경조사 문자 템플릿 ${TEMPLATES.length}가지 — 이름만 넣어 바로 복사 | 가족의 날`,
    h1: "인사·부고 문자 템플릿",
    desc: `부고 알림, 조문 위로, 답례 인사, 결혼 감사, 설날·추석 인사말, 생신 축하, 쾌유 기원까지 ${TEMPLATES.length}가지 문구를 모았습니다. 이름과 장소만 넣으면 바로 복사됩니다.`,
    lead: `${TEMPLATES.length}가지 문구 중 골라 이름·장소만 채우면 그대로 복사됩니다.`,
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>부고나 답례 문자는 <b>가장 정신없을 때 가장 정확하게</b> 써야 하는 글입니다. 이 도구는 상황별 문구를 미리 준비해 두고, 이름·빈소·발인 같은 정보만 채워 넣으면 완성된 문장이 되도록 만들었습니다. 모든 문구는 직접 작성한 것이라 저작권 걱정 없이 쓰실 수 있습니다.</p>
<p>입력한 내용은 <b>브라우저 안에서만</b> 치환되며 어디에도 전송되지 않습니다. 부고 문자에는 되도록 <b>필요한 정보(빈소·발인)만</b> 담고, 계좌번호는 상주가 직접 요청받았을 때만 안내하는 것이 무난합니다.</p></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 넣을 내용 (비워 둬도 됩니다)</h2>
<div class="row2">
<div><label for="v이름">받는 분 이름</label><input type="text" id="v이름" placeholder="예: 김철수" maxlength="20" /></div>
<div><label for="v고인">고인 성함</label><input type="text" id="v고인" placeholder="예: 홍길동" maxlength="20" /></div>
<div><label for="v상주">상주·보내는 사람</label><input type="text" id="v상주" placeholder="예: 홍상주" maxlength="20" /></div>
<div><label for="v관계">고인과의 관계</label><input type="text" id="v관계" placeholder="예: 부친" maxlength="20" /></div>
<div><label for="v일시">일시</label><input type="text" id="v일시" placeholder="예: 3월 2일 오전" maxlength="30" /></div>
<div><label for="v장소">장소·장지</label><input type="text" id="v장소" placeholder="예: ○○추모공원" maxlength="30" /></div>
<div><label for="v빈소">빈소</label><input type="text" id="v빈소" placeholder="예: ○○병원 장례식장 3호실" maxlength="40" /></div>
<div><label for="v발인">발인</label><input type="text" id="v발인" placeholder="예: 3월 4일 오전 8시" maxlength="30" /></div>
</div>
<p class="note">여기 적은 내용은 저장되지 않습니다. 페이지를 닫으면 사라집니다.</p>
<h2>2) 상황 고르기</h2>
<div class="chips" id="cats"></div>
</section>
<div id="list" aria-live="polite"></div>`,
    howtoHtml: `<section><h2>상황별 문구 수</h2>
${tableOf(["상황", "문구 수", "이럴 때 씁니다"], CATEGORIES.map((c) => {
      const n = TEMPLATES.filter((t) => t.cat === c.key).length;
      const useCase = {
        obituary: "가족·지인·회사에 부고를 알릴 때", condole: "부고를 받고 위로를 전할 때",
        "thanks-funeral": "장례를 마치고 조문객에게 인사할 때", "thanks-wedding": "결혼식 뒤 하객에게 인사할 때",
        seollal: "설 연휴에 안부를 전할 때", chuseok: "추석 연휴에 안부를 전할 때",
        birthday: "생신·회갑·돌잔치를 축하할 때", getwell: "병문안·쾌유를 기원할 때",
      }[c.key] || "";
      return [`<b>${esc(c.name)}</b>`, `${n}가지`, esc(useCase)];
    }))}
<h3>사용 방법</h3>
<ol><li>위쪽 칸에 이름·빈소 같은 정보를 채웁니다. 비워 두면 <b>{이름}</b>처럼 표시된 채로 남습니다.</li>
<li>상황을 고르면 해당 문구만 보입니다.</li>
<li>문구 아래 <b>복사</b>를 누르면 채워진 상태로 클립보드에 담깁니다.</li></ol>
<h3>부고 문자를 쓸 때 주의할 점</h3>
<ul>
<li>고인과 상주의 관계를 분명히 적습니다(예: “○○○의 부친상”).</li>
<li>빈소 주소와 발인 시각은 <b>정확히</b> 적습니다. 오타가 가장 큰 실수입니다.</li>
<li>단체 발송 시 받는 사람이 서로 보이지 않도록 개별 발송하는 것이 좋습니다.</li>
<li>조문을 사양할 때는 그 뜻을 문장 안에 분명히 밝혀 두세요.</li>
</ul>
${srcLine(MSG_META)}</section>`,
    faq: [
      { q: "지역마다 인사말이 다른가요?", a: "인사말 자체는 크게 다르지 않지만, 격식의 정도와 높임 표현의 강도는 집안·지역·세대에 따라 다릅니다. 어른께 보낼 때는 격식형을, 친구에게는 편한 말투를 고르시면 됩니다." },
      { q: "‘삼가 고인의 명복을 빕니다’는 종교와 상관없이 써도 되나요?", a: "‘명복’은 불교에서 온 말이지만 지금은 종교와 무관한 관용 표현으로 널리 쓰입니다. 그래도 신경이 쓰인다면 이 도구의 ‘종교 중립형’ 문구를 쓰시면 됩니다." },
      { q: "부고 문자에 계좌번호를 넣어도 되나요?", a: "논란이 있는 부분입니다. 먼저 보내는 부고에는 넣지 않고, 물어보는 분께 개별적으로 알려 드리는 것이 무난하다는 의견이 많습니다." },
      { q: "입력한 이름이 서버에 남나요?", a: "남지 않습니다. 치환은 브라우저 안에서만 이루어지며, 입력값은 저장하지도 전송하지도 않습니다." },
      { q: "문구를 그대로 써도 되나요?", a: "됩니다. 모든 문구를 직접 작성했으므로 자유롭게 쓰실 수 있습니다. 한두 문장은 본인의 말로 바꾸면 훨씬 진심이 전해집니다." },
    ],
    related: [relTo(1, "condolence"), relTo(1, "holiday-dday"), extRel("gyeongjosa"), extRel("giftmoney")],
    scripts: [{ src: "assets/js/message-temp.js", module: true }],
  });

  /* ── 9. 명절 선물 예산 배분 ── */
  emit({
    out: "gift-guide/index.html", emoji: "🎁", priority: "0.8",
    title: "명절 선물 예산 배분 계산기 — 총예산을 대상별로 나누기 | 가족의 날",
    h1: "명절 선물 예산 배분",
    desc: "명절 선물과 용돈에 쓸 총예산을 정하면 부모님·시부모님·조카·직장까지 대상별로 얼마씩 배분할지 계산해 줍니다. 목록은 기기에만 저장되고 내보내기도 됩니다.",
    lead: "총예산을 정하고 챙길 분들을 고르면, 대상별 금액을 계산해 드립니다.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>명절 지출이 부담스러운 이유는 금액 자체보다 <b>계획 없이 하나씩 결정</b>하기 때문입니다. 이 도구는 순서를 뒤집습니다. 먼저 <b>총예산</b>을 정하고, 챙겨야 할 분들을 고른 뒤, 중요도(가중치)에 따라 자동으로 나눕니다. 배분 결과가 마음에 들지 않으면 가중치를 조절해 다시 계산하면 됩니다.</p>
<p>목록은 <b>이 브라우저에만</b> 저장됩니다. 서버로 보내지 않으며, 언제든 내보내기(JSON)나 전체 삭제를 할 수 있습니다.</p></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 총예산</h2>
<label for="total">이번 명절에 쓸 수 있는 금액</label>
<input type="number" id="total" value="600000" min="0" step="10000" inputmode="numeric" />
<div class="chips" id="quick"></div>
<h2>2) 챙길 분들</h2>
<div id="targets"></div>
<div class="btnrow"><button class="btn sec small" type="button" id="addRow">+ 직접 추가</button></div>
</section>
<div id="out" aria-live="polite"></div>
<section class="panel">
<h2 style="margin-top:0">저장·정리</h2>
<div class="btnrow">
<button class="btn" type="button" id="save">이 기기에 저장</button>
<button class="btn sec" type="button" id="exp">내보내기(JSON)</button>
<button class="btn danger" type="button" id="wipe">전체 삭제</button>
</div>
<p class="note">저장은 이 브라우저의 localStorage에만 이루어집니다. <b>서버 저장 없음</b> — 기기를 바꾸거나 브라우저 기록을 지우면 사라집니다.</p>
</section>`,
    howtoHtml: `<section><h2>선물 고를 때 참고</h2>
${tableOf(["대상", "많이 고르는 것", "생각해 볼 점"], [
      ["부모님·시부모님", "현금·건강식품·과일·안마기기", "현금을 가장 선호한다는 조사가 반복적으로 나옵니다. 금액을 정하기 어렵다면 형제와 맞추는 편이 편합니다."],
      ["조부모님", "현금·내복·간편식", "보관과 조리가 쉬운 것이 좋습니다."],
      ["형제자매", "생필품 세트·상품권", "서로 부담을 줄이려 ‘올해는 생략’을 합의하는 집도 많습니다."],
      ["조카", "현금(세뱃돈)·문구·장난감", "형제간에 금액을 미리 맞춰 두면 서운함이 줄어듭니다."],
      ["직장 상사·동료", "커피·간식 세트", "회사 규정과 청탁금지법 적용 여부를 먼저 확인하세요."],
      ["거래처", "규정 확인 필요", "공직자 등에게는 청탁금지법상 가액 기준이 적용될 수 있습니다."],
    ])}
<p class="note warn">공직자·언론인·교직원 등에게 선물할 때는 <b>청탁금지법(김영란법)</b>의 가액 기준을 반드시 확인하세요. 이 도구는 예산 배분만 도울 뿐 법적 판단을 하지 않습니다.</p>
<h3>사용 방법</h3>
<ol><li>총예산을 입력합니다.</li><li>챙길 대상을 체크하고 인원수와 가중치를 조정합니다.</li>
<li>표에 나온 1인당 금액을 보고 예산을 다시 조정합니다.</li>
<li>필요하면 저장해 두었다가 다음 명절에 다시 씁니다.</li></ol></section>`,
    faq: [
      { q: "지역마다 명절 용돈 관행이 다른가요?", a: "다릅니다. 세뱃돈 액수와 ‘누구까지 챙기는지’의 범위는 지역과 집안에 따라 차이가 큽니다. 형제자매끼리 미리 금액을 맞추는 것이 가장 확실한 방법입니다." },
      { q: "가중치는 어떻게 정하나요?", a: "정답은 없습니다. 기본값은 부모님을 가장 높게 두었지만, 그동안 받은 것과 형편에 맞춰 자유롭게 조정하세요." },
      { q: "저장한 목록은 어디에 있나요?", a: "이 브라우저의 저장 공간(localStorage)에만 있습니다. 서버에는 아무것도 저장되지 않으므로 다른 기기에서는 보이지 않습니다." },
      { q: "세뱃돈은 얼마가 적당한가요?", a: "정해진 기준은 없습니다. 미취학 아동에게 1만 원, 초등학생 1~3만 원, 중고등학생 3~5만 원 선이 흔히 언급되지만 집안 사정에 맞추는 것이 우선입니다." },
    ],
    related: [relTo(1, "holiday-dday"), relTo(1, "condolence"), extRel("giftmoney"), extRel("dday")],
    scripts: [{ src: "assets/js/gift-guide.js", module: true }],
  });

  /* ── 10. 하객 자리배치도 ── */
  emit({
    out: "seat-map/index.html", emoji: "🪑", priority: "0.8",
    title: "하객 자리배치도 만들기 — 테이블 배치 이미지로 저장 | 가족의 날",
    h1: "하객 자리배치도",
    desc: "결혼식 피로연이나 돌잔치 하객을 그룹별로 입력하면 테이블에 자동 배치해 그림으로 만들어 줍니다. 이미지로 저장해 안내판이나 단톡방에 바로 쓸 수 있습니다.",
    lead: "그룹과 인원만 넣으면 테이블 배치도를 그려 드립니다. 이미지로 저장해 바로 쓰세요.",
    crumbs: [],
    introHtml: `<section><h2>어떤 도구인가요</h2>
<p>피로연 자리 배치는 인원이 조금만 늘어도 손으로 감당하기 어렵습니다. 이 도구는 <b>그룹(가족·직장·대학 동기 등)과 인원수</b>만 넣으면 테이블당 정원에 맞춰 자동으로 나누고, 배치도를 그림으로 그려 줍니다. 같은 그룹은 되도록 같은 테이블에 모으고, 남는 자리는 다음 그룹으로 채웁니다.</p>
<p>그림은 <b>PNG 이미지</b>로 저장할 수 있어 예식장 안내 데스크에 인쇄해 두거나 가족 단톡방에 공유하기 좋습니다. 이름은 입력하지 않고 <b>그룹 이름과 인원</b>만 다루므로 개인정보가 남지 않습니다.</p></section>`,
    bodyHtml: `<section class="panel">
<h2 style="margin-top:0">1) 기본 설정</h2>
<div class="row2">
<div><label for="cap">테이블당 인원</label><input type="number" id="cap" value="10" min="2" max="20" inputmode="numeric" /></div>
<div><label for="title">배치도 제목</label><input type="text" id="title" value="○○ 결혼식 피로연" maxlength="30" /></div>
</div>
<h2>2) 그룹 입력</h2>
<div id="groups"></div>
<div class="btnrow"><button class="btn sec small" type="button" id="addG">+ 그룹 추가</button></div>
</section>
<div id="out" aria-live="polite"></div>
<section class="panel">
<h2 style="margin-top:0">배치도 그림</h2>
<canvas class="cv" id="cv" width="1000" height="700" aria-label="자리 배치도"></canvas>
<div class="btnrow">
<button class="btn" type="button" id="dl">PNG로 저장</button>
<button class="btn sec" type="button" id="save">이 기기에 저장</button>
<button class="btn sec" type="button" id="exp">내보내기(JSON)</button>
<button class="btn danger" type="button" id="wipe">전체 삭제</button>
</div>
<p class="note">그룹 이름과 인원만 <b>이 브라우저</b>에 저장됩니다. <b>서버 저장 없음</b> — 하객 이름은 입력받지 않습니다.</p>
</section>`,
    howtoHtml: `<section><h2>자리 배치 요령</h2>
<ul>
<li><b>어른 자리는 입구에서 가깝고 조용한 쪽</b>으로 잡습니다. 이동이 적은 것이 가장 큰 배려입니다.</li>
<li>가족·친척 테이블은 <b>신랑·신부석에 가깝게</b> 두는 것이 일반적입니다.</li>
<li>직장·동창 그룹은 서로 아는 사람끼리 묶어야 대화가 이어집니다.</li>
<li>아이 동반 하객은 <b>통로 쪽</b>에 배치하면 서로 편합니다.</li>
<li>테이블당 1~2자리는 <b>여유석</b>으로 비워 두면 당일 변수에 대응하기 좋습니다.</li>
</ul>
<h3>사용 방법</h3>
<ol><li>테이블당 인원을 정합니다(보통 8~10명).</li>
<li>그룹 이름과 인원을 입력합니다. 그룹을 계속 추가할 수 있습니다.</li>
<li>배치 결과 표와 그림을 확인하고 <b>PNG로 저장</b>합니다.</li></ol></section>`,
    faq: [
      { q: "지역마다 자리 배치 관행이 다른가요?", a: "예식 형식(폐백 유무, 뷔페·코스 여부)에 따라 다르고, 지역과 예식장에 따라서도 다릅니다. 예식장 담당자와 먼저 상의하면 실제 홀 구조에 맞춰 조정할 수 있습니다." },
      { q: "하객 이름을 넣을 수 있나요?", a: "일부러 넣지 않았습니다. 개인 이름을 다루면 저장·유출 위험이 생기기 때문에, 이 도구는 그룹 이름과 인원만 다룹니다." },
      { q: "저장한 배치는 어디에 있나요?", a: "이 브라우저의 저장 공간에만 있습니다. 서버에는 아무것도 올라가지 않으며, 내보내기로 파일을 받아 두면 다른 기기에서도 다시 쓸 수 있습니다." },
      { q: "테이블이 많아지면 그림이 작아지나요?", a: "테이블 수에 맞춰 자동으로 줄 배치를 조정합니다. 너무 많아지면 두 장으로 나눠 저장하는 편이 보기 좋습니다." },
    ],
    related: [relTo(1, "condolence"), relTo(1, "message-temp"), extRel("gyeongjosa"), extRel("giftmoney")],
    scripts: [{ src: "assets/js/seat-map.js", module: true }],
  });

  /* ── 11. 절하는 법 ── */
  emit({
    out: "bow-guide/index.html", emoji: "🙇", priority: "0.8",
    title: "절하는 법 — 큰절·평절·반절과 공수법 그림 설명 | 가족의 날",
    h1: "절하는 법",
    desc: "세배와 차례, 문상에서 하는 큰절·평절·반절의 순서를 그림으로 설명합니다. 남녀 손 위치(공수법)와 절 횟수, 상황별로 어떤 절을 하는지 정리했습니다.",
    lead: "큰절·평절·반절, 손은 어느 쪽이 위인지 그림으로 확인하세요.",
    crumbs: [],
    introHtml: `<section><h2>어떤 페이지인가요</h2>
<p>절은 1년에 몇 번 안 하기 때문에 매번 헷갈립니다. 특히 <b>손을 어느 쪽으로 포개는지(공수법)</b>는 평상시와 상례(장례)에서 반대가 되기 때문에 실수가 잦습니다. 이 페이지는 큰절·평절·반절의 순서를 그림과 함께 정리했습니다.</p>
${DISCLAIM_REGION}</section>`,
    bodyHtml: bowBody(),
    howtoHtml: `<section><h2>상황별로 어떤 절을 하나요</h2>
${tableOf(["상황", "절의 종류", "횟수"], [
      ["세배(어른께)", "큰절", "남녀 모두 한 번"],
      ["차례·기제사", "큰절", "두 번(재배). 여자는 네 번 하는 집도 있습니다"],
      ["문상(고인께)", "큰절", "두 번 하고 상주와 맞절 한 번"],
      ["친구·아랫사람 인사", "평절", "한 번"],
      ["웃어른이 아랫사람의 절을 받을 때", "반절", "한 번"],
      ["혼례 폐백", "큰절", "집안 방식에 따름"],
    ])}
<h3>공수(拱手) — 손을 포개는 법</h3>
<ul>
<li><b>평상시(세배·차례 등)</b>: 남자는 <b>왼손이 위</b>, 여자는 <b>오른손이 위</b>입니다.</li>
<li><b>상례(장례·문상)</b>: 평상시와 <b>반대</b>로, 남자는 오른손이 위, 여자는 왼손이 위입니다.</li>
</ul>
<p class="note">기제사와 차례는 흉사가 아니라 <b>길사</b>로 보아 평상시 공수를 하는 것이 일반적인 설명입니다. 이 부분은 집안에 따라 다르게 가르치기도 합니다.</p>
<h3>문상 순서 (일반적인 흐름)</h3>
<ol>
<li>빈소에 들어가 <b>외투와 모자를 벗습니다.</b></li>
<li>분향 또는 헌화를 합니다. 향은 <b>손으로 부채질하듯 끄고</b> 입으로 불지 않습니다.</li>
<li>영정 앞에서 <b>큰절 두 번</b>을 하고 반 배(가볍게 목례)를 합니다. 종교에 따라 묵념으로 대신해도 됩니다.</li>
<li>상주와 <b>맞절 한 번</b>을 하고 짧게 위로의 말을 건넵니다.</li>
<li>부의금을 전하고 조용히 물러납니다. 사망 원인을 자세히 묻지 않는 것이 예의입니다.</li>
</ol></section>`,
    faq: [
      { q: "지역마다 절하는 방식이 다른가요?", a: "다릅니다. 여자의 절 횟수(두 번인지 네 번인지)나 평절의 자세는 지역·가문에 따라 차이가 있습니다. 집안 어른이 하시는 대로 따라 하는 것이 가장 확실합니다." },
      { q: "손은 어느 쪽이 위인가요?", a: "평상시에는 남자가 왼손, 여자가 오른손이 위입니다. 장례 같은 흉사에서는 반대로 남자가 오른손, 여자가 왼손이 위입니다." },
      { q: "세배할 때 ‘새해 복 많이 받으세요’를 먼저 말하나요?", a: "절을 먼저 하고 나서 덕담을 주고받는 것이 일반적입니다. 절을 하면서 동시에 말하지는 않습니다." },
      { q: "종교상 절을 하지 않아도 되나요?", a: "됩니다. 기독교 등에서는 절 대신 헌화하고 묵념하는 방식이 널리 쓰입니다. 상주에게 미리 양해를 구할 필요도 없이 자연스럽게 하시면 됩니다." },
      { q: "무릎이 아파 큰절이 어렵습니다.", a: "허리를 굽혀 정중히 인사하는 것으로 충분합니다. 형식보다 마음이 우선이며, 어른들도 대개 그렇게 이해하십니다." },
    ],
    related: [relTo(1, "charye-table"), relTo(1, "condolence"), extRel("jeryegak"), extRel("gyeongjosa")],
  });
}

/* 절 그림 (SVG, 빌드 시 정적 생성) */
function bowFigure(title, steps, poses) {
  return `<section class="panel"><h3 style="margin-top:0">${esc(title)}</h3>
<svg class="fig" viewBox="0 0 480 150" role="img" aria-label="${esc(title)} 순서 그림">
<style>
.bl{fill:none;stroke:currentColor;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.bh{fill:currentColor}
.bg2{fill:none;stroke:currentColor;stroke-width:1.4;opacity:.45;stroke-dasharray:4 4}
.bt{fill:currentColor;font-size:11px;opacity:.75;text-anchor:middle}
</style>
${poses.map((pose, i) => {
    const x = 60 + i * 120;
    return `<g transform="translate(${x},0)">${pose}<line class="bg2" x1="-42" y1="120" x2="42" y2="120" />` +
      `<text class="bt" x="0" y="140">${esc(steps[i])}</text></g>`;
  }).join("")}
</svg></section>`;
}
function bowBody() {
  // 서 있는 자세
  const stand = `<circle class="bh" cx="0" cy="26" r="11"/><path class="bl" d="M0 37 L0 82 M0 50 L-16 66 M0 50 L16 66 M0 82 L-13 120 M0 82 L13 120"/><path class="bl" d="M-16 66 L0 62 L16 66"/>`;
  // 손 올린 자세 (공수 후 이마 높이)
  const raise = `<circle class="bh" cx="0" cy="26" r="11"/><path class="bl" d="M0 37 L0 82 M0 48 L-14 30 M0 48 L14 30 M0 82 L-13 120 M0 82 L13 120"/><path class="bl" d="M-14 30 L0 26 L14 30"/>`;
  // 무릎 꿇는 자세
  const kneel = `<circle class="bh" cx="4" cy="46" r="11"/><path class="bl" d="M4 57 L2 92 M2 70 L-14 60 M2 70 L16 78 M2 92 L-20 108 M2 92 L20 104"/><path class="bl" d="M-24 118 L26 118"/>`;
  // 엎드려 절하는 자세
  const prostrate = `<circle class="bh" cx="-18" cy="88" r="11"/><path class="bl" d="M-8 92 L24 100 M-6 96 L-26 104 M24 100 L34 118 M8 96 L2 118"/><path class="bl" d="M-34 118 L40 118"/>`;
  // 반절 (가볍게 굽힘)
  const half = `<circle class="bh" cx="-6" cy="42" r="11"/><path class="bl" d="M-2 52 L8 84 M0 60 L-14 72 M4 68 L14 76 M8 84 L-2 120 M8 84 L20 118"/>`;
  // 평절 (앉아 인사)
  const flat = `<circle class="bh" cx="0" cy="52" r="11"/><path class="bl" d="M0 63 L0 92 M0 74 L-16 82 M0 74 L16 82 M-22 108 L22 108"/><path class="bl" d="M0 92 L-18 106 M0 92 L18 106"/>`;

  return `<section><h2>큰절 — 세배·차례·문상</h2>
<p>가장 정중한 절입니다. 세배, 차례·기제사, 문상 때 합니다.</p>
${bowFigure("큰절 순서 (남자 기준)", ["1. 공수하고 선다", "2. 손을 눈높이로", "3. 무릎을 꿇는다", "4. 이마를 손등에"], [stand, raise, kneel, prostrate])}
<ol>
<li><b>공수</b>합니다. 평상시에는 남자가 왼손, 여자가 오른손을 위로 포갭니다.</li>
<li>포갠 손을 <b>눈높이(이마 앞)</b>까지 올립니다.</li>
<li>손을 바닥에 짚으며 <b>왼 무릎부터</b> 꿇습니다(여자는 오른 무릎부터 하는 방식도 있습니다).</li>
<li>이마가 손등에 닿을 만큼 <b>깊이 숙였다가</b> 잠시 머무릅니다.</li>
<li>일어설 때는 반대 순서로, <b>오른 무릎을 먼저</b> 세우고 일어나 다시 공수합니다.</li>
</ol>
<h2>평절 — 또래·친지 사이</h2>
<p>맞절을 하거나 아랫사람이 웃어른이 아닌 친지에게 할 때 하는 절입니다.</p>
${bowFigure("평절 순서", ["1. 공수하고 선다", "2. 앉으며 손을 짚는다", "3. 허리를 굽혀 인사"], [stand, flat, half])}
<ol><li>공수한 채 앉습니다.</li><li>손을 무릎 앞 바닥에 짚습니다.</li><li>허리를 굽혀 인사하고 천천히 일어납니다.</li></ol>
<h2>반절 — 절을 받는 사람의 답례</h2>
<p>웃어른이 아랫사람의 절을 받았을 때 답례로 하는 가벼운 절입니다.</p>
${bowFigure("반절 순서", ["1. 앉은 채 공수", "2. 가볍게 굽혀 답례"], [flat, half])}
<p class="note">그림은 자세의 흐름을 이해하기 위한 개략도입니다. 세부 동작은 집안에서 가르치는 방식을 따르세요.</p>
</section>`;
}

/* ═══════════════ family-title 롱테일 (조합별 상세) ═══════════════ */
function buildFamilyTitleLongtail() {
  const byGroup = {};
  for (const c of COMBOS) (byGroup[c.group] = byGroup[c.group] || []).push(c);

  for (const c of COMBOS) {
    const sibs = byGroup[c.group].filter((x) => x.slug !== c.slug).slice(0, 8);
    const short = c.name.split("(")[0].trim();
    const steps = c.path.split(".");
    const pathTable = tableOf(["단계", "누구", "여기서 몇 촌"], steps.map((s, i) => {
      const r = computeChon(steps.slice(0, i + 1));
      return [`${i + 1}`, esc(steps.slice(0, i + 1).map((x) => PHRASE[x]).join("의 ")), chonText(r)];
    }));
    const callRow = [];
    callRow.push(["부를 때 (호칭어)", esc(c.call || "-")]);
    if (c.callF) callRow.push(["부를 때 — 내가 여성이면", esc(c.callF)]);
    callRow.push(["가리킬 때 (지칭어)", esc(c.name)]);
    if (c.hanja) callRow.push(["한자", esc(c.hanja)]);
    callRow.push(["촌수", esc(c.chonLabel)]);
    callRow.push(["계열", esc(c.group)]);

    emit({
      out: `family-title/${c.slug}/index.html`, emoji: "📖", priority: "0.6",
      title: `${c.phrase}은 뭐라고 부르나요? — ${short} (${c.chonLabel}) | 가족의 날`,
      h1: `${c.phrase} = ${short}`,
      desc: `${c.phrase}은(는) ${c.name}이며 나와는 ${c.chonLabel} 관계입니다. 부를 때와 가리킬 때 쓰는 말, 촌수를 세는 순서, 헷갈리기 쉬운 점을 정리했습니다.`,
      lead: `${esc(c.phrase)} — 정식 명칭은 <b>${esc(c.name)}</b>, 나와는 <b>${esc(c.chonLabel)}</b> 관계입니다.`,
      crumbs: [{ name: "가족 호칭 사전", rel: "../", abs: SITE_ORIGIN + "/family-title/" }],
      introHtml: `<section class="result">
<div class="big">${esc(short)}</div>
<div class="sub">${esc(c.phrase)} · ${esc(c.chonLabel)}${c.derived ? " · 관행 안내" : ""}</div>
</section>
${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
${c.derived ? `<p class="note warn">이 관계는 국립국어원 『표준 언어 예절』에 <b>단일 표제어가 정해져 있지 않습니다.</b> 아래 내용은 가장 가까운 관계에 준해 부르는 <b>관행 안내</b>입니다.</p>` : ""}`,
      bodyHtml: `<section><h2>어떻게 부르고, 어떻게 가리키나요</h2>
${tableOf(["구분", "쓰는 말"], callRow)}
<h2>촌수는 이렇게 셉니다</h2>
${pathTable}
<p>${c.chon.affinal
        ? "배우자를 거쳐 이어지는 관계이므로 <b>혈족이 아니라 인척</b>입니다. 촌수는 배우자를 기준으로 세며, 배우자 사이는 촌수가 없습니다(무촌)."
        : "부모·자식으로 이어지는 <b>혈족</b> 관계입니다. 공동 조상까지 올라간 세대 수와 다시 내려온 세대 수를 더해 촌수를 셉니다."}</p>
<div class="btnrow"><a class="btn" href="../../kinship-calc/?p=${c.path}">이 관계를 계산기에서 열기 →</a></div>
${DISCLAIM_REGION}</section>`,
      howtoHtml: `<section><h2>같은 계열의 다른 호칭</h2>
<div class="chips">${sibs.map((s) => `<a class="chip" href="../${s.slug}/">${esc(s.name.split("(")[0])}</a>`).join("")}</div>
<p class="src"><a href="../">${esc(c.group)} 호칭 전체 보기 →</a></p>
${srcLine(KINSHIP_META)}</section>`,
      faq: [
        { q: `${c.phrase}은 나와 몇 촌인가요?`, a: `${c.chonLabel}입니다. ${c.chon.affinal ? "배우자를 거쳐 이어지므로 혈족이 아닌 인척으로 봅니다." : "부모와 자식 사이를 1촌으로 세어 올라갔다 내려온 수를 더한 값입니다."}` },
        { q: "지역마다 부르는 말이 다른가요?", a: "다릅니다. 같은 관계라도 지역·가문·세대에 따라 다른 말을 씁니다. 이 페이지는 국립국어원 『표준 언어 예절』 기준의 일반적 안내이며, 집안에서 쓰는 말이 있다면 그 말이 우선입니다." },
        { q: "부를 때와 가리킬 때가 왜 다른가요?", a: "부르는 말(호칭어)은 당사자 앞에서 쓰는 말이고, 가리키는 말(지칭어)은 제3자에게 설명할 때 쓰는 말이기 때문입니다. 두 말이 같은 관계도 있고 다른 관계도 있습니다." },
      ],
      related: [
        { href: "../../kinship-calc/", label: "🌳 촌수 계산기" },
        { href: "../../family-title/", label: "📖 가족 호칭 사전" },
        extRel("chonsu"), extRel("ftf"),
      ],
    });
  }
}

/* ═══════════════ holiday-dday 연도별 롱테일 ═══════════════ */
function buildHolidayLongtail() {
  const defs = [
    { key: "seollal", name: "설날", lunar: "음력 1월 1일", arr: SEOLLAL, emoji: "🧧", food: "떡국", greet: "새해 복 많이 받으세요" },
    { key: "chuseok", name: "추석", lunar: "음력 8월 15일", arr: CHUSEOK, emoji: "🌕", food: "송편", greet: "풍성한 한가위 보내세요" },
  ];
  for (const def of defs) {
    for (const h of def.arr) {
      const r = holidayRange(h.date);
      const [y, m, d] = h.date.split("-").map(Number);
      const dow = DOW_KR[dowOf(y, m, d)];
      const lun = solarToLunar(y, m, d);
      const badge = h.needsCheck ? ` <span class="badge warn">확인 필요</span>` : "";
      const others = def.arr.filter((x) => x.year !== h.year);
      emit({
        out: `holiday-dday/${def.key}/${h.year}/index.html`, emoji: def.emoji, priority: "0.6",
        title: `${h.year}년 ${def.name}은 언제? ${h.date} (${dow}요일) 연휴 정리 | 가족의 날`,
        h1: `${h.year}년 ${def.name}`,
        desc: `${h.year}년 ${def.name}은 ${h.date} ${dow}요일입니다. 전날부터 다음 날까지 ${r.prev}~${r.next}이 공휴일이며, ${def.name}까지 남은 날을 D-day로 확인할 수 있습니다.`,
        lead: `${h.year}년 ${def.name}은 <b>${h.date} (${dow}요일)</b>입니다.`,
        crumbs: [{ name: "명절 D-day", rel: "../../", abs: SITE_ORIGIN + "/holiday-dday/" }],
        introHtml: `<section class="result">
<div class="big" id="dd">${h.date}</div>
<div class="sub">${def.name} · ${dow}요일 · ${def.lunar}${badge}</div>
</section>
<div id="cnt" class="panel2" style="text-align:center" aria-live="polite"></div>
${h.needsCheck ? `<p class="note warn"><span class="badge warn">확인 필요</span> 이 날짜는 한국천문연구원 음양력 변환으로 최종 확인하지 못한 값입니다. 항공권·기차표 예약처럼 중요한 결정 전에는 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">공식 변환기</a>와 정부 공휴일 공고로 확인하세요.</p>` : ""}`,
        bodyHtml: `<section><h2>${h.year}년 ${def.name} 연휴</h2>
${tableOf(["구분", "날짜", "요일"], [
          [`${def.name} 전날`, r.prev, DOW_KR[dowOf(...r.prev.split("-").map(Number))]],
          [`<b>${def.name} 당일</b>`, `<b>${r.day}</b>`, dow],
          [`${def.name} 다음 날`, r.next, DOW_KR[dowOf(...r.next.split("-").map(Number))]],
        ])}
<p>「관공서의 공휴일에 관한 규정」 제2조에 따라 ${def.name}은 <b>전날·당일·다음 날 3일</b>이 공휴일입니다. 대체공휴일은 그해 요일 배치에 따라 달라지므로 여기에는 반영하지 않았습니다.</p>
<h2>${h.year}년 ${def.name} 준비 체크</h2>
<ul>
<li><b>차례상</b>: ${def.name}에는 ${def.food}을(를) 올립니다. <a href="../../../charye-table/">차례상 차림표</a>에서 간소화 상차림과 전통 배치를 비교해 보세요.</li>
<li><b>인사말</b>: “${def.greet}” — <a href="../../../message-temp/">문자 템플릿</a>에서 상대별 문구를 고를 수 있습니다.</li>
<li><b>선물·용돈</b>: <a href="../../../gift-guide/">선물 예산 배분</a>으로 총예산을 먼저 정하면 지출이 줄어듭니다.</li>
<li><b>호칭</b>: 오랜만에 만나는 친척 호칭은 <a href="../../../kinship-calc/">촌수 계산기</a>로 미리 확인해 두세요.</li>
</ul></section>`,
        howtoHtml: `<section><h2>다른 해의 ${def.name}</h2>
${tableOf(["연도", "날짜", "요일", "확인"], others.map((x) => {
          const [yy, mm, ddd] = x.date.split("-").map(Number);
          return [`<a href="../${x.year}/">${x.year}년</a>`, x.date, DOW_KR[dowOf(yy, mm, ddd)], x.needsCheck ? '<span class="badge warn">확인 필요</span>' : '<span class="badge ok">확인됨</span>'];
        }))}
<p class="src">${h.year}년 ${def.name}의 음력 표기: ${lun ? `음력 ${lun.year}년 ${lun.month}월 ${lun.day}일` : "-"}</p>
${srcLine(HOLIDAY_META)}</section>`,
        faq: [
          { q: `${h.year}년 ${def.name}은 며칠인가요?`, a: `${h.date}, ${dow}요일입니다. 연휴는 ${r.prev}부터 ${r.next}까지 3일입니다.` },
          { q: "연휴가 지역마다 다른가요?", a: "공휴일은 전국이 같습니다. 다만 회사·업종별 휴무와 지역 행사 일정은 다를 수 있고, 대체공휴일 적용 여부는 정부 공고로 확정됩니다." },
          { q: `${def.name}은 왜 매년 날짜가 바뀌나요?`, a: `${def.name}은 ${def.lunar}로 정해진 음력 명절이기 때문입니다. 음력과 양력은 해마다 11일가량 어긋나고 윤달로 보정하므로 양력 날짜가 매년 달라집니다.` },
        ],
        related: [
          { href: "../../", label: "📅 명절 D-day 전체 보기" },
          { href: "../../../charye-table/", label: "🍎 차례상 차림표" },
          extRel("dday"), extRel("jeryegak"),
        ],
        extraHead: `<script>window.__HOLIDAY=${JSON.stringify({ date: h.date, name: def.name })};</script>`,
        scripts: [{ src: "assets/js/holiday-year.js", module: false }],
      });
    }
  }
}

/* ═══════════════════════════ 가이드 2편 ═══════════════════════════ */
function buildGuides() {
  const ch2026 = CHUSEOK.find((h) => h.year === 2026);
  const r = holidayRange(ch2026.date);
  emit({
    out: "guide/chuseok-2026-checklist/index.html", emoji: "🌕", priority: "0.8", type: "article",
    title: "2026 추석 준비 체크리스트 — 4주 전부터 당일까지 | 가족의 날",
    h1: "2026 추석 준비 체크리스트",
    desc: `2026년 추석은 ${ch2026.date}입니다. 4주 전 예약부터 장보기, 차례상, 용돈, 인사말, 귀성길까지 시기별로 무엇을 해야 하는지 정리한 체크리스트입니다.`,
    lead: `2026년 추석은 <b>${ch2026.date}</b>, 연휴는 ${r.prev}~${r.next}입니다. 언제 무엇을 할지 미리 정리해 두세요.`,
    crumbs: [{ name: "가이드", rel: "../", abs: SITE_ORIGIN + "/guide/" }],
    introHtml: `<section><p>명절 스트레스의 절반은 <b>준비를 몰아서 하기 때문</b>에 생깁니다. 표를 미리 나눠 두면 같은 일을 하고도 훨씬 덜 지칩니다. 이 글은 2026년 추석(${ch2026.date}, 연휴 ${r.prev}~${r.next})을 기준으로, 시기별로 무엇을 결정하고 무엇을 사면 되는지 순서대로 정리한 것입니다.</p>
<p class="note">대체공휴일은 그해 공고에 따라 달라질 수 있습니다. 이동 계획은 확정된 공휴일 공고를 확인한 뒤 세우세요.</p></section>`,
    bodyHtml: `<section><h2>4주 전 — 예약과 합의</h2>
<ul>
<li><b>이동 수단 확보</b>: 기차표 예매는 명절 승차권 예매 기간에 몰립니다. 날짜와 시간대를 가족과 먼저 맞춰 두세요.</li>
<li><b>모이는 방식 합의</b>: 몇 시에, 어디서, 몇 끼를 함께 먹을지 미리 정하면 당일 갈등이 크게 줄어듭니다.</li>
<li><b>차례 여부 결정</b>: 지낼지, 간소화할지, 성묘로 대신할지 <b>가족 합의</b>가 먼저입니다. <a href="../../charye-table/">차례상 차림표</a>에서 간소화안을 함께 보면 이야기하기 쉽습니다.</li>
<li><b>선물 예산 확정</b>: <a href="../../gift-guide/">선물 예산 배분</a>으로 총액을 먼저 정하고 대상별로 나눕니다.</li>
</ul>
<h2>2주 전 — 주문과 확인</h2>
<ul>
<li>선물 세트 주문(배송이 몰리므로 여유 있게).</li>
<li>제수·장보기 목록 작성. 냉장 보관이 필요한 것과 미리 살 수 있는 것을 나눕니다.</li>
<li>현금 준비: 세뱃돈이 아니어도 어른 용돈·조카 용돈은 <b>새 지폐</b>로 준비해 두면 편합니다.</li>
<li>성묘 계획이 있다면 벌초 일정과 묘소 위치를 확인합니다.</li>
</ul>
<h2>1주 전 — 장보기와 청소</h2>
<ul>
<li>과일·나물·전 재료 구입. 명절 직전에는 가격이 오르는 품목이 있습니다.</li>
<li>차례를 지낸다면 상차림 그림을 <b>인쇄해 부엌에 붙여</b> 두면 당일 우왕좌왕이 줄어듭니다.</li>
<li>인사 문자 초안 작성: <a href="../../message-temp/">문자 템플릿</a>에서 어른용·직장용·친구용을 미리 골라 둡니다.</li>
<li>친척 호칭 확인: <a href="../../kinship-calc/">촌수 계산기</a>로 헷갈리는 관계 두세 개만 미리 확인해 둬도 충분합니다.</li>
</ul>
<h2>연휴 첫날 (${r.prev}) — 이동과 준비</h2>
<ul>
<li>귀성길 정체는 오전에 집중됩니다. 출발 시각을 가족과 공유하세요.</li>
<li>도착 후 음식 준비는 <b>역할을 먼저 나누고</b> 시작합니다. “누가 무엇을”이 정해지면 갈등이 줄어듭니다.</li>
<li>전날 저녁에 상차림 대부분을 끝내 두면 당일 아침이 훨씬 여유롭습니다.</li>
</ul>
<h2>추석 당일 (${ch2026.date}) — 차례와 인사</h2>
<ul>
<li>차례는 보통 아침에 지냅니다. <a href="../../bow-guide/">절하는 법</a>에서 공수와 절 순서를 확인하세요.</li>
<li>성묘는 오전에 다녀오는 집이 많습니다. 벌초 도구와 물을 챙기세요.</li>
<li>어른께 드릴 인사와 용돈은 <b>조용한 자리에서</b> 전하는 것이 서로 편합니다.</li>
<li>멀리 계신 분께는 문자로 안부를 전합니다. 오전 중에 보내는 것이 무난합니다.</li>
</ul>
<h2>연휴 마지막 날 (${r.next}) — 정리</h2>
<ul>
<li>남은 음식은 소분해 나눕니다. 되가져가는 양을 미리 물어보면 낭비가 줄어듭니다.</li>
<li>귀경길은 오후~저녁에 가장 막힙니다. 이른 출발이나 다음 날 새벽 출발을 고려하세요.</li>
<li>다음 명절 D-day를 <a href="../../holiday-dday/">명절 D-day</a>에서 캘린더에 넣어 두면 내년이 편합니다.</li>
</ul>
<h2>명절 갈등을 줄이는 세 가지</h2>
<ol>
<li><b>결정은 미리, 당일에는 실행만.</b> 당일 회의가 가장 큰 스트레스입니다.</li>
<li><b>일은 사람 수로 나눈다.</b> 특정한 사람에게 몰리면 다음 명절이 더 힘들어집니다.</li>
<li><b>안 할 일을 정한다.</b> 전 부치지 않기, 가짓수 줄이기처럼 빼는 결정을 가족이 함께 합니다. 성균관 표준안도 음식은 6~9가지면 충분하다고 안내합니다.</li>
</ol></section>`,
    howtoHtml: `<section><h2>한 장 요약</h2>
${tableOf(["시기", "핵심 할 일"], [
      ["4주 전", "이동 수단 예약, 모이는 방식·차례 여부 합의, 선물 예산 확정"],
      ["2주 전", "선물 주문, 장보기 목록, 현금 준비, 성묘 일정"],
      ["1주 전", "장보기, 상차림 인쇄, 인사 문자 초안, 호칭 확인"],
      [`연휴 첫날 (${r.prev})`, "이동, 역할 분담, 전날 상차림 준비"],
      [`당일 (${ch2026.date})`, "차례·성묘, 인사와 용돈, 안부 문자"],
      [`마지막 날 (${r.next})`, "음식 나눔, 귀경, 다음 명절 일정 등록"],
    ])}
${srcLine(HOLIDAY_META, "차례상 안내는 성균관 의례정립위원회 표준안(2022)")}</section>`,
    faq: [
      { q: "2026년 추석은 언제인가요?", a: `2026년 추석은 ${ch2026.date}이며, 연휴는 ${r.prev}부터 ${r.next}까지입니다. 대체공휴일은 정부 공고로 확정됩니다.` },
      { q: "명절 준비는 지역마다 다른가요?", a: "다릅니다. 차례 음식, 성묘 시기, 모이는 순서까지 지역과 집안에 따라 차이가 큽니다. 이 체크리스트는 널리 통용되는 흐름을 정리한 것이니 집안 사정에 맞게 덜어내며 쓰세요." },
      { q: "차례를 간소화해도 괜찮을까요?", a: "성균관 의례정립위원회는 2022년 표준안에서 음식은 6~9가지면 충분하고 전을 부치지 않아도 된다고 밝혔습니다. 가족이 합의했다면 간소화는 예에 어긋나지 않습니다." },
      { q: "귀성길은 언제 출발하는 것이 좋나요?", a: "일반적으로 연휴 첫날 오전이 가장 막힙니다. 전날 밤이나 당일 새벽 출발이 상대적으로 수월하지만, 해마다 다르므로 교통 예보를 함께 확인하세요." },
    ],
    related: [
      { href: "../../charye-table/", label: "🍎 차례상 차림표" },
      { href: "../../holiday-dday/chuseok/2026/", label: "📅 2026 추석 D-day" },
      extRel("dday"), extRel("jeryegak"),
    ],
  });

  emit({
    out: "guide/kinship-basics/index.html", emoji: "🌳", priority: "0.8", type: "article",
    title: "촌수 계산법 기초 — 사촌은 왜 4촌인가 | 가족의 날",
    h1: "촌수 계산법 기초",
    desc: "촌수는 어떻게 세는지, 혈족과 인척은 무엇이 다른지, 사촌이 왜 4촌인지, 당숙·재종형제 같은 말은 무슨 뜻인지 예시 표와 함께 쉽게 정리했습니다.",
    lead: "촌수는 외우는 게 아니라 세는 것입니다. 규칙 두 개만 알면 8촌까지 셀 수 있습니다.",
    crumbs: [{ name: "가이드", rel: "../", abs: SITE_ORIGIN + "/guide/" }],
    introHtml: `<section><p>친척 관계가 어려운 이유는 이름이 많아서가 아니라 <b>세는 규칙을 배운 적이 없기 때문</b>입니다. 사실 규칙은 두 개뿐입니다. 이 글을 읽고 나면 “재종형제”라는 말을 처음 들어도 몇 촌인지 바로 계산할 수 있습니다.</p></section>`,
    bodyHtml: `<section><h2>규칙 1 — 부모와 자식 사이가 1촌</h2>
<p>촌수의 기본 단위는 <b>한 세대</b>입니다. 나와 아버지는 1촌, 아버지와 할아버지는 1촌이므로 나와 할아버지는 2촌입니다. 이렇게 위아래로 곧게 이어지는 관계를 <b>직계</b>라고 합니다.</p>
${tableOf(["관계", "촌수", "세는 법"], [
      ["부모", "1촌", "나 → 부모 (1단계)"],
      ["조부모", "2촌", "나 → 부모 → 조부모 (2단계)"],
      ["증조부모", "3촌", "3단계"],
      ["자녀", "1촌", "나 → 자녀"],
      ["손자녀", "2촌", "나 → 자녀 → 손자녀"],
    ])}
<h2>규칙 2 — 옆으로 갈 때는 올라갔다 내려온다</h2>
<p>형제·사촌처럼 옆으로 이어지는 관계를 <b>방계</b>라고 합니다. 방계는 <b>공동 조상까지 올라간 세대 수</b>와 <b>거기서 상대까지 내려온 세대 수</b>를 더합니다.</p>
${tableOf(["관계", "계산", "촌수"], [
      ["형제·자매", "나 → 아버지(1) → 형제(1)", "2촌"],
      ["큰아버지·고모", "나 → 아버지(1) → 할아버지(1) → 큰아버지(1)", "3촌"],
      ["조카", "나 → 아버지(1) → 형제(1) → 조카(1)", "3촌"],
      ["사촌", "나 → 아버지(1) → 할아버지(1) → 큰아버지(1) → 사촌(1)", "4촌"],
      ["당숙(아버지의 사촌)", "나 → 아버지(1) → 할아버지(1) → 증조부(1) → 종조부(1) → 당숙(1)", "5촌"],
      ["재종형제(육촌)", "증조부까지 3단계 올라갔다 3단계 내려옴", "6촌"],
    ])}
<p><b>홀수 촌은 나와 세대가 다른 사람</b>(부모·조카·삼촌뻘), <b>짝수 촌은 나와 같은 세대</b>(형제·사촌·육촌)라는 규칙성도 기억해 두면 편합니다.</p>
<h2>혈족과 인척은 무엇이 다른가</h2>
<p><b>혈족</b>은 피로 이어진 관계, <b>인척</b>은 혼인으로 이어진 관계입니다. 그리고 <b>배우자 사이에는 촌수가 없습니다(무촌)</b>. 그래서 아내의 아버지(장인)는 아내 기준 1촌이고, 나에게는 1촌 인척이 됩니다.</p>
${tableOf(["관계", "구분", "촌수"], [
      ["아내·남편", "배우자", "무촌"],
      ["장인·시아버지", "인척", "1촌"],
      ["처남·시동생", "인척", "2촌"],
      ["형수·제수", "인척", "2촌"],
      ["고모부·이모부", "인척", "3촌"],
      ["사촌", "혈족", "4촌"],
    ])}
<p class="src">촌수 계산 원칙은 민법 제770조(혈족의 촌수 계산)와 제771조(인척의 촌수 계산)에 규정되어 있습니다.</p>
<h2>이름에 담긴 규칙</h2>
<ul>
<li><b>외(外)</b>가 붙으면 어머니 쪽입니다. 외할아버지, 외삼촌, 외사촌.</li>
<li><b>당(堂)</b>은 아버지의 사촌 계열입니다. 당숙(5촌), 당질(5촌).</li>
<li><b>재종(再從)</b>은 육촌, <b>삼종(三從)</b>은 팔촌입니다.</li>
<li><b>종(從)</b>은 사촌 계열을 뜻해, 종조부는 할아버지의 형제입니다.</li>
<li><b>고종</b>은 고모의 자녀, <b>이종</b>은 이모의 자녀, <b>외종</b>은 외삼촌의 자녀입니다.</li>
</ul>
<h2>많이 틀리는 것들</h2>
<ul>
<li><b>“삼촌”은 원래 촌수를 가리키는 말</b>입니다. 아버지의 형제가 3촌이라 삼촌이라 부르게 된 것이고, 표준 호칭은 큰아버지·작은아버지입니다.</li>
<li><b>사돈은 촌수가 없습니다.</b> 자녀의 배우자의 부모는 나와 혈족도 인척 촌수도 성립하지 않아, 관계 이름으로만 부릅니다.</li>
<li><b>이복형제도 2촌입니다.</b> 아버지를 공유하므로 촌수는 같습니다.</li>
<li><b>8촌까지가 법적으로 의미</b>가 있습니다. 민법상 친족의 범위는 8촌 이내의 혈족, 4촌 이내의 인척, 배우자입니다.</li>
</ul>
<div class="btnrow"><a class="btn" href="../../kinship-calc/">촌수 계산기로 직접 세어 보기 →</a></div></section>`,
    howtoHtml: `<section><h2>연습 문제</h2>
${tableOf(["문제", "답"], [
      ["아버지의 형의 아들은?", "사촌(4촌), 나이에 따라 형 또는 동생"],
      ["어머니의 여동생의 딸은?", "이종사촌(4촌)"],
      ["아내의 언니의 남편은?", "손위 동서, 부를 때는 형님"],
      ["남편의 여동생은?", "시누이, 부를 때는 아가씨"],
      ["할아버지의 형은?", "큰할아버지(종조부), 4촌"],
      ["형의 손자는?", "4촌 비속, 이름으로 부름"],
    ])}
<p class="src"><a href="../../family-title/">가족 호칭 사전</a>에서 ${COMBOS.length}가지 조합을 관계별로 확인할 수 있습니다.</p>
${srcLine(KINSHIP_META)}</section>`,
    faq: [
      { q: "사촌은 왜 4촌인가요?", a: "나에서 아버지(1촌), 아버지에서 할아버지(2촌), 할아버지에서 큰아버지(3촌), 큰아버지에서 그 아들(4촌)로 세기 때문입니다. 공동 조상인 할아버지까지 올라간 2단계와 다시 내려온 2단계를 더한 값입니다." },
      { q: "촌수는 지역마다 다르게 세나요?", a: "촌수를 세는 규칙 자체는 민법에 근거해 전국이 같습니다. 다만 그 관계를 부르는 호칭은 지역·가문·세대에 따라 다릅니다." },
      { q: "배우자는 몇 촌인가요?", a: "촌수가 없습니다(무촌). 부부는 촌수로 세지 않고, 배우자의 혈족과의 관계를 인척 촌수로 셉니다." },
      { q: "친족의 법적 범위는 어디까지인가요?", a: "민법상 친족은 8촌 이내의 혈족, 4촌 이내의 인척, 그리고 배우자입니다. 상속이나 결혼 금지 범위 등에서 이 기준이 쓰입니다." },
    ],
    related: [
      { href: "../../kinship-calc/", label: "🌳 촌수 계산기" },
      { href: "../../family-title/", label: "📖 가족 호칭 사전" },
      extRel("chonsu"), extRel("ftf"),
    ],
  });

  /* 가이드 인덱스 */
  emit({
    out: "guide/index.html", emoji: "📚", priority: "0.6",
    title: "가이드 — 명절과 가족 예절 읽을거리 | 가족의 날",
    h1: "가이드",
    desc: "명절 준비 체크리스트와 촌수 계산법 기초 등, 도구만으로는 다 담기 어려운 내용을 글로 정리했습니다.",
    lead: "도구로 다 담기 어려운 내용을 글로 정리했습니다.",
    crumbs: [],
    bodyHtml: `<section><div class="cards">
<a class="card" href="chuseok-2026-checklist/"><div class="t"><span class="e">🌕</span>2026 추석 준비 체크리스트</div><div class="d">4주 전 예약부터 당일 차례, 귀경까지 시기별로 정리</div></a>
<a class="card" href="kinship-basics/"><div class="t"><span class="e">🌳</span>촌수 계산법 기초</div><div class="d">사촌은 왜 4촌인가 — 규칙 두 개로 8촌까지 세기</div></a>
</div></section>`,
    faq: [{ q: "내용은 지역마다 다른가요?", a: "예절과 관행은 지역·가문마다 다릅니다. 가이드의 내용은 널리 통용되는 일반적 기준을 정리한 것이며 정답이 아닙니다." }],
    related: [relTo(1, "kinship-calc"), relTo(1, "charye-table"), extRel("jeryegak"), extRel("dday")],
    noAd: false,
  });
}

/* ═══════════════════════════ 정책 페이지 ═══════════════════════════ */
function buildPolicy() {
  emit({
    out: "privacy/index.html", emoji: "🔒", priority: "0.3", type: "page", noAd: true,
    title: "개인정보처리방침 | 가족의 날",
    h1: "개인정보처리방침",
    desc: "가족의 날은 이용자의 개인정보를 수집하지 않습니다. 모든 계산은 브라우저에서 처리되며, 광고와 저장 방식에 대해 안내합니다.",
    lead: "가족의 날은 이름·연락처 등 개인정보를 수집하지 않습니다.",
    crumbs: [],
    bodyHtml: `<section>
<h2>1. 수집하는 개인정보</h2>
<p>가족의 날(이하 “서비스”)은 회원가입 절차가 없으며, 실명·전화번호·주민등록번호·이메일 등 <b>개인을 식별할 수 있는 정보를 일절 수집하지 않습니다.</b></p>
<h2>2. 입력한 내용의 처리</h2>
<p>도구에 입력하는 값(관계 단계, 금액, 날짜, 문자 템플릿의 이름 등)은 <b>이용자의 브라우저 안에서만</b> 처리됩니다. 서버로 전송되지 않으며 서비스 운영자는 그 내용을 알 수 없습니다.</p>
<h2>3. 브라우저 저장(localStorage)</h2>
<p>일부 도구(선물 예산 배분, 하객 자리배치도, 테마 설정)는 편의를 위해 입력값을 이용자의 브라우저 저장 공간에 보관합니다. 이 데이터는 <b>이용자의 기기에만</b> 남으며, 각 도구의 “전체 삭제” 버튼이나 브라우저의 사이트 데이터 삭제로 언제든 지울 수 있습니다.</p>
<h2>4. 광고</h2>
<p>서비스는 Google AdSense 광고를 게재합니다. Google을 비롯한 제3자 공급업체는 쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener nofollow">Google 광고 설정</a>에서 맞춤 광고를 사용 중지할 수 있으며, <a href="https://www.aboutads.info" target="_blank" rel="noopener nofollow">aboutads.info</a>에서 제3자 공급업체의 쿠키 사용을 관리할 수 있습니다.</p>
<h2>5. 로그 분석</h2>
<p>서비스는 호스팅 사업자가 제공하는 기본적인 접속 통계(페이지 조회수 등)를 이용할 수 있습니다. 이는 개인을 식별하지 않는 집계 정보입니다.</p>
<h2>6. 아동의 개인정보</h2>
<p>서비스는 만 14세 미만 아동을 포함한 어떤 이용자로부터도 개인정보를 수집하지 않습니다.</p>
<h2>7. 문의</h2>
<p>개인정보 처리에 관한 문의는 서비스 운영자에게 전달해 주시기 바랍니다. 서비스는 수집하는 개인정보가 없으므로 열람·정정·삭제 요청 대상이 되는 보관 정보가 존재하지 않습니다.</p>
<h2>8. 방침의 변경</h2>
<p>이 방침이 변경되는 경우 이 페이지를 통해 공지합니다. 최종 개정일: ${BUILD_DATE}</p>
</section>`,
  });

  emit({
    out: "terms/index.html", emoji: "📄", priority: "0.3", type: "page", noAd: true,
    title: "이용약관 | 가족의 날",
    h1: "이용약관",
    desc: "가족의 날 서비스 이용에 관한 약관입니다. 제공하는 정보의 성격과 책임의 한계를 안내합니다.",
    lead: "서비스가 제공하는 정보의 성격과 책임 범위를 안내합니다.",
    crumbs: [],
    bodyHtml: `<section>
<h2>제1조 (목적)</h2>
<p>이 약관은 가족의 날(이하 “서비스”)이 제공하는 무료 웹 도구의 이용 조건과 책임 범위를 정하는 것을 목적으로 합니다.</p>
<h2>제2조 (서비스의 성격)</h2>
<p>서비스는 명절·가족 호칭·경조사와 관련한 <b>일반적인 정보와 계산 도구</b>를 무료로 제공합니다. 별도의 가입 절차나 요금이 없습니다.</p>
<h2>제3조 (정보의 한계)</h2>
<ol>
<li>서비스가 제공하는 호칭·예절·상차림 안내는 <b>지역과 가문에 따라 달라지는 관행</b>을 정리한 것으로, 유일한 정답이 아닙니다.</li>
<li>경조사비 금액은 <b>일반적인 관행 범위를 참고로 제시</b>하는 것이며, 특정 금액을 권장하거나 기준으로 정하는 것이 아닙니다.</li>
<li>음양력 변환과 명절 날짜는 천문 계산 및 공개 자료를 바탕으로 하며, 중요한 결정 전에는 한국천문연구원 등 <b>공식 자료로 확인</b>하시기 바랍니다.</li>
<li>서비스는 법률·의료·금융·세무에 관한 자문을 제공하지 않습니다.</li>
</ol>
<h2>제4조 (책임의 제한)</h2>
<p>서비스가 제공하는 정보를 이용해 내린 판단과 그 결과에 대한 책임은 이용자에게 있습니다. 서비스는 정보의 정확성·완전성을 보증하지 않으며, 정보 이용으로 발생한 손해에 대해 법이 허용하는 범위에서 책임을 지지 않습니다.</p>
<h2>제5조 (저작권)</h2>
<p>서비스가 직접 작성한 문구·설명·그림의 저작권은 서비스에 있습니다. 이용자는 문자 템플릿 등 도구가 생성한 결과물을 <b>개인적 용도로 자유롭게</b> 사용할 수 있습니다. 페이지 전체를 복제해 재배포하는 것은 허용되지 않습니다.</p>
<h2>제6조 (서비스의 변경·중단)</h2>
<p>서비스는 사전 통지 없이 내용을 변경하거나 제공을 중단할 수 있습니다.</p>
<h2>제7조 (약관의 변경)</h2>
<p>이 약관이 변경되는 경우 이 페이지를 통해 공지합니다. 최종 개정일: ${BUILD_DATE}</p>
</section>`,
  });
}

/* ═══════════════════════════ 허브 홈 ═══════════════════════════ */
function buildHub() {
  const nextHol = [...SEOLLAL.map((h) => ({ ...h, name: "설날" })), ...CHUSEOK.map((h) => ({ ...h, name: "추석" }))]
    .sort((a, b) => a.date.localeCompare(b.date));
  emit({
    out: "index.html", emoji: "🏮", priority: "1.0",
    title: "가족의 날 — 명절·가족 호칭·경조사 도구 모음",
    h1: "가족의 날",
    desc: "촌수와 호칭, 차례상 차림, 제삿날 계산, 경조사비, 명절 인사 문자까지. 명절과 가족 행사에서 헷갈리는 것들을 정리한 무료 도구 11종을 모았습니다.",
    lead: "촌수·호칭부터 차례상, 제삿날, 경조사비까지. 명절에 검색하게 되는 것들을 한곳에 모았습니다.",
    crumbs: [],
    introHtml: `<section class="cards">${TOOL_LIST.map((t) =>
      `<a class="card" href="${t.slug}/"><div class="t"><span class="e">${t.emoji}</span>${esc(t.name)}</div><div class="d">${esc(t.card)}</div></a>`).join("")}</section>`,
    bodyHtml: `<section><h2>왜 만들었나요</h2>
<p>명절이 다가오면 같은 것을 검색합니다. “고모부를 뭐라고 부르지”, “차례상 어디에 뭘 놓지”, “축의금 얼마 하지”, “제사 날짜가 언제지”. 답은 흩어져 있고, 대부분 <b>지역과 집안마다 다르다</b>는 말로 끝납니다.</p>
<p>가족의 날은 그 흩어진 답을 <b>계산할 수 있는 것은 계산해서</b>, <b>다를 수밖에 없는 것은 다르다고 밝혀서</b> 정리한 도구 모음입니다. 촌수는 민법의 계산 원칙대로, 호칭은 국립국어원 『표준 언어 예절』을 기준으로, 차례상은 성균관 표준안과 전통 관행을 나란히 놓고 보여 줍니다.</p>
<p>모든 도구는 <b>브라우저 안에서만</b> 동작합니다. 로그인도, 서버 저장도 없습니다.</p>
<h2>다가오는 명절</h2>
${tableOf(["명절", "날짜", "확인"], nextHol.map((h) => {
      const [y, m, d] = h.date.split("-").map(Number);
      const key = h.name === "설날" ? "seollal" : "chuseok";
      return [`<a href="holiday-dday/${key}/${h.year}/">${h.year} ${h.name}</a>`,
      `${h.date} (${DOW_KR[dowOf(y, m, d)]})`,
      h.needsCheck ? '<span class="badge warn">확인 필요</span>' : '<span class="badge ok">확인됨</span>'];
    }))}
<h2>읽을거리</h2>
<div class="cards">
<a class="card" href="guide/chuseok-2026-checklist/"><div class="t"><span class="e">🌕</span>2026 추석 준비 체크리스트</div><div class="d">4주 전부터 당일까지 시기별로 할 일 정리</div></a>
<a class="card" href="guide/kinship-basics/"><div class="t"><span class="e">🌳</span>촌수 계산법 기초</div><div class="d">규칙 두 개로 8촌까지 세는 법</div></a>
</div></section>`,
    howtoHtml: `<section><h2>자료 근거</h2>
<ul>
<li><b>촌수·호칭</b>: 국립국어원 『표준 언어 예절』(2011), 민법 제770~771조</li>
<li><b>차례상</b>: 성균관 의례정립위원회 차례상 표준안(2022)</li>
<li><b>명절 날짜</b>: 한국천문연구원 음양력 변환, 「관공서의 공휴일에 관한 규정」</li>
<li><b>경조사비</b>: 공개된 설문·보도에서 반복 언급되는 범위를 자체 정리(공식 기준 아님)</li>
</ul>
<p class="note warn">이 사이트의 예절·관행 안내는 <b>지역·가문마다 다릅니다.</b> 어느 것도 “정답”이 아니며, 집안에서 이어 온 방식이 우선입니다.</p></section>`,
    faq: [
      { q: "회원가입이 필요한가요?", a: "필요 없습니다. 모든 도구가 무료이며 로그인 없이 바로 쓸 수 있습니다." },
      { q: "입력한 내용이 저장되나요?", a: "서버에는 저장되지 않습니다. 계산은 브라우저 안에서만 이루어지고, 일부 도구가 편의를 위해 이 기기의 저장 공간을 쓰는 경우에는 화면에 명시하고 전체 삭제 버튼을 함께 제공합니다." },
      { q: "예절 안내가 지역마다 다른가요?", a: "다릅니다. 호칭, 차례 음식, 제사 시간, 경조사비 관행 모두 지역과 집안에 따라 차이가 큽니다. 이 사이트는 널리 통용되는 기준을 정리한 것이며, 각 페이지에 근거 자료를 밝혀 두었습니다." },
      { q: "모바일에서도 되나요?", a: "됩니다. 모든 도구가 휴대폰 화면에 맞춰 동작하며, 배치도·봉투 그림은 이미지로 저장할 수 있습니다." },
    ],
    related: [extRel("chonsu"), extRel("ftf"), extRel("gyeongjosa"), extRel("jeryegak"), extRel("giftmoney"), extRel("dday")],
  });
}

/* ═══════════════════════════ sitemap / robots ═══════════════════════════ */
function buildSitemap() {
  const body = sitemapUrls.map((u) =>
    `  <url><loc>${u.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${u.priority}</priority></url>`).join("\n");
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
}

/* ═══════════════════════════ 실행 ═══════════════════════════ */
build();

const htmlCount = written.filter((f) => f.endsWith(".html")).length;
console.log(`✔ 생성 완료: HTML ${htmlCount}개 (+ sitemap.xml, robots.txt)`);
console.log(`  · 도구 ${TOOL_LIST.length}종, 호칭 롱테일 ${COMBOS.length}개, 명절 롱테일 ${SEOLLAL.length + CHUSEOK.length}개, 가이드 2편`);
if (warnings.length) {
  console.log(`⚠ 경고 ${warnings.length}건`);
  for (const w of warnings) console.log("   - " + w);
} else {
  console.log("⚠ 경고 0건");
}
