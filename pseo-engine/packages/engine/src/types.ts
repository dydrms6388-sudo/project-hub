/** Core domain types. DB-driver-independent (schema.sql의 행 형태와 1:1). */

export type RegionLevel = "sido" | "sigungu" | "dong";

export interface Region {
  id: number;
  level: RegionLevel;
  /** 법정동코드 prefix — 시도 2 / 시군구 5 / 읍면동 10자리. */
  code: string;
  name: string;
  parentId: number | null;
  slug: string;
}

export interface Complex {
  id: number;
  datasetKey: string;
  regionId: number;
  name: string;
  slug: string;
  builtYear: number | null;
}

export interface Transaction {
  id: number;
  datasetKey: string;
  complexId: number;
  dealDate: string; // YYYY-MM-DD
  priceKrw: number; // 원 단위
  areaM2: number;
  floor: number | null;
  sourceId: string;
}

export interface RawRecord {
  datasetKey: string;
  sourceId: string;
  payload: unknown;
}

export type PageEntityType =
  | "overview"
  | "sido"
  | "sigungu"
  | "dong"
  | "complex"
  | "complex_year";

export interface PageRegistryEntry {
  datasetKey: string;
  url: string;
  entityType: PageEntityType;
  entityId: number;
  dataScore: number;
  noindex: boolean;
}

/** 정규화된 한 건 — 어댑터가 raw payload에서 뽑아낸다. */
export interface NormalizedDeal {
  sourceId: string;
  region: { sidoName: string; sigunguName: string; sigunguCode: string; dongName: string };
  complexName: string;
  builtYear: number | null;
  dealDate: string; // YYYY-MM-DD
  priceKrw: number;
  areaM2: number;
  floor: number | null;
}

export interface IngestStats {
  fetched: number;
  rawInserted: number;
  rawDuplicates: number;
  transactionsUpserted: number;
  complexesCreated: number;
  regionsCreated: number;
}
