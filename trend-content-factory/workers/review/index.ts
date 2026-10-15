// M3. 품질 게이트 (CLI 진입점).
// 사용: tsx workers/review/index.ts [--dry-run] [--vertical <slug>] [--limit <n>]
// status='draft' 초안을 심사 → approved/rejected 로 갱신.

import { parseArgs } from '../../lib/cli.js';
import { makeLogger } from '../../lib/logger.js';
import { getStore } from '../../lib/store.js';
import { recordFailure } from '../../lib/failures.js';
import { makePanel } from './panel.js';
import { reviewDrafts } from './pipeline.js';

const log = makeLogger('review');

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const store = getStore(args.dryRun);
  const panel = makePanel();

  let drafts = await store.loadDrafts('draft');
  if (args.vertical) drafts = drafts.filter((d) => d.vertical === args.vertical);
  if (args.limit) drafts = drafts.slice(0, args.limit);

  if (drafts.length === 0) {
    log.warn('심사할 draft 상태 초안 없음 — compose 먼저 실행 필요');
    return;
  }

  log.info(`심사 시작 — ${drafts.length}건, panel=${panel.mode}, store=${store.kind}${args.dryRun ? ' (dry-run)' : ''}`);
  const summary = await reviewDrafts(panel, drafts, store);
  log.info(
    `심사 완료 — 심사 ${summary.reviewed} / 통과 ${summary.approved} / 탈락 ${summary.rejected} ` +
      `(통과율 ${((summary.approved / Math.max(1, summary.reviewed)) * 100).toFixed(0)}%)`,
  );
}

main().catch(async (err) => {
  await recordFailure('review', err, { context: { fatal: true } });
  process.exitCode = 1;
});
