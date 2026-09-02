// 40개 slug 각각에 renderer·content·presets가 모두 있는지 검사한다.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/patterns.json"), "utf8"));
const slugs = data.patterns.map((p) => p.slug);

const rendererSrc =
  readdirSync(join(root, "src/lib/renderers"))
    .map((f) => readFileSync(join(root, "src/lib/renderers", f), "utf8"))
    .join("\n") +
  readFileSync(join(root, "src/lib/core/raster.ts"), "utf8");
const contentSrc = readdirSync(join(root, "src/lib/content"))
  .map((f) => readFileSync(join(root, "src/lib/content", f), "utf8"))
  .join("\n");
const presetSrc = readFileSync(join(root, "src/lib/content/presets.ts"), "utf8");

let fail = 0;
for (const slug of slugs) {
  const missing = [];
  const has = (src) => src.includes(`"${slug}"`) || new RegExp(`\\b${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:`).test(src);
  if (!has(rendererSrc)) missing.push("renderer");
  if (!has(contentSrc)) missing.push("content");
  if (!has(presetSrc)) missing.push("preset");
  if (missing.length) {
    console.error(`❌ ${slug}: ${missing.join(", ")} 누락`);
    fail++;
  }
}
console.log(
  fail === 0
    ? `✅ ${slugs.length}개 slug 전부 renderer/content/preset 존재`
    : `${fail}개 slug 누락`
);
process.exit(fail ? 1 : 0);
