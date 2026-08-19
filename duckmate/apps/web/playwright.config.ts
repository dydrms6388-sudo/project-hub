// =============================================================================
// G1 · Playwright 설정 (로컬 / CI 공용)
//
// 설계 원칙
//  1) **설정 로드는 어떤 환경에서도 실패하지 않는다.** Supabase env 가 하나도 없어도
//     `playwright test --list` 는 성공해야 한다(문법·수집 검증을 CI 게이트로 쓴다).
//     따라서 이 파일에서 env 를 단언(throw)하지 않는다 — 실행 전 사전조건 검사는
//     `e2e/helpers/env.ts` 가 테스트 런타임에 수행하고, 미충족이면 skip 한다.
//  2) 외부 URL(E2E_BASE_URL) 이 주어지면 로컬 dev 서버를 띄우지 않는다
//     (프리뷰/스테이징 배포 대상 실행).
//  3) 브라우저는 이미 설치돼 있다고 가정한다 — `playwright install` 을 돌리지 않는다.
//     설치 경로는 PLAYWRIGHT_BROWSERS_PATH 로 주입한다(예: /opt/pw-browsers).
//
// 실행 사전조건은 docs/agents/28_e2e.md §사전조건 참조.
// =============================================================================

import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);

/** 외부 대상이 지정되면 그 URL 을, 아니면 로컬 dev 서버를 쓴다. */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL?.trim();
const LOCAL_PORT = Number(process.env.E2E_PORT ?? 3000);
const LOCAL_BASE_URL = `http://127.0.0.1:${LOCAL_PORT}`;
const baseURL = EXTERNAL_BASE_URL && EXTERNAL_BASE_URL.length > 0 ? EXTERNAL_BASE_URL : LOCAL_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,

  // 온보딩 7스텝 + 계정 2개 생성이 한 테스트에 들어가므로 기본 타임아웃을 늘린다.
  timeout: 120_000,
  expect: { timeout: 15_000 },

  // 계정 생성·매칭이 서로의 추천 큐에 영향을 주므로 파일 간 병렬은 켜되
  // (spec 단위로 계정이 독립) 워커는 보수적으로 잡는다.
  fullyParallel: false,
  workers: CI ? 1 : Number(process.env.E2E_WORKERS ?? 1),

  forbidOnly: CI,
  retries: CI ? 2 : 0,

  // 산출물 경로는 루트 .gitignore 가 이미 무시하는 이름을 쓴다
  // (playwright-report/ · test-results/) — .gitignore 를 건드리지 않기 위해서.
  reporter: CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],

  outputDir: "test-results",

  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    // 실패한 시도에만 트레이스/스크린샷/비디오 — 용량 폭증 방지
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // PRD 는 모바일 웹 우선 — 온보딩·채팅은 모바일 뷰포트에서도 돌린다.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /(onboarding|age-gate)\.spec\.ts$/,
    },
  ],

  // 외부 대상 지정 시에는 서버를 띄우지 않는다.
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : {
        // pnpm dev = next dev (apps/web). 모노레포 루트에서 실행해도 되도록 cwd 고정.
        command: "pnpm dev",
        cwd: __dirname,
        url: LOCAL_BASE_URL,
        // 이미 띄워둔 dev 서버가 있으면 재사용(로컬 반복 실행 속도).
        reuseExistingServer: !CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          // E2E 는 항상 스텁 본인인증을 쓴다 (StubVerifier — lib/auth/identity-verifier.ts).
          // 이미 셸에 값이 있으면 그 값을 존중한다.
          IDENTITY_VERIFIER: process.env.IDENTITY_VERIFIER ?? "stub",
          NODE_ENV: "development",
        },
      },
});
