// 카드 렌더: HTML → Playwright → PNG (플랫폼 dims 그대로 풀해상도).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Browser } from 'playwright';
import type { PlatformSpec } from '../../config/platforms.js';
import type { Vertical } from '../../lib/types.js';
import { buildCardHtml, type CardSlide } from '../../lib/render/cardTemplate.js';

export type CardRenderResult = { file: string; ms: number; width: number; height: number };

export async function renderCard(
  browser: Browser,
  opts: {
    vertical: Vertical;
    spec: PlatformSpec;
    slide: CardSlide;
    index: number;
    total: number;
    isCover: boolean;
    hook: string;
    seed: number;
    outPath: string;
  },
): Promise<CardRenderResult> {
  const { spec, outPath } = opts;
  const { w, h } = spec.card;
  const html = buildCardHtml(opts);
  const t0 = Date.now();

  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await page.locator('#card').screenshot({ path: outPath, type: 'png' });
  } finally {
    await context.close();
  }
  return { file: outPath, ms: Date.now() - t0, width: w, height: h };
}
