// M3 코어: 초안 배치 심사 → reviews 적재 + 초안 상태 갱신(approved/rejected).
// 탈락분은 폐기하지 않고 rejected 로 보관(주간 실패 패턴 분석용).

import { randomUUID } from 'node:crypto';
import { makeLogger } from '../../lib/logger.js';
import { recordFailure } from '../../lib/failures.js';
import { toReviewRecord } from '../../lib/reviewSchema.js';
import type { Store } from '../../lib/store.js';
import type { DraftRecord, ReviewRecord } from '../../lib/types.js';
import type { Panel } from './panel.js';

const log = makeLogger('review');
const BATCH = 10;

export type ReviewSummary = {
  reviewed: number;
  approved: number;
  rejected: number;
  reviews: ReviewRecord[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function reviewDrafts(
  panel: Panel,
  drafts: DraftRecord[],
  store: Store,
): Promise<ReviewSummary> {
  const now = new Date().toISOString();
  const reviews: ReviewRecord[] = [];
  const approvedIds: string[] = [];
  const rejectedIds: string[] = [];

  for (const batch of chunk(drafts, BATCH)) {
    let verdicts;
    try {
      verdicts = await panel.review(batch);
    } catch (err) {
      await recordFailure('review', err, { context: { batchSize: batch.length } });
      continue;
    }
    for (const d of batch) {
      const personas = verdicts.get(d.id);
      if (!personas) {
        // 심사 누락 → 안전하게 rejected (게시로 새지 않게).
        rejectedIds.push(d.id);
        await recordFailure('review', new Error('심사 결과 누락'), {
          vertical: d.vertical,
          context: { draft: d.id },
        });
        continue;
      }
      const rec = toReviewRecord(randomUUID(), d.id, d.vertical, personas, panel.mode === 'mock', now);
      reviews.push(rec);
      (rec.passed ? approvedIds : rejectedIds).push(d.id);
    }
    log.info(`배치 심사 ${batch.length}건 완료 (누적 통과 ${approvedIds.length})`);
  }

  await store.saveReviews(reviews);
  await store.updateDraftStatus(approvedIds, 'approved');
  await store.updateDraftStatus(rejectedIds, 'rejected');

  return {
    reviewed: reviews.length,
    approved: approvedIds.length,
    rejected: rejectedIds.length,
    reviews,
  };
}
