import sensorsJson from "../../data/sensors.json";
import calculatorsJson from "../../data/calculators.json";
import guidesJson from "../../data/guides.json";

export interface Resolution {
  label: string;
  width: number;
  height: number;
  pitchUm: number;
}

export interface Sensor {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  diagonalMm: number;
  cropFactor: number;
  commonResolutions: Resolution[];
  source: string;
}

export interface CalcMeta {
  slug: string;
  name: string;
  category: CategoryKey;
  formula: string;
  formulaSource: { 문헌명: string; 출처: string };
  complexity: string;
}

export interface GuideMeta {
  slug: string;
  name: string;
  category: CategoryKey;
  topic: string;
  relatedCalculator: string;
  factualBasis: string;
}

export type CategoryKey =
  | "depth"
  | "exposure"
  | "astro"
  | "framing"
  | "sharpness"
  | "flash"
  | "planning";

export const CATEGORIES: Record<CategoryKey, string> = {
  depth: "심도·광학",
  exposure: "노출",
  astro: "천체·자연광",
  framing: "화각·구도",
  sharpness: "해상도·디테일",
  flash: "플래시",
  planning: "촬영 계획",
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const SENSORS: Sensor[] = sensorsJson.sensors as Sensor[];

export const CALCULATORS: CalcMeta[] = (
  calculatorsJson.calculators as Array<Record<string, unknown>>
).map((c) => ({
  slug: c.slug as string,
  name: c.name as string,
  category: c.category as CategoryKey,
  formula: c.formula as string,
  formulaSource: c.formulaSource as CalcMeta["formulaSource"],
  complexity: c.complexity as string,
}));

export const GUIDES: GuideMeta[] = guidesJson.guides as GuideMeta[];

export function getSensor(id: string): Sensor {
  return SENSORS.find((s) => s.id === id) ?? SENSORS[0];
}

export function getCalc(slug: string): CalcMeta | undefined {
  return CALCULATORS.find((c) => c.slug === slug);
}

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function calcsInCategory(cat: CategoryKey): CalcMeta[] {
  return CALCULATORS.filter((c) => c.category === cat);
}

export function guidesInCategory(cat: CategoryKey): GuideMeta[] {
  return GUIDES.filter((g) => g.category === cat);
}

export const F_CLICKS_THIRD = calculatorsJson.meta.fStopClicksThird as number[];
export const F_CLICKS_HALF = calculatorsJson.meta.fStopClicksHalf as number[];
export const SHUTTER_CLICKS_THIRD = calculatorsJson.meta
  .shutterClicksThird as string[];

export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL || undefined;
}
