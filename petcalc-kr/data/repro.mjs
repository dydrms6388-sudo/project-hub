// 번식 관련 데이터: 강아지 임신 기간, 고양이 발정 주기
const SRC_AKC_PREG = "https://www.akc.org/expert-advice/dog-breeding/dog-pregnancy-week-by-week/";
const SRC_MERCK = "https://www.merckvetmanual.com/dog-owners/reproductive-disorders-of-dogs";
const SRC_CORNELL = "https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics";
const CHECKED = "2026-08-19";

export const DOG_GESTATION = {
  avgDays: { value: 63, source: SRC_AKC_PREG, checkedAt: CHECKED },
  rangeDays: { value: [58, 68], source: SRC_MERCK, checkedAt: CHECKED },
  milestones: [
    { day: 25, label: "초음파로 임신 확인 가능 시점(약 25~35일)", source: SRC_AKC_PREG, checkedAt: CHECKED },
    { day: 30, label: "호르몬(릴랙신) 검사 가능 시점(약 25~30일 이후)", source: SRC_AKC_PREG, checkedAt: CHECKED },
    { day: 45, label: "X-ray로 태아 수 확인 가능 시점(약 45일 이후)", source: SRC_AKC_PREG, checkedAt: CHECKED },
    { day: 57, label: "출산 준비(산실 마련) 권장 시점", source: SRC_AKC_PREG, checkedAt: CHECKED },
  ],
  note: "교배일 기준 평균 63일(약 9주), 정상 범위 58~68일. 배란일 기준으로는 65±1일로 더 정확함.",
};

export const CAT_HEAT = {
  seasonal: { value: "계절성 다발정 동물 — 일조 시간이 길어지는 시기(봄~가을)에 발정이 반복됨", source: SRC_CORNELL, checkedAt: CHECKED },
  estrusDays: { value: [3, 14], avg: 7, source: SRC_CORNELL, checkedAt: CHECKED },
  intervalDays: { value: [14, 21], source: SRC_CORNELL, checkedAt: CHECKED },
  firstHeatMonths: { value: [4, 12], note: "이르면 생후 4개월부터 가능", source: SRC_CORNELL, checkedAt: CHECKED },
  note: "발정 지속 평균 약 7일(3~14일), 임신하지 않으면 2~3주(14~21일) 간격으로 반복. 개체차가 매우 큼.",
};
