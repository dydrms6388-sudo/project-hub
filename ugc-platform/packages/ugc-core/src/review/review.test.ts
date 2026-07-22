import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineUgcConfig } from "../config.js";
import { createUgc } from "../pipeline.js";
import { MemoryStore } from "../adapters/memory.js";
import { HeuristicClassifier } from "../moderate/classifier.js";

// Thresholds tuned so plain short-ish text lands in the queue band, and
// minContentScore sits where one reaction can push a page over the line.
const config = defineUgcConfig({
  appSlug: "review-test",
  contentSchema: z.object({ title: z.string().min(2), body: z.string().min(1) }),
  moderation: {
    autoPublishThreshold: 90, // hard to auto-publish → most content queues
    blockThreshold: 10,
    requireMinLength: 5,
    forbiddenCategories: ["pii", "hate", "adult"],
  },
  seo: { urlPattern: "/case/[slug]", titleTemplate: "{title}", minContentScore: 25 },
  rateLimit: { perIpPerHour: 100, perUserPerDay: 100 },
});

const BODY =
  "검수 대기열로 들어갈 만한 평범한 글입니다. 길이는 충분하지만 자동 공개 임계치는 못 넘습니다.";

function setup() {
  const store = new MemoryStore();
  // Heuristic classifier caps clean text below the 90 auto-publish bar → queue.
  const ugc = createUgc(config, { store, dashboard: store, classifier: new HeuristicClassifier() });
  return { store, ugc };
}

async function submitQueued(ugc: ReturnType<typeof createUgc>) {
  const res = await ugc.intake({
    raw: { title: "검수 대상 글", body: BODY },
    authorId: "author-1",
    ipHash: "ip-1",
    text: BODY,
  });
  if (res.stage !== "queued") throw new Error(`expected queued, got ${res.stage}`);
  return res.submission;
}

describe("review approve/reject", () => {
  it("approve publishes the queued submission and clears the queue", async () => {
    const { store, ugc } = setup();
    const sub = await submitQueued(ugc);
    expect(await store.moderationQueue("review-test", 10)).toHaveLength(1);

    const approved = await ugc.reviewApprove({
      submissionId: sub.id,
      text: BODY,
      resolvedBy: "admin",
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.content.status).toBe("published");
      expect(await store.getContentBySlug("review-test", approved.content.slug)).not.toBeNull();
    }
    expect(await store.moderationQueue("review-test", 10)).toHaveLength(0);
  });

  it("reject blocks the submission and clears the queue", async () => {
    const { store, ugc } = setup();
    const sub = await submitQueued(ugc);

    const rejected = await ugc.reviewReject({ submissionId: sub.id, resolvedBy: "admin" });
    expect(rejected.ok).toBe(true);
    expect((await store.getSubmission("review-test", sub.id))?.status).toBe("blocked");
    expect(await store.moderationQueue("review-test", 10)).toHaveLength(0);
  });

  it("refuses to approve twice (stale dashboard guard)", async () => {
    const { ugc } = setup();
    const sub = await submitQueued(ugc);
    await ugc.reviewApprove({ submissionId: sub.id, text: BODY, resolvedBy: "admin" });
    const again = await ugc.reviewApprove({ submissionId: sub.id, text: BODY, resolvedBy: "admin" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("not_queued");
  });

  it("approve on unknown id → not_found", async () => {
    const { ugc } = setup();
    const res = await ugc.reviewApprove({ submissionId: "nope", text: "x", resolvedBy: "a" });
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("engage promotion + report auto-hide", () => {
  it("a reaction persists the recomputed score and can promote noindex→indexed", async () => {
    const { store, ugc } = setup();
    const sub = await submitQueued(ugc);
    const approved = await ugc.reviewApprove({
      submissionId: sub.id,
      text: BODY,
      resolvedBy: "admin",
    });
    if (!approved.ok) throw new Error("approve failed");

    // Force the content below the index bar to test promotion.
    const demoted = await store.upsertContent({
      ...approved.content,
      contentScore: 10,
      indexed: false,
    });
    expect(demoted.indexed).toBe(false);

    const { promoted } = await ugc.engage(
      { contentId: demoted.id, kind: "reaction", authorId: "fan-1" },
      demoted,
      BODY,
    );
    expect(promoted).toBe(true);
    const after = await store.getContentBySlug("review-test", demoted.slug);
    expect(after?.indexed).toBe(true);
    expect(after?.reactions).toBe(1); // preserved through the upsert
  });

  it("3 reports auto-hide the content", async () => {
    const { store, ugc } = setup();
    const sub = await submitQueued(ugc);
    const approved = await ugc.reviewApprove({
      submissionId: sub.id,
      text: BODY,
      resolvedBy: "admin",
    });
    if (!approved.ok) throw new Error("approve failed");
    const { content } = approved;

    for (let i = 0; i < 3; i++) {
      await ugc.report({
        contentId: content.id,
        reason: `신고 사유 ${i}`,
        reporterId: `reporter-${i}`,
        url: content.url,
      });
    }
    const after = await store.getContentBySlug("review-test", content.slug);
    expect(after?.status).toBe("hidden");
  });
});
