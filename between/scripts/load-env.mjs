// 아주 작은 .env 로더 (Next.js 밖에서 실행되는 스크립트용). 이미 설정된 환경변수는 덮어쓰지 않는다.
import { existsSync, readFileSync } from "node:fs";

export function loadEnv(files = [".env.local", ".env"]) {
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}
