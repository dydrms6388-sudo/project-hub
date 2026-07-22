// scripts/post-social.mjs — 오늘의 카드뉴스 PNG 를 Instagram/Facebook 에 자동 게시
//
// 필요 시크릿(GitHub Actions Secrets — 하나라도 없으면 조용히 스킵):
//   META_ACCESS_TOKEN : 장기 페이지 액세스 토큰 (pages_manage_posts, instagram_content_publish 등)
//   META_PAGE_ID      : Facebook 페이지 ID
//   META_IG_USER_ID   : Instagram 비즈니스/크리에이터 계정 ID (페이지에 연결돼 있어야 함)
// 설정 방법은 SOCIAL-SETUP.md 참고.
//
// 동작:
//   1) 사이트 배포 후 공개 URL(https://tomatoeggcat.com/news-cards/img/<date>/...)이 200 될 때까지 대기
//   2) Instagram: cover+카드 최대 5장 캐러셀 게시(실패 시 cover 단일 게시로 폴백)
//   3) Facebook 페이지: cover 사진 + 헤드라인 캡션 게시
import { readFileSync } from "node:fs";

const TOKEN = process.env.META_ACCESS_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const IG_ID = process.env.META_IG_USER_ID;
const SITE = "https://tomatoeggcat.com";
const GRAPH = "https://graph.facebook.com/v21.0";

if (!TOKEN || (!PAGE_ID && !IG_ID)) {
  console.log("ℹ️ META_* 시크릿 미설정 — SNS 게시 스킵 (SOCIAL-SETUP.md 참고해 활성화)");
  process.exit(0);
}

const data = JSON.parse(readFileSync("data/news-cards.json", "utf8"));
const manifest = JSON.parse(readFileSync(`news-cards/img/${data.date}/manifest.json`, "utf8"));
const base = `${SITE}/news-cards/img/${data.date}`;
const urls = manifest.images.map(f => `${base}/${f}`);
const top = manifest.items;

const caption = [
  `🗞️ 오늘의 카드뉴스 · ${data.date}`,
  "",
  ...top.map((it, i) => `${i + 1}. ${it.t} (${it.src})`),
  "",
  "원문 링크·전체 브리핑 👉 tomatoeggcat.com/news-cards",
  "기사 저작권은 각 언론사에 있습니다. 제목·출처만 인용하며 본문은 원문에서 확인하세요.",
  "#뉴스 #카드뉴스 #오늘의뉴스 #헤드라인 #뉴스브리핑",
].join("\n");

const api = async (path, params) => {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: TOKEN }),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`${path}: ${JSON.stringify(j.error || j)}`);
  return j;
};

// 1) 배포 완료 대기 (최대 12분)
async function waitPublic(url) {
  for (let i = 0; i < 36; i++) {
    try { const r = await fetch(url, { method: "HEAD" }); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 20000));
  }
  return false;
}
if (!(await waitPublic(urls[0]))) {
  console.error(`❌ 이미지 공개 URL 미응답: ${urls[0]} — 게시 중단(다음 크론에서 재시도됨)`);
  process.exit(1);
}

// 2) Instagram 캐러셀
if (IG_ID) {
  try {
    const use = urls.slice(0, 6); // cover + 카드 5
    const children = [];
    for (const u of use) {
      const c = await api(`/${IG_ID}/media`, { image_url: u, is_carousel_item: "true" });
      children.push(c.id);
    }
    const carousel = await api(`/${IG_ID}/media`, {
      media_type: "CAROUSEL", children: children.join(","), caption,
    });
    // 컨테이너 처리 대기 후 게시
    await new Promise(r => setTimeout(r, 15000));
    const pub = await api(`/${IG_ID}/media_publish`, { creation_id: carousel.id });
    console.log(`✅ Instagram 캐러셀 게시: ${pub.id}`);
  } catch (e) {
    console.warn(`⚠️ IG 캐러셀 실패 → 단일 이미지 폴백: ${e.message}`);
    try {
      const c = await api(`/${IG_ID}/media`, { image_url: urls[0], caption });
      await new Promise(r => setTimeout(r, 10000));
      const pub = await api(`/${IG_ID}/media_publish`, { creation_id: c.id });
      console.log(`✅ Instagram 단일 게시: ${pub.id}`);
    } catch (e2) { console.error(`❌ Instagram 게시 실패: ${e2.message}`); process.exitCode = 1; }
  }
}

// 3) Facebook 페이지
if (PAGE_ID) {
  try {
    const post = await api(`/${PAGE_ID}/photos`, { url: urls[0], caption });
    console.log(`✅ Facebook 게시: ${post.post_id || post.id}`);
  } catch (e) { console.error(`❌ Facebook 게시 실패: ${e.message}`); process.exitCode = 1; }
}
