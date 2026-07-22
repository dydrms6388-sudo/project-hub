/** @pseo/engine — 공공데이터 → 롱테일 페이지 엔진 (Phase 0: 수집 계층). */

export type {
  Region,
  RegionLevel,
  Complex,
  Transaction,
  RawRecord,
  NormalizedDeal,
  PageEntityType,
  PageRegistryEntry,
  IngestStats,
} from "./types.js";

export type { EngineStore, DatasetAdapter, HttpGet, Clock } from "./ports.js";
export { realClock } from "./ports.js";

export { ingestScope, type IngestOptions } from "./ingest.js";
export {
  dataScore,
  shouldCreatePage,
  MIN_TRANSACTIONS_FOR_PAGE,
  type DataScoreInput,
} from "./data-score.js";

export {
  MolitAptAdapter,
  parseItems,
  parseTotalCount,
  normalizeItem,
  type MolitAptOptions,
} from "./adapters/molit-apt.js";
export { MemoryEngineStore } from "./adapters/memory.js";
