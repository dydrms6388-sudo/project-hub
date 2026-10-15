// Meta Graph API 게시 어댑터 (Instagram + Facebook 공용).
// IG: 컨테이너 생성(/media) → status_code=FINISHED 폴링(지수백오프, 최대 5분) → /media_publish.
// 릴은 media_type=REELS. FB 페이지는 /{page-id}/photos|videos.
// ⚠️ 미디어는 공개 URL 이어야 한다(Graph 가 URL 에서 pull). job.storage_path = 공개 URL.
//    dry-run 로컬 파일 경로로는 실제 게시 불가 → SimPublisher 로 검증.

import { parseAppUsage, parseBusinessUseCaseUsage } from '../../http.js';
import { makeLogger } from '../../logger.js';
import type { Account, PlatformPublisher, PublishJob, PublishOutcome, UsageSample } from '../types.js';

const log = makeLogger('meta');
const GRAPH = 'https://graph.facebook.com/v21.0';

type GraphResult = { json: Record<string, unknown>; usage: UsageSample; status: number };

async function graphCall(
  url: string,
  init: RequestInit,
  publishingQuota: number | null = null,
): Promise<GraphResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const usage: UsageSample = {
      appUsage: parseAppUsage(res.headers.get('x-app-usage'))?.worst ?? null,
      bucUsage: parseBusinessUseCaseUsage(res.headers.get('x-business-use-case-usage')),
      publishingQuota,
    };
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { json, usage, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class IgPublisher implements PlatformPublisher {
  readonly platform = 'ig' as const;

  async publishingUsage(account: Account, token: string): Promise<number | null> {
    const url = `${GRAPH}/${account.external_user_id}/content_publishing_limit?fields=quota_usage,config&access_token=${token}`;
    const { json } = await graphCall(url, { method: 'GET' });
    const data = (json['data'] as Array<Record<string, unknown>> | undefined)?.[0];
    if (!data) return null;
    const used = Number(data['quota_usage'] ?? 0);
    const total = Number((data['config'] as Record<string, unknown> | undefined)?.['quota_total'] ?? 50);
    return total > 0 ? used / total : null;
  }

  async publish(job: PublishJob, account: Account, token: string): Promise<PublishOutcome> {
    const isReel = job.kind === 'reel_mp4';
    // 1) 컨테이너 생성
    const createUrl = `${GRAPH}/${account.external_user_id}/media`;
    const body = new URLSearchParams({ caption: job.caption, access_token: token });
    if (isReel) {
      body.set('media_type', 'REELS');
      body.set('video_url', job.storage_path);
    } else {
      body.set('image_url', job.storage_path);
    }
    const created = await graphCall(createUrl, { method: 'POST', body });
    const creationId = created.json['id'] as string | undefined;
    if (!creationId) {
      return { ok: false, error: `컨테이너 생성 실패: ${JSON.stringify(created.json)}`, usage: created.usage, retryable: created.status >= 500 };
    }

    // 2) status_code=FINISHED 폴링 (지수백오프, 최대 5분)
    const deadline = Date.now() + 5 * 60 * 1000;
    let delay = 3000;
    let lastUsage = created.usage;
    while (Date.now() < deadline) {
      await sleep(delay);
      const statusUrl = `${GRAPH}/${creationId}?fields=status_code,status&access_token=${token}`;
      const st = await graphCall(statusUrl, { method: 'GET' });
      lastUsage = st.usage;
      const code = st.json['status_code'] as string | undefined;
      if (code === 'FINISHED') break;
      if (code === 'ERROR') return { ok: false, error: `미디어 처리 오류: ${JSON.stringify(st.json)}`, usage: st.usage };
      delay = Math.min(delay * 2, 30_000);
    }

    // 3) 게시
    const pubUrl = `${GRAPH}/${account.external_user_id}/media_publish`;
    const pub = await graphCall(pubUrl, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: creationId, access_token: token }),
    });
    const mediaId = pub.json['id'] as string | undefined;
    if (!mediaId) {
      return { ok: false, error: `media_publish 실패: ${JSON.stringify(pub.json)}`, usage: pub.usage, retryable: pub.status >= 500 };
    }
    log.info(`IG 게시 완료 media=${mediaId}`);
    return { ok: true, externalId: mediaId, permalink: `https://instagram.com/p/${mediaId}`, usage: lastUsage };
  }
}

export class FbPublisher implements PlatformPublisher {
  readonly platform = 'fb' as const;

  async publishingUsage(_account: Account, _token: string): Promise<number | null> {
    return null; // FB 페이지는 별도 상한 버킷; 헤더 사용률로 거버닝.
  }

  async publish(job: PublishJob, account: Account, token: string): Promise<PublishOutcome> {
    const isVideo = job.kind === 'reel_mp4';
    const url = isVideo
      ? `${GRAPH}/${account.external_user_id}/videos`
      : `${GRAPH}/${account.external_user_id}/photos`;
    const body = new URLSearchParams({ access_token: token });
    if (isVideo) {
      body.set('file_url', job.storage_path);
      body.set('description', job.caption);
    } else {
      body.set('url', job.storage_path);
      body.set('caption', job.caption);
    }
    const res = await graphCall(url, { method: 'POST', body });
    const id = (res.json['id'] || res.json['post_id']) as string | undefined;
    if (!id) return { ok: false, error: `FB 게시 실패: ${JSON.stringify(res.json)}`, usage: res.usage, retryable: res.status >= 500 };
    return { ok: true, externalId: id, permalink: `https://facebook.com/${id}`, usage: res.usage };
  }
}
