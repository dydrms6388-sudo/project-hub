// 슬라이더 양끝값 출력 레벨 실측 (Playwright + 실제 빌드 페이지)
// 사용: node scripts/measure-levels.mjs  (사전: npm run build 로 out/ 생성)
import { createServer } from "node:http";
import { readFileSync, existsSync, readFileSync as rf } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
const data = JSON.parse(readFileSync(join(root, "data/sounds.json"), "utf8"));

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".txt": "text/plain",
  ".xml": "application/xml", ".otf": "font/otf",
};
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(out, p);
  if (p.endsWith("/")) file = join(out, p, "index.html");
  if (!existsSync(file)) file = join(out, p, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("nf");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(rf(file));
});
await new Promise((r) => server.listen(4173, r));

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
  ],
});
const page = await browser.newPage();
page.setDefaultTimeout(15000);

const results = [];
for (const s of data.sounds) {
  const url = `http://127.0.0.1:4173/sound/${s.slug}/`;
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    // 볼륨 배너 확인 버튼이 있으면 누르고 재생
    const ack = page.locator(".volume-banner button");
    if (await ack.count()) await ack.click();
    await page.locator(".btn-play").click();
    await page.waitForFunction(() => typeof window.__soundlab !== "undefined");

    const measure = async (params, settleMs) => {
      await page.evaluate((p) => window.__soundlab.setParams(p), params);
      await page.waitForTimeout(settleMs);
      // 주기적 소스(최대 1.6초 주기)도 잡히도록 1800ms 동안 최대 피크 수집
      return page.evaluate(async () => {
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 1800) {
          peak = Math.max(peak, window.__soundlab.getPeak());
          await new Promise((r) => setTimeout(r, 16));
        }
        return peak;
      });
    };

    const mins = Object.fromEntries(s.params.map((p) => [p.name, p.min]));
    const maxs = Object.fromEntries(s.params.map((p) => [p.name, p.max]));
    const defs = Object.fromEntries(s.params.map((p) => [p.name, p.default]));

    const pkDef = await measure(defs, 600);
    const pkMin = await measure(mins, 800);
    const pkMax = await measure(maxs, 800);
    const worst = Math.max(pkDef, pkMin, pkMax);
    const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : "-inf");
    results.push({ slug: s.slug, pkDef, pkMin, pkMax, worst });
    console.log(
      `${s.slug.padEnd(24)} def ${db(pkDef).padStart(6)} dB / min ${db(pkMin).padStart(6)} dB / max ${db(pkMax).padStart(6)} dB ${worst > 0.98 ? " ⚠️ 클리핑 위험" : ""}`
    );
  } catch (e) {
    console.log(`${s.slug.padEnd(24)} ❌ 측정 실패: ${String(e).slice(0, 90)}`);
    results.push({ slug: s.slug, error: true });
  }
}

const ok = results.filter((r) => !r.error);
const over = ok.filter((r) => r.worst > 0.98);
const globalMax = Math.max(...ok.map((r) => r.worst));
console.log(
  `\n측정 ${ok.length}/${data.sounds.length}개 성공 / 전체 최대 피크 ${(20 * Math.log10(globalMax)).toFixed(1)} dBFS / 0.98 초과(클리핑 위험) ${over.length}건`
);
if (over.length) console.log("초과:", over.map((r) => r.slug).join(", "));

await browser.close();
server.close();
process.exit(0);
