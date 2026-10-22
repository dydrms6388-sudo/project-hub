"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser, run } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";
import * as repo from "@/lib/server/repo";
import { cleanText } from "@/lib/validation/text";

const schema = z.object({
  target: z.uuid(),
  action: z.enum(["warn", "suspend", "ban", "hide_profile", "remove_photo", "restore", "dismiss_report"]),
  reason: z.string().max(500).transform(cleanText).nullable().default(null),
  hours: z.number().int().min(1).max(8760).nullable().default(null),
  reportId: z.uuid().nullable().default(null),
  photoId: z.uuid().nullable().default(null),
});

export async function moderateAction(input: z.input<typeof schema>) {
  return run(async () => {
    const a = schema.parse(input);
    await asCurrentUser(async (db) => {
      // 최종 권한 판단은 DB 함수 public.moderate() 가 수행 (admin_roles + 비익명 JWT)
      if (!(await repo.isAdmin(db))) throw new AppError("권한이 없어요.", 403);
      await repo.moderate(db, a);
    });
    revalidatePath("/admin");
    return null;
  });
}
