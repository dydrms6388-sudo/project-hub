// 네이버 데이터랩 검색어 트렌드 API. NAVER_CLIENT_ID/SECRET 없으면 skip.
// 데이터랩은 절대 검색량이 아닌 상대 비율(0~100)을 반환 → magnitude 로 근사.

import { env } from '../../../lib/env.js';
import { makeLogger } from '../../../lib/logger.js';
import type { TrendSource, Vertical } from '../../../lib/types.js';
import { clean, type RawTrend, type SourceAdapter } from './base.js';

const log = makeLogger('naver');

type DatalabResponse = {
  results?: Array<{
    title?: string;
    data?: Array<{ period: string; ratio: number }>;
  }>;
};

export class NaverDatalabAdapter implements SourceAdapter {
  readonly type = 'naver_datalab' as const;

  async fetch(_vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]> {
    if (!env.naverClientId || !env.naverClientSecret) {
      log.warn('NAVER_CLIENT_ID/SECRET 없음 → naver_datalab skip');
      return [];
    }
    const groups = (source.params?.['keywordGroups'] as string[] | undefined) ?? [];
    if (groups.length === 0) return [];

    // 최근 30일 상대 트렌드 요청.
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const body = {
      startDate: iso(start),
      endDate: iso(end),
      timeUnit: 'date',
      keywordGroups: groups.slice(0, 5).map((g) => ({ groupName: g, keywords: [g] })),
    };

    // 데이터랩은 POST 전용 → 전용 abort 타임아웃으로 직접 호출.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.httpTimeoutMs);
    let json: DatalabResponse;
    try {
      const post = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: {
          'X-Naver-Client-Id': env.naverClientId,
          'X-Naver-Client-Secret': env.naverClientSecret,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      json = (await post.json()) as DatalabResponse;
    } finally {
      clearTimeout(timer);
    }
    const results = json.results ?? [];
    return results.slice(0, limit).map((r, i) => {
      const series = r.data ?? [];
      const last = series[series.length - 1]?.ratio ?? 0;
      const prev = series[series.length - 2]?.ratio ?? last;
      const delta = last - prev;
      return {
        title: clean(`'${r.title}' 검색 급증`, 120),
        summary: clean(`네이버 데이터랩 상대 검색비율 ${last.toFixed(0)} (전일 대비 ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}).`, 300),
        source_url: `https://datalab.naver.com/keyword/trendResult.naver?query=${encodeURIComponent(r.title ?? '')}`,
        raw: { ratio: last, delta, rank: i },
        magnitude: Math.max(0, last),
      } satisfies RawTrend;
    });
  }
}
