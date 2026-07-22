import { describe, expect, it } from "vitest";
import {
  MolitAptAdapter,
  normalizeItem,
  parseItems,
  parseTotalCount,
} from "./adapters/molit-apt.js";
import { MemoryEngineStore } from "./adapters/memory.js";
import { ingestScope } from "./ingest.js";
import { dataScore, shouldCreatePage } from "./data-score.js";
import type { Clock, HttpGet } from "./ports.js";

/** 즉시 반환 클록 — 백오프 대기를 기록만 하고 실제로 자지 않는다. */
function fakeClock(): Clock & { slept: number[] } {
  const slept: number[] = [];
  return {
    slept,
    nowMs: () => 1_750_000_000_000,
    sleep: async (ms) => {
      slept.push(ms);
    },
  };
}

const item = (apt: string, day: string, amount: string, dong = "청운동") => `
  <item>
    <sggCd>11110</sggCd><umdNm>${dong}</umdNm><aptNm>${apt}</aptNm>
    <dealAmount>${amount}</dealAmount><excluUseAr>84.97</excluUseAr>
    <dealDay>${day}</dealDay><floor>7</floor><buildYear>2008</buildYear>
    <sidoNm>서울특별시</sidoNm><sggNm>종로구</sggNm>
  </item>`;

const xml = (items: string[], total = items.length) => `<?xml version="1.0"?>
<response><header><resultCode>000</resultCode></header>
<body><items>${items.join("")}</items>
<numOfRows>500</numOfRows><pageNo>1</pageNo><totalCount>${total}</totalCount></body></response>`;

const JAN = xml([
  item("경희궁자이", "5", "159,000"),
  item("경희궁자이", "12", "162,500"),
  item("사직아이파크", "20", "121,000", "사직동"),
]);
const FEB = xml([item("경희궁자이", "3", "165,000")]);

function fixtureHttp(): HttpGet {
  return async (url) => {
    if (url.includes("DEAL_YMD=202601")) return { status: 200, body: JAN };
    if (url.includes("DEAL_YMD=202602")) return { status: 200, body: FEB };
    return { status: 200, body: xml([]) };
  };
}

function makeAdapter(http: HttpGet, clock = fakeClock()) {
  return new MolitAptAdapter({
    serviceKey: "TEST_KEY",
    http,
    clock,
    endMonth: "202602",
  });
}

describe("molit-apt XML 파싱", () => {
  it("item 블록과 totalCount를 뽑는다", () => {
    expect(parseItems(JAN)).toHaveLength(3);
    expect(parseTotalCount(JAN)).toBe(3);
  });

  it("금액 콤마 제거 + 만원→원, 날짜 조합, 조합 자연키", () => {
    const deal = normalizeItem(parseItems(JAN)[0]!, "11110", "202601");
    expect(deal).not.toBeNull();
    expect(deal!.priceKrw).toBe(1_590_000_000);
    expect(deal!.dealDate).toBe("2026-01-05");
    expect(deal!.region.dongName).toBe("청운동");
    expect(deal!.sourceId).toContain("11110:202601:경희궁자이");
  });

  it("필수 필드 결손 아이템은 null로 스킵", () => {
    expect(normalizeItem("<item><aptNm>x</aptNm></item>", "11110", "202601")).toBeNull();
  });
});

describe("백오프", () => {
  it("5xx 두 번 후 성공하면 지수백오프로 재시도한다", async () => {
    let calls = 0;
    const clock = fakeClock();
    const http: HttpGet = async () => {
      calls++;
      return calls <= 2 ? { status: 500, body: "" } : { status: 200, body: xml([]) };
    };
    const adapter = makeAdapter(http, clock);
    await adapter.fetchBatch("11110", "202602");
    expect(calls).toBe(3);
    expect(clock.slept.slice(0, 2)).toEqual([1000, 2000]);
  });

  it("연속 실패는 4회 재시도 후 포기한다", async () => {
    const http: HttpGet = async () => ({ status: 503, body: "" });
    const adapter = makeAdapter(http, fakeClock());
    await expect(adapter.fetchBatch("11110", "202602")).rejects.toThrow(/giving up/);
  });

  it("4xx(429 제외)는 재시도 없이 즉시 실패한다", async () => {
    let calls = 0;
    const http: HttpGet = async () => {
      calls++;
      return { status: 401, body: "" };
    };
    const adapter = makeAdapter(http, fakeClock());
    await expect(adapter.fetchBatch("11110", "202602")).rejects.toThrow(/HTTP 401/);
    expect(calls).toBe(1);
  });
});

describe("증분 수집 (서울 종로구)", () => {
  it("두 달치를 수집해 지역 계층·단지·거래를 만든다", async () => {
    const store = new MemoryEngineStore();
    const adapter = makeAdapter(fixtureHttp());

    const stats = await ingestScope(adapter, store, "11110", { initialCursor: "202601" });

    expect(stats.fetched).toBe(4);
    expect(stats.rawInserted).toBe(4);
    expect(stats.transactionsUpserted).toBe(4);
    // 시도 1 + 시군구 1 + 동 2(청운동/사직동)
    expect(store.regions.map((r) => r.level).sort()).toEqual(["dong", "dong", "sido", "sigungu"]);
    // 단지 2개 (경희궁자이는 두 달에 걸쳐 1개로 병합)
    expect(store.complexes).toHaveLength(2);
    // 커서는 마지막 성공 배치
    expect(await store.getCursor("molit-apt", "11110")).toBe("202602");
  });

  it("재실행 시 raw 중복은 스킵되고 거래가 늘지 않는다", async () => {
    const store = new MemoryEngineStore();
    const adapter = makeAdapter(fixtureHttp());
    await ingestScope(adapter, store, "11110", { initialCursor: "202601" });

    // 커서가 202602 → 재실행은 202602 한 달만 다시 본다 (전체 재수집 금지)
    const second = await ingestScope(adapter, store, "11110", { initialCursor: "202601" });
    expect(second.fetched).toBe(1);
    expect(second.rawDuplicates).toBe(1);
    expect(second.transactionsUpserted).toBe(0);
    expect(store.transactions).toHaveLength(4);
  });
});

describe("data_score 임계치", () => {
  it("거래 3건 미만이면 페이지 생성 금지(0점)", () => {
    const input = { transactionCount: 2, recentCount: 2, childCount: 0 };
    expect(shouldCreatePage(input)).toBe(false);
    expect(dataScore(input)).toBe(0);
  });

  it("거래량·신선도·하위 엔티티가 점수를 올린다", () => {
    const small = dataScore({ transactionCount: 3, recentCount: 0, childCount: 0 });
    const big = dataScore({ transactionCount: 100, recentCount: 60, childCount: 10 });
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(100);
  });
});
