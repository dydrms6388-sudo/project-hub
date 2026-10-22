// 통합 테스트 전용 격리 DB / 저장소 (개발 DB 와 분리)
export const TEST_ENV = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://between_app:between_app@localhost:5432/between_test",
  DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres",
  AUTH_PROVIDER: "local",
  STORAGE_PROVIDER: "local",
  LOCAL_STORAGE_DIR: ".data/test-uploads",
  LOCAL_JWT_SECRET: "integration-test-secret-integration-test-secret",
  APP_ORIGIN: "http://localhost:3000",
};
