// 완료 리포트: 본문 분량, 문장 유사도 상위 10쌍, 도입문 중복
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/patterns.json"), "utf8"));
const dir = join(root, "src/lib/content");
const load = (file) => {
  const src = readFileSync(join(dir, file), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: "commonjs", target: "es2020" } }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", js)(mod.exports, () => ({}), mod);
  return mod.exports;
};
const contents = {};
for (const f of ["curvesSpirals.ts", "fractals.ts", "tilingsFields.ts", "chaosNumber.ts"]) {
  for (const v of Object.values(load(f))) if (typeof v === "object") Object.assign(contents, v);
}
const applications = load("applications.ts").applications;

console.log("=== 본문 분량 (공백 포함) ===");
const bodies = {};
let min = Infinity, minSlug = "", under = 0;
for (const p of data.patterns) {
  const c = contents[p.slug];
  if (!c) { console.log("❌ 콘텐츠 없음:", p.slug); continue; }
  const all = [c.intro, c.formula.expr, ...c.formula.explain, c.history, c.extremes, applications[p.slug] ?? "", ...c.faq.flatMap((f) => [f.q, f.a])].join(" ");
  bodies[p.slug] = { intro: c.intro, all };
  if (all.length < 1000) { under++; console.log("⚠️", p.slug, all.length); }
  if (all.length < min) { min = all.length; minSlug = p.slug; }
}
console.log(`최소: ${minSlug} ${min}자 / 1000자 미만 ${under}개 / 총 ${Object.keys(bodies).length}`);

console.log("\n=== 도입문 첫 두 어절 중복 ===");
const fw = {};
for (const [s, { intro }] of Object.entries(bodies)) {
  const k = intro.split(/\s+/).slice(0, 2).join(" ");
  (fw[k] ||= []).push(s);
}
const dup = Object.entries(fw).filter(([, v]) => v.length > 1);
console.log(dup.length ? dup : "중복 없음");

const sentences = [];
for (const [s, { all }] of Object.entries(bodies))
  for (const t of all.split(/(?<=[.다요])\s+/)) if (t.trim().length >= 20) sentences.push({ s, t: t.trim() });
const bg = (str) => {
  const set = new Set();
  const cs = str.replace(/\s/g, "");
  for (let i = 0; i < cs.length - 1; i++) set.add(cs.slice(i, i + 2));
  return set;
};
const sets = sentences.map((x) => bg(x.t));
const pairs = [];
for (let i = 0; i < sentences.length; i++)
  for (let j = i + 1; j < sentences.length; j++) {
    if (sentences[i].s === sentences[j].s) continue;
    let inter = 0;
    for (const g of sets[i]) if (sets[j].has(g)) inter++;
    const jac = inter / (sets[i].size + sets[j].size - inter);
    if (jac > 0.2) pairs.push({ jac, a: sentences[i], b: sentences[j] });
  }
pairs.sort((x, y) => y.jac - x.jac);
console.log(`\n=== 문장 유사도 상위 10쌍 (총 문장 ${sentences.length}) ===`);
for (const p of pairs.slice(0, 10))
  console.log(`${(p.jac * 100).toFixed(1)}% [${p.a.s}↔${p.b.s}]\n  A:${p.a.t.slice(0, 54)}\n  B:${p.b.t.slice(0, 54)}`);
if (!pairs.length) console.log("20% 초과 없음");
