import { describe, expect, it } from "vitest";
import { REGION } from "@duckmate/db";
import { REGIONS_FALLBACK, regionLabel, sidoList, sigunguList } from "./regions";

describe("regions fallback integrity (seed 0013 mirror)", () => {
  it("has 80 rows (수도권 66 + 시도 폴백 14), unique 5-digit codes", () => {
    expect(REGIONS_FALLBACK).toHaveLength(80);
    const codes = new Set(REGIONS_FALLBACK.map((r) => r.code));
    expect(codes.size).toBe(80);
    for (const r of REGIONS_FALLBACK) expect(REGION.pattern.test(r.code)).toBe(true);
  });
  it("capital area first, fallback rows are XX000", () => {
    const sidos = sidoList(REGIONS_FALLBACK);
    expect(sidos.slice(0, 3).map((s) => s.code)).toEqual(["11", "28", "41"]);
    expect(sidos).toHaveLength(17);
    const fallback = REGIONS_FALLBACK.filter((r) => REGION.isSidoFallback(r.code));
    expect(fallback).toHaveLength(14);
    expect(sigunguList(REGIONS_FALLBACK, "26")).toHaveLength(1);
    expect(sigunguList(REGIONS_FALLBACK, "11")).toHaveLength(25);
  });
  it("labels 구 단위 only", () => {
    expect(regionLabel(REGIONS_FALLBACK, "11440")).toBe("마포구");
    expect(regionLabel(REGIONS_FALLBACK, "26000")).toBe("부산");
    expect(regionLabel(REGIONS_FALLBACK, null)).toBe("");
  });
});
