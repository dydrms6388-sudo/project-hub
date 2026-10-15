// YouTube Data API v3 — 인기 영상 차트. YOUTUBE_API_KEY 없으면 skip.

import { env } from '../../../lib/env.js';
import { fetchJson } from '../../../lib/http.js';
import { makeLogger } from '../../../lib/logger.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, num, type RawTrend, type SourceAdapter } from './base.js';

const log = makeLogger('yt');

type YtResponse = {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; description?: string; channelTitle?: string };
    statistics?: { viewCount?: string; likeCount?: string };
  }>;
};

export class YouTubePopularAdapter implements SourceAdapter {
  readonly type = 'youtube_popular' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    if (!env.youtubeApiKey) {
      log.warn('YOUTUBE_API_KEY 없음 → youtube_popular skip');
      return [];
    }
    const region = String(source.params?.['regionCode'] ?? 'KR');
    const category = source.params?.['categoryId'] ? `&videoCategoryId=${String(source.params['categoryId'])}` : '';
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular` +
      `&regionCode=${region}${category}&maxResults=${Math.min(limit, 50)}&key=${env.youtubeApiKey}`;
    const json = await fetchJson<YtResponse>(url, { breakerKey: 'youtube' });
    const items = json.items ?? [];
    return items
      .filter((v) => v.snippet?.title)
      .slice(0, limit)
      .map((v, i) => ({
        title: clean(v.snippet?.title, 200),
        summary: clean(v.snippet?.description, 320),
        source_url: v.id ? `https://www.youtube.com/watch?v=${v.id}` : '',
        raw: { views: num(v.statistics?.viewCount), channel: v.snippet?.channelTitle ?? '', rank: i },
        rank: i,
        magnitude: num(v.statistics?.viewCount),
      }));
  }
}
