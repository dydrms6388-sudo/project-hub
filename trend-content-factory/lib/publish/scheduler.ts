// M5 스케줄러 코어: 게시 전 체크리스트 + 상태머신 + 거버너.
// 상태: queued → (checklist) → uploading → published | throttled | failed
//
// 체크리스트(하나라도 실패 → throttled 로 되돌림, dedup 은 failed):
//  1. content_publishing_limit 잔여 (사용률 ≥ 0.6 이면 throttle — HARD #1 ×0.6)
//  2. 워밍업 일일 한도 (HARD #5)
//  3. 최근 게시 간격 ≥ 40분(±지터) (HARD 체크리스트 3)
//  4. 캡션 중복도 < 0.85 (HARD 체크리스트 4)

import { randomUUID } from 'node:crypto';
import { makeLogger } from '../logger.js';
import { recordFailure } from '../failures.js';
import { evaluateUsage } from './governor.js';
import { warmupCap } from './warmup.js';
import { canPublishNow, nextAllowedTime, captionTooSimilar } from './pacing.js';
import { publisherFor, type PublisherMode } from './registry.js';
import type { PublishStore } from './store.js';
import type { Account, PublishJob } from './types.js';

const log = makeLogger('scheduler');
const MAX_ATTEMPTS = 5;
const LIMIT_BACKOFF_MS = 60 * 60 * 1000; // 1h
const WARMUP_BACKOFF_MS = 6 * 60 * 60 * 1000; // 다음 창

export type StepAction = 'published' | 'throttled' | 'failed' | 'skipped';
export type StepResult = { jobId: string; platform: string; action: StepAction; reason: string };

export type SchedulerDeps = {
  store: PublishStore;
  mode: PublisherMode;
  clock?: () => number;
  rng?: () => number;
  /** 실모드에서 계정 토큰 해석. sim 모드면 무시. */
  tokenFor?: (account: Account) => string | null;
};

function startOfDayIso(now: number): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * 백프레셔 이연(대기) — 실패가 아니다. attempts 를 올리지 않고 scheduled_at 만 미룬다.
 * (페이싱/워밍업/레이트리밋/계정 쿨다운 등 "기다리면 해결되는" 사유)
 */
async function reschedule(
  store: PublishStore,
  job: PublishJob,
  reason: string,
  nextMs: number,
): Promise<StepResult> {
  await store.updateJob(job.id, {
    state: 'throttled',
    scheduled_at: new Date(nextMs).toISOString(),
    last_error: reason,
  });
  return { jobId: job.id, platform: job.platform, action: 'throttled', reason };
}

/** 실제 게시 실패 재시도 — attempts 를 올리고 한도 초과 시 failed. */
async function retryOrFail(
  store: PublishStore,
  job: PublishJob,
  reason: string,
  nextMs: number,
): Promise<StepResult> {
  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await store.updateJob(job.id, { state: 'failed', attempts, last_error: `max attempts: ${reason}` });
    return { jobId: job.id, platform: job.platform, action: 'failed', reason: `max attempts (${reason})` };
  }
  await store.updateJob(job.id, {
    state: 'throttled',
    attempts,
    scheduled_at: new Date(nextMs).toISOString(),
    last_error: reason,
  });
  return { jobId: job.id, platform: job.platform, action: 'throttled', reason };
}

async function processJob(job: PublishJob, account: Account, deps: SchedulerDeps): Promise<StepResult> {
  const clock = deps.clock ?? Date.now;
  const rng = deps.rng ?? (() => 0.5);
  const store = deps.store;
  const now = clock();
  const nowIso = new Date(now).toISOString();

  // 계정 상태
  if (account.state === 'disabled') return skip(job, 'account disabled');
  if (account.state === 'paused') return skip(job, 'account paused');
  if (account.cooldown_until && Date.parse(account.cooldown_until) > now) {
    return reschedule(store, job, `account cooldown until ${account.cooldown_until}`, Date.parse(account.cooldown_until));
  }

  const publisher = publisherFor(account.platform, deps.mode);
  const token = deps.mode === 'sim' ? 'sim' : (deps.tokenFor?.(account) ?? '');
  if (deps.mode === 'real' && !token) {
    return reschedule(store, job, 'no token for account', now + LIMIT_BACKOFF_MS);
  }

  // 1) content_publishing_limit / 사용률 ×0.6
  let usageFrac: number | null = null;
  try {
    usageFrac = await publisher.publishingUsage(account, token);
  } catch (err) {
    log.debug(`publishingUsage 조회 실패(무시): ${String(err)}`);
  }
  if (usageFrac != null && usageFrac >= 0.6) {
    return reschedule(store, job, `publishing usage ${(usageFrac * 100).toFixed(0)}% ≥ 60%`, now + LIMIT_BACKOFF_MS);
  }

  // 2) 워밍업 일일 한도
  const publishedToday = await store.countPublishedSince(account.id, startOfDayIso(now));
  const cap = warmupCap(account, now);
  if (publishedToday >= cap) {
    return reschedule(store, job, `warmup cap ${cap} 도달 (오늘 ${publishedToday})`, now + WARMUP_BACKOFF_MS);
  }

  // 3) 페이싱 (≥40분 ±지터)
  const last = await store.lastPublishedAt(account.id);
  if (!canPublishNow(last, now, rng())) {
    const next = nextAllowedTime(last, now, rng());
    return reschedule(store, job, `pacing: 다음 허용 ${new Date(next).toISOString()}`, next);
  }

  // 4) 캡션 중복 (dedup → failed, 재시도 무의미)
  const recent = await store.recentPublishedCaptions(account.id, 30);
  const dup = captionTooSimilar(job.caption, recent);
  if (dup.dup) {
    await store.updateJob(job.id, { state: 'failed', last_error: `duplicate caption sim=${dup.maxSim}` });
    return { jobId: job.id, platform: job.platform, action: 'failed', reason: `중복 캡션 (sim=${dup.maxSim})` };
  }

  // 게시
  await store.updateJob(job.id, { state: 'uploading' });
  let outcome;
  try {
    outcome = await publisher.publish(job, account, token);
  } catch (err) {
    outcome = { ok: false, error: String(err), retryable: true } as const;
  }

  if (outcome.usage) {
    await store.logRateLimit({
      account_id: account.id,
      endpoint: `${account.platform}:publish`,
      app_usage: outcome.usage.appUsage,
      buc_usage: outcome.usage.bucUsage,
      publishing_quota_usage: outcome.usage.publishingQuota,
      created_at: nowIso,
    });
  }

  if (outcome.ok) {
    await store.updateJob(job.id, { state: 'published' });
    await store.recordPost({
      id: randomUUID(),
      account_id: account.id,
      draft_id: job.draft_id,
      platform: account.platform,
      external_id: outcome.externalId ?? '',
      permalink: outcome.permalink ?? '',
      caption: job.caption,
      published_at: nowIso,
    });

    // 거버너: 사용률 80%/95% 초과 시 쿨다운/중단
    if (outcome.usage) {
      const dec = evaluateUsage(outcome.usage);
      if (dec.action !== 'ok') {
        const until = new Date(now + dec.cooldownMs).toISOString();
        account.state = dec.action === 'halt' ? 'disabled' : 'cooldown';
        account.cooldown_until = until;
        await store.setAccountCooldown(account.id, account.state, until);
        return { jobId: job.id, platform: job.platform, action: 'published', reason: `게시 OK; 거버너 ${dec.action} (${dec.worst}%) → ${until}` };
      }
    }
    return { jobId: job.id, platform: job.platform, action: 'published', reason: `게시 OK (${outcome.externalId})` };
  }

  // 실패 (실제 게시 오류만 attempts 카운트)
  if (outcome.retryable) {
    const res = await retryOrFail(store, job, `retryable: ${outcome.error}`, now + 60_000);
    if (res.action === 'failed') {
      await recordFailure('publish', new Error(outcome.error ?? 'unknown'), {
        vertical: job.vertical,
        context: { job: job.id, platform: account.platform },
      });
    }
    return res;
  }
  await store.updateJob(job.id, { state: 'failed', attempts: job.attempts + 1, last_error: outcome.error });
  await recordFailure('publish', new Error(outcome.error ?? 'unknown'), {
    vertical: job.vertical,
    context: { job: job.id, platform: account.platform },
  });
  return { jobId: job.id, platform: job.platform, action: 'failed', reason: outcome.error ?? 'unknown' };
}

function skip(job: PublishJob, reason: string): StepResult {
  return { jobId: job.id, platform: job.platform, action: 'skipped', reason };
}

/** 한 번의 스케줄러 패스: 현재 시각 기준 due 잡을 처리. */
export async function runSchedulerPass(
  accounts: Account[],
  deps: SchedulerDeps,
  limit = 100,
): Promise<StepResult[]> {
  const clock = deps.clock ?? Date.now;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const due = await deps.store.dueJobs(new Date(clock()).toISOString(), limit);
  const results: StepResult[] = [];
  for (const job of due) {
    const account = byId.get(job.account_id);
    if (!account) {
      results.push(skip(job, 'unknown account'));
      continue;
    }
    results.push(await processJob(job, account, deps));
  }
  return results;
}
