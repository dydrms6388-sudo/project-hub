import raw from "../../data/patterns.json";

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  meaning: string;
}

export interface Pattern {
  slug: string;
  name: string;
  category: string;
  mathBasis: string;
  discoveredBy: string;
  year: number;
  params: ParamSpec[];
  renderCost: "저" | "중" | "고";
  needsWorker: boolean;
  mergedFrom?: string[];
}

export interface Category {
  slug: string;
  label: string;
}

const data = raw as unknown as { categories: Category[]; patterns: Pattern[] };

export const categories: Category[] = data.categories;
export const patterns: Pattern[] = data.patterns;

export function getPattern(slug: string): Pattern | undefined {
  return patterns.find((p) => p.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function byCategory(cat: string): Pattern[] {
  return patterns.filter((p) => p.category === cat);
}

/** 같은 카테고리 우선으로 관련 패턴 3개 */
export function related(slug: string): Pattern[] {
  const me = getPattern(slug);
  if (!me) return [];
  const pool = patterns.filter((p) => p.slug !== slug);
  const same = pool.filter((p) => p.category === me.category);
  const rest = pool.filter((p) => p.category !== me.category);
  return [...same, ...rest].slice(0, 3);
}

export function defaultParams(pat: Pattern): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of pat.params) out[p.name] = p.default;
  return out;
}

export function clampParams(
  pat: Pattern,
  values: Record<string, number>
): Record<string, number> {
  const out = defaultParams(pat);
  for (const spec of pat.params) {
    const v = values[spec.name];
    if (v !== undefined && Number.isFinite(v)) {
      out[spec.name] = Math.min(spec.max, Math.max(spec.min, v));
    }
  }
  return out;
}

// 빌드 시점에 인라인되는 공개 환경변수. 배포 시 NEXT_PUBLIC_SITE_URL 필수 —
// 미설정 로컬 빌드는 localhost 플레이스홀더로 생성된다.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
export const SITE_NAME = "수학 패턴 연구소";
