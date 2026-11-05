import { describe, expect, it } from "vitest";
import { mapFailure, UNDO_PLUS_NOTE, withRetry } from "./errors";

const f = (code: Parameters<typeof mapFailure>[0]["code"], extra: Partial<Parameters<typeof mapFailure>[0]> = {}) =>
  ({ ok: false as const, code, message: extra.message ?? "msg", ...extra });

describe("mapFailure", () => {
  it("redirectTo 우선", () => {
    expect(mapFailure(f("NOT_ENTITLED", { redirectTo: "/settings/verify" }))).toEqual({ kind: "redirect", to: "/settings/verify" });
  });
  it("NOT_VERIFIED → /verify, SANCTIONED → /suspended, NOT_AUTHENTICATED → /login", () => {
    expect(mapFailure(f("NOT_VERIFIED"))).toEqual({ kind: "redirect", to: "/verify" });
    expect(mapFailure(f("SANCTIONED"))).toEqual({ kind: "redirect", to: "/suspended" });
    expect(mapFailure(f("NOT_AUTHENTICATED"))).toEqual({ kind: "redirect", to: "/login" });
  });
  it("슈퍼라이크 소진은 인라인 사유(구매 안내 없음)", () => {
    const r = mapFailure(f("NOT_ENTITLED", { field: "superlike", message: "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전" }));
    expect(r).toEqual({ kind: "inline", field: "superlike", message: "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전" });
  });
  it("되돌리기 무료 → 플러스 안내 인라인, 만료/매칭됨도 인라인", () => {
    expect(mapFailure(f("NOT_ENTITLED"), { surface: "undo" })).toEqual({ kind: "inline", field: "undo", message: UNDO_PLUS_NOTE });
    expect(mapFailure(f("NOT_FOUND", { message: "되돌릴 수 있는 시간(5분)이 지났어요" }), { surface: "undo" })).toMatchObject({ kind: "inline", field: "undo" });
    expect(mapFailure(f("ALREADY_ACTED"), { surface: "undo" })).toMatchObject({ kind: "inline", field: "undo" });
  });
  it("ALREADY_ACTED(액션) → 조용히 새로고침, NOT_FOUND → 새로고침+문구", () => {
    expect(mapFailure(f("ALREADY_ACTED"), { surface: "act" })).toEqual({ kind: "refresh", message: null });
    expect(mapFailure(f("NOT_FOUND", { message: "오늘 추천에 없는 상대예요" }))).toEqual({ kind: "refresh", message: "오늘 추천에 없는 상대예요" });
  });
  it("RATE_LIMITED → 토스트 + retryAfterSec", () => {
    expect(mapFailure(f("RATE_LIMITED", { retryAfterSec: 42 }))).toEqual({ kind: "toast", message: "msg", retryAfterSec: 42 });
    expect(withRetry("요청이 많아요", 42)).toBe("요청이 많아요 (42초 후)");
    expect(withRetry("요청이 많아요")).toBe("요청이 많아요");
  });
  it("채팅 전송 SANCTIONED 는 리다이렉트 대신 토스트(읽기 가능 상태 유지)", () => {
    expect(mapFailure(f("SANCTIONED", { message: "채팅이 24시간 제한됐어요" }), { surface: "send" })).toEqual({ kind: "toast", message: "채팅이 24시간 제한됐어요" });
  });
  it("알 수 없는 코드는 토스트", () => {
    expect(mapFailure(f("INTERNAL"))).toEqual({ kind: "toast", message: "msg" });
  });
});
