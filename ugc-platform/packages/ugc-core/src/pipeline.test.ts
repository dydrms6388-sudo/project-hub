import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineUgcConfig } from "./config.js";
import { createUgc } from "./pipeline.js";
import { MemoryStore } from "./adapters/memory.js";
import { detectPii, hasBlockingPii } from "./moderate/pii.js";
import { makeSlug, romanize } from "./publish/slug.js";
import { contentScore } from "./publish/score.js";

const config = defineUgcConfig({
  appSlug: "pangyeolso",
  contentSchema: z.object({
    title: z.string().min(2),
    body: z.string().min(1),
  }),
  moderation: {
    autoPublishThreshold: 60,
    blockThreshold: 20,
    requireMinLength: 10,
    forbiddenCategories: ["pii", "hate", "adult"],
  },
  seo: {
    urlPattern: "/case/[slug]",
    titleTemplate: "{title} — 판결소",
    minContentScore: 30,
  },
  rateLimit: { perIpPerHour: 5, perUserPerDay: 20 },
});

function newUgc() {
  const store = new MemoryStore();
  return { store, ugc: createUgc(config, { store }) };
}

describe("pii detection", () => {
  it("flags phone / RRN / email as blocking", () => {
    expect(hasBlockingPii("연락처 010-1234-5678 로 주세요")).toBe(true);
    expect(hasBlockingPii("주민번호 900101-1234567")).toBe(true);
    expect(hasBlockingPii("메일 hong@example.com")).toBe(true);
  });
  it("does not flag clean prose", () => {
    expect(hasBlockingPii("오늘 점심은 김치찌개를 먹었고 아주 맛있었다.")).toBe(false);
    expect(detectPii("평범한 후기입니다").length).toBe(0);
  });
});

describe("slug + score", () => {
  it("romanizes hangul and appends a stable hash", () => {
    expect(romanize("판결")).toBe("pangyeol");
    const a = makeSlug("우리 동네 이야기");
    expect(a).toMatch(/^[a-z0-9-]+$/);
    expect(makeSlug("우리 동네 이야기")).toBe(a); // deterministic
  });
  it("scores longer structured text higher", () => {
    const short = contentScore({ text: "짧다", reactions: 0 });
    const long = contentScore({
      text: "첫 문단입니다. 내용이 길고 다양합니다.\n\n- 항목 하나\n- 항목 둘\n\n마무리 문단.",
      reactions: 5,
    });
    expect(long).toBeGreaterThan(short);
  });
});

describe("intake pipeline", () => {
  it("publishes clean content", async () => {
    const { ugc } = newUgc();
    const res = await ugc.intake({
      raw: { title: "동네 리뷰", body: "이 가게는 정말 친절하고 음식도 맛있었습니다. 추천합니다." },
      authorId: "u1",
      ipHash: "iphash",
      text: "이 가게는 정말 친절하고 음식도 맛있었습니다. 추천합니다. 재방문 의사 있습니다.",
    });
    expect(res.stage).toBe("published");
  });

  it("blocks content containing a phone number (PII)", async () => {
    const { ugc } = newUgc();
    const res = await ugc.intake({
      raw: { title: "연락", body: "문의는 010-9876-5432 로 연락 주세요 지금 바로." },
      authorId: "u2",
      ipHash: "iphash2",
      text: "문의는 010-9876-5432 로 연락 주세요 지금 바로 연락 바랍니다.",
    });
    expect(res.stage).toBe("blocked");
    if (res.stage === "blocked") expect(res.moderation.pii).toBe(true);
  });

  it("rejects invalid submissions before moderation", async () => {
    const { ugc } = newUgc();
    const res = await ugc.intake({
      raw: { title: "x", body: "" },
      authorId: "u3",
      ipHash: "iphash3",
      text: "",
    });
    expect(res.stage).toBe("rejected");
  });

  it("enforces the per-ip hourly rate limit", async () => {
    const { ugc } = newUgc();
    const mk = (n: number) => ({
      raw: { title: `제목 ${n}`, body: "충분히 긴 본문 내용입니다 정상적인 글." },
      authorId: null,
      ipHash: "sameip",
    });
    let rejected = 0;
    for (let i = 0; i < 7; i++) {
      const r = await ugc.submit(mk(i));
      if (!r.ok && r.code === "rate_limited") rejected++;
    }
    expect(rejected).toBeGreaterThan(0);
  });
});
