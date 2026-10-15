// 사료 급여량(RER/MER) 데이터 · 계산 함수
// 표준 수의영양학 공식: RER(kcal/day) = 70 × (체중kg)^0.75
// MER 계수 표: Ohio State University Veterinary Medical Center "Basic Calorie Calculator"
// 및 WSAVA Global Nutrition Guidelines 의 표준 계수.
const SRC_OSU = "https://vet.osu.edu/vmc/companion/our-services/nutrition-support-service/basic-calorie-calculator";
const SRC_WSAVA = "https://wsava.org/global-guidelines/global-nutrition-guidelines/";
const CHECKED = "2026-08-19";

export const RER_FORMULA = {
  value: "RER = 70 × (체중kg)^0.75",
  source: SRC_OSU,
  checkedAt: CHECKED,
};

// MER = RER × 계수
export const MER_FACTORS = {
  dog: [
    { key: "puppy_young", label: "강아지 (생후 0~4개월)", factor: 3.0, source: SRC_OSU, checkedAt: CHECKED },
    { key: "puppy_older", label: "강아지 (4개월~성견 전)", factor: 2.0, source: SRC_OSU, checkedAt: CHECKED },
    { key: "neutered_adult", label: "중성화한 성견", factor: 1.6, source: SRC_OSU, checkedAt: CHECKED },
    { key: "intact_adult", label: "중성화 안 한 성견", factor: 1.8, source: SRC_OSU, checkedAt: CHECKED },
    { key: "inactive", label: "비활동적 / 비만 경향", factor: 1.3, note: "OSU 표 기준 1.2~1.4 범위의 중간값", source: SRC_OSU, checkedAt: CHECKED },
    { key: "weight_loss", label: "체중 감량 중", factor: 1.0, note: "이상 체중 기준 RER × 1.0", source: SRC_OSU, checkedAt: CHECKED },
    { key: "weight_gain", label: "체중 증량 필요", factor: 1.5, note: "OSU 표 기준 1.2~1.8 범위의 중간값, 이상 체중 기준", source: SRC_OSU, checkedAt: CHECKED },
    { key: "active_work", label: "활동량 많음 / 사역견", factor: 2.5, note: "OSU 표 기준 2.0~5.0 범위의 보수적 값", source: SRC_OSU, checkedAt: CHECKED },
  ],
  cat: [
    { key: "kitten", label: "새끼 고양이 (1살 미만)", factor: 2.5, source: SRC_OSU, checkedAt: CHECKED },
    { key: "neutered_adult", label: "중성화한 성묘", factor: 1.2, source: SRC_OSU, checkedAt: CHECKED },
    { key: "intact_adult", label: "중성화 안 한 성묘", factor: 1.4, source: SRC_OSU, checkedAt: CHECKED },
    { key: "inactive", label: "비활동적 / 비만 경향", factor: 1.0, source: SRC_OSU, checkedAt: CHECKED },
    { key: "weight_loss", label: "체중 감량 중", factor: 0.8, note: "이상 체중 기준 RER × 0.8", source: SRC_OSU, checkedAt: CHECKED },
    { key: "weight_gain", label: "체중 증량 필요", factor: 1.4, note: "OSU 표 기준 1.2~1.8 범위 내 보수적 값, 이상 체중 기준", source: SRC_OSU, checkedAt: CHECKED },
  ],
  meta: { source: SRC_WSAVA, checkedAt: CHECKED },
};

export function calcRER(weightKg) {
  const w = Number(weightKg);
  if (!isFinite(w) || w <= 0) return NaN;
  return 70 * Math.pow(w, 0.75);
}

export function calcMER(weightKg, factor) {
  const f = Number(factor);
  if (!isFinite(f) || f <= 0) return NaN;
  return calcRER(weightKg) * f;
}

// 사료 g 환산: 하루 kcal ÷ (사료 100g당 kcal) × 100
export function kcalToGrams(kcalPerDay, kcalPer100g) {
  const k = Number(kcalPerDay), d = Number(kcalPer100g);
  if (!isFinite(k) || !isFinite(d) || d <= 0) return NaN;
  return (k / d) * 100;
}
