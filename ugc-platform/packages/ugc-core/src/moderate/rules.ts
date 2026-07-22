/**
 * 1차 규칙 기반 검수 — 길이, URL 개수, 전화/계좌 패턴, 금칙어.
 * Cheap, deterministic, runs before any LLM call. Produces a partial signal
 * that moderate/index.ts folds together with the LLM classification.
 */
import type { ModerationCategory } from "../types.js";
import { detectPii, hasBlockingPii } from "./pii.js";

export interface RuleConfig {
  requireMinLength: number;
  /** More than this many URLs reads as link spam. */
  maxUrls: number;
  /** Words that force a block outright (service-supplied 금칙어). */
  forbiddenWords: string[];
}

export interface RuleResult {
  /** 0–100 penalty-based score (100 = clean). */
  score: number;
  categories: ModerationCategory[];
  /** Hard block independent of score (PII / forbidden word). */
  hardBlock: boolean;
  reasons: string[];
}

const URL_RE = /https?:\/\/[^\s]+/gi;

export function applyRules(text: string, cfg: RuleConfig): RuleResult {
  const reasons: string[] = [];
  const categories = new Set<ModerationCategory>();
  let score = 100;
  let hardBlock = false;

  const trimmed = text.trim();

  if (trimmed.length < cfg.requireMinLength) {
    score -= 40;
    reasons.push(`too_short(<${cfg.requireMinLength})`);
  }

  const urlCount = (trimmed.match(URL_RE) ?? []).length;
  if (urlCount > cfg.maxUrls) {
    score -= 30;
    categories.add("spam");
    reasons.push(`too_many_urls(${urlCount})`);
  }

  // Repetition / 도배 heuristic: one char or short token dominating the text.
  if (trimmed.length >= 20) {
    const uniqueRatio = new Set(trimmed.replace(/\s/g, "")).size / trimmed.replace(/\s/g, "").length;
    if (uniqueRatio < 0.15) {
      score -= 25;
      categories.add("spam");
      reasons.push("low_char_diversity");
    }
  }

  const lower = trimmed.toLowerCase();
  for (const w of cfg.forbiddenWords) {
    if (!w) continue;
    if (lower.includes(w.toLowerCase())) {
      hardBlock = true;
      categories.add("hate");
      reasons.push(`forbidden_word`);
      break;
    }
  }

  // PII: high-confidence → hard block; fuzzy → penalty + queue signal.
  if (hasBlockingPii(trimmed)) {
    hardBlock = true;
    categories.add("pii");
    reasons.push("pii_high_confidence");
  } else if (detectPii(trimmed).length > 0) {
    score -= 20;
    categories.add("pii");
    reasons.push("pii_low_confidence");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    categories: [...categories],
    hardBlock,
    reasons,
  };
}
