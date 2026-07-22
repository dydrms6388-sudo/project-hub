// 계정 로딩. 실서비스=Supabase accounts 테이블, 그 외=env 테스트 계정 1개.
// 토큰 원문은 절대 코드/DB 에 없다 → token_env(변수명) 참조로만.

import { hasSupabase } from '../env.js';
import { supabase } from '../supabase.js';
import type { Account, AccountState, Platform } from './types.js';

/** env 로 정의된 테스트 계정 1개 (Phase 3). 없으면 null. */
export function testAccountFromEnv(): Account | null {
  const platform = process.env['PUBLISH_TEST_PLATFORM'] as Platform | undefined;
  const external = process.env['PUBLISH_TEST_EXTERNAL_ID'];
  const vertical = process.env['PUBLISH_TEST_VERTICAL'];
  if (!platform || !external || !vertical) return null;
  return {
    id: process.env['PUBLISH_TEST_ACCOUNT_ID'] ?? 'test-account',
    vertical_slug: vertical,
    platform,
    external_user_id: external,
    token_env: process.env['PUBLISH_TEST_TOKEN_ENV'] ?? 'PUBLISH_TEST_TOKEN',
    ...(process.env['PUBLISH_TEST_WARMUP_START'] ? { warmup_started_at: process.env['PUBLISH_TEST_WARMUP_START'] } : {}),
    state: 'active',
  };
}

export async function loadAccountsFromSupabase(): Promise<Account[]> {
  const { data, error } = await supabase().from('accounts').select('*').eq('state', 'active');
  if (error) throw new Error(`accounts 로드 실패: ${error.message}`);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row['id']),
      vertical_slug: String(row['vertical_slug']),
      platform: row['platform'] as Platform,
      external_user_id: String(row['ig_user_id'] ?? row['fb_page_id'] ?? ''),
      state: (row['state'] as AccountState) ?? 'active',
      ...(row['warmup_started_at'] ? { warmup_started_at: String(row['warmup_started_at']) } : {}),
      ...(row['daily_cap_override'] != null ? { daily_cap_override: Number(row['daily_cap_override']) } : {}),
      ...(row['cooldown_until'] ? { cooldown_until: String(row['cooldown_until']) } : {}),
    } satisfies Account;
  });
}

export async function resolveAccounts(dryRun: boolean): Promise<Account[]> {
  if (!dryRun && hasSupabase()) return loadAccountsFromSupabase();
  const test = testAccountFromEnv();
  return test ? [test] : [];
}

export function tokenFor(account: Account): string | null {
  const name = account.token_env;
  if (!name) return null;
  return process.env[name] ?? null;
}
