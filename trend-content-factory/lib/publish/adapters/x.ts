// X(Twitter) API 어댑터. 미디어 업로드(v1.1 chunked) → 트윗 생성(v2).
// 사용자 컨텍스트 토큰 필요 (스코프: tweet.write, media.write). storage_path=미디어 공개 URL.
// ⚠️ X 미디어 업로드는 OAuth 사용자 컨텍스트가 필요하다. 토큰 발급/갱신 절차는 README 런북 참고.

import { makeLogger } from '../../logger.js';
import type { Account, PlatformPublisher, PublishJob, PublishOutcome } from '../types.js';

const log = makeLogger('x');
const UPLOAD = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEET = 'https://api.x.com/2/tweets';

async function fetchMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`미디어 다운로드 실패 ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadMedia(bytes: Buffer, mime: string, token: string): Promise<string> {
  const auth = { authorization: `Bearer ${token}` };
  // INIT
  const initRes = await fetch(UPLOAD, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(bytes.length),
      media_type: mime,
      media_category: mime.startsWith('video') ? 'tweet_video' : 'tweet_image',
    }),
  });
  const initJson = (await initRes.json()) as { media_id_string?: string };
  const mediaId = initJson.media_id_string;
  if (!mediaId) throw new Error(`X media INIT 실패: ${JSON.stringify(initJson)}`);

  // APPEND (단일 청크; 대용량은 분할 필요)
  const form = new FormData();
  form.set('command', 'APPEND');
  form.set('media_id', mediaId);
  form.set('segment_index', '0');
  form.set('media', new Blob([new Uint8Array(bytes)], { type: mime }));
  await fetch(UPLOAD, { method: 'POST', headers: auth, body: form });

  // FINALIZE
  await fetch(UPLOAD, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
  });
  return mediaId;
}

export class XPublisher implements PlatformPublisher {
  readonly platform = 'x' as const;

  async publishingUsage(): Promise<number | null> {
    return null; // X 는 429/헤더로 페이싱.
  }

  async publish(job: PublishJob, _account: Account, token: string): Promise<PublishOutcome> {
    try {
      const mime = job.kind === 'reel_mp4' ? 'video/mp4' : 'image/png';
      const bytes = await fetchMedia(job.storage_path);
      const mediaId = await uploadMedia(bytes, mime, token);
      const res = await fetch(TWEET, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ text: job.caption.slice(0, 280), media: { media_ids: [mediaId] } }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
      const id = json.data?.id;
      if (!id) return { ok: false, error: `X 트윗 실패: ${JSON.stringify(json)}`, retryable: res.status >= 500 };
      log.info(`X 게시 완료 ${id}`);
      return { ok: true, externalId: id, permalink: `https://x.com/i/status/${id}` };
    } catch (err) {
      return { ok: false, error: String(err), retryable: true };
    }
  }
}
