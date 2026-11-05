import { describe, expect, it } from "vitest";
import { HOBBY_CAP, HOBBY_CATEGORY_CAP } from "@duckmate/db";
import { HOBBY_CATEGORIES } from "@duckmate/ui/tokens";
import { DB_TO_UI_CATEGORY, HOBBIES_FALLBACK, HOBBY_CATEGORIES_FALLBACK, searchHobbies, uiCategorySlug } from "./hobbies";

describe("hobbies fallback integrity (seed 0013 mirror)", () => {
  it("12 categories × 5 = 60, ids 1..60 unique", () => {
    expect(HOBBY_CATEGORIES_FALLBACK).toHaveLength(HOBBY_CATEGORY_CAP);
    expect(HOBBIES_FALLBACK).toHaveLength(HOBBY_CAP);
    expect(new Set(HOBBIES_FALLBACK.map((h) => h.id)).size).toBe(60);
    expect(new Set(HOBBIES_FALLBACK.map((h) => h.slug)).size).toBe(60);
    for (const c of HOBBY_CATEGORIES_FALLBACK) expect(HOBBIES_FALLBACK.filter((h) => h.categoryId === c.id)).toHaveLength(5);
    expect(HOBBY_CATEGORIES_FALLBACK.filter((c) => c.isInitial)).toHaveLength(8);
  });
  it("every DB category slug maps to a @duckmate/ui category slug", () => {
    const ui = new Set<string>(HOBBY_CATEGORIES.map((c) => c.slug));
    for (const c of HOBBY_CATEGORIES_FALLBACK) {
      expect(DB_TO_UI_CATEGORY[c.slug]).toBeDefined();
      expect(ui.has(uiCategorySlug(c.slug))).toBe(true);
    }
  });
  it("search matches name/category, ignores spaces", () => {
    expect(searchHobbies(HOBBIES_FALLBACK, HOBBY_CATEGORIES_FALLBACK, "아이돌").map((h) => h.slug)).toContain("idol");
    expect(searchHobbies(HOBBIES_FALLBACK, HOBBY_CATEGORIES_FALLBACK, "리듬 게임").map((h) => h.slug)).toContain("rhythm_game");
    expect(searchHobbies(HOBBIES_FALLBACK, HOBBY_CATEGORIES_FALLBACK, "")).toEqual([]);
  });
});
