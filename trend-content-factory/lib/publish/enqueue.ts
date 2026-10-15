// 승인·렌더된 에셋 → 특정 계정의 게시 잡 생성.
// 캐러셀(같은 draft·platform 다중 에셋)은 대표 1개로 묶어 잡 1건(=게시 1건).

import { randomUUID } from 'node:crypto';
import { PLATFORMS } from '../../config/platforms.js';
import { formatForPlatform } from './captions.js';
import type { AssetRecord, DraftRecord } from '../types.js';
import type { Account, PublishJob } from './types.js';

export function buildJobsForAccount(
  account: Account,
  assets: AssetRecord[],
  draftsById: Map<string, DraftRecord>,
  nowIso: string,
): PublishJob[] {
  const spec = PLATFORMS[account.platform];
  // 계정 플랫폼 + 계정 버티컬에 해당하는 에셋만, draft별 대표 1개.
  const byDraft = new Map<string, AssetRecord>();
  for (const a of assets) {
    if (a.platform !== account.platform) continue;
    if (a.vertical !== account.vertical_slug) continue;
    const cur = byDraft.get(a.draft_id);
    // slideIndex 0(커버) 우선.
    const idx = (a.meta['slideIndex'] as number | undefined) ?? 0;
    if (!cur || idx < ((cur.meta['slideIndex'] as number | undefined) ?? 0)) byDraft.set(a.draft_id, a);
  }

  const jobs: PublishJob[] = [];
  for (const asset of byDraft.values()) {
    const draft = draftsById.get(asset.draft_id);
    if (!draft) continue;
    const caption = formatForPlatform(draft.caption, draft.hashtags, draft.cta, spec);
    jobs.push({
      id: randomUUID(),
      vertical: account.vertical_slug,
      draft_id: asset.draft_id,
      asset_id: asset.id,
      account_id: account.id,
      platform: account.platform,
      kind: asset.kind,
      storage_path: asset.storage_path,
      caption,
      scheduled_at: nowIso,
      state: 'queued',
      attempts: 0,
      created_at: nowIso,
    });
  }
  return jobs;
}
