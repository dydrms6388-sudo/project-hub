// 모든 외부 HTTP 호출의 공통 계층: 타임아웃 + 지수 백오프 + 서킷브레이커.
// (DoD: 모든 외부 API 호출에 타임아웃 + 지수백오프 + 서킷브레이커)

import { env } from './env.js';
import { makeLogger } from './logger.js';

const log = makeLogger('http');

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 열림 상태에서 연속 실패가 임계치를 넘으면 일정 시간 호출을 차단한다. */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly name: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  canPass(now: number): boolean {
    return now >= this.openUntil;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(now: number): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = now + this.cooldownMs;
      log.warn(`circuit "${this.name}" OPEN for ${this.cooldownMs}ms after ${this.failures} failures`);
      this.failures = 0;
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();
function breakerFor(key: string): CircuitBreaker {
  let b = breakers.get(key);
  if (!b) {
    b = new CircuitBreaker(key);
    breakers.set(key, b);
  }
  return b;
}

export type FetchOpts = {
  timeoutMs?: number;
  retries?: number;
  /** 서킷브레이커 그룹 키 (기본: 호스트명) */
  breakerKey?: string;
  headers?: Record<string, string>;
  /** 백오프 계산에 쓰는 monotonic clock (테스트 주입용). 기본 Date.now */
  now?: () => number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 지수 백오프. 시도 i(0-base) → 2^i 초, 상한 16초. */
function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt, 16) * 1000;
}

export async function fetchWithRetry(url: string, opts: FetchOpts = {}): Promise<Response> {
  const {
    timeoutMs = env.httpTimeoutMs,
    retries = 3,
    breakerKey = new URL(url).host,
    headers = {},
    now = Date.now,
  } = opts;

  const breaker = breakerFor(breakerKey);
  if (!breaker.canPass(now())) {
    throw new HttpError(`circuit open for ${breakerKey}`);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'trend-content-factory/0.1 (+contact-owner)', ...headers },
        signal: controller.signal,
      });
      clearTimeout(timer);
      // 5xx / 429 는 재시도 대상, 4xx(기타)는 즉시 실패.
      if (res.status >= 500 || res.status === 429) {
        throw new HttpError(`upstream ${res.status}`, res.status);
      }
      breaker.recordSuccess();
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      breaker.recordFailure(now());
      if (attempt < retries) {
        const wait = backoffMs(attempt);
        log.debug(`retry ${attempt + 1}/${retries} for ${url} in ${wait}ms (${String(err)})`);
        await sleep(wait);
      }
    }
  }
  throw new HttpError(`fetch failed after ${retries + 1} attempts: ${url}`, undefined, String(lastErr));
}

export async function fetchText(url: string, opts?: FetchOpts): Promise<string> {
  const res = await fetchWithRetry(url, opts);
  return res.text();
}

export async function fetchJson<T>(url: string, opts?: FetchOpts): Promise<T> {
  const res = await fetchWithRetry(url, opts);
  return (await res.json()) as T;
}

// ── Meta Graph API 사용률 헤더 파서 (M5/거버너에서 소비, 여기서 유틸만 정의) ──

export type MetaUsage = {
  callCount: number;
  totalCputime: number;
  totalTime: number;
  /** 세 지표 중 최대치 (0~100+) */
  worst: number;
};

/** X-App-Usage 또는 X-Ad-Account-Usage JSON 헤더를 파싱. */
export function parseAppUsage(header: string | null): MetaUsage | null {
  if (!header) return null;
  try {
    const j = JSON.parse(header) as Partial<Record<'call_count' | 'total_cputime' | 'total_time', number>>;
    const callCount = j.call_count ?? 0;
    const totalCputime = j.total_cputime ?? 0;
    const totalTime = j.total_time ?? 0;
    return { callCount, totalCputime, totalTime, worst: Math.max(callCount, totalCputime, totalTime) };
  } catch {
    return null;
  }
}

/** X-Business-Use-Case-Usage 헤더에서 특정 비즈니스 ID의 최악 사용률을 뽑는다. */
export function parseBusinessUseCaseUsage(header: string | null): number | null {
  if (!header) return null;
  try {
    const j = JSON.parse(header) as Record<string, Array<Record<string, number>>>;
    let worst = 0;
    for (const entries of Object.values(j)) {
      for (const e of entries) {
        for (const k of ['call_count', 'total_cputime', 'total_time', 'estimated_time_to_regain_access']) {
          const v = e[k];
          if (typeof v === 'number' && k !== 'estimated_time_to_regain_access') worst = Math.max(worst, v);
        }
      }
    }
    return worst;
  } catch {
    return null;
  }
}
