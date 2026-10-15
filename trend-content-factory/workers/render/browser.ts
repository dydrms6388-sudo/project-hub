// Playwright Chromium 런처. 이 환경은 사전설치 브라우저(빌드 1194)와 npm playwright 버전이
// 어긋나므로 executablePath 를 명시 해석한다. (env 가이드: playwright install 금지)

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { makeLogger } from '../../lib/logger.js';

const log = makeLogger('browser');

function resolveChrome(): string | undefined {
  if (process.env['CHROME_PATH'] && existsSync(process.env['CHROME_PATH'])) {
    return process.env['CHROME_PATH'];
  }
  const root = process.env['PLAYWRIGHT_BROWSERS_PATH'] || '/opt/pw-browsers';
  try {
    const dirs = readdirSync(root).filter((d) => d.startsWith('chromium-'));
    // 헤드리스 셸 말고 풀 chrome 우선.
    for (const d of dirs) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  return undefined; // playwright 기본 경로 시도
}

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  const executablePath = resolveChrome();
  log.info(`chromium 실행: ${executablePath ?? '(playwright 기본)'}`);
  browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
