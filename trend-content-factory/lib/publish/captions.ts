// 플랫폼별 캡션 재작성 (같은 소재를 플랫폼 톤/한도에 맞게). 결정론적(LLM 불필요).
// 계정 간 캡션 중복 금지 제약과 함께, 플랫폼별 캡션이 서로 달라지도록 한다.

import type { PlatformSpec } from '../../config/platforms.js';

/**
 * 캡션 본문 + CTA + 해시태그를 플랫폼 한도 내로 조립.
 * - 해시태그는 hashtagLimit 만큼만.
 * - 총 길이는 captionLimit 이내(초과 시 본문 말줄임).
 */
export function formatForPlatform(
  caption: string,
  hashtags: string[],
  cta: string,
  spec: PlatformSpec,
): string {
  const tags = hashtags.slice(0, spec.hashtagLimit).join(' ');
  const ctaLine = cta && spec.id !== 'x' ? `\n${cta}` : ''; // X는 초압축
  const tail = [ctaLine, tags ? `\n\n${tags}` : ''].join('');
  const room = spec.captionLimit - tail.length;
  let body = caption.trim();
  if (body.length > room) body = body.slice(0, Math.max(0, room - 1)).trimEnd() + '…';
  return `${body}${tail}`.trim();
}

/** 플랫폼 스타일 힌트(디버그/로깅용). */
export function styleHint(spec: PlatformSpec): string {
  return `${spec.label}: ${spec.captionStyle} (≤${spec.captionLimit}자, #${spec.hashtagLimit})`;
}
