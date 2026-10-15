#!/usr/bin/env node
/**
 * preview/ 에서 "모델 실행 런타임" 자산만 골라 제거한다.
 *
 * 왜: 프리뷰는 레이아웃·콘텐츠 확인용이고, 모델 실행은 어차피 프리뷰에서 안 된다
 * (onnxruntime wasm 22MB×3 을 리포에 커밋하지 않음). 그런데 이 벤더 청크들은
 *  - 합쳐서 수십 MB 라 .git(28MB) 을 몇 배로 불리고
 *  - 미니파이된 고엔트로피 문자열 때문에 GitHub 시크릿 스캐닝 오탐을 유발한다
 *    (minified @huggingface/transformers 안의 32자 문자열이 Mistral API 키로 오탐).
 *
 * 안전 조건: 초기 HTML 이 참조하지 않는 지연 로드 청크만 지운다. 페이지 렌더에는
 * 영향이 없고, 모델 실행 버튼만 실패한다 — 개별 Vercel 프로젝트 배포에서는 정상.
 */
import { readdirSync, readFileSync, statSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW = join(ROOT, "preview");

/** 이 마커가 들어 있으면 모델 실행 런타임 청크로 본다 */
const MARKERS = ["onnxruntime", "@huggingface/transformers", "huggingface/transformers", "mlc-ai", "web-llm"];

const walk = (d, out = []) => {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name);
    if (f.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

if (!existsSync(PREVIEW)) { console.log("preview/ 없음"); process.exit(0); }

let freed = 0, removed = 0;
for (const site of readdirSync(PREVIEW)) {
  const dir = join(PREVIEW, site);
  if (!statSync(dir).isDirectory()) continue;

  const files = walk(dir);
  const html = files.filter((f) => f.endsWith(".html")).map((f) => readFileSync(f, "utf8")).join("\n");

  for (const f of files) {
    const size = statSync(f).size;
    let hit = false;

    if (f.endsWith(".wasm")) hit = true;
    else if (f.endsWith(".js") && size > 200 * 1024) {
      const base = f.slice(f.lastIndexOf("/") + 1);
      // 초기 HTML 이 참조하는 청크는 절대 건드리지 않는다
      if (!html.includes(base)) {
        const txt = readFileSync(f, "utf8");
        hit = MARKERS.some((m) => txt.includes(m));
      }
    }

    if (hit) { freed += size; removed++; rmSync(f); }
  }
}
console.log(`모델 런타임 자산 ${removed}개 제거, ${(freed / 1048576).toFixed(1)}MB 절약`);
