// 완료 리포트용 분석: 본문 분량, 문장 유사도 상위 쌍, 도입문 중복 검사
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/illusions.json"), "utf8"));

// content TS 파일을 JS로 트랜스파일해 로드
const contentDir = join(root, "src/lib/content");
const contents = {};
let tipMap = {};
for (const f of readdirSync(contentDir)) {
  if (f === "types.ts" || f === "index.ts") continue;
  if (f === "tips.ts") {
    const src = readFileSync(join(contentDir, f), "utf8");
    const js = ts.transpileModule(src, {
      compilerOptions: { module: "commonjs", target: "es2020" },
    }).outputText;
    const mod = { exports: {} };
    new Function("exports", "require", "module", js)(mod.exports, () => ({}), mod);
    tipMap = mod.exports.tips;
    continue;
  }
  const src = readFileSync(join(contentDir, f), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: "commonjs", target: "es2020" },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", js)(mod.exports, () => ({}), mod);
  for (const v of Object.values(mod.exports)) {
    if (typeof v === "object") Object.assign(contents, v);
  }
}

// 1) 본문 분량(공백 제외 한글 기준 문자 수)
console.log("=== 본문 분량 (공백 제외 문자 수) ===");
let minLen = Infinity;
let minSlug = "";
const bodyText = {};
for (const ill of data.illusions) {
  const c = contents[ill.slug];
  if (!c) {
    console.log(`❌ ${ill.slug}: 콘텐츠 없음`);
    continue;
  }
  const all = [c.intro, c.see, c.reality, ...c.why, tipMap[ill.slug] ?? "", c.history, ...c.faq.flatMap((f) => [f.q, f.a])].join("");
  const len = all.replace(/\s/g, "").length;
  bodyText[ill.slug] = { intro: c.intro, all };
  if (len < minLen) {
    minLen = len;
    minSlug = ill.slug;
  }
  if (len < 1000) console.log(`⚠️ ${ill.slug}: ${len}자 (<1000)`);
}
console.log(`최소 분량: ${minSlug} ${minLen}자 / 항목 수 ${Object.keys(bodyText).length}`);

// 2) 도입 첫 문장 첫 어절 중복 검사
console.log("\n=== 도입문 첫 어절 ===");
const firstWords = {};
for (const [slug, { intro }] of Object.entries(bodyText)) {
  const w = intro.split(/\s+/).slice(0, 2).join(" ");
  (firstWords[w] ||= []).push(slug);
}
const dupIntro = Object.entries(firstWords).filter(([, v]) => v.length > 1);
console.log(dupIntro.length ? dupIntro : "도입 시작 표현 중복 없음");

// 3) 문장 유사도 상위 10쌍 (서로 다른 항목 간, 문자 bigram Jaccard)
const sentences = [];
for (const [slug, { all }] of Object.entries(bodyText)) {
  for (const s of all.split(/(?<=[.다요])\s+|(?<=\.)\s+/)) {
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
    const A = sets[i];
    const B = sets[j];
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    const jac = inter / (A.size + B.size - inter);
    if (jac > 0.2) pairs.push({ jac, a: sentences[i], b: sentences[j] });
  }
}
pairs.sort((x, y) => y.jac - x.jac);
console.log(`\n=== 문장 유사도 상위 10쌍 (전체 문장 ${sentences.length}개) ===`);
for (const p of pairs.slice(0, 10)) {
  console.log(
    `${(p.jac * 100).toFixed(1)}% [${p.a.slug} ↔ ${p.b.slug}]\n  A: ${p.a.t.slice(0, 60)}\n  B: ${p.b.t.slice(0, 60)}`
  );
}
if (pairs.length === 0) console.log("Jaccard 20% 초과 문장 쌍 없음");
