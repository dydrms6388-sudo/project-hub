// Reddit 공개 JSON (로그인/OAuth 불필요한 .json 엔드포인트만 사용).

import { fetchJson } from '../../../lib/http.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, type RawTrend, type SourceAdapter } from './base.js';

type RedditListing = {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        selftext?: string;
        url?: string;
        permalink?: string;
        score?: number;
        num_comments?: number;
        over_18?: boolean;
        stickied?: boolean;
      };
    }>;
  };
};

export class RedditAdapter implements SourceAdapter {
  readonly type = 'reddit_json' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    const sub = String(source.params?.['subreddit'] ?? '');
    if (!sub) return [];
    const sort = String(source.params?.['sort'] ?? 'hot');
    const t = source.params?.['t'] ? `&t=${String(source.params['t'])}` : '';
    const url = `https://www.reddit.com/r/${sub}/${sort}.json?limit=${Math.min(limit * 2, 50)}${t}`;
    const json = await fetchJson<RedditListing>(url, { breakerKey: 'reddit' });
    const children = json.data?.children ?? [];
    const out: RawTrend[] = [];
    for (const c of children) {
      const d = c.data;
      if (!d || d.stickied || d.over_18 || !d.title) continue;
      out.push({
        title: clean(d.title, 200),
        summary: clean(d.selftext, 320),
        source_url: d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url ?? ''),
        raw: { score: d.score ?? 0, comments: d.num_comments ?? 0, subreddit: sub },
        magnitude: d.score ?? 0,
      });
      if (out.length >= limit) break;
    }
    return out;
  }
}
