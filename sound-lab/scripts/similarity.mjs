// 문장 유사도 검사 — 40개 항목 본문(intro+hear+signal+why+history)을
// 2-gram 자카드 유사도로 전수 비교해 상위 10쌍을 출력한다.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadContent(file) {
  let src = readFileSync(join(root, "src/lib/content", file), "utf8");
  src = src.replace(/import type .*?;\n/g, "");
  src = src.replace(/const content: Record<string, SoundContent>/, "const content");
  src = src.replace(/export default content;/, "");
  return new Function(`${src}; return content;`)();
}

const files = readdirSync(join(root, "src/lib/content")).filter(
  (f) => f.endsWith(".ts") && !["types.ts", "index.ts"].includes(f)
);
const all = {};
for (const f of files) Object.assign(all, loadContent(f));

function bigrams(text) {
  const t = text.replace(/\s+/g, "");
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const entries = Object.entries(all).map(([slug, c]) => [
  slug,
  bigrams([c.intro, c.hear, c.signal, c.why, c.history].join(" ")),
]);

const pairs = [];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    pairs.push({
      a: entries[i][0],
      b: entries[j][0],
      sim: jaccard(entries[i][1], entries[j][1]),
    });
  }
}
pairs.sort((x, y) => y.sim - x.sim);
console.log("본문 2-gram 자카드 유사도 상위 10쌍:");
for (const p of pairs.slice(0, 10)) {
  console.log(`  ${(p.sim * 100).toFixed(1)}%  ${p.a} ↔ ${p.b}`);
}
const avg = pairs.reduce((s, p) => s + p.sim, 0) / pairs.length;
console.log(`전체 평균: ${(avg * 100).toFixed(1)}% (쌍 ${pairs.length}개)`);
