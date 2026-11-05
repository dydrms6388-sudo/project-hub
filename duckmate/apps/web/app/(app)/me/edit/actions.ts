"use server";

/**
 * /me/edit 전용 서버 액션. 온보딩 액션(saveBasic/saveHobbies/saveQuizAnswers/saveCard)은 lib/onboarding/actions 를 그대로 재사용하고,
 * 온보딩에 없는 bio 만 여기서 사용자 권한(RLS profiles_self_update)으로 갱신한다.
 */
import { z } from "zod";
import { BIO_MAX } from "@duckmate/db";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { checkText } from "@/lib/onboarding/text-rules";

const bioSchema = z.object({ bio: z.string().trim().max(BIO_MAX, `${BIO_MAX}자까지 쓸 수 있어요`) });

export async function updateBio(input: unknown): Promise<ActionResult<{ bio: string | null }>> {
  try {
    const parsed = bioSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message, { field: "bio" });
    const bio = parsed.data.bio.length > 0 ? parsed.data.bio : null;
    if (bio) {
      const hit = checkText(bio);
      if (hit) return fail("INVALID_INPUT", hit.category === "CT" ? "소개에는 연락처·SNS 계정을 넣을 수 없어요" : "소개에 쓸 수 없는 표현이 있어요", { field: "bio" });
    }
    const ctx = await requireProfileForAction(1);
    const { error } = await ctx.supabase.from("profiles").update({ bio }).eq("id", ctx.profileId);
    if (error) throw error;
    return ok({ bio });
  } catch (e) {
    return toActionFailure(e);
  }
}
