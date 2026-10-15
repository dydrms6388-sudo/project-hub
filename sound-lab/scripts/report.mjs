// 완료 리포트: 본문 분량, 도입문 중복, 문장 유사도 상위 10쌍, 코드 중복률
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/sounds.json"), "utf8"));

const contentDir = join(root, "src/lib/content");
const contents = {};
for (const f of readdirSync(contentDir)) {
  if (f === "types.ts" || f === "index.ts") continue;
  const src = readFileSync(join(contentDir, f), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: "commonjs", target: "es2020" },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", js)(mod.exports, () => ({}), mod);
  for (const v of Object.values(mod.exports))
    if (typeof v === "object") Object.assign(contents, v);
}

// 1) 본문 분량
console.log("=== 본문 분량 (공백 제외 문자 수) ===");
let minLen = Infinity, minSlug = "", total = 0;
const bodyText = {};
for (const s of data.sounds) {
  const c = contents[s.slug];
  if (!c) {
    console.log(`❌ ${s.slug}: 콘텐츠 없음`);
    continue;
  }
  const all = [c.intro, c.hear, c.signal, ...c.why, c.history, ...c.faq.flatMap((f) => [f.q, f.a])].join("");
  const len = all.replace(/\s/g, "").length;
  bodyText[s.slug] = { intro: c.intro, all };
  total += len;
  if (len < minLen) { minLen = len; minSlug = s.slug; }
  if (len < 1000) console.log(`⚠️ ${s.slug}: ${len}자 (<1000)`);
}
console.log(`항목 ${Object.keys(bodyText).length}개 / 최소 ${minSlug} ${minLen}자 / 평균 ${Math.round(total / Object.keys(bodyText).length)}자`);

// 2) 도입 첫 두 어절 중복
console.log("\n=== 도입문 첫 두 어절 중복 ===");
const firstWords = {};
for (const [slug, { intro }] of Object.entries(bodyText)) {
  const w = intro.split(/\s+/).slice(0, 2).join(" ");
  (firstWords[w] ||= []).push(slug);
}
const dup = Object.entries(firstWords).filter(([, v]) => v.length > 1);
console.log(dup.length ? dup : "중복 없음");

// 3) 문장 유사도 상위 10쌍 (문자 bigram Jaccard, 서로 다른 항목 간)
const sentences = [];
for (const [slug, { all }] of Object.entries(bodyText)) {
  for (const s of all.split(/(?<=다\.|요\.|\.)\s+/)) {
    const t = s.trim();
    if (t.length >= 20) sentences.push({ slug, t });
  }
}
const bigrams = (s) => {
  const set = new Set();
  const cs = s.replace(/\s/g, "");
  for (let i = 0; i < cs.length - 1; i++) set.add(cs.slice(i, i + 2));
  return set;
};
const sets = sentences.map((s) => bigrams(s.t));
const pairs = [];
for (let i = 0; i < sentences.length; i++) {
  for (let j = i + 1; j < sentences.length; j++) {
    if (sentences[i].slug === sentences[j].slug) continue;
    const A = sets[i], B = sets[j];
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    const jac = inter / (A.size + B.size - inter);
    if (jac > 0.15) pairs.push({ jac, a: sentences[i], b: sentences[j] });
  }
}
pairs.sort((x, y) => y.jac - x.jac);
console.log(`\n=== 문장 유사도 상위 10쌍 (전체 문장 ${sentences.length}개) ===`);
for (const p of pairs.slice(0, 10)) {
  console.log(
    `${(p.jac * 100).toFixed(1)}% [${p.a.slug} ↔ ${p.b.slug}]\n  A: ${p.a.t.slice(0, 55)}\n  B: ${p.b.t.slice(0, 55)}`
  );
}
if (pairs.length === 0) console.log("Jaccard 15% 초과 쌍 없음");

// 4) 코드 중복률 (5행 슬라이딩 윈도우, src/**.ts(x))
function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(f) && !p.includes("content")) out.push(p);
  }
  return out;
}
const files = walk(join(root, "src"));
const windows = new Map();
let totalWin = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 4 && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("import"));
  for (let i = 0; i + 5 <= lines.length; i++) {
    const key = lines.slice(i, i + 5).join("¶");
    totalWin++;
    windows.set(key, (windows.get(key) ?? 0) + 1);
  }
}
let dupWin = 0;
for (const n of windows.values()) if (n > 1) dupWin += n - 1;
console.log(
  `\n=== 코드 중복률 (5행 윈도우, content 제외) ===\n중복 윈도우 ${dupWin}/${totalWin} = ${((dupWin / totalWin) * 100).toFixed(1)}% (파일 ${files.length}개)`
);
