"use client";

/**
 * ActionResult 공통 처리 (15_auth §0-1):
 *   redirectTo 있으면 무조건 이동 / field 있으면 인라인 오류 / RATE_LIMITED 면 토스트 + retryAfterSec / 그 외 토스트.
 *
 *   const { handle, pending, run } = useActionResult();
 *   const res = await run(() => saveBasic(input));
 *   handle(res, { onSuccess: (data) => …, onFieldError: (field, msg) => setErrors(…) })
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@duckmate/ui";
import type { ActionFailure, ActionResult } from "@/lib/auth/errors";
import { COPY } from "./copy";

export type HandleOptions<T> = {
  onSuccess?: (data: T) => void;
  onFieldError?: (field: string, message: string) => void;
  /** redirectTo 처리 전에 호출(이벤트 발화 등). true 를 돌려주면 기본 이동을 막는다 */
  onRedirect?: (to: string, failure: ActionFailure | null) => boolean | void;
  /** field 없는 실패의 기본 토스트를 막고 직접 처리 */
  onFailure?: (failure: ActionFailure) => boolean | void;
  /** router.replace 대신 push */
  push?: boolean;
};

export function useActionResult() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const go = useCallback(
    (to: string, push?: boolean) => {
      if (push) router.push(to);
      else router.replace(to);
    },
    [router],
  );

  const handle = useCallback(
    <T,>(res: ActionResult<T>, opts: HandleOptions<T> = {}): boolean => {
      if (res.ok) {
        opts.onSuccess?.(res.data);
        return true;
      }
      if (res.redirectTo) {
        const prevented = opts.onRedirect?.(res.redirectTo, res) === true;
        if (!prevented) go(res.redirectTo, opts.push);
        return false;
      }
      if (res.code === "RATE_LIMITED") {
        toast({ title: COPY.common.rateLimited(res.retryAfterSec ?? 60), variant: "error" });
        return false;
      }
      if (res.field && opts.onFieldError) {
        opts.onFieldError(res.field, res.message);
        return false;
      }
      if (opts.onFailure?.(res) === true) return false;
      toast({ title: res.message, variant: "error" });
      return false;
    },
    [go, toast],
  );

  /** pending 토글 + 네트워크 예외를 ActionFailure 로 변환 */
  const run = useCallback(async <T,>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
    setPending(true);
    try {
      return await fn();
    } catch {
      return { ok: false, code: "INTERNAL", message: COPY.common.network };
    } finally {
      setPending(false);
    }
  }, []);

  return { handle, run, pending, go };
}

/** 같은 오리진 경로만 허용(오픈 리다이렉트 방지) */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
