// 탐색 필터: 스키마 + URL 쿼리스트링 직렬화. (서버/클라이언트 공용, 순수 함수)
// 서로 다른 조건은 AND, 같은 조건 안의 복수 선택은 OR (관심사는 any/all 선택 가능).
import { z } from "zod";
import { AVAILABILITY, BODY_TYPES, INTERESTS, POSITIONS, PURPOSES, STYLES, values } from "@/lib/domain/options";
import { isValidSigungu, SIDO_LIST } from "@/lib/domain/regions";

export const SORTS = [
  { value: "recommended", label: "추천순" },
  { value: "recent", label: "최근 활동순" },
  { value: "new", label: "신규순" },
  { value: "age_asc", label: "나이 어린순" },
  { value: "age_desc", label: "나이 많은순" },
  { value: "region", label: "가까운 지역순" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export const ACTIVE_WITHIN = [
  { value: "any", label: "전체" },
  { value: "online", label: "접속 중" },
  { value: "today", label: "24시간 이내" },
  { value: "week", label: "7일 이내" },
] as const;

const availabilityValues = values(AVAILABILITY).filter((v) => v !== "off") as ["now", "tonight", "weekend", "flexible"];

const list = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max).default([]);

export const exploreFiltersSchema = z
  .object({
    sido: list(z.enum(SIDO_LIST as [string, ...string[]]), 17),
    // "서울:강남구" 형식 (구 이름이 시/도마다 중복되므로)
    sigungu: list(z.string().max(30), 30),
    dong: z
      .string()
      .trim()
      .max(20)
      .regex(/^[가-힣0-9]*$/)
      .optional(),
    ageMin: z.coerce.number().int().min(19).max(99).optional(),
    ageMax: z.coerce.number().int().min(19).max(99).optional(),
    heightMin: z.coerce.number().int().min(140).max(220).optional(),
    heightMax: z.coerce.number().int().min(140).max(220).optional(),
    bodyTypes: list(z.enum(values(BODY_TYPES)), 7),
    positions: list(z.enum(values(POSITIONS)), 5),
    styles: list(z.enum(values(STYLES)), 10),
    purposes: list(z.enum(values(PURPOSES)), 8),
    interests: list(z.enum(values(INTERESTS)), 20),
    interestsMode: z.enum(["any", "all"]).default("any"),
    hasPhoto: z.boolean().default(false),
    activeWithin: z.enum(["any", "online", "today", "week"]).default("any"),
    availability: list(z.enum(availabilityValues), 4),
    sort: z.enum(SORTS.map((s) => s.value) as [Sort, ...Sort[]]).default("recommended"),
  })
  .transform((f) => ({
    ...f,
    sigungu: f.sigungu.filter((s) => {
      const [sd, sg] = s.split(":");
      return sd && sg && isValidSigungu(sd, sg);
    }),
    dong: f.dong || undefined,
  }));

export type ExploreFilters = z.output<typeof exploreFiltersSchema>;
export const DEFAULT_FILTERS: ExploreFilters = exploreFiltersSchema.parse({});

const ARRAY_KEYS = [
  "sido",
  "sigungu",
  "bodyTypes",
  "positions",
  "styles",
  "purposes",
  "interests",
  "availability",
] as const;
const SCALAR_KEYS = [
  "dong",
  "ageMin",
  "ageMax",
  "heightMin",
  "heightMax",
  "interestsMode",
  "activeWithin",
  "sort",
] as const;

/** URLSearchParams → 필터 (잘못된 값은 조용히 기본값으로) */
export function filtersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): ExploreFilters {
  const get = (k: string): string[] => {
    if (sp instanceof URLSearchParams) return sp.getAll(k);
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };
  const raw: Record<string, unknown> = {};
  for (const k of ARRAY_KEYS) {
    const vals = get(k)
      .flatMap((v) => v.split(","))
      .filter(Boolean);
    if (vals.length) raw[k] = vals;
  }
  for (const k of SCALAR_KEYS) {
    const v = get(k)[0];
    if (v) raw[k] = v;
  }
  if (get("hasPhoto")[0] === "1") raw.hasPhoto = true;
  return parseFiltersLenient(raw);
}

/** 항목별로 검증해 잘못된 항목만 버린다 (공유 URL 이 일부 깨져도 나머지는 유지) */
export function parseFiltersLenient(raw: Record<string, unknown>): ExploreFilters {
  const full = exploreFiltersSchema.safeParse(raw);
  if (full.success) return normalizeRanges(full.data);
  const keep: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (exploreFiltersSchema.safeParse({ [k]: v }).success) keep[k] = v;
  }
  return normalizeRanges(exploreFiltersSchema.parse(keep));
}

function normalizeRanges(f: ExploreFilters): ExploreFilters {
  const out = { ...f };
  if (out.ageMin && out.ageMax && out.ageMin > out.ageMax) [out.ageMin, out.ageMax] = [out.ageMax, out.ageMin];
  if (out.heightMin && out.heightMax && out.heightMin > out.heightMax)
    [out.heightMin, out.heightMax] = [out.heightMax, out.heightMin];
  return out;
}

export function filtersToSearchParams(f: ExploreFilters): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of ARRAY_KEYS) if (f[k].length) sp.set(k, f[k].join(","));
  for (const k of SCALAR_KEYS) {
    const v = f[k];
    if (v !== undefined && v !== DEFAULT_FILTERS[k]) sp.set(k, String(v));
  }
  if (f.hasPhoto) sp.set("hasPhoto", "1");
  return sp;
}

/** 활성화된 필터 개수 (정렬 제외) — 필터 버튼 배지용 */
export function activeFilterCount(f: ExploreFilters): number {
  let n = 0;
  for (const k of ARRAY_KEYS) if (f[k].length) n++;
  if (f.dong) n++;
  if (f.ageMin || f.ageMax) n++;
  if (f.heightMin || f.heightMax) n++;
  if (f.hasPhoto) n++;
  if (f.activeWithin !== "any") n++;
  return n;
}
