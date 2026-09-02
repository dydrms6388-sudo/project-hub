/**
 * 더미 env 세트 — apps/web 을 Supabase 없이 build/start 하기 위한 최소 값 (lib/env.ts zod 스키마 통과용).
 *  실제 네트워크 연결은 일어나지 않는다(세션 쿠키가 없으면 getUser 가 로컬에서 실패 → 비로그인 취급).
 *  G1(E2E)·G3(배포 후 검증)도 같은 세트를 쓴다. 비밀값 아님.
 */
export const DUMMY_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy-anon-key-0123456789abcdef",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key-0123456789abcdef",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_COMPANY_URL: "http://localhost:3001",
  AUTH_GATE_SECRET: "dummy-gate-secret-0123456789abcdef",
};

/** Playwright 번들 크로미움 대신 사용할 실행 파일(샌드박스: /opt/pw-browsers). 없으면 undefined → Playwright 기본 */
export const CHROMIUM_CANDIDATES = [
  process.env.PW_CHROMIUM_PATH,
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
].filter(Boolean);
