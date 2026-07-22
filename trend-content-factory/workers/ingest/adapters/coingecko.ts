// CoinGecko — 공개 trending 엔드포인트 (키 불필요, 공정사용 레이트리밋 존재).

import { fetchJson } from '../../../lib/http.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, type RawTrend, type SourceAdapter } from './base.js';

type Trending = {
  coins?: Array<{
    item?: {
      id: string;
      name?: string;
      symbol?: string;
      market_cap_rank?: number | null;
      data?: { price_change_percentage_24h?: Record<string, number> };
    };
  }>;
};

export class CoinGeckoAdapter implements SourceAdapter {
  readonly type = 'coingecko' as const;

  async fetch(_vertical: Vertical, _source: TrendSource, limit: number): Promise<RawTrend[]> {
    const json = await fetchJson<Trending>('https://api.coingecko.com/api/v3/search/trending', {
      breakerKey: 'coingecko',
    });
    const coins = json.coins ?? [];
    return coins.slice(0, limit).map((c, i) => {
      const it = c.item;
      const name = it?.name ?? it?.id ?? 'unknown';
      const sym = (it?.symbol ?? '').toUpperCase();
      const chg = it?.data?.price_change_percentage_24h?.['krw'];
      const chgStr = typeof chg === 'number' ? ` (24h ${chg.toFixed(1)}%)` : '';
      return {
        title: clean(`${name} ${sym} 급상승 중${chgStr}`, 160),
        summary: clean(`CoinGecko 트렌딩 ${i + 1}위. 시총 랭크 ${it?.market_cap_rank ?? '-'}.`, 300),
        source_url: it?.id ? `https://www.coingecko.com/en/coins/${it.id}` : 'https://www.coingecko.com',
        raw: { rank: i, market_cap_rank: it?.market_cap_rank ?? null, symbol: sym },
        rank: i,
      } satisfies RawTrend;
    });
  }
}
