/**
 * ActionFailure → 화면 반응 매핑 (순수 함수, vitest).
 *  - redirectTo 가 있으면 무조건 이동(15_auth §0-1)
 *  - NOT_VERIFIED → /verify · SANCTIONED → /suspended · NOT_AUTHENTICATED → /login
 *  - NOT_ENTITLED(field=superlike | undo) → 인라인 사유(압박 카피 없음, 구매 안내 없음)
 *  - ALREADY_ACTED → 조용히 목록 새로고침 · RATE_LIMITED → 토스트 + retryAfterSec
 */
import type { ActionFailure } from "@/lib/auth/errors";

export type FailureUx =
  | { kind: "redirect"; to: string }
  | { kind: "inline"; message: string; field: string }
  | { kind: "toast"; message: string; retryAfterSec?: number }
  | { kind: "refresh"; message: string | null };

export const UNDO_PLUS_NOTE = "되돌리기는 플러스에서 쓸 수 있어요";

export function mapFailure(f: ActionFailure, ctx: { surface?: "act" | "undo" | "seen" | "match" | "send" | "block" } = {}): FailureUx {
  if (f.redirectTo) return { kind: "redirect", to: f.redirectTo };
  switch (f.code) {
    case "NOT_AUTHENTICATED":
      return { kind: "redirect", to: "/login" };
    case "NOT_VERIFIED":
      return { kind: "redirect", to: "/verify" };
    case "SANCTIONED":
      return ctx.surface === "send" ? { kind: "toast", message: f.message } : { kind: "redirect", to: "/suspended" };
    case "NOT_ENTITLED":
      if (f.field === "superlike") return { kind: "inline", message: f.message, field: "superlike" };
      if (ctx.surface === "undo") return { kind: "inline", message: UNDO_PLUS_NOTE, field: "undo" };
      return { kind: "toast", message: f.message };
    case "ALREADY_ACTED":
      return ctx.surface === "undo" ? { kind: "inline", message: f.message, field: "undo" } : { kind: "refresh", message: null };
    case "NOT_FOUND":
      if (ctx.surface === "undo") return { kind: "inline", message: f.message, field: "undo" };
      return { kind: "refresh", message: f.message };
    case "RATE_LIMITED":
      return { kind: "toast", message: f.message, ...(f.retryAfterSec !== undefined ? { retryAfterSec: f.retryAfterSec } : {}) };
    case "INVALID_INPUT":
      return f.field ? { kind: "inline", message: f.message, field: f.field } : { kind: "toast", message: f.message };
    default:
      return { kind: "toast", message: f.message };
  }
}

/** 토스트 문구에 대기 초 붙이기 */
export function withRetry(message: string, retryAfterSec?: number): string {
  if (!retryAfterSec || retryAfterSec <= 0) return message;
  return `${message} (${retryAfterSec}초 후)`;
}
