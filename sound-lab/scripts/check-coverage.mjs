// 커버리지·정합성 검사: 빌더 등록, 콘텐츠 존재, 프리셋 범위/step, 관련 링크
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/sounds.json"), "utf8"));
let fail = 0;
const err = (m) => {
  console.log(`❌ ${m}`);
  fail++;
};

// 1) 빌더 등록 확인 (키 텍스트 스캔)
const builderSrc = ["illusion", "psycho", "spatial", "synthesis"]
  .map((f) => readFileSync(join(root, `src/lib/audio/builders/${f}.ts`), "utf8"))
  .join("\n");
for (const s of data.sounds) {
  const quoted = builderSrc.includes(`"${s.slug}":`);
  const bare = new RegExp(`(^|\\s)${s.slug.replace(/-/g, "\\-")}:\\s*\\(`, "m").test(builderSrc);
  if (!quoted && !bare) err(`빌더 없음: ${s.slug}`);
}

// 2) 콘텐츠 로드 (TS 트랜스파일)
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

// 3) 항목별 검사
for (const s of data.sounds) {
  const c = contents[s.slug];
  if (!c) {
    err(`콘텐츠 없음: ${s.slug}`);
    continue;
  }
  for (const k of ["intro", "hear", "signal", "history"])
    if (typeof c[k] !== "string" || c[k].length < 30)
      err(`${s.slug}.${k} 누락/부족`);
  if (!Array.isArray(c.why) || c.why.length < 2) err(`${s.slug}.why < 2개`);
  if (!Array.isArray(c.faq) || c.faq.length !== 3) err(`${s.slug}.faq ≠ 3개`);
  if (!Array.isArray(c.presets) || c.presets.length !== 3)
    err(`${s.slug}.presets ≠ 3개`);
  const specs = Object.fromEntries(s.params.map((p) => [p.name, p]));
  for (const pr of c.presets ?? []) {
    for (const [k, v] of Object.entries(pr.params ?? {})) {
      const spec = specs[k];
      if (!spec) {
        err(`${s.slug} 프리셋 '${pr.name}': 없는 파라미터 ${k}`);
        continue;
      }
      if (v < spec.min || v > spec.max)
        err(`${s.slug} 프리셋 '${pr.name}': ${k}=${v} 범위 밖 [${spec.min},${spec.max}]`);
      const steps = (v - spec.min) / spec.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-6)
        err(`${s.slug} 프리셋 '${pr.name}': ${k}=${v} step(${spec.step}) 불일치`);
    }
  }
}

// 4) related 링크 무결성 (sounds.ts의 RELATED 텍스트 스캔)
const soundsTs = readFileSync(join(root, "src/lib/sounds.ts"), "utf8");
const slugSet = new Set(data.sounds.map((s) => s.slug));
for (const s of data.sounds) {
  if (!soundsTs.includes(`"${s.slug}": [`)) err(`RELATED 누락: ${s.slug}`);
}
const relRefs = [...soundsTs.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
for (const r of relRefs) {
  if (r.includes("-") && r.length > 3 && !slugSet.has(r)) {
    // slug 형태인데 목록에 없는 참조 — 오탐 가능성 있는 항목은 무시 목록으로
    const ignore = new Set(["sound-lab", "apple-sd", "noto-sans", "pretendard-variable", "claude-code", "ko-kr"]);
    if (!ignore.has(r) && /^[a-z]+(-[a-z0-9]+)+$/.test(r) && !r.startsWith("btn"))
      console.log(`(참고) RELATED에 목록 외 참조 가능성: ${r}`);
  }
}

console.log(
  fail === 0
    ? `✅ 통과: 항목 ${data.sounds.length}개, 빌더·콘텐츠·프리셋 정합`
    : `실패 ${fail}건`
);
process.exit(fail === 0 ? 0 : 1);
