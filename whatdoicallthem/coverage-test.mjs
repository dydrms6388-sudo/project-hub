// coverage-test.mjs — DEPLOY GATE for /whatdoicallthem
// The pack requires: "규칙 테이블 커버리지 테스트(모든 조합 결과 존재)".
// The rules engine lives inline in index.html (single-file app), so this test
// lifts the pure-logic block out of the page and exercises every combination of
// speaker gender × listener gender × relationship × formality × spouse side ×
// age gap, asserting that each one produces a usable, fully-populated result.
//
//   node whatdoicallthem/coverage-test.mjs     (run from the repo root)
//
// Exit code 0 = gate passed. Any missing title, empty explanation, empty
// caution or dangling alternative id fails the run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

// The engine block runs from the title dictionary up to the URL-state helpers.
const START = "/* ---------- title dictionary ---------- */";
const END = "/* ---------- state → URL ---------- */";
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from < 0 || to < 0 || to <= from) {
  console.error("FAIL: could not locate the engine block in index.html — did the section comments change?");
  process.exit(1);
}
const src = html.slice(from, to);

// `document` is only touched by helpers the engine never calls at load time,
// but stub it so the block evaluates cleanly under Node.
const factory = new Function("document", src + "\nreturn {T,GENDERS,RELS,SPOUSES,FORMS,resolve,band};");
const { T, GENDERS, RELS, SPOUSES, FORMS, resolve } = factory({ getElementById: () => null });

const GAPS = [-40, -22, -10, -9, -5, -2, -1, 0, 1, 2, 5, 9, 10, 22, 40];
const MY_AGE = 45; // keeps every derived age inside the 6–110 input range

const failures = [];
let combos = 0;
const primaryTitles = new Set();
const reachedTitles = new Set();

for (const me of GENDERS)
  for (const them of GENDERS)
    for (const rel of RELS)
      for (const form of FORMS)
        for (const spouse of SPOUSES)
          for (const gap of GAPS) {
            const state = {
              me: me.id, them: them.id, myAge: MY_AGE, theirAge: MY_AGE + gap,
              rel: rel.id, form: form.id, spouse: spouse.id,
            };
            const label = `${me.id}→${them.id} ${rel.id}/${form.id}/${spouse.id} gap=${gap}`;
            combos++;
            let r;
            try {
              r = resolve(state);
            } catch (e) {
              failures.push(`${label}: threw ${e.message}`);
              continue;
            }
            if (!r || !r.id) { failures.push(`${label}: no title id`); continue; }
            const t = T[r.id];
            if (!t) { failures.push(`${label}: unknown title id "${r.id}"`); continue; }
            primaryTitles.add(r.id);
            reachedTitles.add(r.id);

            if (!t.h || !t.r || !t.g) failures.push(`${label}: title "${r.id}" is missing hangul/romanization/gloss`);
            if (!r.why || r.why.length < 40) failures.push(`${label}: explanation too short`);
            if (!t.w || t.w.length < 40) failures.push(`${label}: title "${r.id}" has no usage note`);
            if (!(r.caution || t.c)) failures.push(`${label}: no caution text`);
            if (!Array.isArray(t.x) || t.x.length < 3) failures.push(`${label}: title "${r.id}" needs 3 example sentences`);
            else for (const ex of t.x) {
              if (!ex.ko || !ex.rr || !ex.en) failures.push(`${label}: title "${r.id}" has an incomplete example`);
            }
            if (!Array.isArray(r.alts) || r.alts.length === 0) failures.push(`${label}: no alternatives offered`);
            for (const a of (r.alts || [])) {
              reachedTitles.add(a.id);
              if (!T[a.id]) failures.push(`${label}: alternative points at unknown title "${a.id}"`);
              if (!a.when) failures.push(`${label}: alternative "${a.id}" has no "when" note`);
              if (a.id === r.id) failures.push(`${label}: alternative repeats the primary title`);
            }
          }

// Every entry in the dictionary must be reachable from some combination, either
// as the recommendation or as an alternative. Anything else is dead content.
const unreachable = Object.keys(T).filter((k) => !reachedTitles.has(k));

console.log(`combinations tested: ${combos}`);
console.log(`titles reached:      ${reachedTitles.size} / ${Object.keys(T).length}  (${primaryTitles.size} as the recommendation)`);
if (unreachable.length) console.log(`unreachable titles:  ${unreachable.join(", ")}`);

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 40)) console.error("  " + f);
  if (failures.length > 40) console.error(`  …and ${failures.length - 40} more`);
  process.exit(1);
}
if (unreachable.length) {
  console.error(`\nFAIL — ${unreachable.length} title(s) can never be produced by the engine.`);
  process.exit(1);
}
console.log("\nPASS — every combination resolves to a complete result.");
