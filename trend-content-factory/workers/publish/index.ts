// M5. 게시 스케줄러 (CLI 진입점).
// 사용: tsx workers/publish/index.ts [--dry-run] [--sim] [--limit <n>]
//   --sim     : 시뮬레이션 게시자(네트워크 없음, 상태머신/거버너 검증)
//   기본(real): 실제 플랫폼 API. 계정/토큰(env 또는 Supabase) 필요.
//
// ⚠️ Phase 3 는 테스트 계정 1개 검증까지. 20계정 확장은 소유자 승인 후(Phase 5).

import { parseArgs } from '../../lib/cli.js';
import { makeLogger } from '../../lib/logger.js';
import { recordFailure } from '../../lib/failures.js';
import { getPublishStore } from '../../lib/publish/store.js';
import { resolveAccounts, tokenFor } from '../../lib/publish/accounts.js';
import { runSchedulerPass } from '../../lib/publish/scheduler.js';

const log = makeLogger('publish');

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const mode = args.raw.includes('--sim') ? 'sim' : 'real';
  const store = getPublishStore(args.dryRun);
  const accounts = await resolveAccounts(args.dryRun);

  if (accounts.length === 0) {
    log.warn('게시 대상 계정 없음 — PUBLISH_TEST_* env 또는 Supabase accounts 필요');
    return;
  }
  log.info(`게시 패스 시작 — 계정 ${accounts.length}, mode=${mode}, store=${store.kind}${args.dryRun ? ' (dry-run)' : ''}`);

  const results = await runSchedulerPass(accounts, { store, mode, tokenFor }, args.limit ?? 100);
  const by = (a: string) => results.filter((r) => r.action === a).length;
  log.info(
    `패스 완료 — 처리 ${results.length}: 게시 ${by('published')} / throttled ${by('throttled')} / 실패 ${by('failed')} / skip ${by('skipped')}`,
  );
  for (const r of results) log.debug(`  [${r.action}] ${r.platform} ${r.jobId.slice(0, 8)}: ${r.reason}`);
}

main().catch(async (err) => {
  await recordFailure('publish', err, { context: { fatal: true } });
  process.exitCode = 1;
});
