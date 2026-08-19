"use server";

// =============================================================================
// D2 · 인증/온보딩 Server Actions
//
// 규약:
// - 각 액션은 zod 검증(schemas.ts) + 현재 profiles.onboarding_step 순서 강제.
//   순서 위반 시 { ok:false, code:"STEP_ORDER" } — E1 은 저장된 스텝 화면으로 보낸다.
// - 저장 성공 시 해당 스텝 진행 중이었다면 다음 스텝으로 자동 전진(재편집 시 유지).
// - 여기서는 anon 키 세션 클라이언트만 사용한다 — verify_level/birth_date/status
//   갱신(service role)은 lib/auth/verify.ts 로 분리 (SUPABASE_SERVICE_ROLE_KEY
//   비노출 원칙).
// - E1 규약: 액션 결과의 code 로 UI 분기하고, redirect 는 액션이 아닌 화면이 한다.
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@duckmate/db";
import {
  type ActionResult,
  fail,
  hasReachedStep,
  nextStepAfter,
  isAdultBirthDate,
  containsContactInfo,
  signUpSchema,
  signInSchema,
  saveHobbiesSchema,
  saveQuizAnswersSchema,
  saveDuckCardSchema,
  savePhotoSchema,
  saveModeSchema,
  type SignUpInput,
  type SignInInput,
  type SaveHobbiesInput,
  type SaveQuizAnswersInput,
  type SaveDuckCardInput,
  type SavePhotoInput,
  type SaveModeInput,
} from "./schemas";
import type { OnboardingStep } from "@duckmate/db";

// ---------------------------------------------------------------------------
// 내부 헬퍼 (export 아님 — "use server" 파일은 async 함수만 export 가능)
// ---------------------------------------------------------------------------

type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; profile: Profile };

async function getOwnProfile(): Promise<ActionResult<Ctx>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return fail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");

  return { ok: true, data: { supabase, profile: profile as Profile } };
}

/** 스텝 도달 검증 + 완료 후 전진값 계산 */
function checkStep(profile: Profile, required: OnboardingStep): ActionResult<OnboardingStep> {
  if (!hasReachedStep(profile.onboarding_step, required)) {
    return fail("STEP_ORDER", `이전 단계를 먼저 완료해야 해요. (현재: ${profile.onboarding_step})`);
  }
  return { ok: true, data: nextStepAfter(profile.onboarding_step, required) };
}

async function advanceStep(ctx: Ctx, next: OnboardingStep): Promise<void> {
  if (ctx.profile.onboarding_step === next) return;
  await ctx.supabase.from("profiles").update({ onboarding_step: next }).eq("id", ctx.profile.id);
}

// ---------------------------------------------------------------------------
// 가입 / 로그인 / 로그아웃
// ---------------------------------------------------------------------------

/**
 * 만 19세 이중(클라이언트+서버) 검증 후 가입.
 * signUp options.data 규약(D1→D2 ①): nickname · birth_date(YYYY-MM-DD) · gender 필수 —
 * handle_new_user() 가 profiles 를 만들고, 미성년이면 가입 트랜잭션 자체가 롤백된다.
 */
export async function signUpWithAge(input: SignUpInput): Promise<ActionResult<{ userId: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }
  const { email, password, nickname, birthDate, gender, regionCode } = parsed.data;

  // 서버측 연령 게이트 (게이트 1/3 — A5 §1.3): 미달 시 저장 시도 자체를 하지 않는다.
  if (!isAdultBirthDate(birthDate)) {
    return fail("UNDERAGE", "만 19세 이상부터 이용할 수 있어요.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname, birth_date: birthDate, gender }, // handle_new_user 규약 3키
    },
  });

  if (error) {
    if (error.message.includes("DUCKMATE_SIGNUP_UNDERAGE")) {
      // DB 트리거(게이트 최후 방어선) — auth.users 행도 남지 않는다
      return fail("UNDERAGE", "만 19세 이상부터 이용할 수 있어요.");
    }
    if (error.message.toLowerCase().includes("already registered")) {
      return fail("EMAIL_TAKEN", "이미 가입된 이메일이에요.");
    }
    return fail("AUTH_FAILED", error.message);
  }
  if (!data.user) return fail("AUTH_FAILED", "가입에 실패했어요. 잠시 후 다시 시도해 주세요.");

  // 세션이 즉시 발급된 경우(이메일 확인 비활성) region_code 저장 + age 스텝 완료 처리.
  // (region_code·onboarding_step 은 클라이언트 갱신 허용 컬럼 — D1 컬럼 권한)
  if (data.session) {
    await supabase
      .from("profiles")
      .update({ region_code: regionCode, onboarding_step: "phone" })
      .eq("user_id", data.user.id);
  }

  return { ok: true, data: { userId: data.user.id } };
}

export async function signIn(input: SignInInput): Promise<ActionResult<{ userId: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", "이메일과 비밀번호를 확인해 주세요.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return fail("AUTH_FAILED", "이메일 또는 비밀번호가 올바르지 않아요.");
  }
  return { ok: true, data: { userId: data.user.id } };
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 온보딩 스텝별 저장 액션 (스텝 순서: age→phone→hobbies→quiz→duckcard→photo→mode)
//   phone 스텝(OTP)은 별도 서버 경로에서 promotePhoneVerified 가 처리(verify.ts).
// ---------------------------------------------------------------------------

/** 취미 3~5개 + Top3 rank — 기존 선택 전량 교체 */
export async function saveHobbies(input: SaveHobbiesInput): Promise<ActionResult> {
  const parsed = saveHobbiesSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "취미 선택을 확인해 주세요.");
  }

  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const step = checkStep(ctx.profile, "hobbies");
  if (!step.ok) return step;

  // 전량 교체 (RLS: profile_hobbies 본인 CRUD)
  const { error: delError } = await ctx.supabase
    .from("profile_hobbies")
    .delete()
    .eq("profile_id", ctx.profile.id);
  if (delError) return fail("DB_ERROR", delError.message);

  const rows = parsed.data.hobbies.map((h) => ({
    profile_id: ctx.profile.id,
    hobby_id: h.hobbyId,
    intensity: h.intensity,
    rank: h.rank,
  }));
  const { error: insError } = await ctx.supabase.from("profile_hobbies").insert(rows);
  if (insError) return fail("DB_ERROR", insError.message);

  await advanceStep(ctx, step.data);
  return { ok: true, data: undefined };
}

/** 궁합 퀴즈 10문항 응답 — upsert (이전으로 돌아가 수정 가능) */
export async function saveQuizAnswers(input: SaveQuizAnswersInput): Promise<ActionResult> {
  const parsed = saveQuizAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "퀴즈 응답을 확인해 주세요.");
  }

  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const step = checkStep(ctx.profile, "quiz");
  if (!step.ok) return step;

  const rows = parsed.data.answers.map((a) => ({
    profile_id: ctx.profile.id,
    question_id: a.questionId,
    choice: a.choice,
  }));
  const { error } = await ctx.supabase
    .from("quiz_answers")
    .upsert(rows, { onConflict: "profile_id,question_id" });
  if (error) return fail("DB_ERROR", error.message);

  await advanceStep(ctx, step.data);
  return { ok: true, data: undefined };
}

/** 덕질카드 — 최애/요즘 빠진 것. 둘 다 null = '나중에 채우기'(스킵 허용 스텝) */
export async function saveDuckCard(input: SaveDuckCardInput): Promise<ActionResult> {
  const parsed = saveDuckCardSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "덕질카드를 확인해 주세요.");
  }
  const { favNote, currentObsession } = parsed.data;

  // 민감정보 프리체크 (12_flows §2.5 — 전화/이메일/URL/메신저ID 저장 거부)
  for (const text of [favNote, currentObsession]) {
    if (text && containsContactInfo(text)) {
      return fail("CONTACT_INFO_BLOCKED", "연락처·링크·SNS 계정은 카드에 적을 수 없어요.");
    }
  }

  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const step = checkStep(ctx.profile, "duckcard");
  if (!step.ok) return step;

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ fav_note: favNote, current_obsession: currentObsession })
    .eq("id", ctx.profile.id);
  if (error) return fail("DB_ERROR", error.message);

  await advanceStep(ctx, step.data);
  return { ok: true, data: undefined };
}

/**
 * 사진 Storage 경로 등록 — 업로드(Storage) 후 호출. review_status 는 DB 기본값
 * pending (클라이언트는 review_status 컬럼 권한 자체가 없다 — D1).
 * 경로 규약: photos/{profile_id}/{uuid}.webp — 본인 폴더만 허용(00006 RLS 와 동일).
 */
export async function savePhoto(input: SavePhotoInput): Promise<ActionResult<{ photoId: string }>> {
  const parsed = savePhotoSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "사진 경로가 올바르지 않아요.");
  }

  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const step = checkStep(ctx.profile, "photo");
  if (!step.ok) return step;

  // 경로의 {profile_id} 세그먼트가 본인이어야 한다
  const pathProfileId = parsed.data.path.split("/")[1];
  if (pathProfileId !== ctx.profile.id) {
    return fail("INVALID_INPUT", "본인 폴더(photos/{내 profile_id}/…)에만 등록할 수 있어요.");
  }

  const { data, error } = await ctx.supabase
    .from("photos")
    .insert({
      profile_id: ctx.profile.id,
      path: parsed.data.path,
      is_primary: parsed.data.isPrimary,
    })
    .select("id")
    .single();
  if (error) return fail("DB_ERROR", error.message);

  await advanceStep(ctx, step.data);
  return { ok: true, data: { photoId: (data as { id: string }).id } };
}

/**
 * 모드 선택 — dating 은 Lv2 미만이면 거부 (A5 §1.2 매트릭스).
 * E1 규약(12_flows §2.7): Lv<2 가 dating 을 고르면 friend 로 저장하고 /verify CTA 를
 * 노출하는 게 UX 기본값 — 이 액션은 dating 시도 자체를 거부하므로, E1 은
 * VERIFY_LEVEL_REQUIRED 코드를 받으면 friend 로 재호출한다.
 * 완료 시 onboarding_step=done (온보딩 종료).
 */
export async function saveMode(input: SaveModeInput): Promise<ActionResult> {
  const parsed = saveModeSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", "모드를 선택해 주세요.");

  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const step = checkStep(ctx.profile, "mode");
  if (!step.ok) return step;

  if (parsed.data.mode === "dating" && ctx.profile.verify_level < 2) {
    return fail("VERIFY_LEVEL_REQUIRED", "데이팅 모드는 본인인증 후 열려요.");
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ mode: parsed.data.mode, onboarding_step: "done" })
    .eq("id", ctx.profile.id);
  if (error) return fail("DB_ERROR", error.message);

  return { ok: true, data: undefined };
}

/**
 * 스킵 가능 스텝(duckcard '나중에 채우기', photo '사진 없이 시작')의 전진 전용 액션.
 * 현재 스텝에서 다음 스텝으로만 이동 — 임의 점프 불가.
 */
export async function advanceOnboardingStep(): Promise<ActionResult<{ step: OnboardingStep }>> {
  const ctxRes = await getOwnProfile();
  if (!ctxRes.ok) return ctxRes;
  const ctx = ctxRes.data;

  const current = ctx.profile.onboarding_step;
  if (current === "done") return { ok: true, data: { step: "done" } };
  // 스킵 전진이 허용되는 스텝: duckcard·photo 뿐 (12_flows §결정-4)
  if (current !== "duckcard" && current !== "photo") {
    return fail("STEP_ORDER", `이 단계(${current})는 건너뛸 수 없어요.`);
  }

  const next = nextStepAfter(current, current);
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ onboarding_step: next })
    .eq("id", ctx.profile.id);
  if (error) return fail("DB_ERROR", error.message);

  return { ok: true, data: { step: next } };
}
