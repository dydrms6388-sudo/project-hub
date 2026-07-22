// 스토어 추상화: dry-run 은 로컬 JSON 파일, 실서비스는 Supabase.
// 워커는 Store 인터페이스에만 의존한다.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DraftRecord, TrendItem } from './types.js';
import { hasSupabase } from './env.js';
import { supabase } from './supabase.js';
import { makeLogger } from './logger.js';

const log = makeLogger('store');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

export interface Store {
  readonly kind: 'json' | 'supabase';
  saveTrends(items: TrendItem[]): Promise<void>;
  loadTrends(vertical?: string): Promise<TrendItem[]>;
  /** 최근 N일 내 사용된 트렌드/초안 제목 (novelty·중복 판정용) */
  recentTitles(vertical: string, days: number): Promise<string[]>;
  saveDrafts(drafts: DraftRecord[]): Promise<void>;
  loadDrafts(): Promise<DraftRecord[]>;
}

// ── JSON 파일 스토어 (dry-run 기본) ──

class JsonStore implements Store {
  readonly kind = 'json' as const;
  private trendsPath = path.join(OUTPUT_DIR, 'trends.json');
  private draftsPath = path.join(OUTPUT_DIR, 'drafts.json');

  private async readArray<T>(p: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(p, 'utf8');
      return JSON.parse(raw) as T[];
    } catch {
      return [];
    }
  }

  private async writeArray<T>(p: string, data: T[]): Promise<void> {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
  }

  async saveTrends(items: TrendItem[]): Promise<void> {
    const existing = await this.readArray<TrendItem>(this.trendsPath);
    await this.writeArray(this.trendsPath, [...existing, ...items]);
    log.info(`JSON 스토어: 트렌드 ${items.length}건 저장 (누적 ${existing.length + items.length})`);
  }

  async loadTrends(vertical?: string): Promise<TrendItem[]> {
    const all = await this.readArray<TrendItem>(this.trendsPath);
    return vertical ? all.filter((t) => t.vertical === vertical) : all;
  }

  async recentTitles(vertical: string, days: number): Promise<string[]> {
    const cutoff = daysAgoIso(days);
    const all = await this.readArray<TrendItem>(this.trendsPath);
    return all
      .filter((t) => t.vertical === vertical && t.collected_at >= cutoff)
      .map((t) => t.title);
  }

  async saveDrafts(drafts: DraftRecord[]): Promise<void> {
    const existing = await this.readArray<DraftRecord>(this.draftsPath);
    await this.writeArray(this.draftsPath, [...existing, ...drafts]);
    log.info(`JSON 스토어: 초안 ${drafts.length}건 저장 (누적 ${existing.length + drafts.length})`);
  }

  async loadDrafts(): Promise<DraftRecord[]> {
    return this.readArray<DraftRecord>(this.draftsPath);
  }
}

// ── Supabase 스토어 (실서비스) ──

class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;

  async saveTrends(items: TrendItem[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await supabase().from('trends').insert(items);
    if (error) throw new Error(`trends insert 실패: ${error.message}`);
  }

  async loadTrends(vertical?: string): Promise<TrendItem[]> {
    let q = supabase().from('trends').select('*');
    if (vertical) q = q.eq('vertical', vertical);
    const { data, error } = await q;
    if (error) throw new Error(`trends select 실패: ${error.message}`);
    return (data ?? []) as TrendItem[];
  }

  async recentTitles(vertical: string, days: number): Promise<string[]> {
    const { data, error } = await supabase()
      .from('trends')
      .select('title')
      .eq('vertical', vertical)
      .gte('collected_at', daysAgoIso(days));
    if (error) throw new Error(`recentTitles 실패: ${error.message}`);
    return (data ?? []).map((r) => (r as { title: string }).title);
  }

  async saveDrafts(drafts: DraftRecord[]): Promise<void> {
    if (drafts.length === 0) return;
    const { error } = await supabase().from('drafts').insert(drafts);
    if (error) throw new Error(`drafts insert 실패: ${error.message}`);
  }

  async loadDrafts(): Promise<DraftRecord[]> {
    const { data, error } = await supabase().from('drafts').select('*');
    if (error) throw new Error(`drafts select 실패: ${error.message}`);
    return (data ?? []) as DraftRecord[];
  }
}

function daysAgoIso(days: number): string {
  // Date.now 사용 (워커 런타임). 결정론 필요 시 주입형으로 확장 가능.
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * dryRun=true 또는 Supabase 미설정 → JSON 스토어.
 * 그 외 → Supabase 스토어.
 */
export function getStore(dryRun: boolean): Store {
  if (dryRun || !hasSupabase()) return new JsonStore();
  return new SupabaseStore();
}
