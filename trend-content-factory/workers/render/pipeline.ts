// M4 코어: 승인된 초안 1건 → 플랫폼별 카드 PNG / 릴 MP4 에셋.
// 카드: 대표 플랫폼(ig)은 전체 캐러셀, 나머지 카드 플랫폼은 커버 1장.
// 릴: 마스터 1080×1920 MP4 1개 → 릴 지원 플랫폼에 공유.

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Browser } from 'playwright';
import { PLATFORMS, platformsForFormat } from '../../config/platforms.js';
import type { AssetRecord, DraftRecord, Vertical } from '../../lib/types.js';
import type { TtsProvider } from '../../lib/media/tts.js';
import { renderCard } from './card.js';
import { renderReel, reelDuration } from './reel.js';

export type RenderResult = {
  assets: AssetRecord[];
  cardMs: number[];
  reelMs: number[];
};

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return h % 100000;
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

export async function renderDraft(
  browser: Browser,
  draft: DraftRecord,
  vertical: Vertical,
  opts: { outDir: string; workDir: string; tts?: TtsProvider },
): Promise<RenderResult> {
  const seed = seedOf(draft.id);
  const base = path.join(opts.outDir, vertical.slug, shortId(draft.id));
  const now = new Date().toISOString();
  const assets: AssetRecord[] = [];
  const cardMs: number[] = [];
  const reelMs: number[] = [];

  const mkAsset = (
    platform: AssetRecord['platform'],
    kind: AssetRecord['kind'],
    file: string,
    width: number,
    height: number,
    durationMs: number,
    meta: Record<string, unknown>,
  ): AssetRecord => ({
    id: randomUUID(),
    draft_id: draft.id,
    vertical: vertical.slug,
    platform,
    kind,
    storage_path: file,
    width,
    height,
    duration_ms: durationMs,
    meta,
    created_at: now,
  });

  if (draft.format === 'card' || draft.format === 'mixed') {
    const cardPlatforms = platformsForFormat('card');
    const slides = draft.slides.length ? draft.slides : [{ headline: draft.hook, body: draft.caption, visual_query: '' }];
    for (const spec of cardPlatforms) {
      // ig(대표)만 전체 캐러셀, 나머지는 커버 1장.
      const isPrimary = spec.id === 'ig';
      const count = isPrimary ? slides.length : 1;
      for (let i = 0; i < count; i += 1) {
        const slide = slides[i]!;
        const out = path.join(base, `${spec.id}-card-${i + 1}.png`);
        const r = await renderCard(browser, {
          vertical,
          spec,
          slide: { headline: slide.headline, body: slide.body },
          index: i,
          total: slides.length,
          isCover: i === 0,
          hook: draft.hook,
          seed,
          outPath: out,
        });
        cardMs.push(r.ms);
        assets.push(mkAsset(spec.id, 'card_png', r.file, r.width, r.height, 0, { slideIndex: i, primary: isPrimary }));
      }
    }
  }

  if (draft.format === 'reel' || draft.format === 'mixed') {
    // 마스터 릴 1개(ig 세로 규격) → 릴 지원 플랫폼에 공유.
    const masterSpec = PLATFORMS.ig;
    const out = path.join(base, `reel-master.mp4`);
    const r = await renderReel(browser, {
      vertical,
      spec: masterSpec,
      beats: draft.reel_script,
      hook: draft.hook,
      seed,
      outPath: out,
      workDir: path.join(opts.workDir, shortId(draft.id)),
      ...(opts.tts ? { tts: opts.tts } : {}),
    });
    reelMs.push(r.ms);
    for (const spec of platformsForFormat('reel')) {
      assets.push(
        mkAsset(spec.id, 'reel_mp4', r.file, r.width, r.height, r.durationMs, {
          codec: r.codec,
          hasAudio: r.hasAudio,
          shared: true,
          durationSec: reelDuration(draft.reel_script, masterSpec),
        }),
      );
    }
  }

  return { assets, cardMs, reelMs };
}
