/**
 * 포트 정의. ugc-core에서 검증한 패턴 그대로 — 엔진은 DB 드라이버를 모른다.
 */
import type {
  Complex,
  IngestStats,
  NormalizedDeal,
  PageRegistryEntry,
  RawRecord,
  Region,
  RegionLevel,
  Transaction,
} from "./types.js";

/** 영속 포트. Supabase 어댑터(Phase 1)와 인메모리 구현이 이걸 충족한다. */
export interface EngineStore {
  /** raw 적재. 이미 있으면(자연키 중복) false. */
  insertRaw(record: RawRecord): Promise<boolean>;

  /** 지역 upsert — (level, code) 기준. 반환은 영속된 행. */
  upsertRegion(row: Omit<Region, "id">): Promise<Region>;

  /** 단지 upsert — (datasetKey, regionId, name) 기준. */
  upsertComplex(row: Omit<Complex, "id">): Promise<Complex>;

  /** 거래 upsert — (datasetKey, sourceId) 기준. 새로 삽입됐으면 true. */
  upsertTransaction(row: Omit<Transaction, "id">): Promise<boolean>;

  /** 커서 조회/저장 — 증분 수집의 기준점. */
  getCursor(datasetKey: string, scope: string): Promise<string | null>;
  setCursor(datasetKey: string, scope: string, cursor: string): Promise<void>;

  /** 단지별 거래 수 (data_score 계산용). */
  countTransactions(complexId: number): Promise<number>;

  upsertPage(entry: PageRegistryEntry): Promise<void>;
}

/**
 * 데이터셋 어댑터 — 데이터셋별 차이를 전부 흡수하는 유일한 경계.
 * 두 번째 데이터셋(주유소 등)은 이 인터페이스 구현 하나로 같은 엔진에 꽂힌다.
 */
export interface DatasetAdapter {
  key: string;

  /**
   * scope(예: 시군구 코드)와 커서(예: 계약월 YYYYMM)로 한 배치를 수집.
   * 반환: 정규화된 거래 목록 + 다음 커서(더 없으면 null).
   */
  fetchBatch(
    scope: string,
    cursor: string | null,
  ): Promise<{ deals: NormalizedDeal[]; nextCursor: string | null }>;
}

/** HTTP 포트 — 실 API 호출을 주입식으로 (테스트에선 픽스처 서버). */
export type HttpGet = (url: string) => Promise<{ status: number; body: string }>;

export interface Clock {
  nowMs(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export type { IngestStats, RegionLevel };
