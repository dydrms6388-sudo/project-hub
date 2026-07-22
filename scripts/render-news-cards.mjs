// scripts/render-news-cards.mjs — data/news-cards.json → SNS용 1080x1080 PNG 카드
//
// 사용(CI 전용, 로컬은 @napi-rs/canvas 설치 시에만):
//   npm i --no-save @napi-rs/canvas && node scripts/render-news-cards.mjs
// 산출: news-cards/img/<date>/card-01.png … card-05.png (+ cover.png)
// 폰트: CI 에서 fonts-noto-cjk 설치 후 아래 경로에서 등록(없으면 시스템 기본).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

let createCanvas, GlobalFonts;
try { ({ createCanvas, GlobalFonts } = await import("@napi-rs/canvas")); }
catch { console.error("❌ @napi-rs/canvas 미설치 — CI 에서 npm i --no-save @napi-rs/canvas 후 실행"); process.exit(1); }

let fontRegistered = false;
for (const p of [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", // 로컬 검증용 폴백(한글 포함)
]) if (!fontRegistered && existsSync(p)) { GlobalFonts.registerFromPath(p, "NotoKR"); fontRegistered = true; }
if (!fontRegistered) console.warn("⚠️ 한글 폰트 미발견 — CI 에서는 fonts-noto-cjk 설치 필요");

const data = JSON.parse(readFileSync("data/news-cards.json", "utf8"));
const top = (data.categories.find(c => c.key === "top") || data.categories[0])?.items?.slice(0, 5) || [];
if (!top.length) { console.error("❌ 주요 카테고리 비어있음"); process.exit(1); }

const W = 1080, H = 1080;
const dir = `news-cards/img/${data.date}`;
mkdirSync(dir, { recursive: true });

const CAT_COLOR = "#f43f5e";
const font = (px, w = 700) => `${w} ${px}px NotoKR, sans-serif`;

// 한글 자동 줄바꿈(공백 우선, 초과 시 음절 단위)
function wrap(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  const push = () => { if (cur) { lines.push(cur); cur = ""; } };
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width <= maxW) { cur = t; continue; }
    if (ctx.measureText(w).width <= maxW) { push(); cur = w; continue; }
    push();
    let seg = "";
    for (const ch of w) {
      if (ctx.measureText(seg + ch).width > maxW) { lines.push(seg); seg = ch; }
      else seg += ch;
    }
    cur = seg;
  }
  push();
  return lines;
}

function drawCard(i, item) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  // 배경
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#141216"); g.addColorStop(1, "#251016");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 상단 브랜드 바
  ctx.fillStyle = CAT_COLOR; ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#9ca3af"; ctx.font = font(34, 500);
  ctx.fillText(`오늘의 카드뉴스 · ${data.date}`, 64, 108);
  ctx.fillStyle = CAT_COLOR; ctx.font = font(34, 700);
  ctx.fillText(`${i + 1}/${top.length}`, W - 64 - ctx.measureText(`${i + 1}/${top.length}`).width, 108);
  // 제목(자동 크기: 길이에 따라 62→46)
  const size = item.t.length > 55 ? 46 : item.t.length > 35 ? 54 : 62;
  ctx.font = font(size, 800);
  const lines = wrap(ctx, item.t, W - 128).slice(0, 7);
  const lh = size * 1.42;
  let y = 300;
  ctx.fillStyle = "#f5f5f5";
  for (const ln of lines) { ctx.fillText(ln, 64, y); y += lh; }
  // 출처·시각
  ctx.fillStyle = "#d4d4d8"; ctx.font = font(34, 600);
  ctx.fillText(`출처: ${item.src}`, 64, H - 170);
  ctx.fillStyle = "#8b8f98";
  const notice = "기사 본문·이미지는 게재하지 않으며, 원문은 프로필/게시글 링크에서 확인하세요.";
  let nSize = 28;
  do { ctx.font = font(nSize, 500); nSize -= 1; } while (nSize > 18 && ctx.measureText(notice).width > W - 128);
  ctx.fillText(notice, 64, H - 120);
  // 워터마크
  ctx.fillStyle = CAT_COLOR; ctx.font = font(32, 700);
  ctx.fillText("tomatoeggcat.com/news-cards", 64, H - 56);
  return canvas.toBuffer("image/png");
}

function drawCover() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1b0f14"); g.addColorStop(1, "#2b1020");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = CAT_COLOR; ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = "#f5f5f5"; ctx.font = font(96, 900);
  ctx.fillText("오늘의", 64, 300);
  ctx.fillText("카드뉴스", 64, 430);
  ctx.fillStyle = CAT_COLOR; ctx.font = font(56, 800);
  ctx.fillText(data.date, 64, 540);
  ctx.fillStyle = "#9ca3af"; ctx.font = font(36, 500);
  ctx.fillText(`주요 헤드라인 ${top.length}건 · 매일 아침 자동 발행`, 64, 640);
  ctx.fillStyle = CAT_COLOR; ctx.font = font(32, 700);
  ctx.fillText("tomatoeggcat.com/news-cards", 64, H - 56);
  return canvas.toBuffer("image/png");
}

writeFileSync(`${dir}/cover.png`, drawCover());
top.forEach((item, i) => writeFileSync(`${dir}/card-${String(i + 1).padStart(2, "0")}.png`, drawCard(i, item)));
writeFileSync(`${dir}/manifest.json`, JSON.stringify({
  date: data.date,
  images: ["cover.png", ...top.map((_, i) => `card-${String(i + 1).padStart(2, "0")}.png`)],
  items: top,
}, null, 1));
console.log(`✅ ${dir}: cover + ${top.length} cards`);
