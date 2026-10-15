/**
 * Moderation classifiers (2차 검수). Two implementations of ClassifierPort:
 *
 *  - `HeuristicClassifier` — fully offline (no network). Lexicon + structure
 *    heuristics. Used as the default and as the LLM fallback.
 *  - `LlmClassifier` — provider-agnostic. Takes an injected `chat(prompt)` that
 *    returns the model's text; the package never imports an AI SDK or a key.
 *    Consumers wire their own model (recommended: the latest Claude model).
 *
 * Batching: `classifyBatch` groups up to `batchSize` (default 10) texts into one
 * `chat` call, per the spec's "LLM 분류기 (배치 10건)".
 */
import { z } from "zod";
import type { ClassifierPort } from "../ports.js";
import type { LlmClassification, ModerationCategory } from "../types.js";
import { detectPii, hasBlockingPii } from "./pii.js";

const CATEGORY_VALUES = [
  "pii", "hate", "spam", "adult", "violence", "self_harm", "illegal", "off_topic",
] as const satisfies readonly ModerationCategory[];

const CATEGORY_SET = new Set<string>(CATEGORY_VALUES);

/** Zod schema for one classification the LLM must return. */
export const llmClassificationSchema = z.object({
  toxicity: z.number().min(0).max(1),
  spam: z.number().min(0).max(1),
  pii: z.boolean(),
  qualityScore: z.number().min(0).max(100),
  categories: z.array(z.string()).transform((cats) =>
    cats.filter((c): c is ModerationCategory => CATEGORY_SET.has(c)),
  ),
  reason: z.string().default(""),
});

// ── Heuristic classifier (offline) ───────────────────────────────────────────

const HATE_LEXICON = [
  "병신", "새끼", "씨발", "시발", "좆", "지랄", "닥쳐", "꺼져", "죽어",
  "idiot", "stupid", "retard",
];
const SPAM_LEXICON = [
  "카톡", "텔레", "광고문의", "디비", "대출", "홍보", "먹튀", "토토", "카지노",
  "정품", "구매대행", "免费", "促销", "casino", "viagra", "무료체험", "클릭",
];
const ADULT_LEXICON = ["섹스", "야동", "성인용품", "19금", "porn", "xxx"];

function lexHits(text: string, lexicon: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of lexicon) if (lower.includes(w.toLowerCase())) n++;
  return n;
}

export class HeuristicClassifier implements ClassifierPort {
  async classify(input: { appSlug: string; text: string }): Promise<LlmClassification> {
    const text = input.text ?? "";
    const categories = new Set<ModerationCategory>();

    const hate = lexHits(text, HATE_LEXICON);
    const spam = lexHits(text, SPAM_LEXICON);
    const adult = lexHits(text, ADULT_LEXICON);
    const pii = hasBlockingPii(text) || detectPii(text).length > 0;

    // URL flood — more than 2 links reads as link spam.
    const urlCount = (text.match(/https?:\/\/[^\s]+/gi) ?? []).length;
    const urlExcess = Math.max(0, urlCount - 2);

    // Repetition / 도배 — very low unique-char ratio in a long-enough string.
    const compact = text.replace(/\s/g, "");
    const repetitive =
      compact.length >= 20 && new Set(compact).size / compact.length < 0.15;

    if (hate > 0) categories.add("hate");
    if (spam > 0 || urlExcess > 0 || repetitive) categories.add("spam");
    if (adult > 0) categories.add("adult");
    if (pii) categories.add("pii");

    const toxicity = Math.min(1, hate * 0.5);
    const spamScore = Math.min(1, spam * 0.4 + urlExcess * 0.3 + (repetitive ? 0.6 : 0));

    // qualityScore: start high, subtract for signals + shortness.
    let quality = 80;
    quality -= hate * 25;
    quality -= spam * 20;
    quality -= adult * 25;
    quality -= urlExcess * 20;
    if (repetitive) quality -= 40;
    if (pii) quality -= 40;
    if (text.trim().length < 20) quality -= 20;
    quality = Math.max(0, Math.min(100, quality));

    return {
      toxicity,
      spam: spamScore,
      pii,
      qualityScore: quality,
      categories: [...categories],
      reason: "heuristic",
    };
  }
}

// ── LLM classifier (provider-agnostic, batched) ──────────────────────────────

export interface LlmClassifierDeps {
  /** Injected model call: takes a prompt, returns the raw text response. */
  chat: (prompt: string) => Promise<string>;
  /** Used when the model output can't be parsed. Defaults to HeuristicClassifier. */
  fallback?: ClassifierPort;
  batchSize?: number;
}

const SYSTEM_INSTRUCTION = `너는 한국어 UGC 검수 분류기다. 각 글에 대해 아래 JSON 스키마의 객체를 반환하라.
반드시 입력 순서와 동일한 순서의 JSON 배열만 출력한다(설명 문장 금지).
스키마: {"toxicity":0~1,"spam":0~1,"pii":true|false,"qualityScore":0~100,"categories":["pii"|"hate"|"spam"|"adult"|"violence"|"self_harm"|"illegal"|"off_topic"],"reason":string}
개인정보(실명+소속/전화/주소/계좌/주민번호)가 있으면 pii=true. 없는 사실을 만들지 마라.`;

export class LlmClassifier implements ClassifierPort {
  private chat: LlmClassifierDeps["chat"];
  private fallback: ClassifierPort;
  private batchSize: number;

  constructor(deps: LlmClassifierDeps) {
    this.chat = deps.chat;
    this.fallback = deps.fallback ?? new HeuristicClassifier();
    this.batchSize = deps.batchSize ?? 10;
  }

  async classify(input: { appSlug: string; text: string }): Promise<LlmClassification> {
    const [only] = await this.classifyBatch(input.appSlug, [input.text]);
    return only ?? this.fallback.classify(input);
  }

  /** Classify many texts, chunked into batches of `batchSize`. Order preserved. */
  async classifyBatch(appSlug: string, texts: string[]): Promise<LlmClassification[]> {
    const out: LlmClassification[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const chunk = texts.slice(i, i + this.batchSize);
      out.push(...(await this.classifyChunk(appSlug, chunk)));
    }
    return out;
  }

  private async classifyChunk(appSlug: string, chunk: string[]): Promise<LlmClassification[]> {
    const prompt = `${SYSTEM_INSTRUCTION}\n\n입력(${chunk.length}건):\n${JSON.stringify(chunk)}`;
    let raw: string;
    try {
      raw = await this.chat(prompt);
    } catch {
      return Promise.all(chunk.map((text) => this.fallback.classify({ appSlug, text })));
    }

    const parsed = extractJsonArray(raw);
    if (!parsed || parsed.length !== chunk.length) {
      return Promise.all(chunk.map((text) => this.fallback.classify({ appSlug, text })));
    }

    return Promise.all(
      parsed.map(async (item, idx) => {
        const res = llmClassificationSchema.safeParse(item);
        if (res.success) return res.data;
        const text = chunk[idx] ?? "";
        return this.fallback.classify({ appSlug, text });
      }),
    );
  }
}

/** Pull the first JSON array out of a model response (tolerates code fences). */
export function extractJsonArray(raw: string): unknown[] | null {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
