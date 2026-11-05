import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** 실 Supabase 연결 여부 (phase1.spec 게이트) */
export const REAL_SUPABASE = process.env.E2E_SUPABASE === "1";

export const ARTIFACTS_DIR = join(__dirname, "..", "artifacts");

let counter = 0;
/** 단계별 스크린샷을 e2e/artifacts/<prefix>-NN-<name>.png 로 저장 (전체 페이지) */
export async function shot(page: Page, prefix: string, name: string): Promise<string> {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  counter += 1;
  const file = join(ARTIFACTS_DIR, `${prefix}-${String(counter).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** window.dataLayer 의 event 이름 목록 (E1 결정 22) */
export async function dataLayerEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dl = (window as unknown as { dataLayer?: Array<{ event?: string }> }).dataLayer ?? [];
    return dl.map((e) => String(e.event ?? ""));
  });
}
