/**
 * 정기결제 탐지 (스펙 4-5).
 *
 * 같은 상호·유사 금액(±5%)이 25~35일 간격으로 3회 이상이면 정기결제로 본다.
 * 잘못 잡으면 사용자가 쓰지도 않는 구독을 해지하라는 소리를 듣게 되므로,
 * 애매하면 잡지 않는 쪽으로 기울인다.
 */
import { addDays, differenceInDays, toPlainDate, type PlainDate } from '@haruchi/schema';
import type { InsightEntry, RecurringCandidate } from './types.js';

/** 결제 간격으로 인정하는 범위 (일) */
export const MIN_INTERVAL_DAYS = 25;
export const MAX_INTERVAL_DAYS = 35;
/** 정기결제로 인정하는 최소 관측 횟수 */
export const MIN_OCCURRENCES = 3;
/** 같은 금액으로 보는 허용 오차 (%) */
export const AMOUNT_TOLERANCE_PERCENT = 5;

interface Observation {
  date: PlainDate;
  amount: number;
  categoryKey: string | null;
}

interface Chain {
  observations: Observation[];
  /** 금액 비교 기준. 체인의 첫 금액을 쓴다 — 결정적이어야 하기 때문이다. */
  reference: number;
}

/**
 * 후보 금액이 기준 금액의 ±5% 안에 드는가. 정수 연산으로 판정한다.
 *
 * 분모는 기준 금액이다. 큰 쪽을 분모로 삼으면 위쪽으로 한 뼘 더 느슨해져서
 * 값이 조금씩 오르는 지출이 계속 같은 체인에 붙는다. 정기결제는 잘못 잡는 것이
 * 못 잡는 것보다 나쁘므로 좁은 쪽을 택한다.
 */
export function isSimilarAmount(
  reference: number,
  candidate: number,
  tolerancePercent = AMOUNT_TOLERANCE_PERCENT,
): boolean {
  return Math.abs(reference - candidate) * 100 <= tolerancePercent * reference;
}

/**
 * 정기결제 후보를 찾는다.
 *
 * 상호명별로 모은 뒤 날짜순으로 체인을 잇는다. 금액이 비슷하고 간격이
 * 25~35일이면 같은 체인, 아니면 새 체인이다. 3회 이상 이어진 체인만 남긴다.
 */
export function detectRecurring(entries: readonly InsightEntry[]): RecurringCandidate[] {
  const byMerchant = new Map<string, Observation[]>();

  for (const entry of entries) {
    if (entry.isExcluded) continue;
    if (entry.kind !== 'expense') continue;
    // 취소된 결제는 정기결제의 근거가 될 수 없다.
    if (entry.isCancellation) continue;
    const merchant = entry.merchantNormalized.trim();
    if (merchant.length === 0) continue;

    const bucket = byMerchant.get(merchant);
    const observation: Observation = {
      date: toPlainDate(new Date(entry.occurredAt)),
      amount: entry.amount,
      categoryKey: entry.categoryKey,
    };
    if (bucket) bucket.push(observation);
    else byMerchant.set(merchant, [observation]);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [merchant, observations] of byMerchant) {
    if (observations.length < MIN_OCCURRENCES) continue;
    observations.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    for (const chain of buildChains(observations)) {
      if (chain.observations.length < MIN_OCCURRENCES) continue;
      candidates.push(toCandidate(merchant, chain));
    }
  }

  return candidates.sort(
    (a, b) => b.confidence - a.confidence || a.merchantNormalized.localeCompare(b.merchantNormalized),
  );
}

function buildChains(observations: readonly Observation[]): Chain[] {
  const chains: Chain[] = [];

  for (const observation of observations) {
    let placed = false;
    for (const chain of chains) {
      const last = chain.observations[chain.observations.length - 1] as Observation;
      const gap = differenceInDays(last.date, observation.date);
      if (gap < MIN_INTERVAL_DAYS || gap > MAX_INTERVAL_DAYS) continue;
      if (!isSimilarAmount(chain.reference, observation.amount)) continue;
      chain.observations.push(observation);
      placed = true;
      break;
    }
    if (!placed) chains.push({ observations: [observation], reference: observation.amount });
  }

  return chains;
}

function toCandidate(merchant: string, chain: Chain): RecurringCandidate {
  const observations = chain.observations;
  const first = observations[0] as Observation;
  const last = observations[observations.length - 1] as Observation;

  const gaps: number[] = [];
  for (let i = 1; i < observations.length; i++) {
    gaps.push(
      differenceInDays((observations[i - 1] as Observation).date, (observations[i] as Observation).date),
    );
  }
  const intervalDays = median(gaps);
  const amount = median(observations.map((observation) => observation.amount));

  return {
    merchantNormalized: merchant,
    amount,
    intervalDays,
    nextExpectedOn: addDays(last.date, intervalDays),
    firstSeen: first.date,
    lastSeen: last.date,
    occurrences: observations.length,
    confidence: scoreConfidence(observations.length, gaps),
    categoryKey: last.categoryKey,
  };
}

/**
 * 신뢰도.
 *
 * 관측이 많을수록, 간격이 고를수록 높다. 상한을 0.95 로 둔다 — 규칙만으로
 * 확신했다고 말하지 않기 위해서다. 사용자 확인(is_confirmed)이 남아 있다.
 */
function scoreConfidence(occurrences: number, gaps: readonly number[]): number {
  let score = 0.5 + Math.min(0.2, (occurrences - MIN_OCCURRENCES) * 0.05);
  const spread = Math.max(...gaps) - Math.min(...gaps);
  if (spread <= 2) score += 0.25;
  else if (spread <= 5) score += 0.15;
  else score += 0.05;
  // DB 컬럼이 numeric(3,2) 라 소수점 둘째 자리까지만 의미가 있다.
  return Math.round(Math.min(0.95, score) * 100) / 100;
}

/** 하위 중앙값. 짝수 개일 때 평균을 내면 정수가 깨질 수 있어 아래쪽을 택한다. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] as number;
}

/** 구독으로 의심하는 최소 지속 기간 (일) */
export const DORMANT_MIN_AGE_DAYS = 180;

/**
 * 미사용 의심을 적용할 카테고리.
 *
 * 이 범위를 두지 않으면 월세·통신비처럼 카테고리에 상호가 하나뿐인 고정비가
 * 전부 "안 쓰는 구독"으로 걸린다. 월세를 6개월 냈다고 집에 안 사는 게 아니다.
 */
export const DEFAULT_SUBSCRIPTION_CATEGORIES = ['leisure.subscription'] as const;

/**
 * 미사용 의심 구독 (스펙 4-5).
 *
 * 6개월 이상 결제되고 있는데, 그 카테고리에서 이 상호 말고는 아무 지출이 없는 경우.
 * 넷플릭스를 6개월째 결제하면서 다른 영상 관련 지출이 전혀 없다면 안 보고 있을
 * 가능성이 있다 — 확신이 아니라 의심이므로 UI 문구도 그렇게 써야 한다.
 */
export function findDormantSubscriptions(
  candidates: readonly RecurringCandidate[],
  entries: readonly InsightEntry[],
  today: PlainDate,
  categoryKeys: readonly string[] = DEFAULT_SUBSCRIPTION_CATEGORIES,
): RecurringCandidate[] {
  const allowed = new Set(categoryKeys);
  const merchantsByCategory = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.isExcluded || entry.kind !== 'expense') continue;
    const key = entry.categoryKey ?? '';
    const bucket = merchantsByCategory.get(key);
    if (bucket) bucket.add(entry.merchantNormalized);
    else merchantsByCategory.set(key, new Set([entry.merchantNormalized]));
  }

  return candidates.filter((candidate) => {
    if (candidate.categoryKey === null || !allowed.has(candidate.categoryKey)) return false;
    const age = differenceInDays(candidate.firstSeen, today);
    if (age < DORMANT_MIN_AGE_DAYS) return false;
    // 이미 끊긴 결제는 "미사용 구독"이 아니라 그냥 끝난 구독이다.
    if (differenceInDays(candidate.lastSeen, today) > candidate.intervalDays * 2) return false;

    const siblings = merchantsByCategory.get(candidate.categoryKey ?? '');
    return siblings !== undefined && siblings.size === 1;
  });
}
