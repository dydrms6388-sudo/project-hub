import raw from "../../data/experiments.json";

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  meaning: string;
}

export interface Experiment {
  slug: string;
  name: string;
  category: string;
  governingEquation: string;
  integrator: "RK4" | "Verlet" | "Symplectic";
  params: ParamSpec[];
  isChaotic: boolean;
  computeCost: "저" | "중" | "고";
  needsWorker: boolean;
  mergedFrom?: string[];
}

export interface Category {
  slug: string;
  label: string;
}

const data = raw as unknown as { categories: Category[]; experiments: Experiment[] };

export const categories: Category[] = data.categories;
export const experiments: Experiment[] = data.experiments;

export function getExperiment(slug: string): Experiment | undefined {
  return experiments.find((e) => e.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function byCategory(cat: string): Experiment[] {
  return experiments.filter((e) => e.category === cat);
}

export function related(slug: string): Experiment[] {
  const me = getExperiment(slug);
  if (!me) return [];
  const pool = experiments.filter((e) => e.slug !== slug);
  const same = pool.filter((e) => e.category === me.category);
  const rest = pool.filter((e) => e.category !== me.category);
  return [...same, ...rest].slice(0, 3);
}

export function defaultParams(exp: Experiment): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of exp.params) out[p.name] = p.default;
  return out;
}

export function clampParams(
  exp: Experiment,
  values: Record<string, number>
): Record<string, number> {
  const out = defaultParams(exp);
  for (const spec of exp.params) {
    const v = values[spec.name];
    if (v !== undefined && Number.isFinite(v)) {
      out[spec.name] = Math.min(spec.max, Math.max(spec.min, v));
    }
  }
  return out;
}

export const SITE_URL = "https://physics-lab.tomatoeggcat.com";
export const SITE_NAME = "물리 실험실";
