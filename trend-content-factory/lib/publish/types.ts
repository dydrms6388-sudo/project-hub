// 게시(M5) 도메인 타입.

import type { AssetKind, Platform } from '../types.js';

export type { Platform } from '../types.js';

export type PublishState = 'queued' | 'reserved' | 'uploading' | 'published' | 'failed' | 'throttled';

export type AccountState = 'active' | 'paused' | 'cooldown' | 'disabled';

export type Account = {
  id: string;
  vertical_slug: string;
  platform: Platform;
  /** ig_user_id / fb_page_id / tiktok open_id / threads user id / x user id */
  external_user_id: string;
  /** 토큰이 담긴 env 변수명 (테스트 계정). 실서비스는 Vault 참조. 시뮬레이션은 없음 */
  token_env?: string;
  /** 워밍업 시작일 ISO(YYYY-MM-DD). 없으면 워밍업 미적용(=성숙 계정) */
  warmup_started_at?: string;
  daily_cap_override?: number;
  state: AccountState;
  cooldown_until?: string;
};

export type PublishJob = {
  id: string;
  vertical: string;
  draft_id: string;
  asset_id: string;
  account_id: string;
  platform: Platform;
  kind: AssetKind;
  storage_path: string;
  caption: string;
  scheduled_at: string; // ISO
  state: PublishState;
  attempts: number;
  last_error?: string;
  created_at: string;
};

/** Graph/플랫폼 응답에서 뽑은 사용률 샘플 (0~100+). */
export type UsageSample = {
  appUsage: number | null; // X-App-Usage worst
  bucUsage: number | null; // X-Business-Use-Case-Usage worst
  publishingQuota: number | null; // content_publishing_limit quota_usage
};

export type PublishOutcome = {
  ok: boolean;
  externalId?: string;
  permalink?: string;
  usage?: UsageSample;
  error?: string;
  /** 재시도 가능한 일시적 실패면 true → throttled 로 큐 반환 */
  retryable?: boolean;
};

export interface PlatformPublisher {
  readonly platform: Platform;
  /** 24h 게시 상한 대비 사용률(0~1). 알 수 없으면 null. */
  publishingUsage(account: Account, token: string): Promise<number | null>;
  /** 실제 게시. 컨테이너 생성→폴링→publish 등 플랫폼별 절차 포함. */
  publish(job: PublishJob, account: Account, token: string): Promise<PublishOutcome>;
}
