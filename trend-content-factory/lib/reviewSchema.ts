// M3 심사 결과 스키마 + 점수 집계/통과 판정.

import { z } from 'zod';
import type { PersonaKey, ReviewRecord } from './types.js';

const personaVerdictSchema = z.object({
  score: z.number().min(0).max(100),
  follow: z.boolean(),
  note: z.string().default(''),
});

export const reviewBatchSchema = z.object({
  results: z.array(
    z.object({
      draft_id: z.string(),
      personas: z.object({
        scroller: personaVerdictSchema,
        expert: personaVerdictSchema,
        editor: personaVerdictSchema,
        designer: personaVerdictSchema,
        algo: personaVerdictSchema,
        risk: personaVerdictSchema,
      }),
    }),
  ),
});

export type ReviewBatchResult = z.infer<typeof reviewBatchSchema>;
export type PersonaBlock = ReviewBatchResult['results'][number]['personas'];

// 페르소나 가중치 (합 1.0)
const WEIGHTS: Record<PersonaKey, number> = {
  scroller: 0.25,
  expert: 0.2,
  editor: 0.15,
  designer: 0.15,
  algo: 0.15,
  risk: 0.1,
};

export const PASS_SCORE = 80;
export const MAX_FOLLOW_NO = 2;

/** persona 블록 → 총점(0~100) + follow NO 개수 + 통과 여부. */
export function aggregate(personas: PersonaBlock): {
  total: number;
  scores: Record<PersonaKey, number>;
  followNo: number;
  passed: boolean;
  reasons: string[];
} {
  const keys: PersonaKey[] = ['scroller', 'expert', 'editor', 'designer', 'algo', 'risk'];
  const scores = {} as Record<PersonaKey, number>;
  let total = 0;
  let followNo = 0;
  const reasons: string[] = [];
  for (const k of keys) {
    const v = personas[k];
    scores[k] = v.score;
    total += v.score * WEIGHTS[k];
    if (!v.follow) {
      followNo += 1;
      if (v.note) reasons.push(`${k}:NO ${v.note}`);
    } else if (v.score < 60 && v.note) {
      reasons.push(`${k}:저점 ${v.note}`);
    }
  }
  const rounded = Math.round(total);
  const passed = rounded >= PASS_SCORE && followNo <= MAX_FOLLOW_NO;
  if (!passed) {
    if (rounded < PASS_SCORE) reasons.unshift(`총점 ${rounded} < ${PASS_SCORE}`);
    if (followNo > MAX_FOLLOW_NO) reasons.unshift(`follow NO ${followNo}개 > ${MAX_FOLLOW_NO}`);
  }
  return { total: rounded, scores, followNo, passed, reasons };
}

export function toReviewRecord(
  id: string,
  draftId: string,
  vertical: string,
  personas: PersonaBlock,
  mock: boolean,
  createdAt: string,
): ReviewRecord {
  const agg = aggregate(personas);
  return {
    id,
    draft_id: draftId,
    vertical,
    total_score: agg.total,
    persona_scores: agg.scores,
    follow_no_count: agg.followNo,
    passed: agg.passed,
    reasons: agg.reasons,
    mock,
    created_at: createdAt,
  };
}
