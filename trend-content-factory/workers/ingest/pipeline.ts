// M1 코어 로직 (index.ts CLI 와 phase1-demo 가 공유).

import { makeLogger } from '../../lib/logger.js';
import { recordFailure } from '../../lib/failures.js';
import {
  noveltyAgainst,
  velocityFromMagnitude,
  velocityFromRank,
} from '../../lib/scoring.js';
import type { TrendItem, Vertical } from '../../lib/types.js';
import { adapterFor } from './adapters/registry.js';
import type { RawTrend } from './adapters/base.js';

const log = makeLogger('ingest');

export function rawToTrend(
  vertical: string,
  r: RawTrend,
  totalInSource: number,
  recentTitles: string[],
  now: string,
): TrendItem {
  const velocity =
    r.magnitude != null
      ? velocityFromMagnitude(r.magnitude)
      : r.rank != null
        ? velocityFromRank(r.rank, totalInSource)
        : 0.5;
  return {
    vertical,
    title: r.title,
    summary: r.summary,
    source_url: r.source_url,
    raw: r.raw,
    velocity_score: Number(velocity.toFixed(4)),
    novelty_score: Number(noveltyAgainst(r.title, recentTitles).toFixed(4)),
    collected_at: now,
  };
}

/** 단일 버티컬의 모든 소스를 수집. 소스 단위 실패는 격리 → job_failures. */
export async function ingestVertical(
  vertical: Vertical,
  perSourceLimit: number,
  recentTitles: string[],
): Promise<TrendItem[]> {
  const collected: TrendItem[] = [];
  const now = new Date().toISOString();

  for (const source of vertical.sources) {
    const adapter = adapterFor(source.type);
    if (!adapter) {
      log.warn(`어댑터 없음: ${source.type} (${vertical.slug})`);
      continue;
    }
    try {
      const raws = await adapter.fetch(vertical, source, perSourceLimit);
      const total = raws.length || 1;
      for (const r of raws) {
        if (!r.title) continue;
        collected.push(rawToTrend(vertical.slug, r, total, recentTitles, now));
      }
      log.info(`${vertical.slug} ← ${source.label}: ${raws.length}건`);
    } catch (err) {
      await recordFailure('ingest', err, {
        vertical: vertical.slug,
        context: { source: source.label, type: source.type },
      });
    }
  }
  return collected;
}
