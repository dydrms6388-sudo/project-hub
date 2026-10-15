// M2. 소재 생성기 (CLI 진입점).
// 사용: tsx workers/compose/index.ts [--dry-run] [--vertical <slug>] [--limit <n>]

import { VERTICALS, getVertical } from '../../config/verticals.js';
import { parseArgs } from '../../lib/cli.js';
import { makeLogger } from '../../lib/logger.js';
import { getStore } from '../../lib/store.js';
import { recordFailure } from '../../lib/failures.js';
import { makeComposer } from './composer.js';
import { composeForVertical } from './pipeline.js';

const log = makeLogger('compose');

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const store = getStore(args.dryRun);
  const composer = makeComposer();
  const targets = args.vertical ? [getVertical(args.vertical)] : VERTICALS;

  log.info(
    `생성 시작 — 대상 ${targets.length}개 버티컬, composer=${composer.mode}, ` +
      `store=${store.kind}${args.dryRun ? ' (dry-run)' : ''}`,
  );

  let produced = 0;
  let passed = 0;

  for (const vertical of targets) {
    const trends = await store.loadTrends(vertical.slug);
    if (trends.length === 0) {
      log.warn(`${vertical.slug}: 트렌드 없음 — ingest 먼저 실행 필요`);
      continue;
    }
    const targetCount = args.limit ?? vertical.postsPerDay;
    const drafts = await composeForVertical(composer, vertical, trends, targetCount);
    await store.saveDrafts(drafts);
    const ok = drafts.filter((d) => d.status === 'draft').length;
    produced += drafts.length;
    passed += ok;
    log.info(`${vertical.slug}: 초안 ${drafts.length}건 (통과 ${ok} / 탈락 ${drafts.length - ok})`);
  }

  log.info(`생성 완료 — 초안 ${produced}건 (사전게이트 통과 ${passed}건, composer=${composer.mode})`);
}

main().catch(async (err) => {
  await recordFailure('compose', err, { context: { fatal: true } });
  process.exitCode = 1;
});
