"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONTACT_KINDS, values } from "@/lib/domain/options";
import { asCurrentUser, run } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";
import * as repo from "@/lib/server/repo";
import { limitUser } from "@/lib/server/request";
import { storage } from "@/lib/storage";
import { validateContact } from "@/lib/validation/contact";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/profile";

const uuid = z.uuid();

export async function updateProfileAction(input: ProfileUpdateInput) {
  return run(async () => {
    const data = profileUpdateSchema.parse(input);
    await asCurrentUser(async (db, s) => {
      await limitUser(db, "profile-update", 30, 3600);
      await repo.updateProfile(db, s.userId, data);
    });
    revalidatePath("/me");
    return null;
  });
}

export async function setHiddenAction(hidden: boolean) {
  return run(async () => {
    await asCurrentUser((db, s) => repo.setHidden(db, s.userId, z.boolean().parse(hidden)));
    revalidatePath("/me");
    return null;
  });
}

const activitySchema = z.object({
  status: z.enum(["now", "tonight", "weekend", "flexible", "off"]),
  hours: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6)]).nullable().default(null),
});

export async function setActivityAction(input: z.input<typeof activitySchema>) {
  return run(async () => {
    const { status, hours } = activitySchema.parse(input);
    await asCurrentUser(async (db, s) => {
      await limitUser(db, "activity", 60, 3600);
      await repo.setActivity(db, s.userId, status, hours);
    });
    revalidatePath("/me");
    return null;
  });
}

const contactSchema = z.object({
  kind: z.enum(values(CONTACT_KINDS)),
  value: z.string().max(300),
  visibility: z.enum(["public", "matches"]),
});

export async function upsertContactAction(input: z.input<typeof contactSchema>) {
  return run(async () => {
    const { kind, value, visibility } = contactSchema.parse(input);
    // 서버에서 검증·정규화한 URL 만 저장 (클라이언트 검증은 UX 용)
    const v = validateContact(kind, value);
    if (!v.ok) throw new AppError(v.error);
    await asCurrentUser(async (db, s) => {
      await limitUser(db, "contact", 30, 3600);
      await repo.upsertContact(db, s.userId, kind, v.url, visibility);
    });
    revalidatePath("/me");
    return { url: v.url };
  });
}

export async function deleteContactAction(kind: string) {
  return run(async () => {
    const k = z.enum(values(CONTACT_KINDS)).parse(kind);
    await asCurrentUser((db, s) => repo.deleteContact(db, s.userId, k));
    revalidatePath("/me");
    return null;
  });
}

export async function deletePhotoAction(photoId: string) {
  return run(async () => {
    const id = uuid.parse(photoId);
    const path = await asCurrentUser((db, s) => repo.deletePhoto(db, s.userId, id));
    if (path) await storage.remove([path]);
    revalidatePath("/me");
    return null;
  });
}

export async function makePrimaryPhotoAction(photoId: string) {
  return run(async () => {
    const id = uuid.parse(photoId);
    await asCurrentUser((db, s) => repo.makePrimaryPhoto(db, s.userId, id));
    revalidatePath("/me");
    return null;
  });
}

export async function setPhotoVisibilityAction(photoId: string, visibility: "public" | "matches") {
  return run(async () => {
    const id = uuid.parse(photoId);
    const vis = z.enum(["public", "matches"]).parse(visibility);
    await asCurrentUser((db, s) => repo.setPhotoVisibility(db, s.userId, id, vis));
    revalidatePath("/me");
    return null;
  });
}
