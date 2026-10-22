"use server";

import { z } from "zod";
import { findUserByRecoveryCode, generateRecoveryCode, saveRecoveryCode } from "@/lib/auth/local";
import {
  deleteAuthUser,
  endSession,
  getSession,
  requireSession,
  setLocalSessionCookie,
  startAnonymousSession,
} from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase";
import { asCurrentUser, run } from "@/lib/server/context";
import { withUser } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { allPhotoPaths, createProfile, getMyProfile } from "@/lib/server/repo";
import { limitIp, limitUser } from "@/lib/server/request";
import { storage } from "@/lib/storage";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/profile";

/** 첫 방문: 성인 확인 + 동의 + 최소 정보 → 익명 세션 + 프로필 생성 */
export async function startAction(input: OnboardingInput) {
  return run(async () => {
    const data = onboardingSchema.parse(input);
    await limitIp("start", env().START_RATE_LIMIT_PER_HOUR, 3600);
    // 이미 익명 세션이 있으면(프로필만 없는 경우) 그 세션을 재사용
    let session = await getSession();
    if (session) {
      const existing = await withUser(session.claims, (db) => getMyProfile(db, session!.userId));
      if (existing) return { redirect: "/explore" };
    } else {
      session = await startAnonymousSession();
    }
    await withUser(session.claims, (db) => createProfile(db, session!.userId, data));
    return { redirect: "/explore" };
  });
}

/** 복구 코드 발급 (local 드라이버). 기존 코드는 무효화된다. 평문은 이 응답에서 한 번만 보여준다 */
export async function issueRecoveryCodeAction() {
  return run(async () => {
    if (env().AUTH_PROVIDER !== "local") throw new AppError("이 환경에서는 이메일 연결을 사용해 주세요.");
    const s = await requireSession();
    await withUser(s.claims, (db) => limitUser(db, "recovery-code", 5, 3600));
    const code = generateRecoveryCode();
    await saveRecoveryCode(s.userId, code);
    return { code };
  });
}

const restoreSchema = z.object({ code: z.string().trim().min(10).max(40) });

export async function restoreAction(input: { code: string }) {
  return run(async () => {
    if (env().AUTH_PROVIDER !== "local") throw new AppError("이메일 로그인 링크로 복구해 주세요.");
    const { code } = restoreSchema.parse(input);
    await limitIp("restore", 10, 3600);
    const userId = await findUserByRecoveryCode(code);
    if (!userId) throw new AppError("복구 코드가 올바르지 않아요.");
    await setLocalSessionCookie(userId);
    return { redirect: "/explore" };
  });
}

const emailSchema = z.object({ email: z.email("이메일 주소를 확인해 주세요.").max(254) });

/** Supabase: 익명 계정에 이메일을 연결해 영구 계정으로 전환 (선택) */
export async function linkEmailAction(input: { email: string }) {
  return run(async () => {
    if (env().AUTH_PROVIDER !== "supabase") throw new AppError("이 환경에서는 복구 코드를 사용해 주세요.");
    const { email } = emailSchema.parse(input);
    const s = await requireSession();
    await withUser(s.claims, (db) => limitUser(db, "link-email", 3, 3600));
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${env().APP_ORIGIN}/auth/callback?next=/me` },
    );
    if (error) throw new AppError("이메일 연결 요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    return null;
  });
}

/** Supabase: 연결된 이메일로 로그인 링크 발송 (새 계정은 만들지 않음) */
export async function emailRestoreAction(input: { email: string }) {
  return run(async () => {
    if (env().AUTH_PROVIDER !== "supabase") throw new AppError("이 환경에서는 복구 코드를 사용해 주세요.");
    const { email } = emailSchema.parse(input);
    await limitIp("email-restore", 5, 3600);
    const supabase = await supabaseServer();
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${env().APP_ORIGIN}/auth/callback?next=/explore` },
    });
    // 계정 존재 여부를 노출하지 않도록 항상 같은 응답
    return null;
  });
}

export async function signOutAction() {
  return run(async () => {
    await endSession();
    return { redirect: "/" };
  });
}

const deleteSchema = z.object({ confirm: z.literal("삭제", { error: "'삭제' 를 입력해 주세요." }) });

/** 개인정보 완전 삭제: 사진 파일 → auth 사용자(cascade) → 세션 */
export async function deleteAccountAction(input: { confirm: string }) {
  return run(async () => {
    deleteSchema.parse(input);
    const s = await requireSession();
    const paths = await asCurrentUser((db) => allPhotoPaths(db, s.userId));
    await deleteAuthUser(s.userId);
    await storage.remove(paths).catch((e) => console.error("[between] storage cleanup failed", e));
    await endSession();
    return { redirect: "/" };
  });
}
