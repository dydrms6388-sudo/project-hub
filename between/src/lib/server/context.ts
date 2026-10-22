import "server-only";
import { ZodError } from "zod";
import { requireSession, type Session } from "@/lib/auth/session";
import { fieldErrors } from "@/lib/validation/profile";
import { withUser, type Db } from "./db";
import { AuthError, toUserMessage, type ActionResult } from "./errors";

/** 현재 세션 사용자 권한(RLS)으로 DB 작업 */
export async function asCurrentUser<T>(fn: (db: Db, s: Session) => Promise<T>): Promise<T> {
  const s = await requireSession();
  return withUser(s.claims, (db) => fn(db, s));
}

/** Server Action 공통 래퍼: 예외 → 사용자 메시지 (내부 정보 비노출) */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      const fe = fieldErrors(e);
      return { ok: false, error: Object.values(fe)[0] ?? "입력값을 확인해 주세요.", fieldErrors: fe };
    }
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return { ok: false, error: toUserMessage(e) };
  }
}
