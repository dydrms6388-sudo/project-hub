// 시뮬레이션 게시자 — 네트워크 없이 전체 상태머신/거버너/워밍업/페이싱을 검증.
// 게시할 때마다 계정 사용률을 램프업 → 80%/95% 임계에서 거버너 동작을 재현한다.

import { makeLogger } from '../../logger.js';
import type { Account, Platform, PlatformPublisher, PublishJob, PublishOutcome } from '../types.js';

const log = makeLogger('sim');

// 계정별 누적 게시수 (모든 플랫폼 sim 인스턴스가 공유).
const postCounts = new Map<string, number>();

export function resetSim(): void {
  postCounts.clear();
}

export class SimPublisher implements PlatformPublisher {
  constructor(
    readonly platform: Platform,
    private usageStep = 12, // 게시당 사용률 증가(%)
    private absoluteLimit = 50, // 24h 절대 상한(건)
  ) {}

  async publishingUsage(account: Account): Promise<number | null> {
    const count = postCounts.get(account.id) ?? 0;
    return count / this.absoluteLimit;
  }

  async publish(job: PublishJob, account: Account): Promise<PublishOutcome> {
    const count = (postCounts.get(account.id) ?? 0) + 1;
    postCounts.set(account.id, count);
    const usagePct = Math.min(100, count * this.usageStep);
    log.debug(`[sim] ${this.platform} 게시 #${count} usage=${usagePct}%`);
    return {
      ok: true,
      externalId: `sim_${job.platform}_${count}_${job.id.slice(0, 6)}`,
      permalink: `https://example.com/${job.platform}/sim_${count}`,
      usage: { appUsage: usagePct, bucUsage: Math.round(usagePct * 0.9), publishingQuota: count },
    };
  }
}
