import { describe, expect, it } from "vitest";
import type { GateState } from "@duckmate/db";
import { checkActionAccess, decodeGateCookie, encodeGateCookie, evaluateGate, homeFor } from "./gate";
import { classifyRoute } from "./routes";
import { normalizeKrPhone } from "./otp";
import { ageYearsKst } from "../onboarding/schemas";
import { checkText } from "../onboarding/text-rules";

const base: GateState = {
  profileId: "p1",
  status: "active",
  onboardingStep: "done",
  verifyLevel: 2,
  mode: "friend",
  hasBirthDate: true,
  sanctionLevel: 0,
  deleteRequestedAt: null,
  hidden: false,
  role: null,
};
const s = (patch: Partial<GateState>): GateState => ({ ...base, ...patch });
const at = (path: string) => classifyRoute(path);
const redirectOf = (state: GateState | null, path: string): string | "allow" => {
  const r = evaluateGate(state, at(path));
  return r.allow ? "allow" : r.redirectTo;
};

describe("classifyRoute", () => {
  it("maps C3 route table", () => {
    expect(at("/home")).toEqual({ kind: "app", minLevel: 2 });
    expect(at("/chat/abc")).toEqual({ kind: "app", minLevel: 2 });
    expect(at("/me/edit")).toEqual({ kind: "app", minLevel: 1 });
    expect(at("/settings/verify")).toEqual({ kind: "app", minLevel: 1 });
    expect(at("/onboarding/hobbies")).toEqual({ kind: "onboarding", step: "hobbies" });
    expect(at("/onboarding/age")).toEqual({ kind: "auth", route: "age" });
    expect(at("/verify")).toEqual({ kind: "verify" });
    expect(at("/admin/reports")).toEqual({ kind: "admin" });
    expect(at("/legal/terms")).toEqual({ kind: "public" });
    expect(at("/")).toEqual({ kind: "public" });
  });
});

describe("evaluateGate order (C3 §0-3)", () => {
  it("① no session", () => {
    expect(redirectOf(null, "/home")).toBe("/login");
    expect(redirectOf(null, "/")).toBe("allow");
    expect(redirectOf(null, "/onboarding/age")).toBe("allow");
    expect(redirectOf(null, "/admin/photos")).toBe("/404");
  });
  it("② age_blocked", () => {
    const st = s({ status: "age_blocked", hasBirthDate: false });
    expect(redirectOf(st, "/home")).toBe("/blocked/age");
    expect(redirectOf(st, "/onboarding/age")).toBe("/blocked/age");
    expect(redirectOf(st, "/blocked/age")).toBe("allow");
  });
  it("③ banned / sanction ≥3 before deleting", () => {
    expect(redirectOf(s({ status: "banned" }), "/home")).toBe("/suspended");
    expect(redirectOf(s({ sanctionLevel: 3 }), "/me")).toBe("/suspended");
    expect(redirectOf(s({ sanctionLevel: 3 }), "/appeal")).toBe("allow");
    expect(redirectOf(s({ sanctionLevel: 2 }), "/home")).toBe("allow");
    expect(redirectOf(s({ status: "deleting", sanctionLevel: 4 }), "/account/restore")).toBe("/suspended");
  });
  it("④ deleting", () => {
    expect(redirectOf(s({ status: "deleting" }), "/home")).toBe("/account/restore");
    expect(redirectOf(s({ status: "deleting" }), "/account/restore")).toBe("allow");
  });
  it("⑤ birth date missing → /onboarding/age, step → /onboarding/{step} with back-revisit", () => {
    expect(redirectOf(s({ hasBirthDate: false, onboardingStep: "basic", verifyLevel: 1 }), "/home")).toBe("/onboarding/age");
    const st = s({ onboardingStep: "quiz", verifyLevel: 1 });
    expect(redirectOf(st, "/home")).toBe("/onboarding/quiz");
    expect(redirectOf(st, "/onboarding/basic")).toBe("allow"); // 이미 저장한 화면 재방문
    expect(redirectOf(st, "/onboarding/card")).toBe("/onboarding/quiz"); // 앞서가기 불가
    expect(redirectOf(st, "/verify")).toBe("/onboarding/quiz");
    expect(redirectOf(st, "/me")).toBe("/onboarding/quiz");
  });
  it("⑥ L2 route needs verify_level ≥2, L1 route ok at step verify", () => {
    const st = s({ onboardingStep: "verify", verifyLevel: 1 });
    expect(redirectOf(st, "/home")).toBe("/verify");
    expect(redirectOf(st, "/chat")).toBe("/verify");
    expect(redirectOf(st, "/me/edit")).toBe("allow");
    expect(redirectOf(st, "/verify")).toBe("allow");
    expect(redirectOf(st, "/onboarding/photos")).toBe("/verify"); // 완료 후 온보딩 접근 → 있어야 할 곳
  });
  it("⑦ pass + completed user bounced from auth/status screens", () => {
    expect(redirectOf(base, "/home")).toBe("allow");
    expect(redirectOf(base, "/verify")).toBe("/home");
    expect(redirectOf(base, "/login")).toBe("/home");
    expect(redirectOf(base, "/suspended")).toBe("/home");
    expect(redirectOf(base, "/onboarding/basic")).toBe("/home");
    expect(redirectOf(s({ status: "paused" }), "/home")).toBe("allow");
  });
  it("admin role", () => {
    expect(redirectOf(base, "/admin/users")).toBe("/404");
    expect(redirectOf(s({ role: "moderator" }), "/admin/users")).toBe("allow");
    expect(redirectOf(s({ role: "admin", onboardingStep: "basic", verifyLevel: 1 }), "/admin/users")).toBe("allow");
  });
  it("homeFor + checkActionAccess", () => {
    expect(homeFor(base)).toBe("/home");
    expect(homeFor(s({ verifyLevel: 1 }))).toBe("/verify");
    expect(homeFor(s({ onboardingStep: "hobbies", verifyLevel: 1 }))).toBe("/onboarding/hobbies");
    expect(checkActionAccess(s({ verifyLevel: 2 }), 3)).toEqual({ allow: false, code: "NOT_VERIFIED", redirectTo: "/verify" });
    expect(checkActionAccess(base, 2)).toEqual({ allow: true });
  });
});

describe("gate cookie", () => {
  it("round-trips and rejects tampering / wrong user / expiry", async () => {
    const secret = "test-secret";
    const c = await encodeGateCookie("u1", base, secret);
    expect(await decodeGateCookie(c, "u1", secret)).toEqual(base);
    expect(await decodeGateCookie(c, "u2", secret)).toBeNull();
    expect(await decodeGateCookie(c.slice(0, -2) + "zz", "u1", secret)).toBeNull();
    expect(await decodeGateCookie(c, "u1", secret, Date.now() + 61_000)).toBeNull();
    const [body] = c.split(".");
    expect(await decodeGateCookie(`${body}.deadbeef`, "u1", secret)).toBeNull();
  });
});

describe("otp / age / text rules", () => {
  it("normalizes KR mobile numbers", () => {
    expect(normalizeKrPhone("010-1234-5678")).toBe("+821012345678");
    expect(normalizeKrPhone("+82 10 1234 5678")).toBe("+821012345678");
    expect(normalizeKrPhone("821012345678")).toBe("+821012345678");
    expect(normalizeKrPhone("02-123-4567")).toBeNull();
    expect(normalizeKrPhone("0101234")).toBeNull();
  });
  it("computes 만 나이 at KST boundary", () => {
    const now = new Date("2026-09-01T16:00:00Z"); // = 2026-09-02 01:00 KST
    expect(ageYearsKst("2007-09-02", now)).toBe(19);
    expect(ageYearsKst("2007-09-03", now)).toBe(18);
  });
  it("catches contact patterns and banned words", () => {
    expect(checkText("서윤")).toBeNull();
    expect(checkText("010-1234-5678")).toMatchObject({ category: "CT" });
    expect(checkText("insta: my.handle")).toMatchObject({ category: "CT" });
    expect(checkText("카톡 abc123")).toMatchObject({ category: "CT" });
    expect(checkText("조건 만남 구함")).toMatchObject({ category: "BW" });
  });
});
