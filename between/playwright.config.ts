import { defineConfig, devices } from "@playwright/test";

// E2E: 격리된 between_e2e DB + 별도 저장소 디렉터리로 프로덕션 빌드를 띄워 실행한다.
const PORT = 3200;
const env = {
  APP_ORIGIN: `http://localhost:${PORT}`,
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://between_app:between_app@localhost:5432/between_e2e",
  DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres",
  AUTH_PROVIDER: "local",
  STORAGE_PROVIDER: "local",
  LOCAL_STORAGE_DIR: ".data/e2e-uploads",
  LOCAL_JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
  CRON_SECRET: "e2e-cron",
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: env.APP_ORIGIN, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "iphone-13", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "iphone-se", use: { ...devices["iPhone SE"], browserName: "chromium" } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${env.APP_ORIGIN}/start`,
    reuseExistingServer: false,
    timeout: 240_000,
    env,
  },
});
