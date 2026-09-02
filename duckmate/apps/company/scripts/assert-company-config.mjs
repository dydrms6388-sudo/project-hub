// prebuild: config/company.ts 의 플레이스홀더 키를 경고한다(exit 0, 차단 X).
// TS 실행 없이 소스 텍스트를 스캔한다 — `KEY: "{{KEY}}"` 또는 `KEY: process.env.X ?? ... ?? "{{KEY}}"` 형태.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../config/company.ts"), "utf8");
const OPTIONAL = new Set(["CONTACT_PHONE", "SNS_X", "SNS_INSTAGRAM", "FOUNDED_YEAR", "CONTACT_ENDPOINT"]);
const missing = [];
for (const m of src.matchAll(/^\s*([A-Z_]+):\s*(.+?),?\s*(?:\/\/.*)?$/gm)) {
  const [, key, expr] = m;
  if (!/\{\{[A-Z_]+\}\}/.test(expr)) continue;
  const envs = [...expr.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((e) => e[1]);
  const set = envs.some((e) => process.env[e] && process.env[e].trim() !== "");
  if (!set) missing.push(key);
}
if (missing.length) {
  const req = missing.filter((k) => !OPTIONAL.has(k));
  const opt = missing.filter((k) => OPTIONAL.has(k));
  console.warn(`⚠️  [company] 플레이스홀더 ${missing.length}개 (배포는 진행, 실서비스 전 채우세요)\n   필수: ${req.join(", ") || "-"}\n   선택: ${opt.join(", ") || "-"}`);
} else {
  console.log("✅ [company] 플레이스홀더 없음");
}
process.exit(0);
