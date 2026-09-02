import { describe, expect, it } from "vitest";
import type { ActionFailure } from "@/lib/auth/errors";
import type { RealtimeMessagePayload } from "@/lib/chat/types";
import {
  dayLabel,
  groupByDay,
  hashId,
  isReciprocated,
  lengthBucket,
  makeOptimistic,
  mapSendFailure,
  mergeMessages,
  payloadToMessage,
  pickTopBanner,
  relativeLabel,
  sentToMessage,
  splitMasked,
  type UiMessage,
} from "./model";

const NOW = new Date("2026-09-02T15:30:00+09:00");

function msg(over: Partial<UiMessage> & { id: string; created_at: string }): UiMessage {
  return {
    match_id: "m",
    sender_id: "me",
    body: null,
    masked_body: "hi",
    display_body: "hi",
    image_path: null,
    suggestion_template_id: null,
    is_held: false,
    read_at: null,
    is_mine: true,
    ...over,
  };
}

describe("mergeMessages", () => {
  it("dedupes by id and sorts by created_at", () => {
    const a = msg({ id: "a", created_at: "2026-09-02T01:00:00Z" });
    const b = msg({ id: "b", created_at: "2026-09-02T02:00:00Z" });
    const out = mergeMessages([b], [a, b]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("replaces optimistic row by clientId when server row arrives (id changes)", () => {
    const opt = makeOptimistic({ matchId: "m", myProfileId: "me", body: "hello", clientId: "c1", now: new Date("2026-09-02T01:00:00Z") });
    const confirmed = sentToMessage(
      { id: "srv-1", matchId: "m", body: "hello", maskedBody: "hello", imagePath: null, isHeld: false, createdAt: "2026-09-02T01:00:01Z", contactMasked: false, warnContact: false, warnRules: [], offlineMeeting: false },
      "me",
      "c1",
    );
    const out = mergeMessages([opt], [confirmed]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("srv-1");
    expect(out[0]!.sendState).toBeUndefined();
    expect(out[0]!.clientId).toBe("c1");
  });
  it("keeps clientId/localImageUrl when realtime echo of same id arrives without them", () => {
    const mine = msg({ id: "x", created_at: "2026-09-02T01:00:00Z", clientId: "c9", localImageUrl: "blob:1" });
    const echo = payloadToMessage(
      { id: "x", match_id: "m", sender_id: "me", masked_body: "[사진]", image_path: "m/x.webp", suggestion_template_id: null, created_at: "2026-09-02T01:00:00Z", scam_signal: false },
      "me",
    );
    const out = mergeMessages([mine], [echo]);
    expect(out).toHaveLength(1);
    expect(out[0]!.clientId).toBe("c9");
    expect(out[0]!.localImageUrl).toBe("blob:1");
    expect(out[0]!.image_path).toBe("m/x.webp");
  });
  it("is stable for equal timestamps", () => {
    const a = msg({ id: "a", created_at: "2026-09-02T01:00:00Z" });
    const b = msg({ id: "b", created_at: "2026-09-02T01:00:00Z" });
    expect(mergeMessages([a, b], []).map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("payloadToMessage", () => {
  it("marks is_mine and uses masked_body for display", () => {
    const p: RealtimeMessagePayload = { id: "1", match_id: "m", sender_id: "them", masked_body: "[연락처 숨김]", image_path: null, suggestion_template_id: null, created_at: "2026-09-02T01:00:00Z", scam_signal: false };
    const m = payloadToMessage(p, "me");
    expect(m.is_mine).toBe(false);
    expect(m.display_body).toBe("[연락처 숨김]");
    expect(m.body).toBeNull();
  });
});

describe("dates", () => {
  it("dayLabel: today / yesterday / this year / other year", () => {
    expect(dayLabel("2026-09-02T09:00:00+09:00", NOW)).toBe("오늘");
    expect(dayLabel("2026-09-01T23:00:00+09:00", NOW)).toBe("어제");
    expect(dayLabel("2026-08-30T12:00:00+09:00", NOW)).toMatch(/^8월 30일 \(.\)$/);
    expect(dayLabel("2025-12-31T12:00:00+09:00", NOW)).toMatch(/^2025년 12월 31일/);
  });
  it("groupByDay inserts one separator per day", () => {
    const items = [
      msg({ id: "a", created_at: "2026-09-01T10:00:00+09:00" }),
      msg({ id: "b", created_at: "2026-09-01T11:00:00+09:00" }),
      msg({ id: "c", created_at: "2026-09-02T09:00:00+09:00" }),
    ];
    const g = groupByDay(items, NOW);
    expect(g.map((x) => x.type)).toEqual(["date", "msg", "msg", "date", "msg"]);
    expect(g[0]!.type === "date" && g[0]!.label).toBe("어제");
    expect(g[3]!.type === "date" && g[3]!.label).toBe("오늘");
  });
  it("relativeLabel buckets", () => {
    expect(relativeLabel("2026-09-02T15:29:40+09:00", NOW)).toBe("방금");
    expect(relativeLabel("2026-09-02T15:18:00+09:00", NOW)).toBe("12분 전");
    expect(relativeLabel("2026-09-02T12:00:00+09:00", NOW)).toBe("3시간 전");
    expect(relativeLabel("2026-09-01T12:00:00+09:00", NOW)).toBe("어제");
    expect(relativeLabel("2026-08-30T12:00:00+09:00", NOW)).toBe("3일 전");
    expect(relativeLabel(null, NOW)).toBe("");
  });
});

describe("splitMasked", () => {
  it("splits placeholders into chips", () => {
    const seg = splitMasked("제 번호는 [연락처 숨김] 이고 [링크 숨김]");
    expect(seg.map((s) => s.type)).toEqual(["text", "masked", "text", "masked"]);
    expect(seg[1]!.type === "masked" && seg[1]!.token).toBe("[연락처 숨김]");
  });
  it("plain text is one segment", () => {
    expect(splitMasked("안녕하세요")).toEqual([{ type: "text", text: "안녕하세요" }]);
  });
});

describe("mapSendFailure", () => {
  const f = (code: ActionFailure["code"], message: string, extra: Partial<ActionFailure> = {}): ActionFailure => ({ ok: false, code, message, ...extra });
  it("RATE_LIMITED detail codes → inline", () => {
    expect(mapSendFailure(f("RATE_LIMITED", "상대의 답장을 기다려 주세요"))).toMatchObject({ kind: "inline" });
    expect(mapSendFailure(f("RATE_LIMITED", "오늘은 이 대화에 더 보낼 수 없어요. 내일 다시 이야기해요"))).toMatchObject({ kind: "inline" });
    expect(mapSendFailure(f("RATE_LIMITED", "요청이 많아요", { retryAfterSec: 30 }))).toMatchObject({ kind: "inline", retryAfterSec: 30 });
  });
  it("NOT_ENTITLED → disable (ended / image)", () => {
    expect(mapSendFailure(f("NOT_ENTITLED", "대화가 종료되었어요"))).toEqual({ kind: "disable", message: "대화가 종료되었어요", reason: "ended" });
    expect(mapSendFailure(f("NOT_ENTITLED", "이미지는 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요"))).toMatchObject({ kind: "disable", reason: "image_not_allowed" });
  });
  it("SANCTIONED → /suspended, NOT_VERIFIED → /verify", () => {
    expect(mapSendFailure(f("SANCTIONED", "채팅이 24시간 제한됐어요"))).toEqual({ kind: "redirect", to: "/suspended", message: "채팅이 24시간 제한됐어요" });
    expect(mapSendFailure(f("NOT_VERIFIED", "x", { redirectTo: "/verify" }))).toMatchObject({ kind: "redirect", to: "/verify" });
  });
  it("INTERNAL → retry", () => {
    expect(mapSendFailure(f("INTERNAL", "잠시 문제가 생겼어요"))).toMatchObject({ kind: "retry" });
  });
});

describe("pickTopBanner", () => {
  const room = { partner_scam_banner: false, contact_unmasked: false, unmask_at: "2026-09-05T01:20:00Z", both_l3: true, my_contact_hits: 0, image_allowed: false, image_allowed_at: "2026-09-03T01:20:00Z" };
  it("scam wins over everything", () => {
    expect(pickTopBanner({ ...room, partner_scam_banner: true }, { guideSeen: false })).toEqual({ kind: "scam" });
    expect(pickTopBanner(room, { guideSeen: false, scamSignal: true })).toEqual({ kind: "scam" });
  });
  it("mask banner with repeated flag", () => {
    expect(pickTopBanner({ ...room, my_contact_hits: 3 }, { guideSeen: true })).toMatchObject({ kind: "mask", repeated: true });
    expect(pickTopBanner(room, { guideSeen: true, warnContact: true })).toMatchObject({ kind: "mask", repeated: true });
  });
  it("falls through: image → guide → null", () => {
    expect(pickTopBanner({ ...room, contact_unmasked: true }, { guideSeen: false })).toMatchObject({ kind: "image" });
    expect(pickTopBanner({ ...room, contact_unmasked: true, image_allowed: true }, { guideSeen: false })).toEqual({ kind: "guide" });
    expect(pickTopBanner({ ...room, contact_unmasked: true, image_allowed: true }, { guideSeen: true })).toBeNull();
    expect(pickTopBanner(room, { guideSeen: true, dismissed: ["mask", "image"] })).toBeNull();
  });
});

describe("misc", () => {
  it("hashId is deterministic 8-hex", () => {
    expect(hashId("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(hashId("abc")).toBe(hashId("abc"));
    expect(hashId("abc")).not.toBe(hashId("abd"));
  });
  it("lengthBucket", () => {
    expect(lengthBucket(5)).toBe("1-20");
    expect(lengthBucket(50)).toBe("21-80");
    expect(lengthBucket(150)).toBe("81-200");
    expect(lengthBucket(500)).toBe("200+");
  });
  it("isReciprocated ignores pending rows", () => {
    const mine = msg({ id: "a", created_at: "2026-09-02T01:00:00Z", is_mine: true });
    const theirs = msg({ id: "b", created_at: "2026-09-02T02:00:00Z", is_mine: false, sender_id: "them" });
    expect(isReciprocated([mine])).toBe(false);
    expect(isReciprocated([mine, theirs])).toBe(true);
    expect(isReciprocated([mine, { ...theirs, sendState: "sending" }])).toBe(false);
  });
});
