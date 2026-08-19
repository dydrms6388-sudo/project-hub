// 반려동물 나이 → 사람 나이 환산표
// 강아지: 체구별 환산표 (단순 ×7 이 아님) — American Kennel Club(AKC) 환산 차트 기준.
// 고양이: 1살=15세, 2살=24세, 이후 1년마다 +4세 — International Cat Care 기준.
const SRC_AKC_DOG = "https://www.akc.org/expert-advice/health/how-to-calculate-dog-years-to-human-years/";
const SRC_ICATCARE = "https://icatcare.org/advice/how-to-tell-your-cats-age-in-human-years/";
const CHECKED = "2026-08-19";

// 인덱스 = 강아지 나이(만 나이, 1~16살). 체구: small(9.5kg 미만) / medium(9.5~22kg) / large(23kg 이상)
export const DOG_AGE_TABLE = {
  small:  [null, 15, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80],
  medium: [null, 15, 24, 28, 32, 36, 42, 47, 51, 56, 60, 65, 69, 74, 78, 83, 87],
  large:  [null, 15, 24, 28, 32, 36, 45, 50, 55, 61, 66, 72, 77, 82, 88, 93, 99],
  sizeLabels: { small: "소형견 (9.5kg 미만)", medium: "중형견 (9.5~22kg)", large: "대형견 (23kg 이상)" },
  source: SRC_AKC_DOG,
  checkedAt: CHECKED,
  note: "AKC 환산 차트 기준. 첫 1년 ≈ 사람 15세, 2년째 ≈ +9세, 이후 체구별로 매년 +4~5세씩. 초대형견은 대형견보다 노화가 더 빠를 수 있음.",
};

export const CAT_AGE_RULE = {
  year1: 15,
  year2: 24,
  perYearAfter: 4,
  source: SRC_ICATCARE,
  checkedAt: CHECKED,
  note: "International Cat Care 환산 기준: 1살=사람 15세, 2살=24세, 이후 1년마다 약 4세씩 증가.",
};

export function dogHumanAge(dogYears, size) {
  const t = DOG_AGE_TABLE[size];
  if (!t) return NaN;
  const y = Number(dogYears);
  if (!isFinite(y) || y <= 0) return NaN;
  if (y < 1) return Math.round(15 * y); // 1살 미만은 선형 근사 (참고용)
  const lo = Math.min(16, Math.floor(y));
  const hi = Math.min(16, lo + 1);
  const base = t[lo];
  if (y >= 16) {
    // 16살 초과: 마지막 구간 증가폭으로 외삽
    const step = t[16] - t[15];
    return Math.round(t[16] + (y - 16) * step);
  }
  return Math.round(base + (t[hi] - base) * (y - lo));
}

export function catHumanAge(catYears) {
  const y = Number(catYears);
  if (!isFinite(y) || y <= 0) return NaN;
  if (y < 1) return Math.round(15 * y);
  if (y < 2) return Math.round(15 + (CAT_AGE_RULE.year2 - 15) * (y - 1));
  return Math.round(CAT_AGE_RULE.year2 + (y - 2) * CAT_AGE_RULE.perYearAfter);
}
