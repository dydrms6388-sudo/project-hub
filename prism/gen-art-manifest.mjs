// prism/art/ 폴더를 스캔해 art-manifest.js 재생성
// 사용: node prism/gen-art-manifest.mjs   (파일명 규칙: c001.webp / c001.png / c01.webp ...)
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const artDir = join(dir, "art");
if (!existsSync(artDir)) { mkdirSync(artDir); console.log("art/ 폴더 생성 — 일러스트를 넣고 다시 실행하세요"); }

const map = {};
for (const f of (existsSync(artDir) ? readdirSync(artDir) : [])) {
  const m = f.match(/^(c\d{2,3})\.(webp|png|jpg|jpeg|avif)$/i);
  if (m) map[m[1]] = f;
}
writeFileSync(join(dir, "art-manifest.js"),
  `/* 자동 생성 — node prism/gen-art-manifest.mjs */\nwindow.PRISM_CARD_ART = ${JSON.stringify(map, null, 1)};\n`);
console.log(`art-manifest.js 갱신: ${Object.keys(map).length}장 등록`);
