import raw from "../../data/illusions.json";

export interface ParamSpec {
  name: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
}

export interface Illusion {
  slug: string;
  name: string;
  nameEn: string;
  category: string;
  discoveredBy: string;
  year: number;
  mechanism: string;
  params: ParamSpec[];
  copyrightStatus: string;
  difficulty: string;
  motionWarning?: boolean;
  mergedFrom?: string[];
}

export interface Category {
  slug: string;
  label: string;
}

const data = raw as unknown as {
  categories: Category[];
  illusions: Illusion[];
};

export const categories: Category[] = data.categories;
export const illusions: Illusion[] = data.illusions;

export function getIllusion(slug: string): Illusion | undefined {
  return illusions.find((i) => i.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function byCategory(cat: string): Illusion[] {
  return illusions.filter((i) => i.category === cat);
}

/** 같은 메커니즘 계열 우선, 부족하면 같은 카테고리에서 채워 3개를 고른다. */
export function related(slug: string): Illusion[] {
  const me = getIllusion(slug);
  if (!me) return [];
  const mechKey = me.mechanism.split("·")[0].trim();
  const pool = illusions.filter((i) => i.slug !== slug);
  const sameMech = pool.filter((i) => i.mechanism.includes(mechKey));
  const sameCat = pool.filter(
    (i) => i.category === me.category && !sameMech.includes(i)
  );
  const rest = pool.filter((i) => !sameMech.includes(i) && !sameCat.includes(i));
  return [...sameMech, ...sameCat, ...rest].slice(0, 3);
}

export function defaultParams(ill: Illusion): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of ill.params) out[p.name] = p.default;
  return out;
}

export const SITE_URL = "https://illusion-lab.tomatoeggcat.com";
export const SITE_NAME = "착시 실험실";
