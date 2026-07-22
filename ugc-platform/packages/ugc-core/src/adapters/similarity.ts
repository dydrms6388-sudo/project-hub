/**
 * Embedding-based duplicate detection (중복 검사, 임베딩 유사도). Implements
 * SimilarityPort against an injected `embed(text)` — the package stays free of
 * any embedding SDK. In production the vectors live in pgvector (`ugc_content`
 * embedding column, Phase 2); this in-memory index backs tests and small apps.
 */
import type { SimilarityPort } from "../ports.js";

export type Embedder = (text: string) => Promise<number[]>;

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemorySimilarityIndex implements SimilarityPort {
  private vectors = new Map<string, number[][]>();

  constructor(private embed: Embedder) {}

  /** Index a piece of text so future submissions are compared against it. */
  async add(appSlug: string, text: string): Promise<void> {
    const v = await this.embed(text);
    const list = this.vectors.get(appSlug) ?? [];
    list.push(v);
    this.vectors.set(appSlug, list);
  }

  async maxSimilarity(appSlug: string, text: string): Promise<number> {
    const list = this.vectors.get(appSlug);
    if (!list || list.length === 0) return 0;
    const v = await this.embed(text);
    let max = 0;
    for (const existing of list) {
      const sim = cosineSimilarity(v, existing);
      if (sim > max) max = sim;
    }
    return max;
  }
}
