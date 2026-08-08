// 슬라이더 양끝값 출력 레벨 실측.
// 실제 엔진 코드(core+engines)를 tsc로 트랜스파일해 헤드리스 Chromium에서
// AudioContext로 구동하고, 마스터 체인 끝(AnalyserNode)에서 피크/RMS를 잰다.
// 사용: node scripts/measure-levels.mjs [출력파일.json]
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/sounds.json"), "utf8"));

// 1) 오디오 모듈만 브라우저용 ESM으로 트랜스파일
const work = mkdtempSync(join(tmpdir(), "sl-measure-"));
execSync(
  `npx tsc src/lib/audio/core.ts src/lib/audio/engines-perception.ts src/lib/audio/engines-synthesis.ts src/lib/audio/engines.ts ` +
    `--outDir ${work} --module esnext --target es2020 --moduleResolution bundler --skipLibCheck`,
  { cwd: root, stdio: "inherit" }
);
// tsc는 공통 루트(src/lib/audio) 기준으로 평탄하게 내보낸다
const emitted = readdirSync(work).filter((f) => f.endsWith(".js"));
for (const f of emitted) {
  const p = join(work, f);
  let src = readFileSync(p, "utf8");
  src = src.replace(/from "\.\/([a-z-]+)"/g, 'from "./$1.js"');
  writeFileSync(p, src);
}

// 2) 하네스 HTML
const harness = `<!doctype html><meta charset="utf-8"><script type="module">
import { createMasterChain } from "./core.js";
import { engines } from "./engines.js";
window.measure = async (slug, values, seconds) => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  await ctx.resume();
  const chain = createMasterChain(ctx);
  const engine = engines[slug]({ ctx, out: chain.input, values });
  const an = chain.analyser;
  const buf = new Float32Array(an.fftSize);
  let peak = 0, sumsq = 0, n = 0;
  await new Promise((r) => setTimeout(r, 200)); // 기동 트랜지언트 제외
  const t0 = performance.now();
  while (performance.now() - t0 < seconds * 1000) {
    an.getFloatTimeDomainData(buf);
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]);
      if (a > peak) peak = a;
      sumsq += buf[i] * buf[i];
      n++;
    }
    await new Promise((r) => setTimeout(r, 35));
  }
  try { engine.stop(); } catch {}
  chain.dispose();
  await ctx.close();
  return { peak, rms: Math.sqrt(sumsq / Math.max(1, n)) };
};
window.ready = true;
</script>`;
writeFileSync(join(work, "harness.html"), harness);

// 3) file:// 모듈 CORS 제한 회피용 간이 HTTP 서버
const { createServer } = await import("node:http");
const server = createServer((req, res) => {
  const path = join(work, req.url === "/" ? "harness.html" : req.url.slice(1));
  try {
    const body = readFileSync(path);
    res.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : "text/html");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("nf");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// 4) Chromium 구동
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/harness.html`);
await page.waitForFunction("window.ready === true");

// 스케줄 주기가 긴 항목은 측정 창을 늘린다
const LONG = new Set([
  "tritone-paradox", "pitch-jnd", "equal-loudness", "zwicker-tone",
  "adsr-envelope", "reverb-convolution", "haas-effect", "continuity-illusion",
  "gap-detection", "delay-echo", "karplus-strong", "masking",
]);

const results = [];
for (const s of data.sounds) {
  const defaults = s.params.map((p) => p.default);
  const configs = [
    { label: "default", values: defaults },
    { label: "all-min", values: s.params.map((p) => p.min) },
    { label: "all-max", values: s.params.map((p) => p.max) },
    ...s.params.flatMap((p, i) => [
      { label: `min:${p.name}`, values: defaults.map((d, j) => (j === i ? p.min : d)) },
      { label: `max:${p.name}`, values: defaults.map((d, j) => (j === i ? p.max : d)) },
    ]),
  ];
  for (const c of configs) {
    const dur = LONG.has(s.slug) ? 2.6 : 1.2;
    const r = await page.evaluate(
      ([slug, values, seconds]) => window.measure(slug, values, seconds),
      [s.slug, c.values, dur]
    );
    const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : "-inf");
    results.push({ slug: s.slug, config: c.label, peak: r.peak, peakDb: db(r.peak), rmsDb: db(r.rms) });
    process.stdout.write(
      `${s.slug} ${c.label}: peak ${db(r.peak)} dBFS, rms ${db(r.rms)} dBFS\n`
    );
  }
}
await browser.close();
server.close();

const outFile = process.argv[2] ?? join(root, "scripts/levels.json");
writeFileSync(outFile, JSON.stringify(results, null, 1));
const worst = [...results].sort((a, b) => b.peak - a.peak).slice(0, 12);
console.log("\n피크 상위 12:");
for (const w of worst) console.log(`  ${w.peakDb} dBFS  ${w.slug} [${w.config}]`);
const over = results.filter((r) => r.peak > 0.891); // -1 dBFS
console.log(over.length ? `\n⚠ -1dBFS 초과 ${over.length}건` : "\n전 구성 -1 dBFS 이하 ✔");
