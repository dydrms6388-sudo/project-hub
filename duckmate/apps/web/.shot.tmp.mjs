import { chromium } from "@playwright/test";
const base = process.env.BASE; const out = process.env.OUT;
const targets = JSON.parse(process.env.TARGETS);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: "ko-KR" });
for (const [path, file] of targets) {
  const page = await ctx.newPage();
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => { console.error(path, e.message); return null; });
  console.log(path, res?.status());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
  await page.close();
}
await browser.close();
