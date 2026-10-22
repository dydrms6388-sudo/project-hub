import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  parseFiltersLenient,
} from "@/lib/explore/filters";
import { buildExploreQuery, buildSwipeQuery, MAX_OFFSET } from "@/lib/explore/query";

const viewer = { id: "11111111-1111-1111-1111-111111111111", sido: "서울", sigungu: "마포구", interests: ["cafe"] };
const now = new Date("2026-06-01T00:00:00Z");

describe("필터 직렬화", () => {
  it("URL 왕복이 보존된다", () => {
    const f = parseFiltersLenient({
      sido: ["부산"],
      sigungu: ["서울:마포구"],
      ageMin: 25,
      ageMax: 35,
      interests: ["cafe", "travel"],
      interestsMode: "all",
      hasPhoto: true,
      availability: ["now"],
      sort: "recent",
    });
    expect(filtersFromSearchParams(filtersToSearchParams(f))).toEqual(f);
  });
  it("잘못된 항목만 버리고 나머지는 유지", () => {
    const f = filtersFromSearchParams(new URLSearchParams("sido=부산,화성&ageMin=abc&bodyTypes=slim&sort=hack"));
    expect(f.bodyTypes).toEqual(["slim"]);
    expect(f.sido).toEqual([]);
    expect(f.sort).toBe("recommended");
  });
  it("잘못된 시군구 조합 제거 + 범위 뒤집힘 정정", () => {
    const f = parseFiltersLenient({ sigungu: ["서울:해운대구", "부산:해운대구"], ageMin: 40, ageMax: 30 });
    expect(f.sigungu).toEqual(["부산:해운대구"]);
    expect([f.ageMin, f.ageMax]).toEqual([30, 40]);
  });
  it("기본값은 활성 필터 0", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(filtersToSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });
});

describe("SQL 빌더", () => {
  it("모든 값은 바인딩 파라미터로만 들어간다 (SQL 인젝션 불가)", () => {
    const f = parseFiltersLenient({ dong: "역삼동", bodyTypes: ["slim"] });
    const q = buildExploreQuery(f, { ...viewer, sido: "'; drop table x; --" }, 0, 24, now);
    expect(q.text).not.toContain("drop table");
    expect(q.text).not.toContain("역삼동");
    expect(q.values).toContain("역삼동");
    expect(q.text).toContain("from public.profile_cards c");
  });
  it("조건은 AND, 지역 내 선택은 OR", () => {
    const f = parseFiltersLenient({ sido: ["부산"], sigungu: ["서울:마포구"], bodyTypes: ["slim", "toned"] });
    const q = buildExploreQuery(f, viewer, 0, 24, now);
    expect(q.text).toMatch(/\(c\.sido = any\(\$\d+::text\[\]\) or \(c\.sido \|\| ':' \|\| c\.sigungu\) = any/);
    expect(q.text).toMatch(/ and c\.body_type = any/);
  });
  it("나이는 출생연도 범위로 변환", () => {
    const q = buildExploreQuery(parseFiltersLenient({ ageMin: 25, ageMax: 30 }), viewer, 0, 24, now);
    expect(q.values).toEqual(expect.arrayContaining([2026 - 30, 2026 - 25]));
  });
  it("관심사 all 은 @>, any 는 &&", () => {
    expect(buildExploreQuery(parseFiltersLenient({ interests: ["cafe"], interestsMode: "all" }), viewer, 0).text).toContain("c.interests @>");
    expect(buildExploreQuery(parseFiltersLenient({ interests: ["cafe"] }), viewer, 0).text).toContain("c.interests &&");
  });
  it("페이지네이션 상한 + 다음 페이지 확인용 limit+1", () => {
    const q = buildExploreQuery(DEFAULT_FILTERS, viewer, 999999, 24, now);
    expect(q.values.slice(-2)).toEqual([25, MAX_OFFSET]);
  });
  it("본인 제외, 스와이프는 이미 본 사람 제외", () => {
    const q = buildSwipeQuery(DEFAULT_FILTERS, viewer, 20, now);
    expect(q.text).toContain("c.id <> $1");
    expect(q.text).toContain("not exists (select 1 from public.likes l where l.liker_id =");
  });
  it.each(["recommended", "recent", "new", "age_asc", "age_desc", "region"] as const)("정렬 %s", (sort) => {
    const q = buildExploreQuery(parseFiltersLenient({ sort }), viewer, 0);
    expect(q.text).toMatch(/order by [\s\S]+ limit \$\d+ offset \$\d+$/);
    expect((q.text.match(/\$\d+/g) ?? []).every((p) => Number(p.slice(1)) <= q.values.length)).toBe(true);
  });
});
