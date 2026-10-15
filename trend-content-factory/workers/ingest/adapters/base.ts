// 소스 어댑터 공통 계약.
// robots.txt / ToS 준수. 로그인 필요한 사이트 스크래핑 금지 — 공개 RSS/JSON/공식 API만.

import type { TrendSource, TrendSourceType, Vertical } from '../../../lib/types.js';

/** 어댑터가 뽑는 원시 트렌드. velocity/novelty 는 ingest 파이프라인이 계산. */
export type RawTrend = {
  title: string;
  summary: string;
  source_url: string;
  raw: Record<string, unknown>;
  /** velocity 힌트: 목록 내 순위(0-base). 있으면 순위 기반 정규화. */
  rank?: number;
  /** velocity 힌트: 크기 신호(점수/조회수 등). 있으면 로그 정규화. */
  magnitude?: number;
};

export interface SourceAdapter {
  readonly type: TrendSourceType;
  /**
   * 단일 소스에서 원시 트렌드 수집.
   * 실패 시 예외를 던지지 말고 빈 배열 반환 대신 throw → ingest 가 job_failures 로 기록.
   * (여기서는 throw 를 허용하고 ingest 레벨에서 소스 단위로 catch)
   */
  fetch(vertical: Vertical, source: TrendSource, limit: number): Promise<RawTrend[]>;
}

/** 안전한 텍스트 정리: 공백/HTML 태그 축약. */
export function clean(text: string | undefined | null, max = 400): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
