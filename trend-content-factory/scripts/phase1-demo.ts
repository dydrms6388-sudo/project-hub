// Phase 1 드라이런 데모.
// 트렌드 ~100건 수집 → 초안 ~50건 생성 → JSON 스키마 검증 → 초안 3건 콘솔 출력.
// 사용: npm run phase1:demo   (또는 tsx scripts/phase1-demo.ts)
//
// 네트워크 소스는 best-effort. 일부 소스가 막혀도 파이프라인은 격리되어 계속 진행하며,
// 최종적으로 실제 수집/생성된 건수를 정직하게 리포트한다.

import { VERTICALS } from '../config/verticals.js';
import { makeLogger } from '../lib/logger.js';
import { dedupeTrends, rankAndSelect } from '../lib/scoring.js';
import { draftSchema } from '../lib/draftSchema.js';
import type { DraftRecord, TrendItem } from '../lib/types.js';
import { ingestVertical } from '../workers/ingest/pipeline.js';
import { composeForVertical } from '../workers/compose/pipeline.js';
import { makeComposer } from '../workers/compose/composer.js';

const log = makeLogger('demo');

const TREND_TARGET = 100;
const DRAFT_TARGET = 50;
const PER_SOURCE = 12;

async function collectTrends(): Promise<Map<string, TrendItem[]>> {
  const byVertical = new Map<string, TrendItem[]>();
  let total = 0;
  for (const v of VERTICALS) {
    if (total >= TREND_TARGET) break;
    const raw = await ingestVertical(v, PER_SOURCE, []);
    const selected = rankAndSelect(dedupeTrends(raw), 12);
    if (selected.length > 0) {
      byVertical.set(v.slug, selected);
      total += selected.length;
    }
    log.info(`누적 트렌드 ${total}/${TREND_TARGET} (마지막: ${v.slug} +${selected.length})`);
  }
  return byVertical;
}

async function main(): Promise<void> {
  console.log('\n===== Phase 1 데모: 수집 → 생성 → 검증 =====\n');

  // 1) 수집
  const trendsByVertical = await collectTrends();
  const allTrends = [...trendsByVertical.values()].flat();
  console.log(`\n[1] 트렌드 수집: ${allTrends.length}건 (목표 ${TREND_TARGET})`);
  if (allTrends.length === 0) {
    console.log('⚠️  라이브 소스에서 수집 0건 — 네트워크/프록시 제약 가능. (스키마·파이프라인은 정상)');
  }

  // 2) 생성
  const composer = makeComposer();
  const drafts: DraftRecord[] = [];
  for (const [slug, trends] of trendsByVertical) {
    if (drafts.length >= DRAFT_TARGET) break;
    const v = VERTICALS.find((x) => x.slug === slug)!;
    const produced = await composeForVertical(composer, v, trends, Math.ceil(trends.length / 2.5));
    drafts.push(...produced);
    log.info(`누적 초안 ${drafts.length}/${DRAFT_TARGET} (마지막: ${slug} +${produced.length})`);
  }
  console.log(`\n[2] 초안 생성: ${drafts.length}건 (composer=${composer.mode}, 목표 ${DRAFT_TARGET})`);

  // 3) 스키마 검증
  let valid = 0;
  const invalid: string[] = [];
  for (const d of drafts) {
    const r = draftSchema.safeParse(d);
    if (r.success) valid += 1;
    else invalid.push(`${d.vertical}/${d.trend_title.slice(0, 24)}: ${r.error.issues[0]?.message ?? 'invalid'}`);
  }
  console.log(`\n[3] JSON 스키마 검증: ${valid}/${drafts.length} 통과`);
  if (invalid.length > 0) {
    console.log('   검증 실패 샘플:');
    for (const line of invalid.slice(0, 5)) console.log(`   - ${line}`);
  }
  const passedGate = drafts.filter((d) => d.status === 'draft').length;
  console.log(`   사전 품질게이트 통과: ${passedGate}/${drafts.length}`);

  // 4) 샘플 3건 출력
  console.log('\n[4] 생성된 초안 샘플 3건\n');
  const samples = drafts.filter((d) => d.status === 'draft').slice(0, 3);
  const show = samples.length > 0 ? samples : drafts.slice(0, 3);
  show.forEach((d, i) => {
    console.log(`──────── 샘플 ${i + 1} [${d.vertical}] (${d.mock ? 'mock' : 'claude'}) ────────`);
    console.log(`  트렌드 : ${d.trend_title}`);
    console.log(`  hook   : ${d.hook}`);
    console.log(`  slides : ${d.slides.length}장`);
    d.slides.forEach((s, j) => console.log(`    ${j + 1}. ${s.headline} — ${s.body.slice(0, 50)}`));
    console.log(`  caption: ${d.caption.slice(0, 140)}`);
    console.log(`  tags   : ${d.hashtags.join(' ')}`);
    console.log(`  cta    : ${d.cta}`);
    console.log(`  risk   : ${d.risk_flags.join(',')} | fact_confidence=${d.fact_confidence} | status=${d.status}`);
    console.log(`  source : ${d.source_url}`);
    console.log('');
  });

  console.log('===== 데모 종료 =====');
  console.log(
    `요약: 트렌드 ${allTrends.length} / 초안 ${drafts.length} / 스키마통과 ${valid} / 게이트통과 ${passedGate}\n`,
  );
}

main().catch((err) => {
  console.error('데모 실패:', err);
  process.exitCode = 1;
});
