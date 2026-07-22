// Draft JSON 스키마 검증 (zod). Claude 출력 강제 검증에 사용.

import { z } from 'zod';

export const slideSchema = z.object({
  headline: z.string().default(''),
  body: z.string().default(''),
  visual_query: z.string().default(''),
});

export const reelBeatSchema = z.object({
  t: z.number(),
  narration: z.string().default(''),
  onscreen: z.string().default(''),
  b_roll: z.string().default(''),
});

export const draftSchema = z.object({
  hook: z.string().min(1),
  slides: z.array(slideSchema).default([]),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().default(''),
  reel_script: z.array(reelBeatSchema).default([]),
  risk_flags: z.array(z.enum(['medical', 'legal', 'financial', 'none'])).default(['none']),
  fact_confidence: z.number().min(0).max(1),
  source_url: z.string().default(''),
});

export type ValidatedDraft = z.infer<typeof draftSchema>;

/** 고지문 존재 여부(의료/법률/투자 리스크 플래그 대응). */
export function hasDisclaimer(caption: string): boolean {
  return /참고용|권장|권고|상담|투자.?주의|재미용|※/.test(caption);
}

/** 품질 사전 게이트: fact_confidence >= 0.7 && (리스크 없거나 고지문 존재). */
export function passesComposeGate(d: ValidatedDraft): { ok: boolean; reason?: string } {
  if (d.fact_confidence < 0.7) return { ok: false, reason: `fact_confidence ${d.fact_confidence} < 0.7` };
  const risky = d.risk_flags.some((f) => f !== 'none');
  if (risky && !hasDisclaimer(d.caption)) {
    return { ok: false, reason: `리스크(${d.risk_flags.join(',')}) 있으나 고지문 없음` };
  }
  return { ok: true };
}
