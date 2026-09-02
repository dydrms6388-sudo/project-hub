import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/experiments.json"), "utf8"));
const slugs = data.experiments.map((e) => e.slug);

const simSrc = readdirSync(join(root, "src/lib/sims")).map((f) => readFileSync(join(root, "src/lib/sims", f), "utf8")).join("\n");
const contentSrc = readdirSync(join(root, "src/lib/content")).map((f) => readFileSync(join(root, "src/lib/content", f), "utf8")).join("\n");
const presetSrc = readFileSync(join(root, "src/lib/content/presets.ts"), "utf8");

let fail = 0;
for (const slug of slugs) {
  const has = (src) => src.includes(`"${slug}"`) || new RegExp(`\\b${slug}\\s*:`).test(src);
  const missing = [];
  if (!has(simSrc)) missing.push("sim");
  if (!has(contentSrc)) missing.push("content");
  if (!has(presetSrc)) missing.push("preset");
  if (missing.length) { console.error(`❌ ${slug}: ${missing.join(", ")}`); fail++; }
}
console.log(fail === 0 ? `✅ ${slugs.length}개 slug 전부 sim/content/preset 존재` : `${fail}개 누락`);
process.exit(fail ? 1 : 0);
