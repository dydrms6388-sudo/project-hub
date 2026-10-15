import { describe, expect, it } from "vitest";
import { stepTimer, track } from "./track";

describe("analytics track (server no-op)", () => {
  it("does not throw outside the browser", () => {
    expect(() => track("onboarding_step_completed", { step: "basic" })).not.toThrow();
  });
  it("stepTimer measures elapsed ms", () => {
    let t = 1000;
    const timer = stepTimer(() => t);
    t = 1500;
    expect(timer.elapsed()).toBe(500);
    timer.reset();
    expect(timer.elapsed()).toBe(0);
  });
});
