import type { TrendSourceType } from '../../../lib/types.js';
import type { SourceAdapter } from './base.js';
import { GoogleTrendsAdapter, RssNewsAdapter } from './rss.js';
import { RedditAdapter } from './reddit.js';
import { HackerNewsAdapter } from './hackernews.js';
import { CoinGeckoAdapter } from './coingecko.js';
import { YouTubePopularAdapter } from './youtube.js';
import { NaverDatalabAdapter } from './naver.js';

const ADAPTERS: SourceAdapter[] = [
  new GoogleTrendsAdapter(),
  new RssNewsAdapter(),
  new RedditAdapter(),
  new HackerNewsAdapter(),
  new CoinGeckoAdapter(),
  new YouTubePopularAdapter(),
  new NaverDatalabAdapter(),
];

const BY_TYPE = new Map<TrendSourceType, SourceAdapter>(ADAPTERS.map((a) => [a.type, a]));

export function adapterFor(type: TrendSourceType): SourceAdapter | undefined {
  return BY_TYPE.get(type);
}
