// 40개 slug 각각에 렌더러·SVG 도형·본문 콘텐츠가 모두 있는지 검사한다.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/illusions.json"), "utf8"));
const slugs = data.illusions.map((i) => i.slug);

const rendererSrc = readdirSync(join(root, "src/lib/renderers"))
  .map((f) => readFileSync(join(root, "src/lib/renderers", f), "utf8"))
  .join("\n");
const figureSrc = readFileSync(join(root, "src/lib/figures.tsx"), "utf8");
const contentSrc = readdirSync(join(root, "src/lib/content"))
  .map((f) => readFileSync(join(root, "src/lib/content", f), "utf8"))
  .join("\n");

let fail = 0;
for (const slug of slugs) {
  const missing = [];
  if (!rendererSrc.includes(`"${slug}"`) && !rendererSrc.includes(`${slug}:`))
    missing.push("renderer");
  if (!figureSrc.includes(`"${slug}"`) && !figureSrc.includes(`${slug}:`))
    missing.push("figure");
  if (!contentSrc.includes(`"${slug}"`) && !contentSrc.includes(`${slug}:`))
    missing.push("content");
  if (missing.length) {
    console.error(`❌ ${slug}: ${missing.join(", ")} 누락`);
    fail++;
  }
}
console.log(
  fail === 0
    ? `✅ ${slugs.length}개 slug 전부 renderer/figure/content 존재`
    : `${fail}개 slug에 누락 있음`
);
process.exit(fail ? 1 : 0);
