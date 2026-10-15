/**
 * 증분 수집 오케스트레이션.
 *
 * 흐름(한 scope 기준): 커서 조회 → 어댑터 fetchBatch 반복 → raw 적재(중복 스킵)
 * → 지역 계층/단지 upsert → 거래 upsert → 커서 전진.
 * 전체 재수집 금지: 커서가 있으면 그 다음 배치부터만 간다.
 */
import type { DatasetAdapter, EngineStore } from "./ports.js";
import type { IngestStats, NormalizedDeal, Region } from "./types.js";

/** 시군구 코드에서 시도 코드(앞 2자리)를 얻는다. */
const sidoCode = (sigunguCode: string) => sigunguCode.slice(0, 2);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface IngestOptions {
  /** 커서가 없을 때 시작할 배치 커서(예: '202601'). */
  initialCursor: string;
  /** 한 번의 실행에서 처리할 최대 배치 수(폭주 방지). 기본 12. */
  maxBatches?: number;
}

export async function ingestScope(
  adapter: DatasetAdapter,
  store: EngineStore,
  scope: string,
  opts: IngestOptions,
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0,
    rawInserted: 0,
    rawDuplicates: 0,
    transactionsUpserted: 0,
    complexesCreated: 0,
    regionsCreated: 0,
  };

  const saved = await store.getCursor(adapter.key, scope);
  let cursor: string | null = saved ?? opts.initialCursor;
  const maxBatches = opts.maxBatches ?? 12;

  const regionCache = new Map<string, Region>();
  const complexIds = new Map<string, number>();

  for (let batch = 0; batch < maxBatches && cursor !== null; batch++) {
    const { deals, nextCursor } = await adapter.fetchBatch(scope, cursor);
    stats.fetched += deals.length;

    for (const deal of deals) {
      const fresh = await store.insertRaw({
        datasetKey: adapter.key,
        sourceId: deal.sourceId,
        payload: deal,
      });
      if (!fresh) {
        stats.rawDuplicates++;
        continue; // 이미 처리된 거래 — 정규화 재실행 불필요
      }
      stats.rawInserted++;

      const dong = await ensureRegions(store, deal, regionCache, stats);

      const complexKey = `${dong.id}:${deal.complexName}`;
      let complexId = complexIds.get(complexKey);
      if (complexId === undefined) {
        const complex = await store.upsertComplex({
          datasetKey: adapter.key,
          regionId: dong.id,
          name: deal.complexName,
          slug: `${slugify(deal.complexName)}-${dong.id}`,
          builtYear: deal.builtYear,
        });
        complexId = complex.id;
        complexIds.set(complexKey, complexId);
        stats.complexesCreated++;
      }

      const inserted = await store.upsertTransaction({
        datasetKey: adapter.key,
        complexId,
        dealDate: deal.dealDate,
        priceKrw: deal.priceKrw,
        areaM2: deal.areaM2,
        floor: deal.floor,
        sourceId: deal.sourceId,
      });
      if (inserted) stats.transactionsUpserted++;
    }

    // 배치 성공 시점마다 커서 저장 — 중간 실패해도 재시작 지점이 남는다.
    await store.setCursor(adapter.key, scope, cursor);
    cursor = nextCursor;
  }

  return stats;
}

/** 시도 → 시군구 → 읍면동 계층을 보장하고 읍면동 행을 돌려준다. */
async function ensureRegions(
  store: EngineStore,
  deal: NormalizedDeal,
  cache: Map<string, Region>,
  stats: IngestStats,
): Promise<Region> {
  const { sidoName, sigunguName, sigunguCode, dongName } = deal.region;

  const sidoKey = `sido:${sidoCode(sigunguCode)}`;
  let sido = cache.get(sidoKey);
  if (!sido) {
    sido = await store.upsertRegion({
      level: "sido",
      code: sidoCode(sigunguCode),
      name: sidoName || sidoCode(sigunguCode),
      parentId: null,
      slug: slugify(sidoName || sidoCode(sigunguCode)),
    });
    cache.set(sidoKey, sido);
    stats.regionsCreated++;
  }

  const sggKey = `sigungu:${sigunguCode}`;
  let sigungu = cache.get(sggKey);
  if (!sigungu) {
    sigungu = await store.upsertRegion({
      level: "sigungu",
      code: sigunguCode,
      name: sigunguName || sigunguCode,
      parentId: sido.id,
      slug: slugify(sigunguName || sigunguCode),
    });
    cache.set(sggKey, sigungu);
    stats.regionsCreated++;
  }

  const dongCode = `${sigunguCode}:${dongName}`;
  const dongKey = `dong:${dongCode}`;
  let dong = cache.get(dongKey);
  if (!dong) {
    dong = await store.upsertRegion({
      level: "dong",
      code: dongCode,
      name: dongName,
      parentId: sigungu.id,
      slug: `${slugify(sigunguName || sigunguCode)}-${slugify(dongName)}`,
    });
    cache.set(dongKey, dong);
    stats.regionsCreated++;
  }

  return dong;
}
