import raw from "../../data/sounds.json";

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  meaning: string;
}

export interface Sound {
  slug: string;
  name: string;
  category: string;
  principle: string;
  synthesis: string;
  params: ParamSpec[];
  needsHeadphones: boolean;
  hearingRisk: "없음" | "주의";
  cpuCost: "저" | "중" | "고";
}

export interface Category {
  slug: string;
  label: string;
  description: string;
}

const data = raw as unknown as { categories: Category[]; sounds: Sound[] };

export const categories: Category[] = data.categories;
export const sounds: Sound[] = data.sounds;

export function getSound(slug: string): Sound | undefined {
  return sounds.find((s) => s.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function byCategory(cat: string): Sound[] {
  return sounds.filter((s) => s.category === cat);
}

export function defaultValues(sound: Sound): number[] {
  return sound.params.map((p) => p.default);
}

const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!envUrl) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL 환경변수가 설정되어 있지 않습니다. 도메인 하드코딩·폴백은 금지되어 있습니다."
  );
}
export const SITE_URL: string = envUrl.replace(/\/$/, "");
export const SITE_NAME = "소리실험실";
