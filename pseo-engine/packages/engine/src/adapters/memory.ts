/**
 * EngineStore 인메모리 구현 — 테스트/로컬 실행용. Supabase 어댑터(Phase 1)가
 * 같은 포트를 충족한다.
 */
import type { EngineStore } from "../ports.js";
import type {
  Complex,
  PageRegistryEntry,
  RawRecord,
  Region,
  Transaction,
} from "../types.js";

export class MemoryEngineStore implements EngineStore {
  raw = new Map<string, RawRecord>();
  regions: Region[] = [];
  complexes: Complex[] = [];
  transactions: Transaction[] = [];
  pages = new Map<string, PageRegistryEntry>();
  cursors = new Map<string, string>();
  private nextId = 1;

  async insertRaw(record: RawRecord): Promise<boolean> {
    const key = `${record.datasetKey}:${record.sourceId}`;
    if (this.raw.has(key)) return false;
    this.raw.set(key, record);
    return true;
  }

  async upsertRegion(row: Omit<Region, "id">): Promise<Region> {
    const found = this.regions.find((r) => r.level === row.level && r.code === row.code);
    if (found) return found;
    const region: Region = { ...row, id: this.nextId++ };
    this.regions.push(region);
    return region;
  }

  async upsertComplex(row: Omit<Complex, "id">): Promise<Complex> {
    const found = this.complexes.find(
      (c) => c.datasetKey === row.datasetKey && c.regionId === row.regionId && c.name === row.name,
    );
    if (found) return found;
    const complex: Complex = { ...row, id: this.nextId++ };
    this.complexes.push(complex);
    return complex;
  }

  async upsertTransaction(row: Omit<Transaction, "id">): Promise<boolean> {
    const exists = this.transactions.some(
      (t) => t.datasetKey === row.datasetKey && t.sourceId === row.sourceId,
    );
    if (exists) return false;
    this.transactions.push({ ...row, id: this.nextId++ });
    return true;
  }

  async getCursor(datasetKey: string, scope: string): Promise<string | null> {
    return this.cursors.get(`${datasetKey}:${scope}`) ?? null;
  }

  async setCursor(datasetKey: string, scope: string, cursor: string): Promise<void> {
    this.cursors.set(`${datasetKey}:${scope}`, cursor);
  }

  async countTransactions(complexId: number): Promise<number> {
    return this.transactions.filter((t) => t.complexId === complexId).length;
  }

  async upsertPage(entry: PageRegistryEntry): Promise<void> {
    this.pages.set(entry.url, entry);
  }
}
