/**
 * 순수 계산 함수 모음 — UI 의존성 없음.
 * 모든 공식은 registry.ts 의 principle / sources 에 원문과 출처가 함께 적혀 있다.
 * (이 파일만 따로 tsc 로 컴파일해 손계산 검산이 가능하도록 순수 함수로 유지한다)
 */

export type Sex = "male" | "female";

export const round = (n: number, digits = 1): number => {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

/** 산식 박스에 뿌릴 한 줄 = 라벨 + 숫자 대입식 + 결과 */
export type Step = { label: string; expr: string; value: string };

/* ------------------------------------------------------------------ */
/* 1. BMI                                                              */
/* ------------------------------------------------------------------ */

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiBand = { label: string; min: number; max: number; tone: "low" | "ok" | "warn" | "high" };

/** WHO 국제 기준 (성인) */
export const BMI_WHO: BmiBand[] = [
  { label: "저체중", min: -Infinity, max: 18.5, tone: "low" },
  { label: "정상", min: 18.5, max: 25, tone: "ok" },
  { label: "과체중(비만 전 단계)", min: 25, max: 30, tone: "warn" },
  { label: "비만 1단계", min: 30, max: 35, tone: "high" },
  { label: "비만 2단계", min: 35, max: 40, tone: "high" },
  { label: "비만 3단계", min: 40, max: Infinity, tone: "high" },
];

/** WHO 서태평양지역 아시아·태평양 기준 (대한비만학회가 채택) */
export const BMI_ASIA: BmiBand[] = [
  { label: "저체중", min: -Infinity, max: 18.5, tone: "low" },
  { label: "정상", min: 18.5, max: 23, tone: "ok" },
  { label: "비만 전 단계(과체중)", min: 23, max: 25, tone: "warn" },
  { label: "1단계 비만", min: 25, max: 30, tone: "high" },
  { label: "2단계 비만", min: 30, max: 35, tone: "high" },
  { label: "3단계 비만(고도비만)", min: 35, max: Infinity, tone: "high" },
];

export function bandOf(bands: BmiBand[], value: number): BmiBand {
  return bands.find((b) => value >= b.min && value < b.max) ?? bands[bands.length - 1];
}

/** 해당 기준에서 "정상" 구간에 해당하는 체중(kg) 범위 */
export function weightRangeForBmi(heightCm: number, lo: number, hi: number): [number, number] {
  const m = heightCm / 100;
  return [lo * m * m, hi * m * m];
}

/* ------------------------------------------------------------------ */
/* 2. BMR / TDEE                                                       */
/* ------------------------------------------------------------------ */

/** Mifflin-St Jeor (1990) */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/** Harris-Benedict 개정판 (Roza & Shizgal 1984) */
export function bmrHarrisBenedict(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return sex === "male"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

/** Katch-McArdle (제지방량 기반) — 체지방률을 아는 경우 */
export function bmrKatchMcArdle(weightKg: number, bodyFatPct: number): number {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

export type Activity = { key: string; label: string; factor: number; desc: string };

export const ACTIVITY_LEVELS: Activity[] = [
  { key: "sedentary", label: "거의 안 움직임", factor: 1.2, desc: "종일 앉아서 일하고 따로 운동하지 않음" },
  { key: "light", label: "가벼운 활동", factor: 1.375, desc: "주 1~3회 가벼운 운동 또는 서서 하는 일" },
  { key: "moderate", label: "보통 활동", factor: 1.55, desc: "주 3~5회 중강도 운동" },
  { key: "active", label: "활동적", factor: 1.725, desc: "주 6~7회 운동 또는 육체노동" },
  { key: "veryActive", label: "매우 활동적", factor: 1.9, desc: "하루 2회 훈련 또는 고강도 육체노동" },
];

export function tdee(bmr: number, factor: number): number {
  return bmr * factor;
}

/* ------------------------------------------------------------------ */
/* 3. 단백질                                                            */
/* ------------------------------------------------------------------ */

export type ProteinGoal = { key: string; label: string; min: number; max: number; note: string };

export const PROTEIN_GOALS: ProteinGoal[] = [
  {
    key: "rda",
    label: "일반 성인(운동 거의 없음)",
    min: 0.8,
    max: 1.0,
    note: "WHO/FAO·한국인 영양소 섭취기준의 성인 권장섭취량은 체중 1kg당 약 0.8~0.91g 수준입니다.",
  },
  {
    key: "light",
    label: "가벼운 운동(주 2~3회)",
    min: 1.0,
    max: 1.4,
    note: "규칙적으로 몸을 쓰기 시작하면 권장섭취량보다 조금 더 필요하다는 것이 일반적인 견해입니다.",
  },
  {
    key: "endurance",
    label: "지구력 운동(러닝·사이클)",
    min: 1.2,
    max: 1.6,
    note: "ACSM/AND/DC 공동 성명은 지구력 종목 선수에게 체중 1kg당 1.2~1.7g을 제시합니다.",
  },
  {
    key: "strength",
    label: "근력 운동·근육량 증가",
    min: 1.6,
    max: 2.2,
    note: "ISSN 포지션 스탠드는 근육량 유지·증가 목적에서 1.4~2.0g/kg 이상을 제시합니다.",
  },
  {
    key: "deficit",
    label: "감량기 근손실 최소화",
    min: 1.6,
    max: 2.2,
    note: "섭취 열량이 줄어드는 시기에는 상대적으로 높은 단백질 비율이 연구에서 다뤄집니다. 감량 계획 자체는 전문가와 상의하세요.",
  },
  {
    key: "senior",
    label: "65세 이상",
    min: 1.0,
    max: 1.2,
    note: "PROT-AGE·ESPEN 등 노년기 지침은 근감소 예방을 위해 1.0~1.2g/kg을 언급합니다.",
  },
];

export function proteinRange(weightKg: number, goal: ProteinGoal): [number, number] {
  return [weightKg * goal.min, weightKg * goal.max];
}

/* ------------------------------------------------------------------ */
/* 4. 수분                                                              */
/* ------------------------------------------------------------------ */

/** 체중 기반 추정: 30~35 mL/kg (임상 현장에서 널리 쓰이는 경험식) */
export function waterFromWeight(weightKg: number): [number, number] {
  return [weightKg * 30, weightKg * 35];
}

/** 운동 보정: 30분당 약 350~500 mL */
export function waterFromExercise(minutes: number): [number, number] {
  return [(minutes / 30) * 350, (minutes / 30) * 500];
}

/** EFSA 총수분 충분섭취량 (음식 포함) */
export const EFSA_TOTAL_WATER = { male: 2500, female: 2000 } as const;
/** 총수분 중 음료로 마시는 비율(약 70~80%) */
export const DRINK_SHARE = 0.75;

/* ------------------------------------------------------------------ */
/* 5. 카페인                                                            */
/* ------------------------------------------------------------------ */

export type CaffeineIntake = { id: string; hhmm: string; mg: number; label?: string };

/** 1차 소실: C(t) = C0 × (1/2)^(t/T½) */
export function caffeineRemaining(doseMg: number, hoursElapsed: number, halfLifeH: number): number {
  if (hoursElapsed < 0) return 0;
  return doseMg * Math.pow(0.5, hoursElapsed / halfLifeH);
}

export const hhmmToMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minToHhmm = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * 여러 번 마신 카페인의 시각별 합계 잔존량.
 * 기준 시각(anchorMin)부터 hours 시간 동안 stepMin 간격으로 계산한다.
 */
export function caffeineCurve(
  intakes: CaffeineIntake[],
  halfLifeH: number,
  anchorMin: number,
  hours = 24,
  stepMin = 15,
): { t: number; mg: number }[] {
  const out: { t: number; mg: number }[] = [];
  for (let t = anchorMin; t <= anchorMin + hours * 60; t += stepMin) {
    let sum = 0;
    for (const it of intakes) {
      let start = hhmmToMin(it.hhmm);
      // 기준 시각보다 이른 시:분은 같은 날로 보고, 그 이후로만 감쇠시킨다.
      if (start < anchorMin) start += 0;
      const dh = (t - start) / 60;
      if (dh >= 0) sum += caffeineRemaining(it.mg, dh, halfLifeH);
    }
    out.push({ t, mg: sum });
  }
  return out;
}

/** 특정 시각(분 단위, 자정 기준)의 잔존량 — 취침 시각이 다음 날이면 +1440 을 넘겨준다 */
export function caffeineAt(intakes: CaffeineIntake[], halfLifeH: number, atMin: number): number {
  let sum = 0;
  for (const it of intakes) {
    const dh = (atMin - hhmmToMin(it.hhmm)) / 60;
    if (dh >= 0) sum += caffeineRemaining(it.mg, dh, halfLifeH);
  }
  return sum;
}

/** 잔존량이 목표치 아래로 내려가는 데 걸리는 시간(h) */
export function hoursToReach(doseMg: number, targetMg: number, halfLifeH: number): number {
  if (doseMg <= targetMg) return 0;
  return halfLifeH * Math.log2(doseMg / targetMg);
}

export type Drink = { name: string; mg: number; serving: string; group: string };

/** 제품·매장·추출 방식에 따라 편차가 큰 값이라 "대표값"으로만 쓴다 */
export const DRINKS: Drink[] = [
  { name: "에스프레소 1샷", mg: 75, serving: "30mL", group: "커피" },
  { name: "아메리카노(작은 컵)", mg: 125, serving: "약 355mL", group: "커피" },
  { name: "아메리카노(큰 컵)", mg: 190, serving: "약 473mL", group: "커피" },
  { name: "콜드브루", mg: 200, serving: "약 355mL", group: "커피" },
  { name: "카페라떼", mg: 75, serving: "약 355mL", group: "커피" },
  { name: "드립커피", mg: 120, serving: "240mL", group: "커피" },
  { name: "인스턴트 커피 1잔", mg: 60, serving: "200mL", group: "커피" },
  { name: "커피믹스 1봉", mg: 50, serving: "1봉", group: "커피" },
  { name: "디카페인 아메리카노", mg: 10, serving: "약 355mL", group: "커피" },
  { name: "캔커피", mg: 75, serving: "175mL", group: "커피" },
  { name: "녹차(티백 1개)", mg: 25, serving: "200mL", group: "차" },
  { name: "홍차(티백 1개)", mg: 45, serving: "200mL", group: "차" },
  { name: "우롱차", mg: 35, serving: "200mL", group: "차" },
  { name: "말차 라떼", mg: 70, serving: "약 355mL", group: "차" },
  { name: "보리차·둥굴레차", mg: 0, serving: "200mL", group: "차" },
  { name: "콜라", mg: 35, serving: "355mL", group: "음료" },
  { name: "제로 콜라", mg: 35, serving: "355mL", group: "음료" },
  { name: "에너지드링크(소형)", mg: 60, serving: "250mL", group: "음료" },
  { name: "에너지드링크(대형)", mg: 100, serving: "355mL", group: "음료" },
  { name: "이온음료", mg: 0, serving: "500mL", group: "음료" },
  { name: "코코아·핫초코", mg: 5, serving: "200mL", group: "간식" },
  { name: "다크초콜릿", mg: 20, serving: "30g", group: "간식" },
  { name: "밀크초콜릿", mg: 6, serving: "30g", group: "간식" },
  { name: "커피맛 아이스크림", mg: 30, serving: "100mL", group: "간식" },
];

/** 성인 1일 최대 섭취 권고량(mg) — 식약처·EFSA 모두 400mg */
export const CAFFEINE_DAILY_LIMIT = 400;
/** 임신부 권고 상한(mg) */
export const CAFFEINE_PREGNANCY_LIMIT = 300;
/** 잠들기에 방해가 덜 된다고 흔히 언급되는 취침 시 잔존량 기준선(mg) */
export const CAFFEINE_BEDTIME_REF = 50;

/* ------------------------------------------------------------------ */
/* 6. 수면 사이클                                                       */
/* ------------------------------------------------------------------ */

export const CYCLE_MIN = 90;

/** 취침 시각 → 사이클 수별 기상 시각 */
export function wakeTimesFromBed(bedMin: number, latencyMin: number, cycles: number[]): { cycles: number; min: number }[] {
  return cycles.map((c) => ({ cycles: c, min: bedMin + latencyMin + c * CYCLE_MIN }));
}

/** 기상 시각 → 사이클 수별 취침 시각 */
export function bedTimesFromWake(wakeMin: number, latencyMin: number, cycles: number[]): { cycles: number; min: number }[] {
  return cycles.map((c) => ({ cycles: c, min: wakeMin - latencyMin - c * CYCLE_MIN }));
}

/* ------------------------------------------------------------------ */
/* 7. 체지방률 (US Navy)                                                */
/* ------------------------------------------------------------------ */

const log10 = (x: number) => Math.log(x) / Math.LN10;

/** 단위는 모두 cm. 남성은 허리-목, 여성은 허리+엉덩이-목을 쓴다. */
export function bodyFatNavy(
  sex: Sex,
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm?: number,
): number {
  if (sex === "male") {
    const d = waistCm - neckCm;
    if (d <= 0) return NaN;
    return 495 / (1.0324 - 0.19077 * log10(d) + 0.15456 * log10(heightCm)) - 450;
  }
  const d = waistCm + (hipCm ?? 0) - neckCm;
  if (d <= 0) return NaN;
  return 495 / (1.29579 - 0.35004 * log10(d) + 0.221 * log10(heightCm)) - 450;
}

export type FatBand = { label: string; min: number; max: number };

/** ACE(American Council on Exercise) 체지방률 분류 */
export const FAT_BANDS: Record<Sex, FatBand[]> = {
  male: [
    { label: "필수지방", min: -Infinity, max: 6 },
    { label: "운동선수", min: 6, max: 14 },
    { label: "건강·양호", min: 14, max: 18 },
    { label: "평균", min: 18, max: 25 },
    { label: "비만 범위", min: 25, max: Infinity },
  ],
  female: [
    { label: "필수지방", min: -Infinity, max: 14 },
    { label: "운동선수", min: 14, max: 21 },
    { label: "건강·양호", min: 21, max: 25 },
    { label: "평균", min: 25, max: 32 },
    { label: "비만 범위", min: 32, max: Infinity },
  ],
};

export function fatBandOf(sex: Sex, pct: number): FatBand {
  const list = FAT_BANDS[sex];
  return list.find((b) => pct >= b.min && pct < b.max) ?? list[list.length - 1];
}

/* ------------------------------------------------------------------ */
/* 8. 나이                                                              */
/* ------------------------------------------------------------------ */

export type Ymd = { y: number; m: number; d: number };

export const parseYmd = (iso: string): Ymd | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
};

/** 만 나이 — 생일이 지났으면 (기준연도-출생연도), 아니면 -1 */
export function ageMan(birth: Ymd, ref: Ymd): number {
  let a = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) a -= 1;
  return a;
}

/** 연 나이 — 기준연도 - 출생연도 (병역법·청소년보호법 등에서 사용) */
export function ageYear(birth: Ymd, ref: Ymd): number {
  return ref.y - birth.y;
}

/** 세는 나이 — 태어나면 1살, 해가 바뀌면 +1 */
export function ageKorean(birth: Ymd, ref: Ymd): number {
  return ref.y - birth.y + 1;
}

const toUtc = (v: Ymd) => Date.UTC(v.y, v.m - 1, v.d);

export function daysBetween(a: Ymd, b: Ymd): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export function addDays(v: Ymd, days: number): Ymd {
  const d = new Date(toUtc(v) + days * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

export const fmtYmd = (v: Ymd): string => `${v.y}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}`;

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const weekdayOf = (v: Ymd): string => WEEKDAY_KO[new Date(toUtc(v)).getUTCDay()];

/** 다음 생일까지 남은 일수 (2/29 는 평년에 3/1 로 본다) */
export function daysToNextBirthday(birth: Ymd, ref: Ymd): { days: number; date: Ymd } {
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const build = (y: number): Ymd =>
    birth.m === 2 && birth.d === 29 && !isLeap(y) ? { y, m: 3, d: 1 } : { y, m: birth.m, d: birth.d };
  let next = build(ref.y);
  if (daysBetween(ref, next) < 0) next = build(ref.y + 1);
  return { days: daysBetween(ref, next), date: next };
}

/* ------------------------------------------------------------------ */
/* 9. 운동 칼로리 (MET)                                                 */
/* ------------------------------------------------------------------ */

export type Met = { name: string; met: number; group: string };

/** Compendium of Physical Activities (Ainsworth 2011) 기반 대표값 */
export const METS: Met[] = [
  { name: "천천히 걷기 (3.2km/h)", met: 2.8, group: "걷기·달리기" },
  { name: "보통 걷기 (4.8km/h)", met: 3.5, group: "걷기·달리기" },
  { name: "빠르게 걷기 (6.4km/h)", met: 5.0, group: "걷기·달리기" },
  { name: "언덕 걷기", met: 6.0, group: "걷기·달리기" },
  { name: "등산", met: 6.0, group: "걷기·달리기" },
  { name: "계단 오르기", met: 8.8, group: "걷기·달리기" },
  { name: "가벼운 조깅", met: 7.0, group: "걷기·달리기" },
  { name: "달리기 (8.0km/h)", met: 8.3, group: "걷기·달리기" },
  { name: "달리기 (9.7km/h)", met: 9.8, group: "걷기·달리기" },
  { name: "달리기 (11.3km/h)", met: 11.0, group: "걷기·달리기" },
  { name: "달리기 (12.9km/h)", met: 11.8, group: "걷기·달리기" },
  { name: "트레드밀 경사 걷기", met: 5.3, group: "걷기·달리기" },
  { name: "자전거 (16~19km/h)", met: 6.8, group: "자전거·유산소 기구" },
  { name: "자전거 (19~22km/h)", met: 8.0, group: "자전거·유산소 기구" },
  { name: "자전거 (22~25km/h)", met: 10.0, group: "자전거·유산소 기구" },
  { name: "실내 사이클 (보통)", met: 7.0, group: "자전거·유산소 기구" },
  { name: "스피닝 (고강도)", met: 10.5, group: "자전거·유산소 기구" },
  { name: "일립티컬", met: 5.0, group: "자전거·유산소 기구" },
  { name: "로잉머신 (보통)", met: 7.0, group: "자전거·유산소 기구" },
  { name: "스텝밀·천국의 계단", met: 9.0, group: "자전거·유산소 기구" },
  { name: "웨이트 트레이닝 (가볍게)", met: 3.5, group: "근력·맨몸" },
  { name: "웨이트 트레이닝 (고강도)", met: 6.0, group: "근력·맨몸" },
  { name: "서킷 트레이닝", met: 8.0, group: "근력·맨몸" },
  { name: "맨몸 운동 (고강도)", met: 8.0, group: "근력·맨몸" },
  { name: "줄넘기 (보통)", met: 11.8, group: "근력·맨몸" },
  { name: "줄넘기 (빠르게)", met: 12.3, group: "근력·맨몸" },
  { name: "스트레칭", met: 2.3, group: "근력·맨몸" },
  { name: "요가 (하타)", met: 2.5, group: "근력·맨몸" },
  { name: "필라테스", met: 3.0, group: "근력·맨몸" },
  { name: "클라이밍", met: 8.0, group: "근력·맨몸" },
  { name: "수영 자유형 (보통)", met: 8.3, group: "수영·수상" },
  { name: "수영 자유형 (빠르게)", met: 9.8, group: "수영·수상" },
  { name: "수영 평영", met: 5.3, group: "수영·수상" },
  { name: "수영 배영", met: 4.8, group: "수영·수상" },
  { name: "아쿠아로빅", met: 5.3, group: "수영·수상" },
  { name: "축구 (일반)", met: 7.0, group: "구기·라켓" },
  { name: "축구 (경기)", met: 10.0, group: "구기·라켓" },
  { name: "농구 (일반)", met: 6.5, group: "구기·라켓" },
  { name: "농구 (경기)", met: 8.0, group: "구기·라켓" },
  { name: "배드민턴", met: 5.5, group: "구기·라켓" },
  { name: "탁구", met: 4.0, group: "구기·라켓" },
  { name: "테니스 (단식)", met: 8.0, group: "구기·라켓" },
  { name: "테니스 (복식)", met: 6.0, group: "구기·라켓" },
  { name: "스쿼시", met: 7.3, group: "구기·라켓" },
  { name: "볼링", met: 3.8, group: "구기·라켓" },
  { name: "골프 (걸어서)", met: 4.8, group: "구기·라켓" },
  { name: "골프 (카트)", met: 3.5, group: "구기·라켓" },
  { name: "배구", met: 4.0, group: "구기·라켓" },
  { name: "에어로빅 댄스", met: 7.3, group: "댄스·기타" },
  { name: "줌바", met: 6.5, group: "댄스·기타" },
  { name: "복싱 (샌드백)", met: 5.5, group: "댄스·기타" },
  { name: "태권도·무술", met: 10.3, group: "댄스·기타" },
  { name: "스키 (활강)", met: 7.0, group: "댄스·기타" },
  { name: "인라인·스케이트", met: 7.5, group: "댄스·기타" },
  { name: "집안 청소", met: 3.5, group: "댄스·기타" },
  { name: "정원 손질", met: 4.0, group: "댄스·기타" },
];

/** kcal = MET × 3.5 × 체중(kg) ÷ 200 × 분 */
export function caloriesBurned(met: number, weightKg: number, minutes: number): number {
  return (met * 3.5 * weightKg) / 200 * minutes;
}

/** 순수 운동 소비 = 총 소비 - 같은 시간 안정 시 소비(MET 1.0) */
export function netCaloriesBurned(met: number, weightKg: number, minutes: number): number {
  return caloriesBurned(met - 1, weightKg, minutes);
}

/* ------------------------------------------------------------------ */
/* 10. 표준체중                                                         */
/* ------------------------------------------------------------------ */

export type IdealFormula = { key: string; label: string; note: string; calc: (sex: Sex, heightCm: number) => number };

const inchesOver5ft = (heightCm: number) => Math.max(0, heightCm / 2.54 - 60);

export const IDEAL_FORMULAS: IdealFormula[] = [
  {
    key: "bmi",
    label: "BMI 표준체중법",
    note: "남자는 키(m)²×22, 여자는 키(m)²×21. 국내 임상 영양에서 가장 널리 쓰입니다.",
    calc: (sex, h) => (h / 100) ** 2 * (sex === "male" ? 22 : 21),
  },
  {
    key: "broca",
    label: "브로카 변법",
    note: "(키cm − 100) × 0.9. 계산이 쉬워 국내 보건 자료에 자주 등장하지만 키가 아주 크거나 작으면 오차가 큽니다.",
    calc: (_sex, h) => (h - 100) * 0.9,
  },
  {
    key: "devine",
    label: "Devine (1974)",
    note: "약물 용량 계산용으로 만들어진 식. 남 50 + 2.3×(키 인치 − 60), 여 45.5 + 2.3×(…).",
    calc: (sex, h) => (sex === "male" ? 50 : 45.5) + 2.3 * inchesOver5ft(h),
  },
  {
    key: "robinson",
    label: "Robinson (1983)",
    note: "Devine 식을 실측 자료로 보정한 버전. 남 52 + 1.9×인치, 여 49 + 1.7×인치.",
    calc: (sex, h) => (sex === "male" ? 52 : 49) + (sex === "male" ? 1.9 : 1.7) * inchesOver5ft(h),
  },
  {
    key: "miller",
    label: "Miller (1983)",
    note: "남 56.2 + 1.41×인치, 여 53.1 + 1.36×인치. 다른 식보다 키에 따른 증가폭이 작습니다.",
    calc: (sex, h) => (sex === "male" ? 56.2 : 53.1) + (sex === "male" ? 1.41 : 1.36) * inchesOver5ft(h),
  },
  {
    key: "hamwi",
    label: "Hamwi (1964)",
    note: "당뇨 식이요법에서 나온 가장 오래된 식. 남 48 + 2.7×인치, 여 45.5 + 2.2×인치.",
    calc: (sex, h) => (sex === "male" ? 48 : 45.5) + (sex === "male" ? 2.7 : 2.2) * inchesOver5ft(h),
  },
];

/* ------------------------------------------------------------------ */
/* 11. 출산 예정일 (네겔 법칙)                                          */
/* ------------------------------------------------------------------ */

export type PregnancyResult = {
  edd: Ymd;
  conception: Ymd;
  gestDays: number;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
  trimesterStarts: { t2: Ymd; t3: Ymd };
  viability: Ymd;
  fullTerm: Ymd;
  progressPct: number;
};

/** LMP + 280일. 생리주기가 28일이 아니면 (주기 − 28)일 만큼 보정한다. */
export function pregnancyFromLmp(lmp: Ymd, cycleLen: number, today: Ymd): PregnancyResult {
  const adj = cycleLen - 28;
  const edd = addDays(lmp, 280 + adj);
  const conception = addDays(lmp, 14 + adj);
  const gestDays = Math.max(0, daysBetween(lmp, today));
  const t = Math.min(3, Math.max(1, gestDays < 98 ? 1 : gestDays < 189 ? 2 : 3)) as 1 | 2 | 3;
  return {
    edd,
    conception,
    gestDays,
    weeks: Math.floor(gestDays / 7),
    days: gestDays % 7,
    trimester: t,
    trimesterStarts: { t2: addDays(lmp, 98), t3: addDays(lmp, 189) },
    viability: addDays(lmp, 24 * 7),
    fullTerm: addDays(lmp, 37 * 7),
    progressPct: Math.min(100, (gestDays / (280 + adj)) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* 12. 목표 심박수 (카보넨)                                             */
/* ------------------------------------------------------------------ */

/** 전통식 HRmax = 220 − 나이 */
export const hrMaxClassic = (age: number): number => 220 - age;
/** Tanaka(2001) HRmax = 208 − 0.7 × 나이 */
export const hrMaxTanaka = (age: number): number => 208 - 0.7 * age;

/** 카보넨: 목표심박 = (HRmax − 안정시심박) × 강도 + 안정시심박 */
export function karvonen(hrMax: number, hrRest: number, intensity: number): number {
  return (hrMax - hrRest) * intensity + hrRest;
}

export type Zone = { key: string; label: string; lo: number; hi: number; desc: string };

export const HR_ZONES: Zone[] = [
  { key: "z1", label: "1존 · 회복", lo: 0.5, hi: 0.6, desc: "가벼운 워밍업·쿨다운. 대화가 아주 편한 강도." },
  { key: "z2", label: "2존 · 유산소 기초", lo: 0.6, hi: 0.7, desc: "긴 시간 유지 가능한 강도. 지방 이용 비율이 높은 구간." },
  { key: "z3", label: "3존 · 유산소 발달", lo: 0.7, hi: 0.8, desc: "말은 되지만 문장이 짧아지는 강도. 심폐 지구력 향상." },
  { key: "z4", label: "4존 · 젖산 역치", lo: 0.8, hi: 0.9, desc: "숨이 가쁘고 오래 못 버티는 강도. 인터벌 훈련 구간." },
  { key: "z5", label: "5존 · 최대", lo: 0.9, hi: 1.0, desc: "짧게만 가능한 전력 구간. 훈련 경험이 충분할 때만." },
];

/* ------------------------------------------------------------------ */
/* 경고 판정 — 수치 처방 없이 '전문가 상담' 만 안내한다                    */
/* ------------------------------------------------------------------ */

export type Warn = { level: "info" | "warn"; text: string };

export function bmiWarnings(b: number): Warn[] {
  const out: Warn[] = [];
  if (!isFinite(b)) return out;
  if (b < 16)
    out.push({
      level: "warn",
      text: "입력하신 값은 BMI 16 미만으로, 통상적인 성인 참고 범위에서 크게 벗어납니다. 이 페이지는 목표 체중이나 식사량을 안내하지 않습니다. 의사 또는 임상영양사와 상담해 주세요.",
    });
  else if (b < 18.5)
    out.push({ level: "info", text: "저체중 범위입니다. 원인은 사람마다 다르므로 걱정된다면 의료진과 상담하시기 바랍니다." });
  if (b >= 35)
    out.push({
      level: "warn",
      text: "BMI 35 이상은 동반질환 위험이 함께 평가되어야 하는 구간입니다. 자가 판단 대신 의료진 상담을 권합니다.",
    });
  return out;
}

export function calorieWarnings(kcal: number): Warn[] {
  if (kcal > 0 && kcal < 1000)
    return [
      {
        level: "warn",
        text: "계산 결과가 1,000kcal 미만으로 나왔습니다. 입력값을 다시 확인해 주세요. 하루 섭취 열량을 이렇게 낮게 잡는 것은 의학적 감독이 필요한 영역이라 이 도구는 섭취 목표를 제시하지 않습니다.",
      },
    ];
  return [];
}

export const MEDICAL_DISCLAIMER =
  "이 계산기의 결과는 공개된 공식과 통계를 그대로 대입한 참고용 수치이며, 의학적 진단·처방·치료를 대신하지 않습니다. 개인의 건강 상태·복용 약·기저질환에 따라 결과의 의미가 달라질 수 있으므로 판단이 필요한 경우 반드시 의료 전문가와 상담하세요.";
