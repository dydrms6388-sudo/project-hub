"use server";

/**
 * 온보딩 단계별 서버 액션 (E1 이 "다음" 버튼에서 호출). C3 §2 저장 규칙.
 *
 *   saveBasic({ nickname, gender, regionCode, availability[] })  basic  → hobbies
 *   saveHobbies({ hobbies[{hobbyId, rank, intensity, favNote?}] }) hobbies → quiz   (전체 교체)
 *   saveQuizAnswers({ answers[{questionId, choice}] })             upsert, step 유지
 *   finishQuiz({ skipped })                                        quiz   → card
 *   saveCard({ nowInto, favNote? })                                card   → photos  (favNote = rank1)
 *   finishPhotos({ skipped })                                      photos → verify (+ onboarding_completed_at)
 *   getOnboardingSnapshot()                                        프리필용 현재 값
 *
 * 규칙
 *  - onboarding_step 은 **앞으로만** 간다(`update … where onboarding_step = from`). 이미 지난 화면 재저장은 값만 갱신.
 *  - 저장 후 nextStep/redirectTo 를 돌려주며, 클라이언트는 redirectTo 로 router.replace 한다.
 *  - 닉네임·최애·요즘 빠진 것은 CT_* · BW_* 서버 검사(text-rules.ts, D4 safety-rules 로 교체 예정).
 */
import { ONBOARDING_STEPS, ONBOARDING_STEP_ROUTES, NICKNAME_CHANGE_INTERVAL_DAYS } from "@duckmate/db";
import type { Enums } from "@duckmate/db";
import { AuthError, fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { invalidateGateCache, requireProfileForAction, type ActionContext } from "@/lib/auth/session";
import { ROUTES } from "@/lib/auth/routes";
import {
  basicSchema,
  cardSchema,
  finishPhotosSchema,
  finishQuizSchema,
  firstIssue,
  hobbiesSchema,
  quizAnswersSchema,
} from "@/lib/onboarding/schemas";
import { checkText, textRuleMessage } from "@/lib/onboarding/text-rules";

type Step = Enums["onboarding_step"];
type OnboardingScreen = Exclude<Step, "verify" | "done">;
const STEP_INDEX = Object.fromEntries(ONBOARDING_STEPS.map((s, i) => [s, i])) as Record<Step, number>;

export type StepResult = { nextStep: Step; redirectTo: string; advanced: boolean };

/** 해당 화면을 저장할 수 있는 상태인지(현재 step 이후 화면은 불가) */
async function contextForScreen(screen: OnboardingScreen): Promise<ActionContext> {
  const ctx = await requireProfileForAction(1, { allowOnboarding: true });
  if (!ctx.state.hasBirthDate) throw new AuthError("ONBOARDING_INCOMPLETE", undefined, { redirectTo: ROUTES.age });
  if (ctx.state.status !== "active") throw new AuthError("NOT_ENTITLED", undefined, { redirectTo: ROUTES.home });
  const current = ctx.state.onboardingStep;
  if (STEP_INDEX[screen] > STEP_INDEX[current]) {
    throw new AuthError("ONBOARDING_INCOMPLETE", undefined, { redirectTo: ONBOARDING_STEP_ROUTES[current] });
  }
  return ctx;
}

/** from → to 전진(뒤로가기 불가). 이미 지난 단계면 no-op */
async function advance(ctx: ActionContext, from: Step, to: Step): Promise<StepResult> {
  const current = ctx.state.onboardingStep;
  if (current !== from) {
    return { nextStep: current, redirectTo: ONBOARDING_STEP_ROUTES[current], advanced: false };
  }
  const patch: { onboarding_step: Step; onboarding_completed_at?: string } = { onboarding_step: to };
  if (to === "verify") patch.onboarding_completed_at = new Date().toISOString();
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", ctx.profileId).eq("onboarding_step", from);
  if (error) throw error;
  await invalidateGateCache();
  return { nextStep: to, redirectTo: ONBOARDING_STEP_ROUTES[to], advanced: true };
}

function invalid(error: Parameters<typeof firstIssue>[0]): ActionResult<never> {
  const { field, message } = firstIssue(error);
  return fail("INVALID_INPUT", message, { field });
}

// ---------------------------------------------------------------------------
// S3 기본 정보 + 활동 시간대
// ---------------------------------------------------------------------------
export async function saveBasic(input: unknown): Promise<ActionResult<StepResult>> {
  try {
    const parsed = basicSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { nickname, gender, regionCode, availability } = parsed.data;

    const hit = checkText(nickname);
    if (hit) return fail("INVALID_INPUT", textRuleMessage(hit, "닉네임"), { field: "nickname" });

    const ctx = await contextForScreen("basic");
    const { supabase, profileId } = ctx;

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("nickname, nickname_changed_at")
      .eq("id", profileId)
      .single();
    if (meErr) throw meErr;

    const changingExisting = me.nickname !== null && me.nickname !== nickname;
    if (changingExisting && me.nickname_changed_at) {
      const next = new Date(me.nickname_changed_at).getTime() + NICKNAME_CHANGE_INTERVAL_DAYS * 86_400_000;
      if (next > Date.now()) {
        return fail("NOT_ENTITLED", `닉네임은 30일에 한 번 바꿀 수 있어요 (다음 변경 가능일: ${new Date(next).toISOString().slice(0, 10)})`, { field: "nickname" });
      }
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        nickname,
        gender,
        region_code: regionCode,
        ...(changingExisting ? { nickname_changed_at: new Date().toISOString() } : {}),
      })
      .eq("id", profileId);
    if (upErr) {
      if (upErr.code === "23505") return fail("CONFLICT", "이미 사용 중인 닉네임이에요", { field: "nickname" });
      if (upErr.code === "23503") return fail("INVALID_INPUT", "지역을 다시 선택해 주세요", { field: "regionCode" });
      throw upErr;
    }

    // 활동 시간대 전체 교체 (중복 셀 제거)
    const cells = Array.from(new Map(availability.map((a) => [`${a.weekday}:${a.slot}`, a])).values());
    const { error: delErr } = await supabase.from("availability").delete().eq("profile_id", profileId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase
      .from("availability")
      .insert(cells.map((c) => ({ profile_id: profileId, weekday: c.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7, slot: c.slot })));
    if (insErr) throw insErr;

    return ok(await advance(ctx, "basic", "hobbies"));
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// S4 취미 3~5개 (전체 교체)
// ---------------------------------------------------------------------------
export async function saveHobbies(input: unknown): Promise<ActionResult<StepResult>> {
  try {
    const parsed = hobbiesSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const hobbies = parsed.data.hobbies;

    for (const h of hobbies) {
      if (h.favNote) {
        const hit = checkText(h.favNote);
        if (hit) return fail("INVALID_INPUT", textRuleMessage(hit, "최애"), { field: `hobbies.${h.rank}.favNote` });
      }
    }

    const ctx = await contextForScreen("hobbies");
    const { supabase, profileId } = ctx;

    const ids = hobbies.map((h) => h.hobbyId);
    const { data: valid, error: hErr } = await supabase.from("hobbies").select("id").in("id", ids).eq("is_active", true);
    if (hErr) throw hErr;
    if ((valid ?? []).length !== ids.length) return fail("INVALID_INPUT", "선택할 수 없는 취미가 있어요", { field: "hobbies" });

    const { error: delErr } = await supabase.from("profile_hobbies").delete().eq("profile_id", profileId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase.from("profile_hobbies").insert(
      hobbies.map((h) => ({
        profile_id: profileId,
        hobby_id: h.hobbyId,
        rank: h.rank as 1 | 2 | 3 | 4 | 5,
        intensity: h.intensity as 1 | 2 | 3 | 4 | 5,
        fav_note: h.favNote ?? null,
      })),
    );
    if (insErr) throw insErr;

    return ok(await advance(ctx, "hobbies", "quiz"));
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// S5 퀴즈: 답변마다 upsert, "나중에" 또는 10문항 완료 시 finishQuiz
// ---------------------------------------------------------------------------
export async function saveQuizAnswers(input: unknown): Promise<ActionResult<{ answered: number }>> {
  try {
    const parsed = quizAnswersSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const ctx = await contextForScreen("quiz");
    const { supabase, profileId } = ctx;
    const at = new Date().toISOString();
    const { error } = await supabase
      .from("quiz_answers")
      .upsert(
        parsed.data.answers.map((a) => ({ profile_id: profileId, question_id: a.questionId, choice: a.choice, answered_at: at })),
        { onConflict: "profile_id,question_id" },
      );
    if (error) {
      if (error.code === "23503") return fail("INVALID_INPUT", "없는 문항이에요", { field: "answers" });
      throw error;
    }
    const { count } = await supabase.from("quiz_answers").select("question_id", { count: "exact", head: true }).eq("profile_id", profileId);
    return ok({ answered: count ?? 0 });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function finishQuiz(input: unknown = {}): Promise<ActionResult<StepResult & { skipped: boolean; answered: number }>> {
  try {
    const parsed = finishQuizSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const ctx = await contextForScreen("quiz");
    const { count } = await ctx.supabase.from("quiz_answers").select("question_id", { count: "exact", head: true }).eq("profile_id", ctx.profileId);
    const step = await advance(ctx, "quiz", "card");
    return ok({ ...step, skipped: parsed.data.skipped, answered: count ?? 0 });
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// S6-a 덕질 카드
// ---------------------------------------------------------------------------
export async function saveCard(input: unknown): Promise<ActionResult<StepResult>> {
  try {
    const parsed = cardSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { nowInto, favNote } = parsed.data;

    const hitNow = checkText(nowInto);
    if (hitNow) return fail("INVALID_INPUT", textRuleMessage(hitNow, "요즘 빠진 것"), { field: "nowInto" });
    if (favNote) {
      const hitFav = checkText(favNote);
      if (hitFav) return fail("INVALID_INPUT", textRuleMessage(hitFav, "최애"), { field: "favNote" });
    }

    const ctx = await contextForScreen("card");
    const { supabase, profileId } = ctx;
    const { error: pErr } = await supabase.from("profiles").update({ now_into: nowInto }).eq("id", profileId);
    if (pErr) throw pErr;
    const { error: hErr } = await supabase.from("profile_hobbies").update({ fav_note: favNote }).eq("profile_id", profileId).eq("rank", 1);
    if (hErr) throw hErr;

    return ok(await advance(ctx, "card", "photos"));
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// S6-b 사진: 완료/나중에 → verify (온보딩 6화면 완료). 사진 업로드 자체는 lib/photos/actions.ts
// ---------------------------------------------------------------------------
export async function finishPhotos(input: unknown = {}): Promise<ActionResult<StepResult & { skipped: boolean; counts: { hobbies: number; quiz: number; photos: number } }>> {
  try {
    const parsed = finishPhotosSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const ctx = await contextForScreen("photos");
    const { supabase, profileId } = ctx;
    const [h, q, p] = await Promise.all([
      supabase.from("profile_hobbies").select("hobby_id", { count: "exact", head: true }).eq("profile_id", profileId),
      supabase.from("quiz_answers").select("question_id", { count: "exact", head: true }).eq("profile_id", profileId),
      supabase.from("photos").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
    ]);
    const step = await advance(ctx, "photos", "verify");
    return ok({
      ...step,
      redirectTo: step.advanced ? ROUTES.verify : step.redirectTo,
      skipped: parsed.data.skipped,
      counts: { hobbies: h.count ?? 0, quiz: q.count ?? 0, photos: p.count ?? 0 },
    });
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// 프리필 스냅샷 (재진입·뒤로가기)
// ---------------------------------------------------------------------------
export type OnboardingSnapshot = {
  step: Step;
  profile: { nickname: string | null; gender: Enums["gender"] | null; regionCode: string | null; nowInto: string | null };
  availability: Array<{ weekday: number; slot: Enums["availability_slot"] }>;
  hobbies: Array<{ hobbyId: number; rank: number; intensity: number; favNote: string | null }>;
  quizAnswered: number[];
  photos: Array<{ id: string; path: string; isPrimary: boolean; reviewStatus: Enums["review_status"] }>;
};

export async function getOnboardingSnapshot(): Promise<ActionResult<OnboardingSnapshot>> {
  try {
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    const { supabase, profileId } = ctx;
    const [prof, av, hb, qz, ph] = await Promise.all([
      supabase.from("profiles").select("nickname, gender, region_code, now_into").eq("id", profileId).single(),
      supabase.from("availability").select("weekday, slot").eq("profile_id", profileId),
      supabase.from("profile_hobbies").select("hobby_id, rank, intensity, fav_note").eq("profile_id", profileId).order("rank"),
      supabase.from("quiz_answers").select("question_id").eq("profile_id", profileId),
      supabase.from("photos").select("id, path, is_primary, review_status").eq("profile_id", profileId).order("sort_order"),
    ]);
    if (prof.error) throw prof.error;
    return ok({
      step: ctx.state.onboardingStep,
      profile: { nickname: prof.data.nickname, gender: prof.data.gender, regionCode: prof.data.region_code, nowInto: prof.data.now_into },
      availability: (av.data ?? []).map((a) => ({ weekday: a.weekday, slot: a.slot })),
      hobbies: (hb.data ?? []).map((h) => ({ hobbyId: h.hobby_id, rank: h.rank, intensity: h.intensity, favNote: h.fav_note })),
      quizAnswered: (qz.data ?? []).map((q) => q.question_id),
      photos: (ph.data ?? []).map((p) => ({ id: p.id, path: p.path, isPrimary: p.is_primary, reviewStatus: p.review_status })),
    });
  } catch (e) {
    return toActionFailure(e);
  }
}
