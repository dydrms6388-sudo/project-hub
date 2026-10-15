// Claude API 추상화 레이어 (모델 교체 가능 + 서킷브레이커 + 재시도).
// 기존 lib/ai/provider.ts 패턴 재사용 컨셉.

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { CircuitBreaker } from '../http.js';
import { makeLogger } from '../logger.js';

const log = makeLogger('ai');

export type CompleteOpts = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  retries?: number;
};

export class ClaudeProvider {
  private client: Anthropic;
  private breaker = new CircuitBreaker('claude', 5, 60_000);

  constructor(apiKey = env.anthropicApiKey) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음 — ClaudeProvider 생성 불가');
    this.client = new Anthropic({ apiKey });
  }

  /** 텍스트 완성. 서킷브레이커 + 지수 백오프 재시도. */
  async complete(system: string, user: string, opts: CompleteOpts = {}): Promise<string> {
    const { model = env.composeModel, maxTokens = 2048, temperature = 0.7, retries = 2 } = opts;
    if (!this.breaker.canPass(Date.now())) throw new Error('claude circuit open');

    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: 'user', content: user }],
        });
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
          .trim();
        this.breaker.recordSuccess();
        return text;
      } catch (err) {
        lastErr = err;
        this.breaker.recordFailure(Date.now());
        log.warn(`claude 호출 실패 (attempt ${attempt + 1}/${retries + 1}): ${String(err)}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, Math.min(2 ** attempt, 16) * 1000));
        }
      }
    }
    throw new Error(`claude 완성 실패: ${String(lastErr)}`);
  }
}

/** 코드펜스/잡텍스트를 제거하고 첫 JSON 오브젝트를 추출. */
export function extractJson(text: string): unknown {
  let s = text.trim();
  // ```json ... ``` 펜스 제거
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('JSON 오브젝트를 찾을 수 없음');
  }
  return JSON.parse(s.slice(start, end + 1));
}
