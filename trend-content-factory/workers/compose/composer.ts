// 소재 생성 추상화: Claude 실호출 또는 (키 없을 때) 결정론적 목업.
// 목업은 파이프라인/스키마 검증용이며 게시에 쓰지 않는다(mock=true 태깅).

import { hasClaude, env } from '../../lib/env.js';
import { ClaudeProvider, extractJson } from '../../lib/ai/provider.js';
import { draftSchema, type ValidatedDraft } from '../../lib/draftSchema.js';
import { makeLogger } from '../../lib/logger.js';
import type { RiskFlag, TrendItem, Vertical } from '../../lib/types.js';
import { COMPOSE_SYSTEM, COMPOSE_USER } from '../../prompts/compose.js';

const log = makeLogger('composer');

export type ComposeResult = { draft: ValidatedDraft; mock: boolean };

export interface Composer {
  readonly mode: 'claude' | 'mock';
  compose(vertical: Vertical, trend: TrendItem): Promise<ComposeResult | null>;
}

// ── 실제 Claude 컴포저 ──

class ClaudeComposer implements Composer {
  readonly mode = 'claude' as const;
  private provider = new ClaudeProvider();

  async compose(vertical: Vertical, trend: TrendItem): Promise<ComposeResult | null> {
    const system = COMPOSE_SYSTEM(vertical);
    const user = COMPOSE_USER(trend);
    // 파싱 실패 시 1회 재시도 후 폐기.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.provider.complete(system, user, {
          model: env.composeModel,
          temperature: attempt === 0 ? 0.7 : 0.4,
          maxTokens: 2048,
        });
        const parsed = draftSchema.parse(extractJson(text));
        return { draft: normalizeSource(parsed, trend), mock: false };
      } catch (err) {
        log.warn(`compose 파싱 실패 (attempt ${attempt + 1}/2): ${String(err)}`);
      }
    }
    return null;
  }
}

// ── 결정론적 목업 컴포저 (dry-run, 키 없음) ──

class MockComposer implements Composer {
  readonly mode = 'mock' as const;

  async compose(vertical: Vertical, trend: TrendItem): Promise<ComposeResult | null> {
    const risk = inferRisk(vertical.topic);
    const disclaimer = risk !== 'none' ? ' ※ 참고용 정보이며 전문가 상담을 권장합니다.' : '';
    const draft: ValidatedDraft = {
      hook: trend.title.slice(0, 20),
      slides: [
        { headline: trend.title.slice(0, 40), body: trend.summary.slice(0, 120), visual_query: `${vertical.topic} 관련 배경` },
        { headline: '핵심 포인트', body: trend.summary.slice(120, 240) || trend.title, visual_query: `${vertical.topic} 데이터 시각화` },
        { headline: '정리', body: '오늘의 트렌드를 저장하고 팔로우하세요.', visual_query: `${vertical.topic} 마무리 컷` },
      ],
      caption: `${trend.title} — ${trend.summary.slice(0, 160)}${disclaimer}`.trim(),
      hashtags: mockHashtags(vertical),
      cta: vertical.ctaPattern,
      reel_script:
        vertical.format === 'reel'
          ? [
              { t: 0, narration: trend.title, onscreen: trend.title.slice(0, 24), b_roll: '오프닝 훅 컷' },
              { t: 5, narration: trend.summary.slice(0, 80), onscreen: '핵심 요약', b_roll: '자료 화면' },
              { t: 15, narration: vertical.ctaPattern, onscreen: 'CTA', b_roll: '마무리' },
            ]
          : [],
      risk_flags: [risk],
      fact_confidence: trend.summary.length > 20 ? 0.82 : 0.68, // 요약 빈약하면 게이트 탈락하도록
      source_url: trend.source_url,
    };
    return { draft: normalizeSource(draft, trend), mock: true };
  }
}

function normalizeSource(d: ValidatedDraft, trend: TrendItem): ValidatedDraft {
  return { ...d, source_url: d.source_url || trend.source_url };
}

function inferRisk(topic: string): RiskFlag {
  if (/건강|의료|육아|반려/.test(topic)) return 'medical';
  if (/법률|정책/.test(topic)) return 'legal';
  if (/경제|금리|환율|코인|연봉|절약/.test(topic)) return 'financial';
  return 'none';
}

function mockHashtags(v: Vertical): string[] {
  const base = v.slug.replace(/-/g, '');
  return ['#트렌드', '#정보', '#꿀팁', `#${base}`, `#${v.topic.split('/')[0]}`, '#데일리', '#오늘의정보', '#저장각'];
}

export function makeComposer(): Composer {
  if (hasClaude()) {
    log.info('Claude 컴포저 사용');
    return new ClaudeComposer();
  }
  log.warn('ANTHROPIC_API_KEY 없음 → 목업 컴포저 폴백 (mock=true, 게시 불가)');
  return new MockComposer();
}
