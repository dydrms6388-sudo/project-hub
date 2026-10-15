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
  name: string;
  desc: string;
}

const data = raw as unknown & { categories: Category[]; sounds: Sound[] };

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

export function defaultParams(s: Sound): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of s.params) out[p.name] = p.default;
  return out;
}

/** 같은 원리로 이어지는 실험 3개 — 손으로 고른 상호 링크 */
const RELATED: Record<string, string[]> = {
  "shepard-risset": ["tritone-paradox", "risset-rhythm", "missing-fundamental"],
  "risset-rhythm": ["shepard-risset", "click-train-pitch", "auditory-streaming"],
  "missing-fundamental": ["mistuned-harmonic", "harmonic-series", "shepard-risset"],
  "tritone-paradox": ["shepard-risset", "octave-scrambled-melody", "pitch-jnd"],
  "octave-illusion": ["scale-illusion", "huggins-pitch", "itd-ild"],
  "scale-illusion": ["octave-illusion", "auditory-streaming", "octave-scrambled-melody"],
  "continuity-illusion": ["masking", "auditory-streaming", "gap-detection"],
  "zwicker-tone": ["masking", "noise-colors", "hearing-range"],
  "auditory-streaming": ["scale-illusion", "continuity-illusion", "risset-rhythm"],
  "huggins-pitch": ["binaural-beats", "octave-illusion", "phase-cancellation"],
  "octave-scrambled-melody": ["tritone-paradox", "scale-illusion", "pitch-jnd"],
  "mistuned-harmonic": ["missing-fundamental", "harmonic-series", "interval-consonance"],
  "binaural-beats": ["beat-frequency", "huggins-pitch", "itd-ild"],
  "beat-frequency": ["binaural-beats", "roughness", "phase-cancellation"],
  "hearing-range": ["equal-loudness", "pitch-jnd", "zwicker-tone"],
  "equal-loudness": ["hearing-range", "masking", "noise-colors"],
  "masking": ["continuity-illusion", "zwicker-tone", "equal-loudness"],
  "roughness": ["beat-frequency", "interval-consonance", "modulation-perception"],
  "interval-consonance": ["roughness", "harmonic-series", "mistuned-harmonic"],
  "combination-tones": ["missing-fundamental", "ring-modulation", "roughness"],
  "pitch-jnd": ["hearing-range", "gap-detection", "tritone-paradox"],
  "gap-detection": ["pitch-jnd", "continuity-illusion", "click-train-pitch"],
  "click-train-pitch": ["risset-rhythm", "gap-detection", "modulation-perception"],
  "modulation-perception": ["roughness", "click-train-pitch", "ring-modulation"],
  "haas-effect": ["itd-ild", "reverb-distance", "comb-filter"],
  "itd-ild": ["haas-effect", "binaural-beats", "octave-illusion"],
  "doppler": ["reverb-distance", "haas-effect", "phase-cancellation"],
  "reverb-distance": ["haas-effect", "doppler", "comb-filter"],
  "harmonic-series": ["missing-fundamental", "adsr-envelope", "filter-sweep"],
  "fm-synthesis": ["ring-modulation", "modulation-perception", "waveshaping-distortion"],
  "ring-modulation": ["fm-synthesis", "combination-tones", "modulation-perception"],
  "karplus-strong": ["comb-filter", "adsr-envelope", "harmonic-series"],
  "noise-colors": ["zwicker-tone", "filter-sweep", "gap-detection"],
  "formant-vowels": ["filter-sweep", "harmonic-series", "noise-colors"],
  "filter-sweep": ["formant-vowels", "noise-colors", "comb-filter"],
  "adsr-envelope": ["harmonic-series", "karplus-strong", "fm-synthesis"],
  "comb-filter": ["karplus-strong", "phase-cancellation", "filter-sweep"],
  "waveshaping-distortion": ["fm-synthesis", "digital-artifacts", "combination-tones"],
  "phase-cancellation": ["beat-frequency", "comb-filter", "huggins-pitch"],
  "digital-artifacts": ["waveshaping-distortion", "noise-colors", "hearing-range"],
};

export function related(slug: string): Sound[] {
  return (RELATED[slug] ?? [])
    .map((s) => getSound(s))
    .filter((s): s is Sound => Boolean(s));
}

export function relatedMap(): Record<string, string[]> {
  return RELATED;
}

/** 슬라이더 라벨: 파라미터 영문 name → 한국어 표기 */
const PARAM_LABELS: Record<string, string> = {
  speed: "속도", stepSemitones: "계단 크기", partials: "부분음 수",
  envelopeCenter: "포락선 중심", accel: "가속률", baseTempo: "기준 템포",
  layers: "레이어 수", fundamental: "기본 주파수", lowestHarmonic: "시작 배음",
  harmonicCount: "배음 수", pitchClass: "첫 음(음이름)", pause: "음 사이 간격",
  baseFreq: "기준 주파수", rate: "교대/재생 속도", tempo: "템포",
  keyShift: "조옮김", toneFreq: "지속음 주파수", noiseGainDb: "잡음 레벨",
  gapDuration: "끊김 길이", toneContinues: "실제 지속 여부", notchCenter: "노치 중심",
  notchWidth: "노치 폭", noiseDuration: "잡음 길이", freqA: "음 A 주파수",
  interval: "음정 간격", phaseFreq: "위상 반전 대역", bandwidth: "대역폭",
  scrambleRange: "뒤섞기 범위", seed: "배치 패턴", harmonicIndex: "대상 배음",
  mistuning: "어긋남", carrier: "반송파", beatFreq: "맥놀이 주파수",
  f1: "주파수 1", detune: "주파수 차", frequency: "주파수", level: "레벨",
  referenceLevel: "기준 레벨", maskerFreq: "마스커 주파수", probeOffset: "표적 간격",
  probeLevel: "표적 레벨", probeDelay: "표적 지연", meanFreq: "중심 주파수",
  separation: "간격", intervalCents: "음정", partialsPerTone: "음당 배음 수",
  f2Ratio: "f2 비율", diffCents: "차이", toneDuration: "음 길이",
  gapLength: "틈 길이", centerFreq: "중심 주파수", repeatInterval: "반복 간격",
  clickRate: "클릭 속도", lowpassCutoff: "저역 컷오프", modRate: "변조 속도",
  modDepth: "변조 깊이", modType: "변조 종류", delay: "지연", levelDiff: "레벨 차",
  itd: "시간차(ITD)", ild: "레벨차(ILD)", sourceFreq: "음원 주파수",
  passDistance: "통과 거리", directRatio: "직접음 비율", decayTime: "잔향 시간",
  preDelay: "프리딜레이", slope: "감쇠 기울기", oddEvenBalance: "홀짝 배음 비율",
  ratio: "주파수 비", index: "변조 지수", indexDecay: "지수 감쇠",
  inputFreq: "입력 주파수", modFreq: "변조 주파수", mix: "혼합비",
  pitch: "음높이", damping: "감쇠", pluckBrightness: "뜯기 밝기",
  f2: "둘째 포먼트", sourcePitch: "성대 주파수", breathiness: "기식",
  cutoff: "컷오프", resonance: "공명(Q)", sourceType: "소스 종류",
  lfoRate: "LFO 속도", attack: "어택", decay: "디케이", sustain: "서스테인",
  release: "릴리즈", delayTime: "지연 시간", feedback: "되먹임",
  drive: "드라이브", symmetry: "대칭도", toneCutoff: "톤 컷오프",
  sampleRate: "샘플레이트", bitDepth: "비트 심도",
};

export function paramLabel(name: string): string {
  return PARAM_LABELS[name] ?? name;
}

/** 로그 스케일로 다뤄야 자연스러운 슬라이더 ("slug:param") */
const LOG_PARAMS = new Set([
  "hearing-range:frequency",
  "equal-loudness:frequency",
  "click-train-pitch:clickRate",
  "modulation-perception:modRate",
  "noise-colors:lowpassCutoff",
  "filter-sweep:cutoff",
]);

export function isLogParam(slug: string, param: string): boolean {
  return LOG_PARAMS.has(`${slug}:${param}`);
}

const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!envUrl) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL 환경변수가 필요합니다 (도메인 하드코딩·폴백 금지)."
  );
}
export const SITE_URL: string = envUrl.replace(/\/$/, "");
export const SITE_NAME = "소리 실험실";
