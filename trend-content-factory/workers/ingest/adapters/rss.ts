// RSS/Atom 어댑터 — google_trends_rss + rss_news 를 공용 파서로 처리.

import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../../../lib/http.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, num, type RawTrend, type SourceAdapter } from './base.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // ht:news_item → news_item, content:encoded → encoded
});

type RssItem = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['#text'] === 'string') return o['#text'];
  }
  return String(v);
}

/** RSS(<channel><item>) 또는 Atom(<feed><entry>) 를 통일된 item 배열로. */
export function parseFeed(xml: string): RssItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc['rss'] as Record<string, unknown> | undefined;
  const channel = rss?.['channel'] as Record<string, unknown> | undefined;
  if (channel?.['item']) return asArray(channel['item']) as RssItem[];
  const feed = doc['feed'] as Record<string, unknown> | undefined;
  if (feed?.['entry']) return asArray(feed['entry']) as RssItem[];
  return [];
}

function itemLink(item: RssItem): string {
  const link = item['link'];
  if (typeof link === 'string') return link;
  // Atom: link 는 배열/객체 (@_href)
  for (const l of asArray(link)) {
    if (l && typeof l === 'object') {
      const href = (l as Record<string, unknown>)['@_href'];
      if (typeof href === 'string') return href;
    }
  }
  return textOf(item['guid']);
}

export class GoogleTrendsAdapter implements SourceAdapter {
  readonly type = 'google_trends_rss' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    if (!source.url) return [];
    const xml = await fetchText(source.url, { breakerKey: 'google-trends' });
    const items = parseFeed(xml);
    return items.slice(0, limit).map((item, i) => {
      const title = clean(textOf(item['title']), 120);
      // google trends: approx_traffic, news_item(제목/설명)
      const traffic = textOf(item['approx_traffic']).replace(/[^\d]/g, '');
      const newsItems = asArray(item['news_item']);
      const firstNews = newsItems[0] as Record<string, unknown> | undefined;
      const summary = clean(
        firstNews ? textOf(firstNews['news_item_title']) : textOf(item['description']),
        300,
      );
      return {
        title,
        summary,
        source_url: firstNews ? textOf(firstNews['news_item_url']) : itemLink(item),
        raw: { approx_traffic: traffic, rank: i },
        rank: i,
        magnitude: traffic ? num(traffic) : undefined,
      } satisfies RawTrend;
    });
  }
}

export class RssNewsAdapter implements SourceAdapter {
  readonly type = 'rss_news' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    if (!source.url) return [];
    const xml = await fetchText(source.url, { breakerKey: `rss:${new URL(source.url).host}` });
    const items = parseFeed(xml);
    return items.slice(0, limit).map((item, i) => ({
      title: clean(textOf(item['title']), 160),
      summary: clean(
        textOf(item['description']) || textOf(item['summary']) || textOf(item['encoded']),
        320,
      ),
      source_url: itemLink(item),
      raw: { source: source.label, rank: i },
      rank: i,
    }));
  }
}
