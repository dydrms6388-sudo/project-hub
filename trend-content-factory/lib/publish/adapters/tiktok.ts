// TikTok Content Posting API 어댑터 (PULL_FROM_URL). Bearer 토큰(open.tiktokapis.com).
// 영상: video/init → status/fetch 폴링. 사진(포토모드): content/init.
// ⚠️ 미디어는 검증된 도메인의 공개 URL 이어야 한다(TikTok URL prefix 검증).

import { makeLogger } from '../../logger.js';
import type { Account, PlatformPublisher, PublishJob, PublishOutcome } from '../types.js';

const log = makeLogger('tiktok');
const API = 'https://open.tiktokapis.com/v2';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(url: string, token: string, body: unknown): Promise<{ json: Record<string, unknown>; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { json, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export class TikTokPublisher implements PlatformPublisher {
  readonly platform = 'tiktok' as const;

  async publishingUsage(): Promise<number | null> {
    return null; // TikTok 은 별도 사용률 헤더 없음 → 게시 성공/실패로 페이싱.
  }

  async publish(job: PublishJob, _account: Account, token: string): Promise<PublishOutcome> {
    const isVideo = job.kind === 'reel_mp4';
    const initUrl = isVideo ? `${API}/post/publish/video/init/` : `${API}/post/publish/content/init/`;
    const initBody = isVideo
      ? {
          post_info: { title: job.caption.slice(0, 150), privacy_level: 'SELF_ONLY', disable_comment: false },
          source_info: { source: 'PULL_FROM_URL', video_url: job.storage_path },
        }
      : {
          post_info: { title: job.caption.slice(0, 90), description: job.caption, privacy_level: 'SELF_ONLY' },
          source_info: { source: 'PULL_FROM_URL', photo_images: [job.storage_path], photo_cover_index: 0 },
          media_type: 'PHOTO',
          post_mode: 'DIRECT_POST',
        };
    const init = await post(initUrl, token, initBody);
    const data = init.json['data'] as Record<string, unknown> | undefined;
    const publishId = data?.['publish_id'] as string | undefined;
    if (!publishId) {
      return { ok: false, error: `TikTok init 실패: ${JSON.stringify(init.json)}`, retryable: init.status >= 500 };
    }

    // 상태 폴링 (최대 5분).
    const deadline = Date.now() + 5 * 60 * 1000;
    let delay = 3000;
    while (Date.now() < deadline) {
      await sleep(delay);
      const st = await post(`${API}/post/publish/status/fetch/`, token, { publish_id: publishId });
      const status = (st.json['data'] as Record<string, unknown> | undefined)?.['status'] as string | undefined;
      if (status === 'PUBLISH_COMPLETE') {
        log.info(`TikTok 게시 완료 ${publishId}`);
        return { ok: true, externalId: publishId };
      }
      if (status === 'FAILED') return { ok: false, error: `TikTok 처리 실패: ${JSON.stringify(st.json)}` };
      delay = Math.min(delay * 2, 30_000);
    }
    return { ok: false, error: 'TikTok 상태 폴링 타임아웃', retryable: true };
  }
}
