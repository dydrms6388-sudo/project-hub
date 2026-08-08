// 콘텐츠 커버리지·규칙 검사기.
// slug 40개 전부에 콘텐츠·엔진이 있는지, 본문 1,000자·FAQ 3·프리셋 3·related 3,
// 금지 표현, 프리셋 범위, 도입 문장 중복을 검사한다.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/sounds.json"), "utf8"));
const slugs = data.sounds.map((s) => s.slug);

// TS 파일을 간이 파싱하지 않고, tsx 없이 검사하기 위해 문자열로 평가한다.
// content 파일은 순수 리터럴이므로 import 구문만 제거하면 JS로 실행 가능.
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

const engineSrc =
  readFileSync(join(root, "src/lib/audio/engines-perception.ts"), "utf8") +
  readFileSync(join(root, "src/lib/audio/engines-synthesis.ts"), "utf8");

const BANNED = ["신기", "놀랍", "놀라운", "신비", "광고 영역", "REPLACE_"];
const problems = [];
const introFirsts = new Map();
const orderCounts = new Map();

for (const s of data.sounds) {
  const c = all[s.slug];
  if (!c) {
    problems.push(`${s.slug}: 콘텐츠 없음`);
    continue;
  }
  if (!engineSrc.includes(`"${s.slug}"`) && !engineSrc.includes(`${s.slug}:`)) {
    problems.push(`${s.slug}: 엔진 없음`);
  }
  const body = [c.intro, c.hear, c.signal, c.why, c.history].join("");
  if (body.length < 1000) problems.push(`${s.slug}: 본문 ${body.length}자 (<1000)`);
  const everything = body + JSON.stringify(c.faq);
  for (const b of BANNED) {
    if (everything.includes(b)) problems.push(`${s.slug}: 금지 표현 "${b}"`);
  }
  if (c.faq.length !== 3) problems.push(`${s.slug}: FAQ ${c.faq.length}개`);
  if (c.presets.length !== 3) problems.push(`${s.slug}: 프리셋 ${c.presets.length}개`);
  for (const p of c.presets) {
    if (p.values.length !== s.params.length) {
      problems.push(`${s.slug}: 프리셋 "${p.name}" 값 개수 ${p.values.length}≠${s.params.length}`);
      continue;
    }
    p.values.forEach((v, i) => {
      const spec = s.params[i];
      if (v < spec.min || v > spec.max)
        problems.push(`${s.slug}: 프리셋 "${p.name}" ${spec.name}=${v} 범위 밖`);
      const k = (v - spec.min) / spec.step;
      if (Math.abs(k - Math.round(k)) > 1e-6)
        problems.push(`${s.slug}: 프리셋 "${p.name}" ${spec.name}=${v} step 미정렬`);
    });
  }
  if (c.related.length !== 3) problems.push(`${s.slug}: related ${c.related.length}개`);
  for (const r of c.related) {
    if (!slugs.includes(r)) problems.push(`${s.slug}: related "${r}" 미존재`);
    if (r === s.slug) problems.push(`${s.slug}: related 자기 참조`);
  }
  const first = c.intro.split(/[.?!]/)[0].slice(0, 12);
  if (introFirsts.has(first))
    problems.push(`${s.slug}: 도입 첫머리 "${first}" 중복 (${introFirsts.get(first)})`);
  introFirsts.set(first, s.slug);
  const key = c.sectionOrder.join(",");
  orderCounts.set(key, (orderCounts.get(key) ?? 0) + 1);
}

console.log(`콘텐츠 ${Object.keys(all).length}/${slugs.length}개, 섹션 순서 종류 ${orderCounts.size}가지`);
if (problems.length) {
  console.log("문제:");
  for (const p of problems) console.log(" -", p);
  process.exit(1);
} else {
  console.log("모든 규칙 통과 ✔");
}
