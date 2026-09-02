// 법적 표현 가드 — docs/00-legal-expression-guide.md 의 금지 표현이 화면 코드에 있으면 실패.
// 실행: node scripts/check-expressions.mjs   (npm run lint:expr / CI)
// 허용 예외: 문장 안에 "금지" "않" "권유하지" 같이 부정 맥락이 같은 줄에 있으면 통과(면책 문구용).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".md", ".mdx", ".json"]);
const BANNED = [
  /매수\s*추천/, /매도\s*추천/, /추천\s*종목/, /적극\s*매수/, /강력\s*매수/, /지금\s*사세요/, /지금\s*팔/,
  /수익\s*보장/, /원금\s*보장/, /확정\s*수익/, /무조건\s*(오른|상승|수익)/, /반드시\s*(오른|상승|수익)/, /필승/,
  /목표가\s*제시/, /급등\s*예상/, /급등주/, /대박/, /따라\s*사/, /리딩/,
  /\bbuy\s+recommendation\b/i, /\bstrong\s+buy\b/i, /\bguaranteed\s+return/i,
];
const NEGATION = /(금지|않|권유하지|아닙니다|아니며|없습니다|보장하지)/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== "node_modules" && name !== ".next") walk(p, out); }
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

let violations = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const re of BANNED) {
        if (re.test(line) && !NEGATION.test(line)) {
          violations++;
          console.error(`✗ ${file}:${i + 1} 금지 표현 [${re.source}] → ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }
}
if (violations) { console.error(`\n${violations}건의 금지 표현. docs/00-legal-expression-guide.md 참고.`); process.exit(1); }
console.log("✓ 금지 표현 없음");
