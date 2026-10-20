// 통합 테스트용 사용자/프로필 생성 헬퍼 — 실제 앱과 같은 경로(withService 로 auth 사용자 생성, withUser 로 프로필 생성)
import { createLocalAnonymousUser } from "@/lib/auth/local";
import { withService, withUser, type Claims } from "@/lib/server/db";
import { createProfile } from "@/lib/server/repo";
import { onboardingSchema } from "@/lib/validation/profile";

export type TestUser = { id: string; claims: Claims };

let n = 0;
export async function makeUser(over: Partial<{ nickname: string; birthYear: number; sido: string; sigungu: string }> = {}): Promise<TestUser> {
  const id = await createLocalAnonymousUser();
  const claims: Claims = { sub: id, role: "authenticated", is_anonymous: true };
  n++;
  const input = onboardingSchema.parse({
    nickname: over.nickname ?? `테스트${n}`,
    birthYear: over.birthYear ?? 1995,
    sido: over.sido ?? "서울",
    sigungu: over.sigungu ?? "마포구",
    adultConfirmed: true,
    privacyConsent: true,
    sensitiveConsent: true,
  });
  await withUser(claims, (db) => createProfile(db, id, input));
  return { id, claims };
}

export function as<T>(u: TestUser, fn: Parameters<typeof withUser<T>>[1]) {
  return withUser(u.claims, fn);
}

export async function makeAdmin(u: TestUser): Promise<TestUser> {
  await withService(async (db) => {
    await db.query("update auth.users set is_anonymous = false, email = $2 where id = $1", [u.id, `${u.id}@admin.test`]);
    await db.query("insert into public.admin_roles (user_id, role) values ($1, 'admin')", [u.id]);
  });
  return { id: u.id, claims: { ...u.claims, is_anonymous: false } };
}
