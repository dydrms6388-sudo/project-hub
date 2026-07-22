/**
 * 국토부 아파트 매매 실거래가 어댑터 (공공데이터포털).
 *
 * - scope  = LAWD_CD (시군구 법정동코드 5자리, 예: 종로구 11110)
 * - cursor = 계약월 YYYYMM. 한 배치 = 한 달. nextCursor 로 다음 달 진행.
 * - serviceKey 는 env(MOLIT_SERVICE_KEY)에서: 소유자가 공공데이터포털에서 발급.
 * - HTTP 는 주입식(HttpGet) — 테스트는 픽스처 XML로 키 없이 전 로직 검증.
 * - rate limit 준수: 페이지 간 지연 + 429/5xx 지수백오프(최대 4회).
 */
import type { DatasetAdapter, Clock, HttpGet } from "../ports.js";
import { realClock } from "../ports.js";
import type { NormalizedDeal } from "../types.js";

const DEFAULT_BASE =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

export interface MolitAptOptions {
  serviceKey: string;
  http: HttpGet;
  clock?: Clock;
  baseUrl?: string;
  rowsPerPage?: number;
  /** 수집 종료월(YYYYMM, 포함). 기본: 이번 달. 테스트에서 주입. */
  endMonth?: string;
  /** 페이지 간 지연(ms). 기본 200. */
  pageDelayMs?: number;
}

export class MolitAptAdapter implements DatasetAdapter {
  readonly key = "molit-apt";
  private clock: Clock;

  constructor(private opts: MolitAptOptions) {
    this.clock = opts.clock ?? realClock;
  }

  async fetchBatch(
    scope: string,
    cursor: string | null,
  ): Promise<{ deals: NormalizedDeal[]; nextCursor: string | null }> {
    const month = cursor ?? this.endMonth();
    const deals: NormalizedDeal[] = [];
    const rows = this.opts.rowsPerPage ?? 500;

    for (let page = 1; ; page++) {
      const url =
        `${this.opts.baseUrl ?? DEFAULT_BASE}?serviceKey=${encodeURIComponent(this.opts.serviceKey)}` +
        `&LAWD_CD=${scope}&DEAL_YMD=${month}&pageNo=${page}&numOfRows=${rows}`;

      const body = await this.getWithBackoff(url);
      const items = parseItems(body);
      for (const item of items) {
        const deal = normalizeItem(item, scope, month);
        if (deal) deals.push(deal);
      }

      const total = parseTotalCount(body);
      if (page * rows >= total || items.length === 0) break;
      await this.clock.sleep(this.opts.pageDelayMs ?? 200);
    }

    return { deals, nextCursor: this.nextMonth(month) };
  }

  private endMonth(): string {
    if (this.opts.endMonth) return this.opts.endMonth;
    const d = new Date(this.clock.nowMs());
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private nextMonth(month: string): string | null {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(4, 6));
    const next = m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, "0")}`;
    return next > this.endMonth() ? null : next;
  }

  /** 429/5xx → 지수백오프(1s, 2s, 4s, 8s) 후 재시도. 4회 초과 시 throw. */
  private async getWithBackoff(url: string): Promise<string> {
    let attempt = 0;
    for (;;) {
      const res = await this.opts.http(url);
      if (res.status === 200) return res.body;
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`[molit-apt] HTTP ${res.status} for ${url.slice(0, 120)}…`);
      }
      if (attempt >= 4) {
        throw new Error(`[molit-apt] giving up after ${attempt} retries (HTTP ${res.status})`);
      }
      await this.clock.sleep(1000 * 2 ** attempt);
      attempt++;
    }
  }
}

// ── XML 파싱 (의존성 없이 — 응답 구조가 평평한 <item> 목록이라 충분) ─────────

function tag(xml: string, name: string): string | null {
  // CDATA 및 공백 허용
  const m = xml.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([^<]*?)(?:\\]\\]>)?\\s*</${name}>`));
  return m ? m[1]!.trim() : null;
}

export function parseItems(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]!);
}

export function parseTotalCount(xml: string): number {
  return Number(tag(xml, "totalCount") ?? 0);
}

/** 한 <item> 블록 → NormalizedDeal. 필수 필드 결손 시 null(스킵). */
export function normalizeItem(
  item: string,
  lawdCd: string,
  month: string,
): NormalizedDeal | null {
  // 신규 필드명(dealAmount 등)과 구 한글 태그(거래금액 등) 둘 다 수용.
  const amountRaw = tag(item, "dealAmount") ?? tag(item, "거래금액");
  const aptName = tag(item, "aptNm") ?? tag(item, "아파트");
  const dong = tag(item, "umdNm") ?? tag(item, "법정동");
  const area = tag(item, "excluUseAr") ?? tag(item, "전용면적");
  const day = tag(item, "dealDay") ?? tag(item, "일");
  const floor = tag(item, "floor") ?? tag(item, "층");
  const builtYear = tag(item, "buildYear") ?? tag(item, "건축년도");
  const sidoName = tag(item, "sidoNm") ?? "";
  const sigunguName = tag(item, "sggNm") ?? tag(item, "시군구") ?? "";

  if (!amountRaw || !aptName || !dong || !area || !day) return null;

  const priceKrw = Number(amountRaw.replace(/[,\s]/g, "")) * 10_000; // 만원 → 원
  const areaM2 = Number(area);
  if (!Number.isFinite(priceKrw) || priceKrw <= 0 || !Number.isFinite(areaM2)) return null;

  const dealDate = `${month.slice(0, 4)}-${month.slice(4, 6)}-${day.padStart(2, "0")}`;
  // 자연키: 시군구+월+단지+면적+일+가격+층 — API가 고유 id를 주지 않으므로 조합키.
  const sourceId = `${lawdCd}:${month}:${aptName}:${areaM2}:${day}:${priceKrw}:${floor ?? ""}`;

  return {
    sourceId,
    region: { sidoName, sigunguName, sigunguCode: lawdCd, dongName: dong },
    complexName: aptName,
    builtYear: builtYear ? Number(builtYear) : null,
    dealDate,
    priceKrw,
    areaM2,
    floor: floor ? Number(floor) : null,
  };
}
