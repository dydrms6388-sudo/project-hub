import { afterAll } from "vitest";
import { TEST_ENV } from "./test-env";

Object.assign(process.env, TEST_ENV);

afterAll(async () => {
  const { closePool } = await import("@/lib/server/db");
  await closePool();
});
