// Phase 2 데모: (수집→생성이 없으면 자체 시드) → 심사 → 렌더 20건 → output/preview.
// 렌더 1건당 소요시간 측정 + 300건/일 처리 가능성 판정 리포트.
// 사용: npm run phase2:demo
//
// 트렌드/초안이 스토어에 없으면 라이브 수집→생성으로 시드한다(Phase 1 재사용).

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERTICALS } from '../config/verticals.js';
import { makeLogger } from '../lib/logger.js';
import { getStore } from '../lib/store.js';
import { dedupeTrends, rankAndSelect } from '../lib/scoring.js';
import { makeComposer } from '../workers/compose/composer.js';
import { composeForVertical } from '../workers/compose/pipeline.js';
import { ingestVertical } from '../workers/ingest/pipeline.js';
import { makePanel } from '../workers/review/panel.js';
import { reviewDrafts } from '../workers/review/pipeline.js';
import { makeTts } from '../lib/media/tts.js';
import { ffmpegCaps } from '../lib/media/ffmpeg.js';
import { getBrowser, closeBrowser } from '../workers/render/browser.js';
import { renderDraft } from '../workers/render/pipeline.js';
import type { AssetRecord } from '../lib/types.js';

const log = makeLogger('demo2');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'output', 'preview');
const WORK = path.resolve(__dirname, '..', 'output', '.work');

const RENDER_TARGET = 20;

async function seedDraftsIfEmpty(store: ReturnType<typeof getStore>): Promise<void> {
  const existing = await store.loadDrafts('draft');
  const approved = await store.loadDrafts('approved');
  if (existing.length + approved.length >= RENDER_TARGET) return;

  log.info('스토어에 초안 부족 → 라이브 수집+생성으로 시드');
  const composer = makeComposer();
  // 카드/릴 균형 위해 앞쪽 버티컬 몇 개만.
  for (const v of VERTICALS.slice(0, 8)) {
    const raw = await ingestVertical(v, 10, []);
    const trends = rankAndSelect(dedupeTrends(raw), 8);
    if (trends.length === 0) continue;
    await store.saveTrends(trends);
    const drafts = await composeForVertical(composer, v, trends, 4);
    await store.saveDrafts(drafts);
    const total = (await store.loadDrafts('draft')).length;
    if (total >= RENDER_TARGET + 10) break;
  }
}

async function main(): Promise<void> {
  console.log('\n===== Phase 2 데모: 심사 → 렌더 =====\n');
  const store = getStore(true); // dry-run(JSON) 고정

  await seedDraftsIfEmpty(store);

  // 1) 심사 (M3)
  const panel = makePanel();
  const toReview = (await store.loadDrafts('draft')).slice(0, 40);
  const rev = await reviewDrafts(panel, toReview, store);
  console.log(`[1] 심사(M3): 심사 ${rev.reviewed} / 통과 ${rev.approved} / 탈락 ${rev.rejected} (panel=${panel.mode})`);

  // 2) 렌더 (M4)
  const caps = await ffmpegCaps();
  console.log(`[2] ffmpeg: ${caps.h264 ? 'H.264/AAC MP4 (스펙 준수)' : 'VP8/webm 폴백 (풀빌드 ffmpeg 권장)'}`);
  const approved = (await store.loadDrafts('approved')).slice(0, RENDER_TARGET);
  if (approved.length === 0) {
    console.log('⚠️ 렌더할 approved 초안 없음.');
    await closeBrowser();
    return;
  }

  const tts = makeTts();
  const browser = await getBrowser();
  const assets: AssetRecord[] = [];
  const cardMs: number[] = [];
  const reelMs: number[] = [];
  const perDraftMs: number[] = [];
  const t0 = Date.now();

  try {
    for (const d of approved) {
      const dt = Date.now();
      const r = await renderDraft(browser, d, VERTICALS.find((v) => v.slug === d.vertical)!, {
        outDir: OUT,
        workDir: WORK,
        tts,
      });
      assets.push(...r.assets);
      cardMs.push(...r.cardMs);
      reelMs.push(...r.reelMs);
      perDraftMs.push(Date.now() - dt);
      log.info(`렌더 ${d.vertical}/${d.id.slice(0, 8)} [${d.format}]: 카드 ${r.cardMs.length} / 릴 ${r.reelMs.length} (${Date.now() - dt}ms)`);
    }
  } finally {
    await closeBrowser();
  }
  const wallMs = Date.now() - t0;
  await store.saveAssets(assets);

  // 3) 타이밍 리포트 + 300/일 판정
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
  const cardCount = cardMs.length;
  const reelCount = reelMs.length;
  const reelDrafts = approved.filter((d) => d.format === 'reel' || d.format === 'mixed').length;
  const cardDrafts = approved.length - reelDrafts;

  console.log('\n[3] 렌더 결과');
  console.log(`  approved 렌더: ${approved.length}건 (카드형 ${cardDrafts} / 릴형 ${reelDrafts})`);
  console.log(`  산출 에셋: ${assets.length}개 — 카드 PNG ${cardCount}, 릴 MP4 ${reelCount}`);
  console.log(`  카드 PNG 평균: ${avg(cardMs)}ms/장`);
  console.log(`  릴 MP4 평균: ${avg(reelMs)}ms/편`);
  console.log(`  초안당 평균(멀티플랫폼 포함): ${avg(perDraftMs)}ms`);
  console.log(`  총 벽시계: ${(wallMs / 1000).toFixed(1)}s`);

  // 300건/일 = 승인초안 300건 렌더. 초안당 평균으로 순차 추정 + 병렬 보정.
  const perDraft = avg(perDraftMs) || 1;
  const seqHours = (perDraft * 300) / 3600000;
  const cores = Math.max(1, os.cpus().length - 1);
  const parHours = seqHours / cores;
  console.log('\n[4] 300건/일 처리 가능성');
  console.log(`  초안당 ${perDraft}ms × 300 = 순차 ${seqHours.toFixed(2)}h`);
  console.log(`  병렬 ${cores}코어 보정 ≈ ${parHours.toFixed(2)}h`);
  const windowH = 2.5; // 타임라인 06:30~09:00 렌더 창
  const verdict = parHours <= windowH ? '✅ 창(06:30~09:00, 2.5h) 내 처리 가능' : `⚠️ 창 초과 — 코어 증설 또는 창 확대 필요 (필요 코어≈${Math.ceil(seqHours / windowH)})`;
  console.log(`  판정: ${verdict}`);
  console.log('\n  ※ 이 환경 측정치는 참고용. 프로덕션 8코어+ VPS 에서 재측정 권장.');

  console.log('\n[5] 샘플 에셋 경로');
  for (const a of assets.slice(0, 6)) {
    console.log(`  [${a.platform}] ${a.kind} ${a.width}x${a.height} → ${path.relative(process.cwd(), a.storage_path)}`);
  }
  console.log('\n===== 데모 종료 =====\n');
}

main().catch(async (err) => {
  console.error('Phase2 데모 실패:', err);
  await closeBrowser();
  process.exitCode = 1;
});
