// 데이터(calculators.json/guides.json)와 코드(레지스트리·콘텐츠)의 정합 검사.
// 사용: node scripts/check-coverage.mjs  (photo-lab 디렉토리에서)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const calcs = JSON.parse(readFileSync(join(root, "data/calculators.json"), "utf8")).calculators;
const guides = JSON.parse(readFileSync(join(root, "data/guides.json"), "utf8")).guides;

const registrySrc = readFileSync(join(root, "src/lib/registry.ts"), "utf8");
const calcContentSrc = ["depth", "astro", "exposure", "misc"]
  .map((f) => readFileSync(join(root, `src/lib/content/calc/${f}.ts`), "utf8"))
  .join("\n");
const guideContentSrc = ["guides1", "guides2"]
  .map((f) => readFileSync(join(root, `src/lib/content/${f}.ts`), "utf8"))
  .join("\n");

let fail = 0;
const has = (src, slug) =>
  src.includes(`"${slug}"`) || new RegExp(`(^|\\s)${slug.replace(/-/g, "\\-")}:`, "m").test(src);

for (const c of calcs) {
  if (!has(registrySrc, c.slug) && !registrySrc.includes(`${c.slug.replace(/-/g, "")}`)) {
    console.error(`FAIL 레지스트리 누락: ${c.slug}`);
    fail++;
  }
  if (!has(calcContentSrc, c.slug)) {
    console.error(`FAIL 계산기 콘텐츠 누락: ${c.slug}`);
    fail++;
  }
}
for (const g of guides) {
  if (!has(guideContentSrc, g.slug)) {
    console.error(`FAIL 해설 콘텐츠 누락: ${g.slug}`);
    fail++;
  }
}

// 해설의 relatedCalculator가 실존하는지
const calcSlugs = new Set(calcs.map((c) => c.slug));
for (const g of guides) {
  if (!calcSlugs.has(g.relatedCalculator)) {
    console.error(`FAIL 해설 ${g.slug} 의 relatedCalculator 미존재: ${g.relatedCalculator}`);
    fail++;
  }
}

console.log(
  fail === 0
    ? `OK — 계산기 ${calcs.length} / 해설 ${guides.length} 전부 레지스트리·콘텐츠 존재`
    : `실패 ${fail}건`
);
process.exit(fail === 0 ? 0 : 1);
