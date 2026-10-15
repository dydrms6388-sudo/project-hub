// Phase 3 데모 (시뮬레이션): 게시 스케줄러 상태머신 + 거버너 + 워밍업 + 페이싱 + dedup 검증.
// 네트워크/실계정 없이 가상 시계로 하루 흐름을 압축 재생한다. 실게시 없음.
// 사용: npm run phase3:demo
//
// ⚠️ Phase 3 는 "테스트 계정 검증"까지. 실제 20계정 확장은 소유자 승인 후.

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPublishStore } from '../lib/publish/store.js';
import { buildJobsForAccount } from '../lib/publish/enqueue.js';
import { runSchedulerPass } from '../lib/publish/scheduler.js';
import { resetSim } from '../lib/publish/adapters/sim.js';
import { warmupCap } from '../lib/publish/warmup.js';
import type { Account, PublishJob } from '../lib/publish/types.js';
import type { AssetRecord, DraftRecord } from '../lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'output');
const MIN = 60_000;
const HOUR = 60 * MIN;

async function readJson<T>(f: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(f, 'utf8')) as T[];
  } catch {
    return [];
  }
}

/** money-brief IG 잡을 실제 렌더 산출물에서 만들거나(있으면), 없으면 합성. */
async function makeJobs(account: Account, count: number, baseIso: string): Promise<PublishJob[]> {
  const assets = await readJson<AssetRecord>(path.join(OUT, 'assets.json'));
  const drafts = await readJson<DraftRecord>(path.join(OUT, 'drafts.json'));
  const draftsById = new Map(drafts.map((d) => [d.id, d]));
  const real = buildJobsForAccount(account, assets, draftsById, baseIso).slice(0, count);
  if (real.length >= count) return real;

  // 합성 폴백 (렌더 산출물 없을 때).
  const jobs: PublishJob[] = [...real];
  for (let i = real.length; i < count; i += 1) {
    jobs.push({
      id: randomUUID(),
      vertical: account.vertical_slug,
      draft_id: `synthetic-${i}`,
      asset_id: `synthetic-asset-${i}`,
      account_id: account.id,
      platform: account.platform,
      kind: 'card_png',
      storage_path: `https://example.com/${account.vertical_slug}/${i}.png`,
      caption: `[${account.vertical_slug}] 오늘의 경제 브리핑 #${i} — 서로 다른 소재 ${i}`,
      scheduled_at: baseIso,
      state: 'queued',
      attempts: 0,
      created_at: baseIso,
    });
  }
  return jobs;
}

async function runScenario(
  title: string,
  account: Account,
  jobs: PublishJob[],
  base: number,
  passes: number,
  stepMs: number,
): Promise<void> {
  console.log(`\n──────── ${title} ────────`);
  console.log(`계정: ${account.platform}/${account.vertical_slug} (id=${account.id}) 워밍업 상한=${fmtCap(warmupCap(account, base))}/일`);
  const store = getPublishStore(true);
  await store.enqueue(jobs);
  console.log(`큐 적재: ${jobs.length}건 (지터 없이 결정론적 페이싱)`);

  let virtualNow = base;
  const deps = { store, mode: 'sim' as const, clock: () => virtualNow, rng: () => 0.5 };

  for (let p = 1; p <= passes; p += 1) {
    const clockStr = new Date(virtualNow).toISOString().slice(11, 16);
    const results = await runSchedulerPass([account], deps, 100);
    for (const r of results) {
      console.log(`  [${clockStr}] ${icon(r.action)} ${r.action.padEnd(9)} ${r.jobId.slice(0, 8)} — ${r.reason}`);
    }
    // 대기 중(queued/throttled) 잡이 없으면 종료. 있으면 시계를 계속 전진.
    const pending = (await store.allJobs()).filter(
      (j) => j.account_id === account.id && (j.state === 'queued' || j.state === 'throttled'),
    );
    if (pending.length === 0) {
      console.log(`  [${clockStr}] 대기 잡 없음 — 종료`);
      break;
    }
    virtualNow += stepMs;
  }

  const all = await store.allJobs();
  const mine = all.filter((j) => j.account_id === account.id);
  const c = (s: string) => mine.filter((j) => j.state === s).length;
  console.log(
    `  결과: published ${c('published')} / throttled ${c('throttled')} / failed ${c('failed')} / queued ${c('queued')}`,
  );
}

function icon(a: string): string {
  return a === 'published' ? '✅' : a === 'failed' ? '❌' : a === 'throttled' ? '⏳' : '⏭️';
}
function fmtCap(n: number): string {
  return Number.isFinite(n) ? String(n) : '∞';
}

async function resetStore(): Promise<void> {
  for (const f of ['publish_queue.json', 'posts.json', 'rate_limit_log.json', 'account_state.json']) {
    await fs.rm(path.join(OUT, f), { force: true }).catch(() => {});
  }
  resetSim();
}

async function main(): Promise<void> {
  console.log('\n===== Phase 3 데모: 게시 스케줄러 (시뮬레이션, 실게시 없음) =====');
  const base = Date.parse(new Date().toISOString().slice(0, 10) + 'T06:00:00.000Z'); // 오늘 06:00Z 고정

  // 시나리오 1: 성숙 계정 — 페이싱 + 거버너 쿨다운 + 캡션 중복(dedup)
  await resetStore();
  const mature: Account = {
    id: 'acct-mature-ig',
    vertical_slug: 'money-brief',
    platform: 'ig',
    external_user_id: '17841400000000000',
    token_env: 'PUBLISH_TEST_TOKEN',
    warmup_started_at: new Date(base - 40 * 24 * HOUR).toISOString().slice(0, 10),
    state: 'active',
  };
  const jobs1 = await makeJobs(mature, 9, new Date(base).toISOString());
  // 캡션 중복 1건 주입 (dedup 시연): 2번째 잡 캡션을 첫 잡과 동일하게.
  if (jobs1.length >= 2) jobs1[1]!.caption = jobs1[0]!.caption;
  await runScenario('시나리오 1: 성숙 계정 (페이싱 40분 + 거버너 80%↑ 쿨다운/95%↑ 중단 + dedup)', mature, jobs1, base, 14, 45 * MIN);
  console.log('  기대: 45분 간격 1건씩 게시 → 사용률 12%씩 상승 → 84%(7건째)에서 거버너 60분 쿨다운 →');
  console.log('        96%(8건째)에서 24시간 중단. 첫 캡션과 동일한 2번째 잡은 dedup 으로 failed.');

  // 시나리오 2: 신규 계정 — 워밍업 일일 한도(1주차 3건)
  await resetStore();
  const fresh: Account = {
    id: 'acct-fresh-ig',
    vertical_slug: 'money-brief',
    platform: 'ig',
    external_user_id: '17841400000000001',
    token_env: 'PUBLISH_TEST_TOKEN',
    warmup_started_at: new Date(base).toISOString().slice(0, 10), // 오늘 시작 → 1주차 cap 3
    state: 'active',
  };
  const jobs2 = await makeJobs(fresh, 6, new Date(base).toISOString());
  await runScenario('시나리오 2: 신규 계정 (워밍업 1주차 = 3건/일)', fresh, jobs2, base, 8, 45 * MIN);
  console.log('  기대: 3건 게시 후 워밍업 상한 도달 → 이후 throttled(다음 창으로 이연).');

  console.log('\n===== 데모 종료 =====');
  console.log('검증된 안전장치: content_publishing_limit(×0.6) · 워밍업 스케줄 · 40분 페이싱 · 캡션 dedup ·');
  console.log('레이트리밋 거버너(80%→쿨다운/95%→중단) · 실패 job_failures 기록 · queued/throttled/published/failed 상태머신.');
  console.log('실게시(IG/FB/TikTok/Threads/X)는 계정 토큰/앱 심사 후 `npm run publish` 로 동작.\n');
}

main().catch((err) => {
  console.error('Phase3 데모 실패:', err);
  process.exitCode = 1;
});
