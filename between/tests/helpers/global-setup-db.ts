import { execFileSync } from "node:child_process";
import { TEST_ENV } from "./test-env";

// 매 실행마다 between_test DB 를 새로 만든다 (shim + 전체 마이그레이션)
export default function setup() {
  execFileSync("node", ["scripts/db-setup.mjs", "--reset"], {
    env: { ...process.env, ...TEST_ENV },
    stdio: "inherit",
  });
}
