import { describe, expect, it } from "vitest";
import { pushPromptCooledDown, PUSH_PROMPT_COOLDOWN_DAYS } from "./push";

describe("pushPromptCooledDown (20_notifications §0-4 · 30일 재요청 금지)", () => {
  it("닫은 적 없으면 물어봐도 된다", () => {
    expect(pushPromptCooledDown(null, "2026-09-02")).toBe(true);
  });

  it("같은 날·29일째는 다시 묻지 않는다", () => {
    expect(pushPromptCooledDown("2026-09-02", "2026-09-02")).toBe(false);
    expect(pushPromptCooledDown("2026-09-02", "2026-10-01")).toBe(false);
  });

  it("30일째부터 다시 묻는다", () => {
    expect(pushPromptCooledDown("2026-09-02", "2026-10-02")).toBe(true);
    expect(PUSH_PROMPT_COOLDOWN_DAYS).toBe(30);
  });

  it("깨진 값은 차단하지 않는다(재요청 허용)", () => {
    expect(pushPromptCooledDown("nope", "2026-09-02")).toBe(true);
  });
});
