// M4. 렌더러 (CLI 진입점).
// 사용: tsx workers/render/index.ts [--dry-run] [--vertical <slug>] [--limit <n>]
// status='approved' 초안을 플랫폼별 카드/릴로 렌더 → output/preview/, 에셋 스토어 적재.
// 병렬도는 CPU-1 로 제한.

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../../lib/cli.js';
import { makeLogger } from '../../lib/logger.js';
import { getStore } from '../../lib/store.js';
import { recordFailure } from '../../lib/failures.js';
import { getVertical } from '../../config/verticals.js';
import { makeTts } from '../../lib/media/tts.js';
import { getBrowser, closeBrowser } from './browser.js';
import { renderDraft } from './pipeline.js';
import type { AssetRecord } from '../../lib/types.js';

const log = makeLogger('render');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'output', 'preview');
const WORK = path.resolve(__dirname, '..', '..', 'output', '.work');

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const store = getStore(args.dryRun);
  const tts = makeTts();

  let drafts = await store.loadDrafts('approved');
  if (args.vertical) drafts = drafts.filter((d) => d.vertical === args.vertical);
  if (args.limit) drafts = drafts.slice(0, args.limit);
  if (drafts.length === 0) {
    log.warn('렌더할 approved 초안 없음 — review 먼저 실행 필요');
    return;
  }

  const concurrency = Math.max(1, os.cpus().length - 1);
  log.info(`렌더 시작 — ${drafts.length}건, 병렬 ${concurrency}, store=${store.kind}${args.dryRun ? ' (dry-run)' : ''}`);

  const browser = await getBrowser();
  const allAssets: AssetRecord[] = [];
  const cardMs: number[] = [];
  const reelMs: number[] = [];

  try {
    await mapLimit(drafts, concurrency, async (d) => {
      try {
        const v = getVertical(d.vertical);
        const r = await renderDraft(browser, d, v, { outDir: OUT, workDir: WORK, tts });
        allAssets.push(...r.assets);
        cardMs.push(...r.cardMs);
        reelMs.push(...r.reelMs);
        log.info(`${d.vertical}/${d.id.slice(0, 8)}: 카드 ${r.cardMs.length} / 릴 ${r.reelMs.length}`);
      } catch (err) {
        await recordFailure('render', err, { vertical: d.vertical, context: { draft: d.id } });
      }
    });
  } finally {
    await closeBrowser();
  }

  await store.saveAssets(allAssets);
  report(cardMs, reelMs, allAssets.length);
}

function avg(a: number[]): number {
  return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
}

function report(cardMs: number[], reelMs: number[], assetCount: number): void {
  log.info('──────── 렌더 리포트 ────────');
  log.info(`에셋 ${assetCount}개 (카드 PNG ${cardMs.length}, 릴 MP4 ${reelMs.length})`);
  log.info(`카드 평균 ${avg(cardMs)}ms, 릴 평균 ${avg(reelMs)}ms`);
}

main().catch(async (err) => {
  await recordFailure('render', err, { context: { fatal: true } });
  await closeBrowser();
  process.exitCode = 1;
});
