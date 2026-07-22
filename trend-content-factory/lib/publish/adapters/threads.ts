// Threads API 어댑터 (graph.threads.net). 컨테이너 생성 → threads_publish.
// IG 와 유사하나 별도 그래프. 미디어는 공개 URL.

import { makeLogger } from '../../logger.js';
import type { Account, PlatformPublisher, PublishJob, PublishOutcome } from '../types.js';

const log = makeLogger('threads');
const API = 'https://graph.threads.net/v1.0';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function call(url: string): Promise<{ json: Record<string, unknown>; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { json, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export class ThreadsPublisher implements PlatformPublisher {
  readonly platform = 'threads' as const;

  async publishingUsage(): Promise<number | null> {
    return null;
  }

  async publish(job: PublishJob, account: Account, token: string): Promise<PublishOutcome> {
    const isVideo = job.kind === 'reel_mp4';
    const p = new URLSearchParams({ access_token: token, text: job.caption });
    p.set('media_type', isVideo ? 'VIDEO' : 'IMAGE');
    p.set(isVideo ? 'video_url' : 'image_url', job.storage_path);
    const create = await call(`${API}/${account.external_user_id}/threads?${p.toString()}`);
    const creationId = create.json['id'] as string | undefined;
    if (!creationId) {
      return { ok: false, error: `Threads 컨테이너 실패: ${JSON.stringify(create.json)}`, retryable: create.status >= 500 };
    }
    // 영상은 처리시간 필요 → 짧게 대기.
    await sleep(isVideo ? 8000 : 2000);
    const pub = await call(
      `${API}/${account.external_user_id}/threads_publish?creation_id=${creationId}&access_token=${token}`,
    );
    const id = pub.json['id'] as string | undefined;
    if (!id) return { ok: false, error: `Threads publish 실패: ${JSON.stringify(pub.json)}`, retryable: pub.status >= 500 };
    log.info(`Threads 게시 완료 ${id}`);
    return { ok: true, externalId: id, permalink: `https://www.threads.net/@${account.external_user_id}/post/${id}` };
  }
}
