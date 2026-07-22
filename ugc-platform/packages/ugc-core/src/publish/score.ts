/**
 * contentScore = 길이 + 고유어휘 + 구조(문단/목록) + 반응수.
 * 0–100. Drives the noindex ↔ sitemap decision (minContentScore). Keeping it a
 * pure function makes the index-promotion path in engage/ trivial to re-run.
 */

export interface ScoreInput {
  text: string;
  reactions: number;
}

export function contentScore({ text, reactions }: ScoreInput): number {
  const trimmed = text.trim();
  const len = trimmed.length;

  // Length: saturating at ~600 chars → 35 pts.
  const lengthPts = Math.min(35, Math.round((len / 600) * 35));

  // Unique vocabulary: ratio of distinct whitespace tokens → 25 pts.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const uniqueRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const vocabPts = Math.round(uniqueRatio * 25);

  // Structure: paragraphs + list markers → 20 pts.
  const paragraphs = trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
  const listMarkers = (trimmed.match(/^[\s]*(?:[-*·]|\d+\.)\s+/gm) ?? []).length;
  const structurePts = Math.min(20, paragraphs * 5 + listMarkers * 2);

  // Engagement: diminishing returns → 20 pts.
  const reactionPts = Math.min(20, Math.round(Math.log2(reactions + 1) * 5));

  return Math.max(0, Math.min(100, lengthPts + vocabPts + structurePts + reactionPts));
}
