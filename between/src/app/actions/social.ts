"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { REPORT_REASONS, values } from "@/lib/domain/options";
import { exploreFiltersSchema } from "@/lib/explore/filters";
import { asCurrentUser, run } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";
import * as repo from "@/lib/server/repo";
import { limitUser } from "@/lib/server/request";
import { cleanText } from "@/lib/validation/text";

const uuid = z.uuid("잘못된 요청이에요.");

const swipeSchema = z.object({ targetId: uuid, kind: z.enum(["like", "pass"]) });

export async function swipeAction(input: z.input<typeof swipeSchema>) {
  return run(async () => {
    const { targetId, kind } = swipeSchema.parse(input);
    return asCurrentUser(async (db, s) => {
      if (targetId === s.userId) throw new AppError("본인에게는 할 수 없어요.");
      // 봇·스팸 방지: 시간당 300회 스와이프, 좋아요는 시간당 120회
      await limitUser(db, "swipe", 300, 3600);
      if (kind === "like") await limitUser(db, "like", 120, 3600);
      return repo.swipe(db, s.userId, targetId, kind);
    });
  });
}

export async function undoSwipeAction(targetId: string) {
  return run(async () => {
    const id = uuid.parse(targetId);
    await asCurrentUser((db, s) => repo.undoSwipe(db, s.userId, id));
    return null;
  });
}

export async function unmatchAction(matchId: string) {
  return run(async () => {
    const id = uuid.parse(matchId);
    const ok = await asCurrentUser((db) => repo.unmatch(db, id));
    if (!ok) throw new AppError("이미 해제된 매칭이에요.");
    revalidatePath("/likes");
    return null;
  });
}

export async function blockAction(targetId: string) {
  return run(async () => {
    const id = uuid.parse(targetId);
    await asCurrentUser(async (db, s) => {
      if (id === s.userId) throw new AppError("본인은 차단할 수 없어요.");
      await limitUser(db, "block", 60, 3600);
      await repo.block(db, s.userId, id);
    });
    revalidatePath("/likes");
    return null;
  });
}

export async function unblockAction(targetId: string) {
  return run(async () => {
    const id = uuid.parse(targetId);
    await asCurrentUser((db, s) => repo.unblock(db, s.userId, id));
    revalidatePath("/me/blocked");
    return null;
  });
}

const reportSchema = z.object({
  targetId: uuid,
  reason: z.enum(values(REPORT_REASONS)),
  detail: z.string().max(500).transform(cleanText).optional(),
  alsoBlock: z.boolean().default(true),
});

export async function reportAction(input: z.input<typeof reportSchema>) {
  return run(async () => {
    const { targetId, reason, detail, alsoBlock } = reportSchema.parse(input);
    await asCurrentUser(async (db, s) => {
      if (targetId === s.userId) throw new AppError("본인은 신고할 수 없어요.");
      await limitUser(db, "report", 10, 3600);
      try {
        await repo.report(db, s.userId, targetId, reason, detail || null);
      } catch (e) {
        if ((e as { code?: string }).code === "23505")
          throw new AppError("이미 신고한 사용자예요. 운영팀이 검토 중이에요.");
        throw e;
      }
    });
    // 신고와 차단은 별도 트랜잭션: 신고가 저장된 뒤 차단
    if (alsoBlock) await asCurrentUser((db, s) => repo.block(db, s.userId, targetId));
    return null;
  });
}

const saveFilterSchema = z.object({
  name: z.string().transform(cleanText).pipe(z.string().min(1, "이름을 입력해 주세요.").max(20)),
  filters: exploreFiltersSchema,
});

export async function saveFilterAction(input: z.input<typeof saveFilterSchema>) {
  return run(async () => {
    const { name, filters } = saveFilterSchema.parse(input);
    await asCurrentUser((db, s) => repo.saveFilter(db, s.userId, name, filters));
    return null;
  });
}

export async function deleteFilterAction(id: string) {
  return run(async () => {
    await asCurrentUser((db, s) => repo.deleteSavedFilter(db, s.userId, uuid.parse(id)));
    return null;
  });
}
