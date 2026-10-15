// M3 심사 패널 추상화: Claude 배치 심사 또는 (키 없을 때) 결정론적 목업.

import { hasClaude, env } from '../../lib/env.js';
import { ClaudeProvider, extractJson } from '../../lib/ai/provider.js';
import { makeLogger } from '../../lib/logger.js';
import { reviewBatchSchema, type PersonaBlock } from '../../lib/reviewSchema.js';
import { hasDisclaimer } from '../../lib/draftSchema.js';
import type { DraftRecord } from '../../lib/types.js';
import { REVIEW_SYSTEM, reviewUser } from '../../prompts/review.js';

const log = makeLogger('panel');

export interface Panel {
  readonly mode: 'claude' | 'mock';
  /** 배치 심사 → draftId별 persona 블록. 실패한 draftId는 결과에서 누락될 수 있음. */
  review(batch: DraftRecord[]): Promise<Map<string, PersonaBlock>>;
}

class ClaudePanel implements Panel {
  readonly mode = 'claude' as const;
  private provider = new ClaudeProvider();

  async review(batch: DraftRecord[]): Promise<Map<string, PersonaBlock>> {
    const out = new Map<string, PersonaBlock>();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.provider.complete(REVIEW_SYSTEM, reviewUser(batch), {
          model: env.reviewModel,
          temperature: 0.3,
          maxTokens: 4096,
        });
        const parsed = reviewBatchSchema.parse(extractJson(text));
        for (const r of parsed.results) out.set(r.draft_id, r.personas);
        return out;
      } catch (err) {
        log.warn(`심사 파싱 실패 (attempt ${attempt + 1}/2): ${String(err)}`);
      }
    }
    return out; // 빈 맵이면 pipeline 이 실패로 기록
  }
}

class MockPanel implements Panel {
  readonly mode = 'mock' as const;

  async review(batch: DraftRecord[]): Promise<Map<string, PersonaBlock>> {
    const out = new Map<string, PersonaBlock>();
    for (const d of batch) out.set(d.id, scoreDraft(d));
    return out;
  }
}

/** 결정론적 휴리스틱 채점 (목업). 실제 Claude 판정의 근사치. */
function scoreDraft(d: DraftRecord): PersonaBlock {
  const hasNumber = /\d/.test(d.hook + d.caption);
  const hookOk = d.hook.length > 0 && d.hook.length <= 22;
  const risky = d.risk_flags.some((f) => f !== 'none');
  const disclaimer = hasDisclaimer(d.caption);
  const captionOk = d.caption.length >= 20 && d.caption.length <= 320;
  const slidesOk = d.format === 'reel' ? d.reel_script.length >= 2 : d.slides.length >= 2;
  const tagsOk = d.hashtags.length >= 5;

  const scroller = clamp((hookOk ? 78 : 58) + (hasNumber ? 10 : 0));
  const expert = clamp(Math.round(d.fact_confidence * 100) - (risky && !disclaimer ? 25 : 0));
  const editor = clamp(captionOk ? 82 : 62);
  const designer = clamp(slidesOk ? 80 : 60);
  const algo = clamp((tagsOk ? 76 : 60) + (d.cta ? 8 : 0) + (hasNumber ? 6 : 0));
  const riskScore = clamp(risky ? (disclaimer ? 78 : 45) : 88);

  const mk = (score: number, follow: boolean, note = ''): PersonaBlock['scroller'] => ({ score, follow, note });
  return {
    scroller: mk(scroller, scroller >= 65, hookOk ? '' : '후킹 약함'),
    expert: mk(expert, expert >= 65, risky && !disclaimer ? '리스크 고지 누락' : ''),
    editor: mk(editor, editor >= 65, captionOk ? '' : '캡션 길이 부적절'),
    designer: mk(designer, designer >= 65, slidesOk ? '' : '슬라이드 부족'),
    algo: mk(algo, algo >= 65, tagsOk ? '' : '해시태그 부족'),
    risk: mk(riskScore, !(risky && !disclaimer), risky && !disclaimer ? '정책 리스크' : ''),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function makePanel(): Panel {
  if (hasClaude()) {
    log.info('Claude 심사 패널 사용');
    return new ClaudePanel();
  }
  log.warn('ANTHROPIC_API_KEY 없음 → 목업 심사 패널 폴백');
  return new MockPanel();
}
