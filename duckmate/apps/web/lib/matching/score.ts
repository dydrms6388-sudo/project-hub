/**
 * D3 점수식의 TS 미러 (순수 함수, 테스트용 · E2 "궁합 %" 로컬 재계산 용).
 * SQL `pair_features(a, b)`(0020) 와 **동일한 수식·반올림**을 유지한다. 값을 바꾸면 SQL 도 같이 고친다.
 *
 *   score = 0.40·hobby + 0.35·quiz + 0.15·avail + 0.10·mutual
 *         + (liker ? +0.10) + (활동 48h ? +0.03 : 7d↑ ? −0.10) + (부스트 ? +0.15) [+ 신규 72h 완성 프로필 +0.05]
 *   clamp 0~1, 소수 4자리
 *
 *   hobby  = 0.7·tagJaccard + 0.3·categoryJaccard
 *            tagJaccard = Σ min(wA,wB)·(|iA−iB| ≥ 3 ? 0.5 : 1) / Σ max(wA,wB),  w = rank ≤ 3 ? 2 : 1
 *   quiz   = 어느 한쪽 3문항 미만 → 0.5 / 아니면 (문항,선택) one-hot × weight 코사인 = Σ_same w² / √(Σ_A w² · Σ_B w²)
 *   avail  = (weekday, slot) 자카드
 *   mutual = 상대가 나를 좋아함 1.0 / 48h 내 활동 0.3 / 0
 */

export type HobbyFeature = { hobbyId: number; categoryId: number; rank: number; intensity: number };
export type QuizFeature = { questionId: number; choice: number; weight: number };
export type SlotFeature = { weekday: number; slot: "morning" | "afternoon" | "evening" | "night" };

export type ProfileFeatures = {
  hobbies: HobbyFeature[];
  quiz: QuizFeature[];
  slots: SlotFeature[];
  /** ISO 문자열 또는 Date */
  lastActiveAt: string | Date;
  createdAt: string | Date;
  /** 승인 사진 ≥1 + Top3 + 퀴즈 ≥10 (is_complete_profile) */
  complete: boolean;
};

export type ScoreParams = {
  likerBonus: number;
  newBonus: number;
  newHours: number;
  activeBonus: number;
  inactivePenalty: number;
  boostBonus: number;
  intensityPenaltyGap: number;
  quizMinAnswers: number;
};

/** app_settings.reco_params 기본값과 동일 */
export const DEFAULT_SCORE_PARAMS: Readonly<ScoreParams> = {
  likerBonus: 0.1,
  newBonus: 0.05,
  newHours: 72,
  activeBonus: 0.03,
  inactivePenalty: 0.1,
  boostBonus: 0.15,
  intensityPenaltyGap: 3,
  quizMinAnswers: 3,
};

export const SCORE_WEIGHTS = { hobby: 0.4, quiz: 0.35, avail: 0.15, mutual: 0.1 } as const;

export type PairContext = {
  /** 후보(b)가 뷰어(a)를 이미 좋아함 */
  liker: boolean;
  /** Phase 3 유료 부스트 활성 */
  boosted?: boolean;
  now?: Date;
  params?: Partial<ScoreParams>;
};

export type PairScore = {
  hobby: number;
  tagJaccard: number;
  categoryJaccard: number;
  quiz: number;
  avail: number;
  mutual: number;
  base: number;
  liker: boolean;
  activeBonus: number;
  inactivePenalty: number;
  newEligible: boolean;
  boost: number;
  /** 신규 부스트 미적용(일 노출 상한 판정은 생성기가) */
  scoreNoNew: number;
  scoreWithNew: number;
};

export const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const toDate = (d: string | Date): Date => (d instanceof Date ? d : new Date(d));

/** 취미 2단 자카드 (세부 태그 가중 + 카테고리) */
export function hobbyScore(a: HobbyFeature[], b: HobbyFeature[], gap = DEFAULT_SCORE_PARAMS.intensityPenaltyGap) {
  const w = (h: HobbyFeature) => (h.rank <= 3 ? 2 : 1);
  const mapA = new Map(a.map((h) => [h.hobbyId, h]));
  const mapB = new Map(b.map((h) => [h.hobbyId, h]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);
  let inter = 0;
  let union = 0;
  for (const id of ids) {
    const ha = mapA.get(id);
    const hb = mapB.get(id);
    const wa = ha ? w(ha) : 0;
    const wb = hb ? w(hb) : 0;
    union += Math.max(wa, wb);
    if (ha && hb) inter += Math.min(wa, wb) * (Math.abs(ha.intensity - hb.intensity) >= gap ? 0.5 : 1);
  }
  const tagJaccard = union > 0 ? inter / union : 0;
  const catA = new Set(a.map((h) => h.categoryId));
  const catB = new Set(b.map((h) => h.categoryId));
  const catUnion = new Set([...catA, ...catB]);
  let catInter = 0;
  for (const c of catA) if (catB.has(c)) catInter += 1;
  const categoryJaccard = catUnion.size > 0 ? catInter / catUnion.size : 0;
  return { tagJaccard, categoryJaccard, hobby: 0.7 * tagJaccard + 0.3 * categoryJaccard };
}

/** 퀴즈 코사인 (one-hot × weight). 3문항 미만 → 0.5 중립 */
export function quizCosine(a: QuizFeature[], b: QuizFeature[], minAnswers = DEFAULT_SCORE_PARAMS.quizMinAnswers): number {
  if (a.length < minAnswers || b.length < minAnswers) return 0.5;
  const mapB = new Map(b.map((q) => [q.questionId, q]));
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const qa of a) {
    na += qa.weight * qa.weight;
    const qb = mapB.get(qa.questionId);
    if (qb && qb.choice === qa.choice) dot += qa.weight * qa.weight;
  }
  for (const qb of b) nb += qb.weight * qb.weight;
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

/** 활동 시간대 (weekday, slot) 자카드 */
export function availabilityOverlap(a: SlotFeature[], b: SlotFeature[]): number {
  const key = (s: SlotFeature) => `${s.weekday}_${s.slot}`;
  const setA = new Set(a.map(key));
  const setB = new Set(b.map(key));
  const union = new Set([...setA, ...setB]);
  let inter = 0;
  for (const k of setA) if (setB.has(k)) inter += 1;
  return union.size > 0 ? inter / union.size : 0;
}

/** 상호 관심 신호 */
export function mutualSignal(liker: boolean, lastActiveAt: string | Date, now: Date): number {
  if (liker) return 1;
  return toDate(lastActiveAt).getTime() >= now.getTime() - 48 * 3_600_000 ? 0.3 : 0;
}

export function scorePair(a: ProfileFeatures, b: ProfileFeatures, ctx: PairContext): PairScore {
  const p = { ...DEFAULT_SCORE_PARAMS, ...(ctx.params ?? {}) };
  const now = ctx.now ?? new Date();
  const h = hobbyScore(a.hobbies, b.hobbies, p.intensityPenaltyGap);
  const quiz = quizCosine(a.quiz, b.quiz, p.quizMinAnswers);
  const avail = availabilityOverlap(a.slots, b.slots);
  const mutual = mutualSignal(ctx.liker, b.lastActiveAt, now);
  const base = SCORE_WEIGHTS.hobby * h.hobby + SCORE_WEIGHTS.quiz * quiz + SCORE_WEIGHTS.avail * avail + SCORE_WEIGHTS.mutual * mutual;

  const lastActive = toDate(b.lastActiveAt).getTime();
  let activeBonus = 0;
  let inactivePenalty = 0;
  if (lastActive >= now.getTime() - 48 * 3_600_000) activeBonus = p.activeBonus;
  else if (lastActive < now.getTime() - 7 * 24 * 3_600_000) inactivePenalty = p.inactivePenalty;
  const newEligible = toDate(b.createdAt).getTime() >= now.getTime() - p.newHours * 3_600_000 && b.complete;
  const boost = ctx.boosted ? p.boostBonus : 0;
  const adj = (ctx.liker ? p.likerBonus : 0) + activeBonus - inactivePenalty + boost;

  return {
    hobby: round4(h.hobby),
    tagJaccard: round4(h.tagJaccard),
    categoryJaccard: round4(h.categoryJaccard),
    quiz: round4(quiz),
    avail: round4(avail),
    mutual: round4(mutual),
    base: round4(base),
    liker: ctx.liker,
    activeBonus,
    inactivePenalty,
    newEligible,
    boost,
    scoreNoNew: round4(clamp01(base + adj)),
    scoreWithNew: round4(clamp01(base + adj + p.newBonus)),
  };
}

/** 카드 "궁합 %" 표기 (E2): score → 정수 % */
export function scorePercent(score: number): number {
  return Math.round(clamp01(score) * 100);
}

/** 분석 이벤트 score_bucket (A3 §8): 0.0~0.2 → 'b0' … */
export function scoreBucket(score: number): "b0" | "b1" | "b2" | "b3" | "b4" {
  const s = clamp01(score);
  if (s < 0.2) return "b0";
  if (s < 0.4) return "b1";
  if (s < 0.6) return "b2";
  if (s < 0.8) return "b3";
  return "b4";
}

/** Top3 에 intensity ≤ 2 취미가 있으면 "입문 환영" 배지 (A2 §0) */
export function isIntroWelcome(hobbies: ReadonlyArray<{ rank: number; intensity: number }>): boolean {
  return hobbies.some((h) => h.rank <= 3 && h.intensity <= 2);
}
