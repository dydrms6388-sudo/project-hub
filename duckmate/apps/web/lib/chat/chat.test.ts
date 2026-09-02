import { describe, expect, it } from "vitest";
import { chatErrorMessage, chatImagePath } from "./types";
import { createDeduper, createStatusTracker } from "./realtime";

describe("chat helpers", () => {
  it("chatErrorMessage maps RPC detail tokens", () => {
    expect(chatErrorMessage("WAIT_FOR_REPLY", "x")).toBe("상대의 답장을 기다려 주세요");
    expect(chatErrorMessage("MATCH_LEFT", "x")).toBe("대화가 종료되었어요");
    expect(chatErrorMessage("IMAGE_NOT_ALLOWED", "x")).toContain("24시간");
    expect(chatErrorMessage("something else", "fallback")).toBe("fallback");
    expect(chatErrorMessage(undefined, "fallback")).toBe("fallback");
  });
  it("chatImagePath", () => {
    expect(chatImagePath("m", "x")).toBe("m/x.webp");
  });
  it("deduper drops repeats and evicts oldest", () => {
    const d = createDeduper(2);
    expect(d.seen("a")).toBe(false);
    expect(d.seen("a")).toBe(true);
    expect(d.seen("b")).toBe(false);
    expect(d.seen("c")).toBe(false); // evicts a
    expect(d.seen("a")).toBe(false);
    expect(d.size()).toBe(2);
  });
  it("status tracker: connected → polling → connected triggers one resync", () => {
    const statuses: string[] = [];
    let resync = 0;
    const track = createStatusTracker((s) => statuses.push(s), () => resync++);
    track("SUBSCRIBED");
    track("CHANNEL_ERROR");
    track("TIMED_OUT");
    track("SUBSCRIBED");
    expect(statuses).toEqual(["connected", "polling", "connected"]);
    expect(resync).toBe(1);
  });
  it("status tracker: first connect does not resync", () => {
    let resync = 0;
    const track = createStatusTracker(undefined, () => resync++);
    track("SUBSCRIBED");
    expect(resync).toBe(0);
  });
});
