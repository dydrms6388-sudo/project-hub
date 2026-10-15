/**
 * Playwright 설정 (G1).
 *  - project `smoke`  : Supabase 없이 항상 실행(더미 env + 개발 목 라우트 /dev/*). `pnpm e2e:smoke`
 *  - project `phase1` : 실 Supabase(로컬 `supabase start` 또는 스테이징)가 있을 때만. `E2E_SUPABASE=1` 이 아니면 spec 안에서 skip.
 *  - webServer: `next dev -p 3100` (dev 라우트 필요). 산출물 폴더는 `NEXT_DIST_DIR=.next-e2e` 로 분리(동시 build 와 충돌 방지).
 *  - 브라우저: /opt/pw-browsers(PLAYWRIGHT_BROWSERS_PATH) 의 chromium 을 그대로 사용 — `npx playwright install` 금지.
 * env:
 *  E2E_PORT(3100) · E2E_BASE_URL(서버를 직접 띄운 경우, webServer 생략) · E2E_REUSE_SERVER=1(기존 서버 재사용)
 *  E2E_SUPABASE=1 + NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY(테스트 헬퍼 전용) → phase1 실행
 *  E2E_CHROMIUM_PATH(선택) — 자동 탐색 실패 시 chromium 실행 파일 경로
 */
import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const REAL = process.env.E2E_SUPABASE === "1";

/** PLAYWRIGHT_BROWSERS_PATH(/opt/pw-browsers) 안의 chromium-<rev>/chrome-linux/chrome (headless shell 은 제외) */
function findChromium(): string | undefined {
  if (process.env.E2E_CHROMIUM_PATH) return process.env.E2E_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse();
  for (const d of dirs) {
    for (const rel of ["chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe"]) {
      const p = join(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const executablePath = findChromium();

/** 더미 env: lib/env.ts publicEnv() 필수 키(URL·anon) + 서버 액션이 읽는 serverEnv() 필수 키(service role ≥ 20자) */
const DUMMY_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key-for-e2e",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key-for-e2e",
  IDENTITY_VERIFIER: "mock",
  NEXT_PUBLIC_SITE_URL: BASE_URL,
};

function webServerEnv(): Record<string, string> {
  const passthrough = Object.fromEntries(Object.entries(process.env).filter((kv): kv is [string, string] => typeof kv[1] === "string"));
  const base = REAL ? passthrough : { ...passthrough, ...DUMMY_ENV };
  return { ...base, NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" };
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "smoke", testMatch: /smoke\.spec\.ts/ },
    { name: "phase1", testMatch: /phase1\.spec\.ts/, timeout: 300_000 },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next dev -p ${PORT}`,
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
        env: webServerEnv(),
      },
});
