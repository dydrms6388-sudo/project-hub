"use server";

/**
 * 재동의 저장 (ReconsentGate 가 호출). 문서별 consents 새 행: key='reconsent', document_key=<doc>, source='banner' (15_auth 결정 22).
 */
import { headers } from "next/headers";
import { z } from "zod";
import { recordConsent } from "@/lib/auth/consents";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { clientIp } from "@/lib/auth/otp";
import { getSession } from "@/lib/auth/session";

const schema = z.object({
  documentKeys: z.array(z.enum(["terms", "privacy", "youth", "location", "refund", "marketing", "business"])).min(1).max(7),
});

export async function acceptReconsent(input: unknown): Promise<ActionResult<{ accepted: number }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", "동의할 문서를 확인해 주세요", { field: "documentKeys" });
    const { supabase, user } = await getSession();
    if (!user) return fail("NOT_AUTHENTICATED", undefined, { redirectTo: "/login" });
    const h = await headers();
    const ctx = { ip: clientIp(h), userAgent: h.get("user-agent") };
    for (const doc of parsed.data.documentKeys) {
      await recordConsent(supabase, user.id, "reconsent", true, "banner", ctx, doc);
    }
    return ok({ accepted: parsed.data.documentKeys.length });
  } catch (e) {
    return toActionFailure(e);
  }
}
