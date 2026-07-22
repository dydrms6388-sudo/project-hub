// 게시 스토어: 큐/게시기록/레이트로그. dry-run=JSON, 실서비스=Supabase.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSupabase } from '../env.js';
import { supabase } from '../supabase.js';
import { makeLogger } from '../logger.js';
import type { AccountState, PublishJob } from './types.js';

const log = makeLogger('pub-store');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'output');

export type PostRecord = {
  id: string;
  account_id: string;
  draft_id: string;
  platform: string;
  external_id: string;
  permalink: string;
  caption: string;
  published_at: string;
};

export type RateLimitEntry = {
  account_id: string;
  endpoint: string;
  app_usage: number | null;
  buc_usage: number | null;
  publishing_quota_usage: number | null;
  created_at: string;
};

export interface PublishStore {
  readonly kind: 'json' | 'supabase';
  enqueue(jobs: PublishJob[]): Promise<void>;
  dueJobs(nowIso: string, limit: number): Promise<PublishJob[]>;
  updateJob(id: string, patch: Partial<PublishJob>): Promise<void>;
  countPublishedSince(accountId: string, sinceIso: string): Promise<number>;
  lastPublishedAt(accountId: string): Promise<number | null>;
  recentPublishedCaptions(accountId: string, days: number): Promise<string[]>;
  recordPost(post: PostRecord): Promise<void>;
  logRateLimit(entry: RateLimitEntry): Promise<void>;
  setAccountCooldown(accountId: string, state: AccountState, cooldownUntilIso: string | null): Promise<void>;
  allJobs(): Promise<PublishJob[]>;
}

// ── JSON ──

class JsonPublishStore implements PublishStore {
  readonly kind = 'json' as const;
  private q = path.join(OUTPUT_DIR, 'publish_queue.json');
  private p = path.join(OUTPUT_DIR, 'posts.json');
  private r = path.join(OUTPUT_DIR, 'rate_limit_log.json');
  private a = path.join(OUTPUT_DIR, 'account_state.json');

  private async read<T>(f: string): Promise<T[]> {
    try {
      return JSON.parse(await fs.readFile(f, 'utf8')) as T[];
    } catch {
      return [];
    }
  }
  private async write<T>(f: string, d: T[]): Promise<void> {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(f, JSON.stringify(d, null, 2), 'utf8');
  }

  async enqueue(jobs: PublishJob[]): Promise<void> {
    const cur = await this.read<PublishJob>(this.q);
    await this.write(this.q, [...cur, ...jobs]);
  }
  async dueJobs(nowIso: string, limit: number): Promise<PublishJob[]> {
    const all = await this.read<PublishJob>(this.q);
    return all
      .filter((j) => (j.state === 'queued' || j.state === 'throttled') && j.scheduled_at <= nowIso)
      .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
      .slice(0, limit);
  }
  async updateJob(id: string, patch: Partial<PublishJob>): Promise<void> {
    const all = await this.read<PublishJob>(this.q);
    const idx = all.findIndex((j) => j.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx]!, ...patch };
      await this.write(this.q, all);
    }
  }
  async countPublishedSince(accountId: string, sinceIso: string): Promise<number> {
    const posts = await this.read<PostRecord>(this.p);
    return posts.filter((x) => x.account_id === accountId && x.published_at >= sinceIso).length;
  }
  async lastPublishedAt(accountId: string): Promise<number | null> {
    const posts = await this.read<PostRecord>(this.p);
    const times = posts.filter((x) => x.account_id === accountId).map((x) => Date.parse(x.published_at));
    return times.length ? Math.max(...times) : null;
  }
  async recentPublishedCaptions(accountId: string, days: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const posts = await this.read<PostRecord>(this.p);
    return posts.filter((x) => x.account_id === accountId && x.published_at >= cutoff).map((x) => x.caption);
  }
  async recordPost(post: PostRecord): Promise<void> {
    const cur = await this.read<PostRecord>(this.p);
    await this.write(this.p, [...cur, post]);
  }
  async logRateLimit(entry: RateLimitEntry): Promise<void> {
    const cur = await this.read<RateLimitEntry>(this.r);
    await this.write(this.r, [...cur, entry]);
  }
  async setAccountCooldown(accountId: string, state: AccountState, cooldownUntilIso: string | null): Promise<void> {
    const cur = await this.read<{ account_id: string; state: AccountState; cooldown_until: string | null }>(this.a);
    const idx = cur.findIndex((x) => x.account_id === accountId);
    const row = { account_id: accountId, state, cooldown_until: cooldownUntilIso };
    if (idx >= 0) cur[idx] = row;
    else cur.push(row);
    await this.write(this.a, cur);
  }
  async allJobs(): Promise<PublishJob[]> {
    return this.read<PublishJob>(this.q);
  }
}

// ── Supabase ──

class SupabasePublishStore implements PublishStore {
  readonly kind = 'supabase' as const;

  async enqueue(jobs: PublishJob[]): Promise<void> {
    if (!jobs.length) return;
    const rows = jobs.map((j) => ({
      id: j.id,
      vertical: j.vertical,
      account_id: j.account_id,
      asset_id: j.asset_id,
      platform: j.platform,
      scheduled_at: j.scheduled_at,
      state: j.state,
      attempts: j.attempts,
      last_error: j.last_error ?? null,
    }));
    const { error } = await supabase().from('publish_queue').insert(rows);
    if (error) throw new Error(`publish_queue insert 실패: ${error.message}`);
  }
  async dueJobs(nowIso: string, limit: number): Promise<PublishJob[]> {
    const { data, error } = await supabase()
      .from('publish_queue')
      .select('*')
      .in('state', ['queued', 'throttled'])
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`dueJobs 실패: ${error.message}`);
    return (data ?? []) as unknown as PublishJob[];
  }
  async updateJob(id: string, patch: Partial<PublishJob>): Promise<void> {
    const { error } = await supabase().from('publish_queue').update(patch).eq('id', id);
    if (error) throw new Error(`updateJob 실패: ${error.message}`);
  }
  async countPublishedSince(accountId: string, sinceIso: string): Promise<number> {
    const { count, error } = await supabase()
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('published_at', sinceIso);
    if (error) throw new Error(`countPublishedSince 실패: ${error.message}`);
    return count ?? 0;
  }
  async lastPublishedAt(accountId: string): Promise<number | null> {
    const { data, error } = await supabase()
      .from('posts')
      .select('published_at')
      .eq('account_id', accountId)
      .order('published_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`lastPublishedAt 실패: ${error.message}`);
    const iso = (data?.[0] as { published_at?: string } | undefined)?.published_at;
    return iso ? Date.parse(iso) : null;
  }
  async recentPublishedCaptions(accountId: string, days: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await supabase()
      .from('posts')
      .select('draft_id, drafts(caption)')
      .eq('account_id', accountId)
      .gte('published_at', cutoff);
    if (error) throw new Error(`recentPublishedCaptions 실패: ${error.message}`);
    return (data ?? [])
      .map((r) => (r as { drafts?: { caption?: string } }).drafts?.caption ?? '')
      .filter(Boolean);
  }
  async recordPost(post: PostRecord): Promise<void> {
    const { error } = await supabase().from('posts').insert({
      id: post.id,
      account_id: post.account_id,
      draft_id: post.draft_id,
      platform: post.platform,
      external_id: post.external_id,
      permalink: post.permalink,
      published_at: post.published_at,
    });
    if (error) throw new Error(`recordPost 실패: ${error.message}`);
  }
  async logRateLimit(entry: RateLimitEntry): Promise<void> {
    const { error } = await supabase().from('rate_limit_log').insert(entry);
    if (error) log.warn(`rate_limit_log insert 경고: ${error.message}`);
  }
  async setAccountCooldown(accountId: string, state: AccountState, cooldownUntilIso: string | null): Promise<void> {
    const { error } = await supabase()
      .from('accounts')
      .update({ state, cooldown_until: cooldownUntilIso })
      .eq('id', accountId);
    if (error) throw new Error(`setAccountCooldown 실패: ${error.message}`);
  }
  async allJobs(): Promise<PublishJob[]> {
    const { data, error } = await supabase().from('publish_queue').select('*');
    if (error) throw new Error(`allJobs 실패: ${error.message}`);
    return (data ?? []) as unknown as PublishJob[];
  }
}

export function getPublishStore(dryRun: boolean): PublishStore {
  if (dryRun || !hasSupabase()) return new JsonPublishStore();
  return new SupabasePublishStore();
}
