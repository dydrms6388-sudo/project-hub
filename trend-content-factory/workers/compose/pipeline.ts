// M2 코어 로직 (index.ts CLI 와 phase1-demo 가 공유).

import { randomUUID } from 'node:crypto';
import { env } from '../../lib/env.js';
import { makeLogger } from '../../lib/logger.js';
import { recordFailure } from '../../lib/failures.js';
import { passesComposeGate } from '../../lib/draftSchema.js';
import type { DraftRecord, TrendItem, Vertical } from '../../lib/types.js';
import type { Composer } from './composer.js';

const log = makeLogger('compose');

/** 한 버티컬의 트렌드 풀 → 초안 레코드. 목표의 oversample 배수까지 생성. */
export async function composeForVertical(
  composer: Composer,
  vertical: Vertical,
  trends: TrendItem[],
  targetCount: number,
): Promise<DraftRecord[]> {
  const oversample = Math.ceil(targetCount * env.composeOversample);
  const pool = trends.slice(0, oversample);
  const out: DraftRecord[] = [];
  const now = new Date().toISOString();

  for (const trend of pool) {
    let result;
    try {
      result = await composer.compose(vertical, trend);
    } catch (err) {
      await recordFailure('compose', err, { vertical: vertical.slug, context: { trend: trend.title } });
      continue;
    }
    if (!result) {
      log.debug(`폐기(파싱 실패): ${trend.title}`);
      continue;
    }
    const gate = passesComposeGate(result.draft);
    out.push({
      ...result.draft,
      id: randomUUID(),
      vertical: vertical.slug,
      trend_title: trend.title,
      format: vertical.format,
      created_at: now,
      status: gate.ok ? 'draft' : 'rejected',
      mock: result.mock,
    });
    if (!gate.ok) log.debug(`게이트 탈락(${gate.reason}): ${trend.title}`);
  }
  return out;
}
