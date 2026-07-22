// scripts/fetch-news.mjs — 언론사 공식 RSS → data/news-cards.json + 일자별 아카이브
//
// 사용: node scripts/fetch-news.mjs        (data/news-cards.json + data/news-archive/YYYY-MM-DD.json)
//
// 저작권 설계(중요):
//  - 기사 "제목·출처·링크·발행시각"만 수집한다. 본문/요약/이미지는 수집하지 않는다.
//    (기사 제목은 저작물성이 인정되지 않는 것이 판례·통설이며, 링크는 원문 유도)
//  - Google News RSS 는 약관상 개인·비상업 한정이라 사용하지 않는다. 언론사 공식 RSS 만 사용.
//  - 카드/페이지에는 항상 출처 표기 + 원문 링크를 노출한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const FEEDS = [
  // key: 카테고리, name: 출처 표기
  { cat: "top", name: "경향신문", url: "https://www.khan.co.kr/rss/rssdata/total_news.xml" },
  { cat: "top", name: "동아일보", url: "https://rss.donga.com/total.xml" },
  { cat: "top", name: "SBS뉴스", url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER" },
  { cat: "top", name: "연합뉴스TV", url: "https://www.yonhapnewstv.co.kr/browse/feed/" },
  { cat: "econ", name: "한국경제", url: "https://www.hankyung.com/feed/economy" },
  { cat: "econ", name: "매일경제", url: "https://www.mk.co.kr/rss/50200011/" },
  { cat: "econ", name: "동아일보", url: "https://rss.donga.com/economy.xml" },
  { cat: "econ", name: "경향신문", url: "https://www.khan.co.kr/rss/rssdata/economy_news.xml" },
  { cat: "tech", name: "전자신문", url: "https://rss.etnews.com/Section901.xml" },
  { cat: "tech", name: "한국경제IT", url: "https://www.hankyung.com/feed/it" },
  { cat: "tech", name: "동아사이언스", url: "https://rss.donga.com/science.xml" },
  { cat: "life", name: "경향문화", url: "https://www.khan.co.kr/rss/rssdata/culture_news.xml" },
  { cat: "life", name: "동아문화", url: "https://rss.donga.com/culture.xml" },
  { cat: "life", name: "SBS연예", url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=14&plink=RSSREADER" },
];
const CATS = [
  { key: "top", name: "주요", emoji: "🗞️" },
  { key: "econ", name: "경제", emoji: "💰" },
  { key: "tech", name: "IT·과학", emoji: "🔬" },
  { key: "life", name: "문화·연예", emoji: "🎬" },
];
const PER_CAT = 8;          // 카테고리당 최종 채택 수
const TIMEOUT_MS = 15000;
// 공개 RSS 피드의 정상 구독(수집은 제목·링크·시각뿐). 봇 정체를 밝히는 UA 를 기본으로 쓰고,
// 실패 시 curl 폴백(사내 프록시 환경 등 fetch 경로가 막힌 경우 대비)으로 재시도한다.
const UA = "Mozilla/5.0 (compatible; TomatoEggCatNews/1.0; +https://tomatoeggcat.com/news-cards/)";
const HEADERS = { "User-Agent": UA, "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8", "Accept-Language": "ko" };

const decode = (s) => String(s ?? "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// 제목 뒷꼬리의 매체명 표기(" - 매일경제" 등)와 장식 대괄호 일부 정리
const cleanTitle = (t) => decode(t)
  .replace(/\s*[-|–]\s*(매일경제|한국경제|경향신문|동아일보|전자신문|SBS.*|연합뉴스.*)\s*$/i, "")
  .slice(0, 90).trim();

// 중복 판정용 정규화(공백/기호 제거)
const normKey = (t) => t.replace(/[\s\[\]().,'"!?…·「」-]/g, "").toLowerCase();

async function fetchXml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function fetchXmlCurl(url) {
  const { execFileSync } = await import("node:child_process");
  return execFileSync("curl", ["-sSL", "--max-time", String(TIMEOUT_MS / 1000), "-A", UA,
    "-H", "Accept: application/rss+xml, application/xml;q=0.9, */*;q=0.8", url],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}

async function fetchFeed(f) {
  let xml;
  try { xml = await fetchXml(f.url); }
  catch (e1) {
    try { xml = await fetchXmlCurl(f.url); }
    catch { throw new Error(`${e1.message} (+curl 실패) ${f.name} ${f.url}`); }
  }
  {
    const items = [];
    for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
      const block = m[0];
      const pick = (tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")) || [])[1] || "";
      const title = cleanTitle(pick("title"));
      let link = decode(pick("link"));
      if (!link) link = decode((block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || "");
      const pub = decode(pick("pubDate")) || decode(pick("dc:date"));
      const ts = pub ? new Date(pub) : null;
      if (!title || title.length < 8 || !/^https?:\/\//.test(link)) continue;
      items.push({ t: title, src: f.name, link, ts: ts && !isNaN(ts) ? ts.toISOString() : null });
    }
    return items;
  }
}

const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600 * 1000);
const dateKST = kst.toISOString().slice(0, 10);

const byCat = Object.fromEntries(CATS.map(c => [c.key, []]));
const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f).then(items => ({ f, items }))));
let okFeeds = 0;
for (const r of results) {
  if (r.status !== "fulfilled") { console.warn(`⚠️ feed 실패: ${r.reason?.message || r.reason}`); continue; }
  okFeeds++;
  byCat[r.value.f.cat].push(...r.value.items);
}
if (okFeeds < 4) { console.error(`❌ 정상 피드 ${okFeeds}/14 — 데이터 갱신 중단(기존 파일 유지)`); process.exit(1); }

const categories = CATS.map(c => {
  const seen = new Set();
  const items = byCat[c.key]
    .filter(it => { const k = normKey(it.t); if (seen.has(k)) return false; seen.add(k); return true; })
    // 최신순 정렬(발행시각 없으면 뒤로) 후 출처 다양성 보장: 같은 출처 연속 최대 2개
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  const picked = [];
  const srcCount = {};
  for (const it of items) {
    if (picked.length >= PER_CAT) break;
    if ((srcCount[it.src] || 0) >= 3) continue; // 출처당 최대 3
    srcCount[it.src] = (srcCount[it.src] || 0) + 1;
    picked.push(it);
  }
  return { key: c.key, name: c.name, emoji: c.emoji, items: picked };
});

const out = {
  updated: now.toISOString(),
  date: dateKST,
  notice: "기사 제목·출처·원문 링크만 제공합니다. 모든 기사의 저작권은 각 언론사에 있으며, 본문은 원문 링크에서 확인하세요.",
  categories,
};
mkdirSync("data", { recursive: true });
mkdirSync("data/news-archive", { recursive: true });
writeFileSync("data/news-cards.json", JSON.stringify(out, null, 1));
writeFileSync(`data/news-archive/${dateKST}.json`, JSON.stringify(out, null, 1));
// 아카이브 인덱스(앱의 날짜 내비게이션용)
const idxPath = "data/news-archive/index.json";
const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, "utf8")) : [];
if (!idx.includes(dateKST)) idx.push(dateKST);
idx.sort();
writeFileSync(idxPath, JSON.stringify(idx.slice(-120))); // 최근 120일 유지
console.log(`✅ feeds ${okFeeds}/${FEEDS.length} | ${categories.map(c => `${c.key}:${c.items.length}`).join(" ")} | date=${dateKST}`);
