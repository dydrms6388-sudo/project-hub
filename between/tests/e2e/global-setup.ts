import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

// 실행마다 E2E DB 와 업로드 디렉터리를 초기화 (개발 DB 와 완전히 분리)
export default function globalSetup() {
  rmSync(".data/e2e-uploads", { recursive: true, force: true });
  execFileSync("node", ["scripts/db-setup.mjs", "--reset"], { env: process.env, stdio: "inherit" });
}
