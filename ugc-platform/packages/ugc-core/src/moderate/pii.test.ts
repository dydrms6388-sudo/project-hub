import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineUgcConfig } from "../config.js";
import { moderate } from "./index.js";
import { detectPii } from "./pii.js";
import {
  HeuristicClassifier,
  LlmClassifier,
  extractJsonArray,
} from "./classifier.js";
import { InMemorySimilarityIndex, cosineSimilarity } from "../adapters/similarity.js";

const config = defineUgcConfig({
  appSlug: "test",
  contentSchema: z.object({ body: z.string() }),
  moderation: {
    autoPublishThreshold: 60,
    blockThreshold: 20,
    requireMinLength: 5,
    forbiddenCategories: ["pii", "hate", "adult"],
  },
  seo: { urlPattern: "/x/[slug]", titleTemplate: "{body}", minContentScore: 30 },
  rateLimit: { perIpPerHour: 100, perUserPerDay: 100 },
});

// 20 PII cases spanning every detector. All must be blocked and flagged pii.
const PII_CASES: Array<[label: string, text: string]> = [
  ["phone-dash", "연락처는 010-1234-5678 로 주세요 지금 바로 문의 바랍니다."],
  ["phone-nosep", "제 번호 01098765432 입니다 편하게 연락 주세요 감사합니다."],
  ["phone-dot", "급하면 010.5555.1234 로 전화 주시면 됩니다 확인 후 답장드릴게요."],
  ["phone-space", "번호 010 8888 7777 남깁니다 통화 가능 시간에 연락 부탁드려요."],
  ["phone-seoul", "사무실 02-123-4567 로 전화 주세요 평일 오전에 받습니다 감사합니다."],
  ["phone-region", "지역번호 031-234-5678 으로 문의 주시면 상담 도와드리겠습니다 네."],
  ["rrn-90", "주민등록번호 900101-1234567 확인 부탁드립니다 처리 후 알려드릴게요 네."],
  ["rrn-00", "신분증상 번호 001122-3456789 라고 적혀 있었어요 참고 부탁드립니다."],
  ["card-dash", "카드번호 1234-5678-9012-3456 결제에 사용했습니다 명세서 확인했어요."],
  ["card-space", "여기 카드 1234 5678 9012 3456 으로 긁었는데 승인이 났습니다 확인요."],
  ["email-basic", "메일은 hong@example.com 으로 보내주세요 확인하고 회신드리겠습니다 네."],
  ["email-corp", "업무 문의는 gildong.hong@company.co.kr 로 부탁드립니다 감사합니다 정말."],
  ["account-1", "입금 계좌 110-234-567890 으로 보내주시면 바로 확인하겠습니다 감사해요."],
  ["account-2", "국민은행 123456-78-901234 로 송금 부탁드립니다 확인 후 연락드릴게요 네."],
  ["address-1", "저희 매장은 강남구 테헤란로 123 에 있습니다 방문 전에 연락 주세요 네."],
  ["address-2", "집 주소가 해운대구 우동 456-7 번지 인데 택배가 자꾸 안 옵니다 확인요."],
  ["addr-dong", "종로구 청운동 12 호 앞에서 만나기로 했었는데 못 오셨더라고요 아쉽네요."],
  ["affil-ceo", "주식회사 김철수 대표가 직접 상담해 주셨는데 아주 친절하셨습니다 추천해요."],
  ["affil-team", "회사 이영희 팀장 께 보고했더니 바로 처리해 주셨습니다 정말 감사했어요 네."],
  ["affil-prof", "서울대학교 박민수 교수님 연구실에서 직접 설명을 들었습니다 유익했어요 정말."],
];

describe("PII detection — all 20 cases must block", () => {
  it.each(PII_CASES)("blocks %s", async (_label, text) => {
    expect(detectPii(text).length, `detectPii found nothing in: ${text}`).toBeGreaterThan(0);
    const res = await moderate(text, config, null);
    expect(res.pii, `pii flag not set for: ${text}`).toBe(true);
    expect(res.decision, `not blocked: ${text}`).toBe("block");
  });

  it("blocks all 20 (aggregate)", async () => {
    const results = await Promise.all(PII_CASES.map(([, t]) => moderate(t, config, null)));
    const blocked = results.filter((r) => r.decision === "block").length;
    expect(blocked).toBe(20);
  });
});

// Spam cases — should not publish (block or queue), never auto-publish.
const SPAM_CASES: Array<[string, string]> = [
  ["ad-loan", "무료 대출 상담 카톡 추가하고 광고문의 주세요 먹튀 없는 안전한 곳입니다 홍보."],
  ["gambling", "토토 카지노 정품 디비 있습니다 클릭 후 무료체험 가능 텔레 주세요 지금 바로."],
  ["repeat", "ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ"],
  ["links", "여기 보세요 http://a.co http://b.co http://c.co http://d.co 완전 대박 클릭 클릭."],
];

describe("spam handling", () => {
  it.each(SPAM_CASES)("does not auto-publish %s", async (_label, text) => {
    const res = await moderate(text, config, new HeuristicClassifier());
    expect(res.decision).not.toBe("publish");
  });
});

// False-positive guards — clean prose must be publishable.
const CLEAN_CASES = [
  "오늘 점심으로 김치찌개를 먹었는데 국물이 진하고 정말 맛있었습니다 또 가고 싶어요.",
  "이 책은 초반이 조금 느리지만 후반부 전개가 아주 흥미진진해서 추천할 만합니다 정말.",
  "주말에 근처 공원을 산책했는데 날씨가 좋아서 기분이 한결 나아졌습니다 좋은 하루였어요.",
];

describe("false-positive guards", () => {
  it.each(CLEAN_CASES)("clean prose is not flagged pii", async (text) => {
    expect(detectPii(text).length).toBe(0);
    const res = await moderate(text, config, null);
    expect(res.pii).toBe(false);
  });
});

describe("embedding dedup (SimilarityPort)", () => {
  // Deterministic fake embedder: bag-of-chars vector over a small alphabet.
  const embed = async (t: string): Promise<number[]> => {
    const v = new Array(26).fill(0) as number[];
    for (const ch of t.toLowerCase()) {
      const i = ch.charCodeAt(0) - 97;
      if (i >= 0 && i < 26) v[i]! += 1;
    }
    return v;
  };

  it("cosineSimilarity is 1 for identical vectors, 0 for orthogonal", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("flags a near-duplicate above threshold", async () => {
    const idx = new InMemorySimilarityIndex(embed);
    await idx.add("test", "the quick brown fox jumps over the lazy dog");
    const dup = await idx.maxSimilarity("test", "the quick brown fox jumps over the lazy dog");
    expect(dup).toBeCloseTo(1);
    const diff = await idx.maxSimilarity("test", "zzzz");
    expect(diff).toBeLessThan(0.5);
  });

  it("returns 0 when the index is empty", async () => {
    const idx = new InMemorySimilarityIndex(embed);
    expect(await idx.maxSimilarity("test", "anything")).toBe(0);
  });
});

describe("LLM classifier (batched, provider-agnostic)", () => {
  it("extractJsonArray tolerates code fences and prose", () => {
    expect(extractJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJsonArray("여기 결과: [1,2,3] 끝")).toEqual([1, 2, 3]);
    expect(extractJsonArray("no array here")).toBeNull();
  });

  it("parses a well-formed batch response and preserves order", async () => {
    const chat = async () =>
      JSON.stringify([
        { toxicity: 0.9, spam: 0.1, pii: false, qualityScore: 10, categories: ["hate"], reason: "a" },
        { toxicity: 0.0, spam: 0.0, pii: false, qualityScore: 90, categories: [], reason: "b" },
      ]);
    const clf = new LlmClassifier({ chat });
    const out = await clf.classifyBatch("test", ["나쁜 글", "좋은 글"]);
    expect(out).toHaveLength(2);
    expect(out[0]!.categories).toContain("hate");
    expect(out[1]!.qualityScore).toBe(90);
  });

  it("falls back to the heuristic when the model output is unusable", async () => {
    const chat = async () => "죄송하지만 답할 수 없습니다";
    const clf = new LlmClassifier({ chat });
    const out = await clf.classify({ appSlug: "test", text: "010-1234-5678 연락주세요" });
    expect(out.pii).toBe(true); // heuristic caught the phone number
  });

  it("drops unknown categories via the schema", async () => {
    const chat = async () =>
      JSON.stringify([
        { toxicity: 0, spam: 0, pii: false, qualityScore: 70, categories: ["banana", "spam"], reason: "" },
      ]);
    const clf = new LlmClassifier({ chat });
    const [only] = await clf.classifyBatch("test", ["x"]);
    expect(only!.categories).toEqual(["spam"]);
  });
});
