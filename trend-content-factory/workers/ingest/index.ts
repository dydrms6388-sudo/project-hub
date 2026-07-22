// M1. 트렌드 수집기 (CLI 진입점).
// 사용: tsx workers/ingest/index.ts [--dry-run] [--vertical <slug>] [--limit <n>]

import { VERTICALS, getVertical } from '../../config/verticals.js';
import { env } from '../../lib/env.js';
import { parseArgs } from '../../lib/cli.js';
import { makeLogger } from '../../lib/logger.js';
import { getStore } from '../../lib/store.js';
import { recordFailure } from '../../lib/failures.js';
import { dedupeTrends, rankAndSelect } from '../../lib/scoring.js';
import { ingestVertical } from './pipeline.js';

const log = makeLogger('ingest');

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const store = getStore(args.dryRun);
  const perSourceLimit = args.limit ?? env.ingestPerSourceLimit;
  const targets = args.vertical ? [getVertical(args.vertical)] : VERTICALS;

  log.info(
    `수집 시작 — 대상 ${targets.length}개 버티컬, 소스당 최대 ${perSourceLimit}건, ` +
      `store=${store.kind}${args.dryRun ? ' (dry-run)' : ''}`,
  );

  let grandTotal = 0;
  let keptTotal = 0;

  for (const vertical of targets) {
    const recentTitles = await store.recentTitles(vertical.slug, 30);
    const raw = await ingestVertical(vertical, perSourceLimit, recentTitles);
    grandTotal += raw.length;

    const deduped = dedupeTrends(raw);
    const selected = rankAndSelect(deduped, Math.max(vertical.postsPerDay * 3, 20));
    keptTotal += selected.length;

    await store.saveTrends(selected);
    log.info(`${vertical.slug}: 수집 ${raw.length} → 중복제거 ${deduped.length} → 선별 ${selected.length}`);
  }

  log.info(`수집 완료 — 원시 ${grandTotal}건 → 저장 ${keptTotal}건 (store=${store.kind})`);
}

main().catch(async (err) => {
  await recordFailure('ingest', err, { context: { fatal: true } });
  process.exitCode = 1;
});
