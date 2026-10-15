// Hacker News — 공개 Algolia 검색 API (키 불필요).

import { fetchJson } from '../../../lib/http.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, type RawTrend, type SourceAdapter } from './base.js';

type HnResult = {
  hits?: Array<{
    objectID: string;
    title?: string;
    story_text?: string;
    url?: string;
    points?: number;
    num_comments?: number;
  }>;
};

export class HackerNewsAdapter implements SourceAdapter {
  readonly type = 'hackernews' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    const tags = String(source.params?.['tags'] ?? 'front_page');
    const query = source.params?.['query'] ? `&query=${encodeURIComponent(String(source.params['query']))}` : '';
    const url = `https://hn.algolia.com/api/v1/search?tags=${encodeURIComponent(tags)}${query}&hitsPerPage=${limit}`;
    const json = await fetchJson<HnResult>(url, { breakerKey: 'hackernews' });
    const hits = json.hits ?? [];
    return hits
      .filter((h) => h.title)
      .slice(0, limit)
      .map((h) => ({
        title: clean(h.title, 200),
        summary: clean(h.story_text, 320),
        source_url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        raw: { points: h.points ?? 0, comments: h.num_comments ?? 0 },
        magnitude: h.points ?? 0,
      }));
  }
}
