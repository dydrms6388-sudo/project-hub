// 법적 고지 플레이스홀더 잔재 검사 — 빌드 차단은 하지 않고 경고만 낸다 (절대 규칙 4).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// cwd 무관하게 저장소 루트 기준으로 스캔 (apps/company prebuild 처럼 하위 폴더에서 실행돼도 동일)
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ROOTS = ["apps/web/content/legal", "apps/web/config", "apps/company/config", "apps/company/content"];
const PATTERNS = [/\[TODO_[A-Z가-힣_]+\]/g, /\{\{[A-Z_]+\}\}/g];
// 설명 문서(변수표 README)는 토큰을 예시로 싣고 있으므로 제외
const SKIP_FILES = new Set(["README.md"]);
const found = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(p); continue; }
    if (!/\.(md|mdx|ts|tsx|json)$/.test(e)) continue;
    if (SKIP_FILES.has(e)) continue;
    const src = readFileSync(p, "utf8");
    for (const re of PATTERNS) {
      const m = src.match(re);
      if (m) found.push({ file: p, tokens: [...new Set(m)] });
    }
  }
}
ROOTS.forEach((r) => walk(join(REPO_ROOT, r)));

if (found.length) {
  console.warn("⚠️  [legal] 미입력 사업자/법적 정보 플레이스홀더가 남아 있습니다 (배포는 진행되지만 실서비스 전 반드시 채우세요):");
  for (const f of found) console.warn(`   - ${relative(REPO_ROOT, f.file)}: ${f.tokens.join(", ")}`);
} else {
  console.log("✅ [legal] 플레이스홀더 없음");
}
process.exit(0);
